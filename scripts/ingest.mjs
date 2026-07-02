// Ingest openfootball World Cup 2026 data into a local SQLite database.
//
//   node scripts/ingest.mjs
//
// Tables:
//   teams         — 48 teams (flag, fifa_code, slug, group, confederation)
//   matches       — knockout #73-104, placeholder slots ("W74") resolved, scorers
//   group_matches — 72 group-stage matches with scores + scorers
//   players       — 26-man squads (number, position, club, dob)
//
// Re-runnable: drops and rebuilds every table each time.

import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const wc = read("data/worldcup.2026.json");
const teamsRaw = read("data/teams.2026.json");
const squadsRaw = read("data/squads.2026.json");

const slugify = (fifaCode, name) =>
  (fifaCode || name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const scorersJson = (goals) =>
  JSON.stringify((goals ?? []).map((g) => ({ name: g.name, minute: g.minute })));

// --- round code mapping -----------------------------------------------------
const ROUND_CODE = {
  "Round of 32": "R32",
  "Round of 16": "R16",
  "Quarter-final": "QF",
  "Semi-final": "SF",
  "Final": "F",
  "Match for third place": "3P",
};
const isKnockout = (m) => m.round in ROUND_CODE;
const isGroup = (m) => typeof m.round === "string" && m.round.startsWith("Matchday");

// --- team lookup ------------------------------------------------------------
const teamByName = new Map();
for (const t of teamsRaw) {
  teamByName.set(t.name, t);
  if (t.name_normalised) teamByName.set(t.name_normalised, t);
}
const findTeam = (name) => teamByName.get(name) ?? null;

// --- parse a slot token -----------------------------------------------------
function parseSlot(token) {
  const wl = /^([WL])(\d+)$/.exec(token ?? "");
  if (wl) return { kind: wl[1], feeder: Number(wl[2]), team: null };
  return { kind: null, feeder: null, team: token ?? null };
}

// --- knockout matches -------------------------------------------------------
const records = wc.matches.filter(isKnockout).map((m) => {
  const s1 = parseSlot(m.team1);
  const s2 = parseSlot(m.team2);
  const ft = m.score?.ft ?? null;
  const pen = m.score?.p ?? null;
  return {
    num: m.num,
    round: m.round,
    round_code: ROUND_CODE[m.round],
    date: m.date ?? null,
    time: m.time ?? null,
    ground: m.ground ?? null,
    slot1_raw: m.team1 ?? null,
    slot2_raw: m.team2 ?? null,
    team1: s1.team,
    team2: s2.team,
    feeder1: s1.feeder,
    feeder2: s2.feeder,
    feeder1_kind: s1.kind,
    feeder2_kind: s2.kind,
    score1: ft ? ft[0] : null,
    score2: ft ? ft[1] : null,
    pen1: pen ? pen[0] : null,
    pen2: pen ? pen[1] : null,
    scorers1: scorersJson(m.goals1),
    scorers2: scorersJson(m.goals2),
    winner: null,
    loser: null,
    played: ft ? 1 : 0,
  };
});
const byNum = new Map(records.map((r) => [r.num, r]));

function decide(r) {
  if (r.winner || !r.played || !r.team1 || !r.team2) return false;
  let w, l;
  if (r.score1 > r.score2) [w, l] = [r.team1, r.team2];
  else if (r.score2 > r.score1) [w, l] = [r.team2, r.team1];
  else if (r.pen1 != null && r.pen2 != null) {
    [w, l] = r.pen1 > r.pen2 ? [r.team1, r.team2] : [r.team2, r.team1];
  } else return false;
  r.winner = w;
  r.loser = l;
  return true;
}

function pull(r) {
  let changed = false;
  for (const side of [1, 2]) {
    if (r[`team${side}`]) continue;
    const feeder = byNum.get(r[`feeder${side}`]);
    if (!feeder) continue;
    const src = r[`feeder${side}_kind`] === "W" ? feeder.winner : feeder.loser;
    if (src) {
      r[`team${side}`] = src;
      changed = true;
    }
  }
  return changed;
}

for (let pass = 0; pass < records.length + 1; pass++) {
  let changed = false;
  for (const r of records) {
    if (pull(r)) changed = true;
    if (decide(r)) changed = true;
  }
  if (!changed) break;
}

// --- group-stage matches ----------------------------------------------------
const groupMatches = wc.matches.filter(isGroup).map((m, i) => {
  const ft = m.score?.ft ?? null;
  return {
    id: i + 1,
    matchday: Number((m.round.match(/\d+/) ?? [0])[0]),
    date: m.date ?? null,
    time: m.time ?? null,
    ground: m.ground ?? null,
    grp: m.group ?? null,
    team1: m.team1 ?? null,
    team2: m.team2 ?? null,
    score1: ft ? ft[0] : null,
    score2: ft ? ft[1] : null,
    scorers1: scorersJson(m.goals1),
    scorers2: scorersJson(m.goals2),
    played: ft ? 1 : 0,
  };
});

// --- squads -----------------------------------------------------------------
const players = [];
for (const sq of squadsRaw) {
  for (const p of sq.players ?? []) {
    players.push({
      team: sq.name,
      number: p.number ?? null,
      pos: p.pos ?? null,
      name: p.name ?? null,
      club: p.club?.name ?? null,
      club_country: p.club?.country ?? null,
      dob: p.date_of_birth ?? null,
    });
  }
}

// --- write the database -----------------------------------------------------
mkdirSync(join(ROOT, "db"), { recursive: true });
const db = new Database(join(ROOT, "db", "worldcup.sqlite"));

db.exec(`
  DROP TABLE IF EXISTS matches;
  DROP TABLE IF EXISTS group_matches;
  DROP TABLE IF EXISTS players;
  DROP TABLE IF EXISTS teams;

  CREATE TABLE teams (
    name      TEXT PRIMARY KEY,
    slug      TEXT UNIQUE,
    fifa_code TEXT,
    flag      TEXT,
    grp       TEXT,
    confed    TEXT,
    continent TEXT
  );

  CREATE TABLE matches (
    num          INTEGER PRIMARY KEY,
    round        TEXT NOT NULL,
    round_code   TEXT NOT NULL,
    date         TEXT,
    time         TEXT,
    ground       TEXT,
    slot1_raw    TEXT,
    slot2_raw    TEXT,
    team1        TEXT,
    team2        TEXT,
    feeder1      INTEGER,
    feeder2      INTEGER,
    feeder1_kind TEXT,
    feeder2_kind TEXT,
    score1       INTEGER,
    score2       INTEGER,
    pen1         INTEGER,
    pen2         INTEGER,
    scorers1     TEXT,
    scorers2     TEXT,
    winner       TEXT,
    loser        TEXT,
    played       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE group_matches (
    id       INTEGER PRIMARY KEY,
    matchday INTEGER,
    date     TEXT,
    time     TEXT,
    ground   TEXT,
    grp      TEXT,
    team1    TEXT,
    team2    TEXT,
    score1   INTEGER,
    score2   INTEGER,
    scorers1 TEXT,
    scorers2 TEXT,
    played   INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_gm_team1 ON group_matches(team1);
  CREATE INDEX idx_gm_team2 ON group_matches(team2);

  CREATE TABLE players (
    team         TEXT,
    number       INTEGER,
    pos          TEXT,
    name         TEXT,
    club         TEXT,
    club_country TEXT,
    dob          TEXT
  );
  CREATE INDEX idx_players_team ON players(team);
`);

const insTeam = db.prepare(
  `INSERT INTO teams (name, slug, fifa_code, flag, grp, confed, continent)
   VALUES (@name, @slug, @fifa_code, @flag, @grp, @confed, @continent)`
);
const insMatch = db.prepare(
  `INSERT INTO matches (num, round, round_code, date, time, ground,
     slot1_raw, slot2_raw, team1, team2, feeder1, feeder2, feeder1_kind,
     feeder2_kind, score1, score2, pen1, pen2, scorers1, scorers2, winner, loser, played)
   VALUES (@num, @round, @round_code, @date, @time, @ground,
     @slot1_raw, @slot2_raw, @team1, @team2, @feeder1, @feeder2, @feeder1_kind,
     @feeder2_kind, @score1, @score2, @pen1, @pen2, @scorers1, @scorers2, @winner, @loser, @played)`
);
const insGroup = db.prepare(
  `INSERT INTO group_matches (id, matchday, date, time, ground, grp,
     team1, team2, score1, score2, scorers1, scorers2, played)
   VALUES (@id, @matchday, @date, @time, @ground, @grp,
     @team1, @team2, @score1, @score2, @scorers1, @scorers2, @played)`
);
const insPlayer = db.prepare(
  `INSERT INTO players (team, number, pos, name, club, club_country, dob)
   VALUES (@team, @number, @pos, @name, @club, @club_country, @dob)`
);

db.transaction(() => {
  for (const t of teamsRaw) {
    insTeam.run({
      name: t.name,
      slug: slugify(t.fifa_code, t.name),
      fifa_code: t.fifa_code ?? null,
      flag: t.flag_icon ?? null,
      grp: t.group ?? null,
      confed: t.confed ?? null,
      continent: t.continent ?? null,
    });
  }
  for (const r of records) insMatch.run(r);
  for (const g of groupMatches) insGroup.run(g);
  for (const p of players) insPlayer.run(p);
})();

// --- report -----------------------------------------------------------------
const r32 = records.filter((r) => r.round_code === "R32");
const rimTeams = r32.flatMap((r) => [r.team1, r.team2]);
const unmatched = [...new Set(rimTeams.filter((n) => n && !findTeam(n)))];

console.log(`teams ingested:      ${teamsRaw.length}`);
console.log(`knockout matches:    ${records.length}`);
console.log(`group matches:       ${groupMatches.length}`);
console.log(`squad players:       ${players.length}`);
console.log(`R32 rim teams:       ${rimTeams.filter(Boolean).length}/32`);
console.log(`decided matches:     ${records.filter((r) => r.winner).length}`);
if (unmatched.length) console.warn(`UNMATCHED team names: ${unmatched.join(", ")}`);
else console.log(`rim teams all matched to flags ✓`);
console.log(`db written:          db/worldcup.sqlite`);
db.close();
