import { notFound } from "next/navigation";
import { getTeamDetail, type JourneyMatch, type Result } from "@/lib/team";
import { formatShortDate } from "@/lib/format";

const RESULT_CHIP: Record<Result, string> = {
  W: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  D: "bg-slate-400/15 text-slate-300 ring-slate-300/25",
  L: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
};
const RESULT_DOT: Record<Result, string> = {
  W: "bg-emerald-400",
  D: "bg-slate-400",
  L: "bg-rose-400",
};

export function TeamDetail({ code }: { code: string }) {
  const team = getTeamDetail(code);
  if (!team) notFound();

  const s = team.stats;
  const meta = [
    team.fifaCode,
    team.group ? `Group ${team.group}` : null,
    team.confed,
    team.continent,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="text-white">
      {/* header */}
      <div className="flex items-center gap-4">
        <span className="text-5xl leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          {team.flag ?? "🏳️"}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
            {team.name}
          </h2>
          <p className="mt-0.5 text-xs font-medium tracking-wide text-white/45">
            {meta}
          </p>
        </div>
      </div>

      {/* form + stats */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {team.form.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-white/40">
              FORM
            </span>
            <div className="flex gap-1">
              {team.form.map((r, i) => (
                <span
                  key={i}
                  className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-black ${RESULT_DOT[r]}`}
                  title={r}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Stat label="P" value={s.played} />
          <Stat label="W-D-L" value={`${s.won}-${s.drawn}-${s.lost}`} />
          <Stat label="GF" value={s.gf} />
          <Stat label="GA" value={s.ga} />
          <Stat label="GD" value={s.gd > 0 ? `+${s.gd}` : `${s.gd}`} />
          <Stat label="CS" value={s.cleanSheets} />
        </div>
      </div>

      {/* journey */}
      <Section title="Journey">
        <ol className="space-y-1.5">
          {team.journey.map((m, i) => (
            <JourneyRow key={i} m={m} />
          ))}
        </ol>
      </Section>

      {/* squad */}
      <Section title="Squad">
        <div className="space-y-4">
          {team.squad.map((grp) => (
            <div key={grp.pos}>
              <h4 className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-[var(--gold)]/80">
                {grp.label.toUpperCase()}
              </h4>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {grp.players.map((p, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="w-5 shrink-0 text-right font-mono text-xs text-white/35">
                      {p.number ?? ""}
                    </span>
                    <span className="max-w-[48%] shrink-0 truncate font-medium text-white/90">
                      {p.name}
                    </span>
                    <span className="ml-auto truncate text-right text-xs text-white/40">
                      {p.club}
                      {p.age != null ? ` · ${p.age}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-center ring-1 ring-inset ring-white/5">
      <div className="text-sm font-bold leading-none text-white">{value}</div>
      <div className="mt-1 text-[9px] font-semibold tracking-wider text-white/35">
        {label}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/55">
        {title}
      </h3>
      {children}
    </section>
  );
}

function JourneyRow({ m }: { m: JourneyMatch }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
      <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--gold)]/70">
        {m.knockout ? m.stage : m.stage}
      </span>
      <span className="text-lg">{m.oppFlag ?? "🏳️"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">vs</span>
          <span className="truncate text-sm font-medium text-white/90">
            {m.oppName}
          </span>
        </div>
        {m.scorers.length > 0 && (
          <div className="mt-0.5 text-[11px] leading-snug text-white/40">
            ⚽ {m.scorers.map((g) => `${g.name} ${g.minute}'`).join(", ")}
          </div>
        )}
      </div>
      {m.played && m.score ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tabular-nums text-white">
            {m.score[0]}–{m.score[1]}
          </span>
          {m.result && (
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-inset ${RESULT_CHIP[m.result]}`}
            >
              {m.result}
            </span>
          )}
        </div>
      ) : (
        <span className="rounded-full bg-[var(--live)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--live)] ring-1 ring-inset ring-[var(--live)]/25">
          {formatShortDate(m.date)}
        </span>
      )}
    </li>
  );
}
