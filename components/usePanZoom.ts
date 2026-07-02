"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Pan + zoom for the sunburst SVG. Coordinates are in viewBox space (-view..view).
// Tap-friendly: pointer capture only engages once a drag passes THRESHOLD, so a
// simple tap still produces a `click` on the flag underneath.

const THRESHOLD = 8; // px of movement before a gesture counts as a drag (not a tap)

type T = { scale: number; tx: number; ty: number };

export type PanZoom = {
  ref: React.RefObject<SVGSVGElement | null>;
  transform: string;
  scale: number;
  handlers: {
    onPointerDown: React.PointerEventHandler<SVGSVGElement>;
    onPointerMove: React.PointerEventHandler<SVGSVGElement>;
    onPointerUp: React.PointerEventHandler<SVGSVGElement>;
    onPointerCancel: React.PointerEventHandler<SVGSVGElement>;
    onDoubleClick: React.MouseEventHandler<SVGSVGElement>;
  };
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  didPan: () => boolean;
};

export function usePanZoom(view: number, min = 1, max = 5): PanZoom {
  const ref = useRef<SVGSVGElement | null>(null);
  const [t, setT] = useState<T>({ scale: 1, tx: 0, ty: 0 });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastSingle = useRef<{ x: number; y: number } | null>(null);
  const lastDist = useRef(0);
  const lastMid = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(0);
  const captured = useRef(false);

  const clamp = (s: number, tx: number, ty: number): T => {
    const sc = Math.max(min, Math.min(max, s));
    if (sc <= 1) return { scale: 1, tx: 0, ty: 0 };
    const lim = (sc - 1) * view;
    return {
      scale: sc,
      tx: Math.max(-lim, Math.min(lim, tx)),
      ty: Math.max(-lim, Math.min(lim, ty)),
    };
  };

  const toView = useCallback(
    (cx: number, cy: number) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return {
        x: ((cx - r.left) / r.width) * 2 * view - view,
        y: ((cy - r.top) / r.height) * 2 * view - view,
      };
    },
    [view],
  );

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setT((cur) => {
        const s2 = Math.max(min, Math.min(max, cur.scale * factor));
        const f = cx != null && cy != null ? toView(cx, cy) : { x: 0, y: 0 };
        const k = s2 / cur.scale;
        return clamp(s2, f.x - k * (f.x - cur.tx), f.y - k * (f.y - cur.ty));
      });
    },
    [min, max, toView], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const panBy = (dxClient: number, dyClient: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const dvx = (dxClient / r.width) * 2 * view;
    const dvy = (dyClient / r.height) * 2 * view;
    setT((cur) => clamp(cur.scale, cur.tx + dvx, cur.ty + dvy));
  };

  const onPointerDown: React.PointerEventHandler<SVGSVGElement> = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    if (pointers.current.size === 1) {
      lastSingle.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      const p = [...pointers.current.values()];
      lastDist.current = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      lastMid.current = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    }
  };

  const onPointerMove: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const n = pointers.current.size;

    if (n === 1 && lastSingle.current) {
      const dx = e.clientX - lastSingle.current.x;
      const dy = e.clientY - lastSingle.current.y;
      moved.current += Math.hypot(dx, dy);
      lastSingle.current = { x: e.clientX, y: e.clientY };
      if (!captured.current && moved.current > THRESHOLD) {
        e.currentTarget.setPointerCapture(e.pointerId);
        captured.current = true;
      }
      panBy(dx, dy);
    } else if (n === 2) {
      const p = [...pointers.current.values()];
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      moved.current += THRESHOLD + 1; // a pinch is never a tap
      if (lastDist.current > 0) zoomAt(dist / lastDist.current, mid.x, mid.y);
      if (lastMid.current) panBy(mid.x - lastMid.current.x, mid.y - lastMid.current.y);
      lastDist.current = dist;
      lastMid.current = mid;
    }
  };

  const end: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (captured.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    pointers.current.delete(e.pointerId);
    const n = pointers.current.size;
    if (n < 2) {
      lastDist.current = 0;
      lastMid.current = null;
    }
    if (n === 1) lastSingle.current = { ...[...pointers.current.values()][0] };
    if (n === 0) {
      lastSingle.current = null;
      captured.current = false;
    }
  };

  // Non-passive wheel listener so we can preventDefault (page scroll vs zoom).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  return {
    ref,
    transform: `translate(${t.tx.toFixed(2)} ${t.ty.toFixed(2)}) scale(${t.scale.toFixed(3)})`,
    scale: t.scale,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onDoubleClick: (e) => zoomAt(1.8, e.clientX, e.clientY),
    },
    zoomIn: () => zoomAt(1.35),
    zoomOut: () => zoomAt(1 / 1.35),
    reset: () => setT({ scale: 1, tx: 0, ty: 0 }),
    didPan: () => moved.current > THRESHOLD,
  };
}
