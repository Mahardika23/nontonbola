# Radial sunburst bracket, rendered in SVG with D3 for layout math

## Context

The centerpiece is a circular knockout bracket with the Final at the dead center and rounds
fanning outward to 32 teams on the rim. We needed to choose both the geometry and the rendering
technology, and the two are coupled (the layout math and the render target constrain each other).

## Decision

- **Geometry: full 360° radial sunburst.** Concentric rings — Final (center) → SF → QF → R16 →
  R32 rim (32 flags). Chosen over a split-horseshoe and a quadrant-zoom circle because it is the
  truest realization of "circle with the final in the middle" and has the most visual impact.
- **Rendering: SVG.** Every flag and match node is a real DOM element, so hover/click hit-testing
  is free and the view is accessible, crisp at any scale, and animatable via CSS / Framer Motion.
- **Layout math: D3 (`d3-hierarchy` radial), for math only.** D3 computes ring radii, sector
  angles, and curved link paths; it does not render. SVG renders.

## Consequences

- Density is the known cost of the 360° choice: 32 rim flags is tight. Mitigated by a
  flags-only rim with names/stats revealed on hover (see interaction design), generous radius,
  and highlighting the active/next match.
- Canvas/PixiJS was rejected: it would force hand-rolled hover hit-testing, text, and
  accessibility — overkill at ~60 matches and hostile to the "hover a flag" requirement.
