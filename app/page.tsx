import { getBracket, type TeamSlot } from "@/lib/bracket";
import { formatShortDate } from "@/lib/format";
import { Sunburst } from "@/components/Sunburst";

// Read live from SQLite on every request (the scheduler will keep it fresh).
export const dynamic = "force-dynamic";

export default function Home() {
  const bracket = getBracket();
  const next = bracket.nextMatch;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center px-4 py-8 sm:py-10">
      <header className="flex flex-col items-center text-center">
        <p className="px-2 text-[10px] font-semibold tracking-[0.18em] text-white/40 sm:text-[11px] sm:tracking-[0.35em]">
          FIFA WORLD CUP 2026 · CANADA · MEXICO · USA
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
          nonton<span className="text-[var(--gold)]">bola</span>
        </h1>
        <p className="mt-2 text-sm text-white/55">
          The knockout bracket — every team&rsquo;s road to the final.
        </p>
      </header>

      {next && (
        <div className="mt-6 flex max-w-[94vw] flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-2xl border border-[var(--live)]/25 bg-[var(--live)]/5 px-4 py-2 text-xs sm:rounded-full sm:text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--live)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--live)]" />
          </span>
          <span className="text-[11px] font-semibold tracking-wider text-[var(--live)]">
            NEXT
          </span>
          <span className="font-medium text-white/90">
            {slotLabel(next.slots[0])} <span className="text-white/40">vs</span>{" "}
            {slotLabel(next.slots[1])}
          </span>
          <span className="text-white/45">
            · {next.round} · {formatShortDate(next.date)}
          </span>
        </div>
      )}

      <div className="mt-4 w-full">
        <Sunburst bracket={bracket} />
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-white/40">
        <LegendItem swatch={<span className="h-0.5 w-5 rounded bg-[var(--gold)]" />}>
          decided path
        </LegendItem>
        <LegendItem
          swatch={
            <span className="h-2 w-2 rounded-full bg-[var(--live)] shadow-[0_0_8px_var(--live)]" />
          }
        >
          next match
        </LegendItem>
        <LegendItem swatch={<span className="text-xs">🏳️</span>}>
          hover a flag for stats
        </LegendItem>
        <span className="text-white/25">·</span>
        <span>data: openfootball</span>
      </footer>
    </main>
  );
}

function slotLabel(slot: TeamSlot): string {
  if (slot.resolved) {
    return `${slot.flag ?? ""} ${slot.name}`.trim();
  }
  return slot.label;
}

function LegendItem({
  swatch,
  children,
}: {
  swatch: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  );
}
