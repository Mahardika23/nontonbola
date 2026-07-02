import { db } from "./db";

// ---------------------------------------------------------------------------
// Team detail: everything we can show from static openfootball data — the
// team's Journey (group + knockout matches), tournament Form, summary stats,
// and the 26-man Squad. (True per-match lineups arrive with Slice 3.)
// ---------------------------------------------------------------------------

export type Pos = "GK" | "DF" | "MF" | "FW";
export const POS_ORDER: Pos[] = ["GK", "DF", "MF", "FW"];
export const POS_LABEL: Record<Pos, string> = {
  GK: "Goalkeepers",
  DF: "Defenders",
  MF: "Midfielders",
  FW: "Forwards",
};

export type Scorer = { name: string; minute: string };
export type Result = "W" | "D" | "L";

export type JourneyMatch = {
  stage: string; // "Group A · MD1" | "Round of 32" | ...
  knockout: boolean;
  date: string | null;
  oppName: string;
  oppFlag: string | null;
  score: [number, number] | null; // [thisTeam, opponent]
  result: Result | null;
  scorers: Scorer[];
  played: boolean;
};

export type SquadPlayer = {
  number: number | null;
  name: string;
  club: string | null;
  clubCountry: string | null;
  age: number | null;
};

export type TeamDetail = {
  slug: string;
  name: string;
  fifaCode: string | null;
  flag: string | null;
  group: string | null;
  confed: string | null;
  continent: string | null;
  journey: JourneyMatch[];
  form: Result[];
  stats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    cleanSheets: number;
  };
  squad: { pos: Pos; label: string; players: SquadPlayer[] }[];
};

type TeamRow = {
  name: string;
  slug: string;
  fifa_code: string | null;
  flag: string | null;
  grp: string | null;
  confed: string | null;
  continent: string | null;
};
type GroupRow = {
  matchday: number;
  date: string | null;
  grp: string | null;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  scorers1: string;
  scorers2: string;
  played: number;
};
type KoRow = {
  num: number;
  round: string;
  date: string | null;
  team1: string | null;
  team2: string | null;
  score1: number | null;
  score2: number | null;
  scorers1: string;
  scorers2: string;
  winner: string | null;
  played: number;
};
type PlayerRow = {
  number: number | null;
  pos: string | null;
  name: string;
  club: string | null;
  club_country: string | null;
  dob: string | null;
};

const isPlaceholder = (s: string | null) => !s || /^[WL]\d+$/.test(s);
const parseScorers = (json: string): Scorer[] => {
  try {
    return JSON.parse(json) as Scorer[];
  } catch {
    return [];
  }
};

// Age at the tournament's opening day.
const TOURNAMENT_START = new Date("2026-06-11");
function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  let age = TOURNAMENT_START.getFullYear() - b.getFullYear();
  const m = TOURNAMENT_START.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && TOURNAMENT_START.getDate() < b.getDate())) age--;
  return age;
}

export function getTeamDetail(slug: string): TeamDetail | null {
  const d = db();
  const team = d.prepare("SELECT * FROM teams WHERE slug = ?").get(slug) as
    | TeamRow
    | undefined;
  if (!team) return null;
  const name = team.name;

  const flagOf = new Map(
    (d.prepare("SELECT name, flag FROM teams").all() as { name: string; flag: string | null }[]).map(
      (t) => [t.name, t.flag],
    ),
  );

  // --- journey: group then knockout, chronological ---
  const journey: JourneyMatch[] = [];

  const groupRows = d
    .prepare(
      "SELECT * FROM group_matches WHERE team1 = ? OR team2 = ? ORDER BY date, matchday, id",
    )
    .all(name, name) as GroupRow[];
  for (const g of groupRows) {
    const home = g.team1 === name;
    const opp = home ? g.team2 : g.team1;
    const my = home ? g.score1 : g.score2;
    const ot = home ? g.score2 : g.score1;
    journey.push({
      stage: `${g.grp ?? "Group"} · MD${g.matchday}`,
      knockout: false,
      date: g.date,
      oppName: opp,
      oppFlag: flagOf.get(opp) ?? null,
      score: my != null && ot != null ? [my, ot] : null,
      result:
        my != null && ot != null ? (my > ot ? "W" : my < ot ? "L" : "D") : null,
      scorers: parseScorers(home ? g.scorers1 : g.scorers2),
      played: g.played === 1,
    });
  }

  const koRows = d
    .prepare(
      "SELECT * FROM matches WHERE (team1 = ? OR team2 = ?) AND round_code != '3P' ORDER BY date, num",
    )
    .all(name, name) as KoRow[];
  for (const k of koRows) {
    const home = k.team1 === name;
    const opp = home ? k.team2 : k.team1;
    const my = home ? k.score1 : k.score2;
    const ot = home ? k.score2 : k.score1;
    journey.push({
      stage: k.round,
      knockout: true,
      date: k.date,
      oppName: isPlaceholder(opp) ? "TBD" : opp!,
      oppFlag: opp ? (flagOf.get(opp) ?? null) : null,
      score: my != null && ot != null ? [my, ot] : null,
      result:
        k.played === 1 && k.winner ? (k.winner === name ? "W" : "L") : null,
      scorers: parseScorers(home ? k.scorers1 : k.scorers2),
      played: k.played === 1,
    });
  }

  // --- form + stats from played matches ---
  const played = journey.filter((j) => j.played && j.score);
  const form = played.map((j) => j.result!).filter(Boolean) as Result[];
  const stats = played.reduce(
    (a, j) => {
      const [gf, ga] = j.score!;
      a.played++;
      a.gf += gf;
      a.ga += ga;
      if (j.result === "W") a.won++;
      else if (j.result === "D") a.drawn++;
      else if (j.result === "L") a.lost++;
      if (ga === 0) a.cleanSheets++;
      return a;
    },
    { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, cleanSheets: 0 },
  );
  stats.gd = stats.gf - stats.ga;

  // --- squad grouped by position ---
  const playerRows = d
    .prepare("SELECT * FROM players WHERE team = ? ORDER BY number")
    .all(name) as PlayerRow[];
  const squad = POS_ORDER.map((pos) => ({
    pos,
    label: POS_LABEL[pos],
    players: playerRows
      .filter((p) => p.pos === pos)
      .map((p) => ({
        number: p.number,
        name: p.name,
        club: p.club,
        clubCountry: p.club_country,
        age: ageFromDob(p.dob),
      })),
  })).filter((g) => g.players.length > 0);

  return {
    slug: team.slug,
    name,
    fifaCode: team.fifa_code,
    flag: team.flag,
    group: team.grp,
    confed: team.confed,
    continent: team.continent,
    journey,
    form,
    stats,
    squad,
  };
}
