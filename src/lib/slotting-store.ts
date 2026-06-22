/**
 * TriloWMS — AI Smart Slotting Engine
 * Scores available warehouse bins for a putaway task using real signals
 * (storage constraints, dispatch proximity, weight/level, capacity, FEFO)
 * and returns a primary suggestion + alternates, each with a plain-language reason.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Warehouse, ZoneType } from "@/lib/wms-data";
import { useEditorStore } from "@/lib/wms-editor-store";
import { useSkuStore } from "@/lib/sku-store";

export interface SlotCandidate {
  binId: string;
  binCode: string;
  zoneName: string;
  zoneType: ZoneType;
  score: number;
  reason: string;
}
export interface SlottingResult {
  primary: SlotCandidate | null;
  alternates: SlotCandidate[];
  note: string;
  generatedAt: string;
}

export interface SlotTaskInput {
  id: string;
  skuCode: string;
  quantity: number;
  expiryDate: string | null;
}

export interface OverrideRecord {
  id: string;
  taskId: string;
  skuCode: string;
  suggestedBinCode: string | null;
  chosenBinCode: string;
  ts: string;
}

// ── pure scoring helpers ───────────────────────────────────────────────────────

function parseLevel(code: string): number {
  const last = code.split("-").pop() ?? "";
  const m = last.match(/[A-H]/i);
  return m ? m[0].toUpperCase().charCodeAt(0) - 64 : 1; // A=1 (ground)
}

function requiredZoneFor(storageType: string): { zone: ZoneType | null; hard: boolean } {
  switch (storageType) {
    case "Cold": case "Frozen": return { zone: "Cold Storage", hard: true };
    case "Hazmat":              return { zone: "Hazardous", hard: true };
    case "Bulk":                return { zone: "Slow Moving", hard: false };
    case "Secure":              return { zone: "Hazardous", hard: false };
    default:                    return { zone: "Finished Goods", hard: false };
  }
}

interface Cand {
  binId: string; binCode: string; zoneName: string; zoneType: ZoneType;
  rackPos: [number, number]; level: number; empty: boolean;
}

function collectBins(wh: Warehouse): Cand[] {
  const out: Cand[] = [];
  for (const z of wh.zones) {
    for (const a of z.aisles) {
      for (const r of a.racks) {
        for (const b of r.bins) {
          if (b.status === "Blocked" || b.status === "Reserved" || b.status === "Full" || b.occupancy >= 1) continue;
          out.push({
            binId: b.id, binCode: b.code, zoneName: z.name, zoneType: z.type,
            rackPos: r.position, level: parseLevel(b.code), empty: b.status === "Empty" || b.occupancy === 0,
          });
        }
      }
    }
  }
  return out;
}

export function computeSuggestion(task: SlotTaskInput): SlottingResult {
  const now = new Date().toISOString();
  const wh = useEditorStore.getState().warehouse;
  const sku = useSkuStore.getState().skus.find((s) => s.skuCode === task.skuCode);
  const weight = sku?.weight ?? 0;
  const storageType = sku?.storageType ?? "Ambient";
  const heavy = weight >= 15;
  const fastMover = (sku?.category ?? "").toLowerCase().includes("fast") || (sku?.subcategory ?? "").toLowerCase().includes("fast");
  const req = requiredZoneFor(storageType);

  const bins = collectBins(wh);
  if (bins.length === 0) {
    return { primary: null, alternates: [], note: "No available bins — build the warehouse or free capacity.", generatedAt: now };
  }

  // nearest outbound dock position for dispatch proximity
  const docks = wh.docks.filter((d) => d.kind === "Outbound").map((d) => d.position);
  const maxDim = Math.max(wh.size.w, wh.size.d, 1);
  const distToDispatch = (pos: [number, number]) => {
    if (docks.length === 0) return 0.5;
    const d = Math.min(...docks.map(([dx, dz]) => Math.hypot(pos[0] - dx, pos[1] - dz)));
    return Math.min(1, d / maxDim); // 0 = at dock, 1 = far
  };

  const scored = bins.map((b) => {
    let score = 10; // base
    const reasons: { w: number; text: string }[] = [];

    // storage constraint
    if (req.zone) {
      if (b.zoneType === req.zone) { score += 40; reasons.push({ w: 40, text: req.hard ? `${storageType} — routed to ${req.zone}` : `Suited to ${req.zone}` }); }
      else if (req.hard) { score -= 60; }
    }

    // dispatch proximity (fast movers weighted heavily)
    const near = 1 - distToDispatch(b.rackPos);
    const dispW = (fastMover ? 30 : 12) * near;
    score += dispW;
    if (fastMover && near > 0.6) reasons.push({ w: dispW, text: "Fast-mover — placed near dispatch" });

    // weight vs level
    if (heavy) {
      const lvlScore = Math.max(0, 22 - (b.level - 1) * 8);
      score += lvlScore;
      if (b.level === 1) reasons.push({ w: 22, text: "Heavy item — ground-level bin" });
    } else {
      score += b.level >= 2 ? 6 : 2; // light items can go higher, free ground for heavy
    }

    // capacity
    if (b.empty) { score += 14; reasons.push({ w: 8, text: `Open capacity in ${b.zoneName}` }); }

    // FEFO / expiry
    if (task.expiryDate && (b.zoneType === "Cold Storage" || b.zoneType === "QC Hold")) {
      score += 12; reasons.push({ w: 25, text: "Expiring lot — FEFO-controlled zone" });
    }

    const top = reasons.sort((a, b2) => b2.w - a.w)[0];
    return {
      binId: b.binId, binCode: b.binCode, zoneName: b.zoneName, zoneType: b.zoneType,
      score: Math.round(score),
      reason: top?.text ?? `Best available capacity in ${b.zoneName}`,
    } as SlotCandidate;
  });

  scored.sort((a, b) => b.score - a.score);
  const [primary, ...rest] = scored;
  return { primary: primary ?? null, alternates: rest.slice(0, 2), note: `${bins.length} candidate bins evaluated`, generatedAt: now };
}

// ── store (cache + override log) ───────────────────────────────────────────────

interface SlottingState {
  suggestions: Record<string, SlottingResult>;
  overrides: OverrideRecord[];

  suggestFor: (task: SlotTaskInput) => SlottingResult;
  suggestForTasks: (tasks: SlotTaskInput[]) => void;
  get: (taskId: string) => SlottingResult | null;
  logOverride: (taskId: string, skuCode: string, suggestedBinCode: string | null, chosenBinCode: string) => void;
}

export const useSlottingStore = create<SlottingState>()(
  persist(
    (set, get) => ({
      suggestions: {},
      overrides: [],

      suggestFor: (task) => {
        const result = computeSuggestion(task);
        set((s) => ({ suggestions: { ...s.suggestions, [task.id]: result } }));
        return result;
      },

      suggestForTasks: (tasks) => {
        const next: Record<string, SlottingResult> = {};
        for (const t of tasks) next[t.id] = computeSuggestion(t);
        set((s) => ({ suggestions: { ...s.suggestions, ...next } }));
      },

      get: (taskId) => get().suggestions[taskId] ?? null,

      logOverride: (taskId, skuCode, suggestedBinCode, chosenBinCode) => {
        set((s) => ({
          overrides: [{ id: `ovr-${Date.now()}`, taskId, skuCode, suggestedBinCode, chosenBinCode, ts: new Date().toISOString() }, ...s.overrides],
        }));
      },
    }),
    { name: "trilowms-slotting-v1", partialize: (s) => ({ overrides: s.overrides }) },
  ),
);
