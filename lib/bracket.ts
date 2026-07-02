import { db } from "./db";

// ---------------------------------------------------------------------------
// Domain types (see CONTEXT.md). A Bracket is the single-elimination tree; each
// Match has two Slots, each holding a resolved Team or an unresolved placeholder.
// ---------------------------------------------------------------------------

export type RoundCode = "F" | "SF" | "QF" | "R16" | "R32";

export type TeamSlot =
  | {
      resolved: true;
      name: string;
      fifaCode: string | null;
      flag: string | null;
      group: string | null;
      confed: string | null;
    }
  | { resolved: false; label: string };

export type MatchNode = {
  kind: "match";
  num: number;
  round: string;
  roundCode: RoundCode;
  date: string | null;
  time: string | null;
  ground: string | null;
  slots: [TeamSlot, TeamSlot];
  score: [number, number] | null;
  pens: [number, number] | null;
  winner: string | null;
  played: boolean;
  isNext: boolean;
  children: BracketChild[];
};

export type TeamRef = { name: string; flag: string | null };

// The match a team faces next after their current result. `opponent` is set once
// the opponent is decided; otherwise `potentials` lists who it could be.
export type NextUp = {
  stage: string;
  date: string | null;
  opponent: TeamRef | null;
  potentials: TeamRef[];
};

export type TeamStatus = "upcoming" | "advanced" | "eliminated" | "champion";

export type TeamLeaf = {
  kind: "team";
  slot: TeamSlot;
  matchNum: number;
  side: 0 | 1;
  opponent: TeamSlot;
  date: string | null;
  played: boolean;
  score: [number, number] | null; // [thisTeam, opponent]
  result: "W" | "L" | null;
  status: TeamStatus;
  reachedStage: string | null; // round they have advanced to (or "Champions")
  next: NextUp | null; // their next match, for teams that have advanced
};

export type BracketChild = MatchNode | TeamLeaf;

export type NextMatch = {
  num: number;
  round: string;
  date: string | null;
  time: string | null;
  slots: [TeamSlot, TeamSlot];
};

export type Bracket = {
  root: MatchNode; // the Final, at the center of the sunburst
  nextMatchNum: number | null;
  nextMatch: NextMatch | null;
};

// ---------------------------------------------------------------------------
// Raw row shapes
// ---------------------------------------------------------------------------

type MatchRow = {
  num: number;
  round: string;
  round_code: string;
  date: string | null;
  time: string | null;
  ground: string | null;
  slot1_raw: string | null;
  slot2_raw: string | null;
  team1: string | null;
  team2: string | null;
  feeder1: number | null;
  feeder2: number | null;
  feeder1_kind: string | null;
  feeder2_kind: string | null;
  score1: number | null;
  score2: number | null;
  pen1: number | null;
  pen2: number | null;
  winner: string | null;
  loser: string | null;
  played: number;
};

type TeamRow = {
  name: string;
  fifa_code: string | null;
  flag: string | null;
  grp: string | null;
  confed: string | null;
  continent: string | null;
};

// ---------------------------------------------------------------------------
// Build the bracket tree rooted at the Final (#104), excluding the 3rd-place
// match, which sits outside the converging tree.
// ---------------------------------------------------------------------------

const FINAL_MATCH = 104;

// Parse a kickoff like ("2026-06-29", "16:30 UTC-4") into a UTC epoch (ms), or null.
// Times across host cities span several zones, so the soonest kickoff is not the
// lowest match number — it must be compared as an absolute instant.
function kickoffMs(date: string | null, time: string | null): number | null {
  if (!date || !time) return null;
  const m = /^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/.exec(time.trim());
  if (!m) return null;
  const off = Number(m[3]);
  const sign = off < 0 ? "-" : "+";
  const abs = String(Math.abs(off)).padStart(2, "0");
  const t = new Date(
    `${date}T${m[1].padStart(2, "0")}:${m[2]}:00${sign}${abs}:00`,
  ).getTime();
  return Number.isNaN(t) ? null : t;
}

export function getBracket(): Bracket {
  const d = db();
  const matchRows = d.prepare("SELECT * FROM matches").all() as MatchRow[];
  const teamRows = d.prepare("SELECT * FROM teams").all() as TeamRow[];

  const teamByName = new Map(teamRows.map((t) => [t.name, t]));
  const byNum = new Map(matchRows.map((m) => [m.num, m]));

  // The next match: the soonest-by-kickoff unplayed match still in the future.
  const now = Date.now();
  const nextMatchNum =
    matchRows
      .filter((m) => m.round_code !== "3P" && m.played === 0)
      .map((m) => ({ m, k: kickoffMs(m.date, m.time) }))
      .filter((x): x is { m: MatchRow; k: number } => x.k != null && x.k >= now)
      .sort((a, b) => a.k - b.k)[0]?.m.num ?? null;

  const slotFor = (row: MatchRow, side: 1 | 2): TeamSlot => {
    const name = side === 1 ? row.team1 : row.team2;
    if (name) {
      const t = teamByName.get(name);
      return {
        resolved: true,
        name,
        fifaCode: t?.fifa_code ?? null,
        flag: t?.flag ?? null,
        group: t?.grp ?? null,
        confed: t?.confed ?? null,
      };
    }
    const kind = side === 1 ? row.feeder1_kind : row.feeder2_kind;
    const feeder = side === 1 ? row.feeder1 : row.feeder2;
    const word = kind === "L" ? "Loser" : "Winner";
    return { resolved: false, label: feeder ? `${word} #${feeder}` : "TBD" };
  };

  // Where each match's WINNER advances to (ignore L-feeders like the 3rd-place match).
  const parentWinnerOf: Record<number, number> = {};
  for (const m of matchRows) {
    if (m.feeder1 != null && m.feeder1_kind === "W") parentWinnerOf[m.feeder1] = m.num;
    if (m.feeder2 != null && m.feeder2_kind === "W") parentWinnerOf[m.feeder2] = m.num;
  }

  const refOf = (name: string): TeamRef => ({
    name,
    flag: teamByName.get(name)?.flag ?? null,
  });

  // Follow a team up the bracket through the rounds they have won.
  const progressFor = (
    teamName: string,
    r32Num: number,
  ): { status: TeamStatus; pendingNum: number | null } => {
    let wins = 0;
    let cur = r32Num;
    for (let guard = 0; guard < 8; guard++) {
      const m = byNum.get(cur);
      if (!m) break;
      if (m.played !== 1 || !m.winner) {
        return { status: wins > 0 ? "advanced" : "upcoming", pendingNum: cur };
      }
      if (m.winner !== teamName) return { status: "eliminated", pendingNum: null };
      wins++;
      const parent = parentWinnerOf[cur];
      if (parent == null) return { status: "champion", pendingNum: null };
      cur = parent;
    }
    return { status: wins > 0 ? "advanced" : "upcoming", pendingNum: cur };
  };

  // The team's next match: a decided opponent, or the potential opponents from
  // the feeder that hasn't resolved yet.
  const nextUpFor = (teamName: string, pendingNum: number): NextUp => {
    const pm = byNum.get(pendingNum)!;
    const isSlot1 = pm.team1 === teamName;
    const oppName = isSlot1 ? pm.team2 : pm.team1;
    const oppFeeder = isSlot1 ? pm.feeder2 : pm.feeder1;
    if (oppName) {
      return { stage: pm.round, date: pm.date, opponent: refOf(oppName), potentials: [] };
    }
    const potentials: TeamRef[] = [];
    const f = oppFeeder != null ? byNum.get(oppFeeder) : undefined;
    if (f?.team1) potentials.push(refOf(f.team1));
    if (f?.team2) potentials.push(refOf(f.team2));
    return { stage: pm.round, date: pm.date, opponent: null, potentials };
  };

  const buildMatch = (num: number): MatchNode => {
    const row = byNum.get(num)!;
    const roundCode = row.round_code as RoundCode;
    const slots: [TeamSlot, TeamSlot] = [slotFor(row, 1), slotFor(row, 2)];
    const score: [number, number] | null =
      row.score1 != null && row.score2 != null ? [row.score1, row.score2] : null;
    const played = row.played === 1;

    const teamLeaf = (side: 0 | 1): TeamLeaf => {
      const slot = slots[side];
      const my = score ? score[side] : null;
      const opp = score ? score[side === 0 ? 1 : 0] : null;

      let status: TeamStatus = "upcoming";
      let reachedStage: string | null = null;
      let next: NextUp | null = null;
      if (slot.resolved) {
        const p = progressFor(slot.name, num);
        status = p.status;
        if (p.status === "champion") {
          reachedStage = "Champions";
        } else if (p.status === "advanced" && p.pendingNum != null) {
          reachedStage = byNum.get(p.pendingNum)?.round ?? null;
          next = nextUpFor(slot.name, p.pendingNum);
        }
      }

      return {
        kind: "team",
        slot,
        matchNum: num,
        side,
        opponent: slots[side === 0 ? 1 : 0],
        date: row.date,
        played,
        score: my != null && opp != null ? [my, opp] : null,
        result:
          played && slot.resolved && row.winner
            ? row.winner === slot.name
              ? "W"
              : "L"
            : null,
        status,
        reachedStage,
        next,
      };
    };

    const children: BracketChild[] =
      roundCode === "R32"
        ? [teamLeaf(0), teamLeaf(1)]
        : [buildMatch(row.feeder1!), buildMatch(row.feeder2!)];

    return {
      kind: "match",
      num,
      round: row.round,
      roundCode,
      date: row.date,
      time: row.time,
      ground: row.ground,
      slots,
      score:
        row.score1 != null && row.score2 != null ? [row.score1, row.score2] : null,
      pens: row.pen1 != null && row.pen2 != null ? [row.pen1, row.pen2] : null,
      winner: row.winner,
      played: row.played === 1,
      isNext: num === nextMatchNum,
      children,
    };
  };

  let nextMatch: NextMatch | null = null;
  if (nextMatchNum != null) {
    const row = byNum.get(nextMatchNum)!;
    nextMatch = {
      num: row.num,
      round: row.round,
      date: row.date,
      time: row.time,
      slots: [slotFor(row, 1), slotFor(row, 2)],
    };
  }

  return { root: buildMatch(FINAL_MATCH), nextMatchNum, nextMatch };
}
