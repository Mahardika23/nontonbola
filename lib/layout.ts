import { hierarchy, cluster } from "d3-hierarchy";
import type { BracketChild, MatchNode } from "./bracket";

// Radius of each ring, indexed by tree depth. Final at the center (0), team
// flags on the rim (depth 5). Tuned for a square viewBox of +/- VIEW.
export const RING_RADIUS = [0, 96, 178, 252, 318, 372] as const;
export const RIM_RADIUS = RING_RADIUS[5];
export const VIEW = 480; // half-extent of the square viewBox

// Ring annotations. The outermost rim is self-evidently the teams (Round of 32),
// so it is left unlabelled to avoid colliding with the rim flags.
export const ROUND_LABELS: { depth: number; label: string }[] = [
  { depth: 3, label: "ROUND OF 16" },
  { depth: 2, label: "QUARTERS" },
  { depth: 1, label: "SEMIS" },
];

const radiusOf = (depth: number) => RING_RADIUS[depth] ?? RIM_RADIUS;

// d3 radial convention: angle 0 points straight up.
const polar = (angle: number, radius: number): [number, number] => [
  radius * Math.sin(angle),
  -radius * Math.cos(angle),
];

export const idOf = (data: BracketChild): string =>
  data.kind === "match" ? `m${data.num}` : `t${data.matchNum}_${data.side}`;

export type PositionedNode = {
  id: string;
  data: BracketChild;
  depth: number;
  angle: number;
  radius: number;
  x: number;
  y: number;
};

export type PositionedLink = {
  id: string;
  targetId: string;
  path: string;
  depth: number; // depth of the outer (target) node
  decided: boolean; // source match already played
};

export type Layout = {
  nodes: PositionedNode[];
  links: PositionedLink[];
  parentOf: Record<string, string>;
};

export function layoutBracket(root: MatchNode): Layout {
  const h = hierarchy<BracketChild>(root, (d) =>
    d.kind === "match" ? d.children : null,
  );
  const laid = cluster<BracketChild>()
    .size([2 * Math.PI, 1])
    .separation(() => 1)(h);

  const nodes: PositionedNode[] = laid.descendants().map((d) => {
    const angle = d.x;
    const radius = radiusOf(d.depth);
    const [x, y] = polar(angle, radius);
    return { id: idOf(d.data), data: d.data, depth: d.depth, angle, radius, x, y };
  });

  const parentOf: Record<string, string> = {};
  const links: PositionedLink[] = laid.links().map((l) => {
    const childId = idOf(l.target.data);
    const parentId = idOf(l.source.data);
    parentOf[childId] = parentId;

    const rC = radiusOf(l.target.depth);
    const rP = radiusOf(l.source.depth);
    const mid = (rC + rP) / 2;
    const [xC, yC] = polar(l.target.x, rC);
    const [c1x, c1y] = polar(l.target.x, mid);
    const [c2x, c2y] = polar(l.source.x, mid);
    const [xP, yP] = polar(l.source.x, rP);

    return {
      id: `${parentId}->${childId}`,
      targetId: childId,
      path: `M${xC.toFixed(1)},${yC.toFixed(1)}C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${xP.toFixed(1)},${yP.toFixed(1)}`,
      depth: l.target.depth,
      decided: (l.source.data as MatchNode).played,
    };
  });

  return { nodes, links, parentOf };
}

// Walk from a node up to the root, collecting every id on the path (inclusive).
export function ancestryChain(
  startId: string,
  parentOf: Record<string, string>,
): Set<string> {
  const chain = new Set<string>([startId]);
  let cur = startId;
  while (parentOf[cur]) {
    cur = parentOf[cur];
    chain.add(cur);
  }
  return chain;
}
