/**
 * TriloWMS — AI Pick-Path Optimization
 * Sequences a wave's pick tasks into the shortest walking route by resolving
 * each bin's real warehouse coordinates and running a nearest-neighbour tour
 * from the pick-start, then improving it with a 2-opt pass.
 */

import { create } from "zustand";
import type { Warehouse } from "@/lib/wms-data";
import { useEditorStore } from "@/lib/wms-editor-store";
import { usePickingStore, type PickTask } from "@/lib/picking-store";

export interface RouteStop {
  seq: number;
  taskId: string;
  binCode: string;
  skuCode: string;
  qty: number;
  x: number;
  z: number;
  legDistance: number;   // metres from previous stop
}
export interface RouteResult {
  waveId: string;
  stops: RouteStop[];
  start: { x: number; z: number };
  end: { x: number; z: number };
  totalDistance: number; // metres
  etaMin: number;
  note: string;
  generatedAt: string;
}

const UNIT_M = 1.5;        // 1 grid unit ≈ 1.5 m
const WALK_MPS = 1.2;      // metres/sec
const PICK_SEC = 18;       // handling time per stop

function binPositionMap(wh: Warehouse): Map<string, { x: number; z: number }> {
  const map = new Map<string, { x: number; z: number }>();
  for (const z of wh.zones) {
    for (const a of z.aisles) {
      for (const r of a.racks) {
        r.bins.forEach((b, i) => {
          // spread bins slightly along the rack so stops don't fully overlap
          map.set(b.code, { x: r.position[0] + (i % 4) * 0.15, z: r.position[1] + Math.floor(i / 4) * 0.15 });
        });
      }
    }
  }
  return map;
}

function hashPos(code: string, wh: Warehouse): { x: number; z: number } {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return { x: (h % Math.max(1, Math.round(wh.size.w))), z: (Math.floor(h / 97) % Math.max(1, Math.round(wh.size.d))) };
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export function computeRoute(waveId: string, tasks: PickTask[]): RouteResult {
  const now = new Date().toISOString();
  const wh = useEditorStore.getState().warehouse;
  const posMap = binPositionMap(wh);

  // start = first inbound/any dock, else origin; end = first outbound dock (packing), else start
  const inbound = wh.docks.find((d) => d.kind === "Inbound");
  const outbound = wh.docks.find((d) => d.kind === "Outbound");
  const start = inbound ? { x: inbound.position[0], z: inbound.position[1] } : { x: 0, z: 0 };
  const end = outbound ? { x: outbound.position[0], z: outbound.position[1] } : start;

  // dedupe by bin: one stop per bin, summing qty (collapse same-location picks)
  const byBin = new Map<string, { taskId: string; binCode: string; skuCode: string; qty: number; x: number; z: number }>();
  for (const t of tasks) {
    const p = posMap.get(t.binCode) ?? hashPos(t.binCode || t.id, wh);
    const key = t.binCode || t.id;
    const ex = byBin.get(key);
    if (ex) ex.qty += t.qtyRequired;
    else byBin.set(key, { taskId: t.id, binCode: t.binCode || "—", skuCode: t.skuCode, qty: t.qtyRequired, x: p.x, z: p.z });
  }
  let pending = [...byBin.values()];
  if (pending.length === 0) {
    return { waveId, stops: [], start, end, totalDistance: 0, etaMin: 0, note: "No pick stops to route.", generatedAt: now };
  }

  // nearest-neighbour tour from start
  const order: typeof pending = [];
  let cur = start;
  while (pending.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < pending.length; i++) { const d = dist(cur, pending[i]); if (d < bd) { bd = d; bi = i; } }
    const nxt = pending.splice(bi, 1)[0];
    order.push(nxt);
    cur = nxt;
  }

  // 2-opt improvement (bounded)
  const path = [start, ...order, end];
  const D = (i: number, j: number) => dist(path[i], path[j]);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < path.length - 2; i++) {
      for (let k = i + 1; k < path.length - 1; k++) {
        if (D(i - 1, i) + D(k, k + 1) > D(i - 1, k) + D(i, k + 1) + 1e-9) {
          let lo = i, hi = k;
          while (lo < hi) { const tmp = path[lo]; path[lo] = path[hi]; path[hi] = tmp; lo++; hi--; }
        }
      }
    }
  }

  const mid = path.slice(1, path.length - 1) as typeof order;
  let total = 0;
  let prev = start;
  const stops: RouteStop[] = mid.map((s, idx) => {
    const legUnits = dist(prev, s);
    const leg = legUnits * UNIT_M;
    total += leg;
    prev = s;
    return { seq: idx + 1, taskId: s.taskId, binCode: s.binCode, skuCode: s.skuCode, qty: s.qty, x: s.x, z: s.z, legDistance: Math.round(leg) };
  });
  total += dist(prev, end) * UNIT_M; // walk to packing

  const etaMin = Math.round((total / WALK_MPS + stops.length * PICK_SEC) / 60);
  return { waveId, stops, start, end, totalDistance: Math.round(total), etaMin, note: `${stops.length} stops · nearest-neighbour + 2-opt`, generatedAt: now };
}

interface PickPathState {
  routes: Record<string, RouteResult>;
  optimize: (waveId: string, apply?: boolean) => RouteResult | null;
  get: (waveId: string) => RouteResult | null;
}

export const usePickPathStore = create<PickPathState>()((set, get) => ({
  routes: {},
  optimize: (waveId, apply = true) => {
    const wave = usePickingStore.getState().waves.find((w) => w.id === waveId);
    if (!wave) return null;
    const result = computeRoute(waveId, wave.tasks);
    set((s) => ({ routes: { ...s.routes, [waveId]: result } }));
    if (apply && result.stops.length > 0) {
      usePickingStore.getState().applyRouteOrder(waveId, result.stops.map((st) => st.taskId));
    }
    return result;
  },
  get: (waveId) => get().routes[waveId] ?? null,
}));
