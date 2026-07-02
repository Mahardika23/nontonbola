"use client";

import type { TeamLeaf, NextUp } from "@/lib/bracket";
import { formatShortDate } from "@/lib/format";

const CARD_W = 258;
const CARD_H = 196;

const SHORT_ROUND: Record<string, string> = {
  "Round of 32": "R32",
  "Round of 16": "R16",
  "Quarter-final": "QF",
  "Semi-final": "SF",
  Final: "Final",
};
const shortRound = (s: string | null) => (s ? (SHORT_ROUND[s] ?? s) : "");

const CHIP = {
  gold: "bg-[var(--gold)]/15 text-[var(--gold)] ring-[var(--gold)]/30",
  grey: "bg-white/10 text-white/55 ring-white/15",
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  live: "bg-[var(--live)]/15 text-[var(--live)] ring-[var(--live)]/30",
};

export function TeamHoverCard({
  leaf,
  pointer,
  docked = false,
  onOpen,
}: {
  leaf: TeamLeaf;
  pointer: { x: number; y: number; w: number; h: number };
  docked?: boolean;
  onOpen?: () => void;
}) {
  const slot = leaf.slot;
  if (!slot.resolved) return null;

  const opp = leaf.opponent;
  const oppLabel = opp.resolved ? opp.name : opp.label;
  const oppFlag = opp.resolved ? (opp.flag ?? "🏳️") : "🏳️";

  const resultChip = !leaf.played
    ? { text: `Kicks off ${formatShortDate(leaf.date)}`, cls: CHIP.live }
    : leaf.result === "W"
      ? { text: `Won ${leaf.score?.[0]}–${leaf.score?.[1]}`, cls: CHIP.emerald }
      : { text: `Lost ${leaf.score?.[0]}–${leaf.score?.[1]}`, cls: CHIP.rose };

  const badge =
    leaf.status === "champion"
      ? { text: "🏆 Champion", cls: CHIP.gold }
      : leaf.status === "advanced"
        ? { text: `✓ Into ${shortRound(leaf.reachedStage)}`, cls: CHIP.gold }
        : leaf.status === "eliminated"
          ? { text: "Out", cls: CHIP.grey }
          : null;

  const tapHint = docked ? (
    <span className="shrink-0 text-[10px] text-white/40">tap to open ›</span>
  ) : null;

  const body = (
    <div className="rounded-2xl border border-[var(--gold)]/25 bg-black/85 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.6)] backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">{slot.flag ?? "🏳️"}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-white">{slot.name}</div>
          <div className="text-[11px] font-medium tracking-wide text-white/45">
            {[slot.fifaCode, slot.group ? `Group ${slot.group}` : null, slot.confed]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        {badge && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${badge.cls}`}
          >
            {badge.text}
          </span>
        )}
      </div>

      <div className="my-3 h-px bg-white/10" />

      {/* Most recent / current match */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-[0.18em] text-[var(--gold)]/80">
          ROUND OF 32
        </div>
        {!leaf.next && tapHint}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[13px] text-white/85">
        <span className="text-white/40">vs</span>
        <span className="text-base">{oppFlag}</span>
        <span className="truncate font-medium">{oppLabel}</span>
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${resultChip.cls}`}
        >
          {resultChip.text}
        </span>
      </div>

      {/* Next match (advanced teams) */}
      {leaf.next && (
        <>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[10px] font-semibold tracking-[0.18em] text-[var(--live)]/80">
              NEXT · {shortRound(leaf.next.stage)}
              {leaf.next.date ? ` · ${formatShortDate(leaf.next.date)}` : ""}
            </div>
            {tapHint}
          </div>
          <div className="mt-1.5 text-[13px] text-white/85">
            <NextOpponent next={leaf.next} />
          </div>
        </>
      )}
    </div>
  );

  if (docked) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-x-3 bottom-3 z-30 mx-auto block w-auto max-w-sm animate-[nb-fade_140ms_ease-out] text-left"
      >
        {body}
      </button>
    );
  }

  const flipX = pointer.x + 18 + CARD_W > pointer.w;
  const flipY = pointer.y + 18 + CARD_H > pointer.h;
  const left = flipX ? pointer.x - CARD_W - 18 : pointer.x + 18;
  const top = Math.max(8, flipY ? pointer.y - CARD_H - 12 : pointer.y + 18);

  return (
    <div
      className="pointer-events-none absolute z-30 animate-[nb-fade_140ms_ease-out]"
      style={{ left, top, width: CARD_W }}
    >
      {body}
    </div>
  );
}

function NextOpponent({ next }: { next: NextUp }) {
  if (next.opponent) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-white/40">vs</span>
        <span className="text-base">{next.opponent.flag ?? "🏳️"}</span>
        <span className="truncate font-medium">{next.opponent.name}</span>
      </span>
    );
  }
  if (next.potentials.length) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-white/40">vs</span>
        {next.potentials.map((p, i) => (
          <span key={p.name} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-white/30">or</span>}
            <span className="text-base">{p.flag ?? "🏳️"}</span>
            <span className="font-medium">{p.name}</span>
          </span>
        ))}
      </span>
    );
  }
  return <span className="text-white/40">vs TBD</span>;
}
