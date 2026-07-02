"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bracket, MatchNode, TeamLeaf } from "@/lib/bracket";
import {
  layoutBracket,
  ancestryChain,
  RING_RADIUS,
  RIM_RADIUS,
  VIEW,
  ROUND_LABELS,
  type PositionedNode,
} from "@/lib/layout";
import { TeamHoverCard } from "./TeamHoverCard";
import { formatShortDate } from "@/lib/format";
import { usePanZoom } from "./usePanZoom";

// SVG presentation attributes don't resolve CSS var(), so use literal colors here.
const GOLD = "#f5c55a";
const GOLD_DIM = "#8a6d2f";
const LIVE = "#4fd1c5";

type Pointer = { x: number; y: number; w: number; h: number };
type HoverState = { leaf: TeamLeaf; id: string } | null;

const slugOf = (leaf: TeamLeaf): string | null =>
  leaf.slot.resolved ? (leaf.slot.fifaCode?.toLowerCase() ?? null) : null;

export function Sunburst({ bracket }: { bracket: Bracket }) {
  const { nodes, links, parentOf } = useMemo(
    () => layoutBracket(bracket.root),
    [bracket],
  );
  const router = useRouter();
  const pz = usePanZoom(VIEW);

  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none)").matches);
  }, []);

  const [hover, setHover] = useState<HoverState>(null);
  const [pointer, setPointer] = useState<Pointer>({ x: 0, y: 0, w: 0, h: 0 });

  const chain = useMemo(
    () => (hover ? ancestryChain(hover.id, parentOf) : null),
    [hover, parentOf],
  );
  const lit = (id: string) => (chain ? chain.has(id) : false);
  const dim = (id: string) => !!chain && !chain.has(id);

  const matchNodes = nodes.filter((n) => n.data.kind === "match");
  const leaves = nodes.filter((n) => n.data.kind === "team");

  // Tap behaviour. Desktop: hover shows the card, click opens. Touch: first tap
  // selects (card + lit path), a second tap on the same flag opens.
  const activate = (leaf: TeamLeaf, id: string, slug: string | null) => {
    if (pz.didPan()) return; // the gesture was a pan, not a tap
    if (isTouch) {
      if (hover?.id === id && slug) router.push(`/team/${slug}`);
      else setHover({ leaf, id });
    } else if (slug) {
      router.push(`/team/${slug}`);
    }
  };

  const openHovered = () => {
    if (!hover) return;
    const slug = slugOf(hover.leaf);
    if (slug) router.push(`/team/${slug}`);
  };

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(94vw,880px)] select-none"
      onMouseMove={
        isTouch
          ? undefined
          : (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPointer({
                x: e.clientX - r.left,
                y: e.clientY - r.top,
                w: r.width,
                h: r.height,
              });
            }
      }
      onMouseLeave={isTouch ? undefined : () => setHover(null)}
    >
      <svg
        ref={pz.ref}
        viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
        className="h-full w-full touch-none overflow-hidden"
        {...pz.handlers}
      >
        <defs>
          <radialGradient id="nb-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1407" />
            <stop offset="45%" stopColor="#0c0a06" />
            <stop offset="100%" stopColor="#070707" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nb-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245,197,90,0.55)" />
            <stop offset="60%" stopColor="rgba(245,197,90,0.10)" />
            <stop offset="100%" stopColor="rgba(245,197,90,0)" />
          </radialGradient>
          <filter id="nb-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nb-glow-live" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="4.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ambient background glow (fixed, not zoomed) */}
        <circle r={RIM_RADIUS + 70} fill="url(#nb-bg)" />
        {/* tap-empty-space to deselect */}
        <rect
          x={-VIEW}
          y={-VIEW}
          width={VIEW * 2}
          height={VIEW * 2}
          fill="transparent"
          onClick={() => {
            if (!pz.didPan()) setHover(null);
          }}
        />

        {/* everything below pans + zooms together */}
        <g transform={pz.transform}>
          {/* faint ring guides */}
          {RING_RADIUS.slice(1).map((r) => (
            <circle key={r} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}

          {/* round labels, stacked along the top */}
          {ROUND_LABELS.map(({ depth, label }) => (
            <text
              key={label}
              x={0}
              y={-RING_RADIUS[depth] - 7}
              textAnchor="middle"
              fontSize={10}
              letterSpacing={2.5}
              fill="rgba(255,255,255,0.32)"
              fontWeight={600}
            >
              {label}
            </text>
          ))}

          {/* connectors */}
          <g strokeLinecap="round">
            {links.map((l) => {
              const on = lit(l.targetId);
              return (
                <path
                  key={l.id}
                  d={l.path}
                  fill="none"
                  stroke={on ? GOLD : l.decided ? GOLD_DIM : "rgba(255,255,255,0.09)"}
                  strokeWidth={on ? 2.6 : Math.max(0.8, 3 - l.depth * 0.42)}
                  strokeOpacity={chain && !on ? 0.4 : 1}
                  filter={on ? "url(#nb-glow)" : undefined}
                  className="transition-all duration-200"
                />
              );
            })}
          </g>

          {/* match-node markers (SF / QF / R16 / R32) */}
          <g>
            {matchNodes
              .filter((n) => n.depth > 0)
              .map((n) => {
                const m = n.data as MatchNode;
                const on = lit(n.id);
                return (
                  <circle
                    key={n.id}
                    cx={n.x}
                    cy={n.y}
                    r={m.isNext ? 5 : on ? 4 : 2.6}
                    fill={m.isNext ? LIVE : on ? GOLD : m.played ? GOLD_DIM : "rgba(255,255,255,0.22)"}
                    filter={m.isNext ? "url(#nb-glow-live)" : on ? "url(#nb-glow)" : undefined}
                    className={m.isNext ? "nb-pulse" : "transition-all duration-200"}
                  />
                );
              })}
          </g>

          {/* team flags on the rim */}
          <g>
            {leaves.map((n) => {
              const leaf = n.data as TeamLeaf;
              const slug = slugOf(leaf);
              return (
                <TeamFlag
                  key={n.id}
                  node={n}
                  lit={lit(n.id)}
                  dim={dim(n.id)}
                  status={leaf.status}
                  onEnter={
                    !isTouch && slug ? () => setHover({ leaf, id: n.id }) : undefined
                  }
                  onSelect={slug ? () => activate(leaf, n.id, slug) : undefined}
                />
              );
            })}
          </g>

          {/* center: the trophy / Final */}
          <g>
            <circle r={62} fill="url(#nb-center)" />
            <text textAnchor="middle" dominantBaseline="central" fontSize={44} y={-2}>
              🏆
            </text>
            <text
              textAnchor="middle"
              y={40}
              fontSize={13}
              letterSpacing={4}
              fontWeight={800}
              fill={GOLD}
            >
              FINAL
            </text>
            <text textAnchor="middle" y={58} fontSize={10} fill="rgba(255,255,255,0.45)">
              {formatShortDate(bracket.root.date)}
            </text>
          </g>
        </g>
      </svg>

      {/* zoom controls */}
      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <ZoomButton label="Zoom in" onClick={pz.zoomIn}>
          +
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={pz.zoomOut}>
          −
        </ZoomButton>
        {pz.scale > 1.01 && (
          <ZoomButton label="Reset zoom" onClick={pz.reset}>
            ⟳
          </ZoomButton>
        )}
      </div>

      {hover && (
        <TeamHoverCard
          leaf={hover.leaf}
          pointer={pointer}
          docked={isTouch}
          onOpen={openHovered}
        />
      )}
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-base text-white/70 backdrop-blur-sm transition hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
    >
      {children}
    </button>
  );
}

function TeamFlag({
  node,
  lit,
  dim,
  status,
  onEnter,
  onSelect,
}: {
  node: PositionedNode;
  lit: boolean;
  dim: boolean;
  status: TeamLeaf["status"];
  onEnter?: () => void;
  onSelect?: () => void;
}) {
  const leaf = node.data as TeamLeaf;
  const slot = leaf.slot;
  const ux = node.x / node.radius;
  const uy = node.y / node.radius;
  const codeX = node.x + ux * 26;
  const codeY = node.y + uy * 26;

  const code = slot.resolved ? (slot.fifaCode ?? "") : "—";
  const flag = slot.resolved ? (slot.flag ?? "🏳️") : "🏳️";

  // Advancement cue: winners keep a gold ring; eliminated teams fade out.
  const advanced = status === "advanced" || status === "champion";
  const eliminated = status === "eliminated";
  const opacity = eliminated ? (dim ? 0.18 : 0.42) : dim ? 0.32 : 1;
  const discStroke = lit || advanced ? GOLD : "rgba(255,255,255,0.12)";
  const codeFill =
    lit || advanced
      ? GOLD
      : eliminated
        ? "rgba(255,255,255,0.3)"
        : "rgba(255,255,255,0.6)";

  return (
    <g
      onMouseEnter={onEnter}
      onClick={onSelect}
      className={onSelect ? "cursor-pointer" : "cursor-default"}
      opacity={opacity}
      style={{ transition: "opacity 200ms" }}
    >
      {/* hit area */}
      <circle cx={node.x} cy={node.y} r={24} fill="transparent" />
      {/* disc behind flag */}
      <circle
        cx={node.x}
        cy={node.y}
        r={lit ? 18 : advanced ? 16 : 15}
        fill="rgba(7,7,7,0.85)"
        stroke={discStroke}
        strokeWidth={lit ? 2 : advanced ? 1.6 : 1}
        strokeOpacity={advanced && !lit ? 0.75 : 1}
        filter={lit ? "url(#nb-glow)" : undefined}
        style={{ transition: "all 200ms" }}
      />
      <text
        x={node.x}
        y={node.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={lit ? 22 : 19}
        style={{ transition: "font-size 200ms" }}
      >
        {flag}
      </text>
      <text
        x={codeX}
        y={codeY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        letterSpacing={0.5}
        fill={codeFill}
      >
        {code}
      </text>
    </g>
  );
}
