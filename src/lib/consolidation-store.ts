/**
 * TriloWMS — Consolidation Module Store
 * Merges picked items from waves into per-order staging lanes before packing.
 * Consumes completed/in-progress pick tasks from the Picking store.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { usePickingStore } from "@/lib/picking-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LaneStatus = "STAGING" | "READY" | "MOVED_TO_PACKING" | "CANCELLED";
export type LineStatus = "PENDING" | "ARRIVED" | "SHORT" | "MISSING";

export interface ConsolidationLine {
  id: string;
  skuCode: string;
  skuName: string;
  uom: string;
  qtyExpected: number;
  qtyArrived: number;
  status: LineStatus;
  toteId: string | null;
  zone: string;
  binCode: string;
  shortReason: string | null;
}

export interface ConsolidationLane {
  id: string;
  orderId: string;
  waveId: string;
  waveNumber: string;
  status: LaneStatus;
  laneCode: string;
  lines: ConsolidationLine[];
  totalLines: number;
  arrivedLines: number;
  totalExpectedUnits: number;
  totalArrivedUnits: number;
  hasShortage: boolean;
  createdAt: string;
  readyAt: string | null;
  movedAt: string | null;
}

// ─── Status meta ──────────────────────────────────────────────────────────────

export const LANE_STATUS_META: Record<LaneStatus, { label: string; color: string; bg: string; border: string }> = {
  STAGING:          { label: "Staging",          color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  READY:            { label: "Ready",             color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  MOVED_TO_PACKING: { label: "Moved to Packing", color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  CANCELLED:        { label: "Cancelled",         color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};

export const LINE_STATUS_META: Record<LineStatus, { label: string; color: string }> = {
  PENDING: { label: "Awaiting", color: "text-slate-400"   },
  ARRIVED: { label: "Arrived",  color: "text-emerald-400" },
  SHORT:   { label: "Short",    color: "text-amber-400"   },
  MISSING: { label: "Missing",  color: "text-red-400"     },
};

// ─── Lane code generator ──────────────────────────────────────────────────────

let _laneSeq = 1;
const nextLaneCode = () => `LANE-${String(_laneSeq++).padStart(3, "0")}`;

// ─── Derive lines from pick tasks ─────────────────────────────────────────────

function deriveLines(tasks: ReturnType<typeof usePickingStore.getState>["waves"][0]["tasks"]): ConsolidationLine[] {
  return tasks.map((t, i) => {
    const lineStatus: LineStatus =
      t.status === "PICKED" ? "ARRIVED" :
      t.status === "SHORT"  ? "SHORT"   :
      t.status === "SKIPPED"? "MISSING" :
      "PENDING";

    return {
      id: `CLINE-${t.id}`,
      skuCode: t.skuCode,
      skuName: t.skuName,
      uom: t.uom,
      qtyExpected: t.qtyRequired,
      qtyArrived: t.qtyPicked,
      status: lineStatus,
      toteId: t.toteId,
      zone: t.zone,
      binCode: t.binCode,
      shortReason: t.shortReason,
    };
  });
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface ConsolidationState {
  lanes: ConsolidationLane[];
  selectedLaneId: string | null;
  lastSyncAt: string | null;

  // Actions
  syncFromPicking: () => number;
  scanArrival: (laneId: string, lineId: string) => void;
  moveToPacking: (laneId: string) => void;
  cancelLane: (laneId: string) => void;
  selectLane: (id: string | null) => void;

  // Derived
  kpis: () => {
    activeLanes: number;
    readyForCheck: number;
    movedToday: number;
    withExceptions: number;
    arrivalRate: string;
    totalLanes: number;
  };
  readyLanes: () => ConsolidationLane[];
  stagingLanes: () => ConsolidationLane[];
  laneProgress: (lane: ConsolidationLane) => number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useConsolidationStore = create<ConsolidationState>()(
  persist(
    (set, get) => ({
      lanes: [],
      selectedLaneId: null,
      lastSyncAt: null,

      syncFromPicking: () => {
        const { waves } = usePickingStore.getState();
        const { lanes } = get();
        const existingWaveIds = new Set(lanes.filter((l) => l.status !== "CANCELLED").map((l) => l.waveId));

        const eligibleStatuses = ["IN_PROGRESS", "PARTIAL", "COMPLETED", "SHORTED"] as const;
        const eligible = waves.filter(
          (w) => eligibleStatuses.includes(w.status as typeof eligibleStatuses[number]) && !existingWaveIds.has(w.id),
        );

        if (eligible.length === 0) return 0;

        const now = new Date().toISOString();
        const newLanes: ConsolidationLane[] = eligible.map((wave) => {
          const lines = deriveLines(wave.tasks);
          const arrivedLines = lines.filter((l) => l.status === "ARRIVED").length;
          const totalArrivedUnits = lines.reduce((s, l) => s + l.qtyArrived, 0);
          const totalExpected = lines.reduce((s, l) => s + l.qtyExpected, 0);
          const hasShortage = lines.some((l) => l.status === "SHORT" || l.status === "MISSING");
          const allArrived = lines.length > 0 && lines.every((l) => l.status === "ARRIVED" || l.status === "SHORT");
          const laneStatus: LaneStatus = allArrived ? "READY" : "STAGING";

          return {
            id: `CLANE-${wave.id}`,
            orderId: wave.sourceOrderId ?? wave.tasks[0]?.orderId ?? wave.id,
            waveId: wave.id,
            waveNumber: wave.waveNumber,
            status: laneStatus,
            laneCode: nextLaneCode(),
            lines,
            totalLines: lines.length,
            arrivedLines,
            totalExpectedUnits: totalExpected,
            totalArrivedUnits,
            hasShortage,
            createdAt: now,
            readyAt: laneStatus === "READY" ? now : null,
            movedAt: null,
          };
        });

        set((s) => ({
          lanes: [...newLanes, ...s.lanes],
          lastSyncAt: now,
        }));

        return newLanes.length;
      },

      scanArrival: (laneId, lineId) => {
        set((s) => ({
          lanes: s.lanes.map((lane) => {
            if (lane.id !== laneId) return lane;
            const lines = lane.lines.map((l) => {
              if (l.id !== lineId || l.status !== "PENDING") return l;
              return { ...l, status: "ARRIVED" as LineStatus, qtyArrived: l.qtyExpected };
            });
            const arrivedLines = lines.filter((l) => l.status === "ARRIVED").length;
            const totalArrivedUnits = lines.reduce((s, l) => s + l.qtyArrived, 0);
            const hasShortage = lines.some((l) => l.status === "SHORT" || l.status === "MISSING");
            const allSettled = lines.every((l) => l.status === "ARRIVED" || l.status === "SHORT" || l.status === "MISSING");
            const laneStatus: LaneStatus = allSettled ? "READY" : "STAGING";
            return {
              ...lane,
              lines,
              arrivedLines,
              totalArrivedUnits,
              hasShortage,
              status: laneStatus,
              readyAt: laneStatus === "READY" && !lane.readyAt ? new Date().toISOString() : lane.readyAt,
            };
          }),
        }));
      },

      moveToPacking: (laneId) => {
        set((s) => ({
          lanes: s.lanes.map((lane) =>
            lane.id === laneId && (lane.status === "READY")
              ? { ...lane, status: "MOVED_TO_PACKING" as LaneStatus, movedAt: new Date().toISOString() }
              : lane,
          ),
        }));
      },

      cancelLane: (laneId) => {
        set((s) => ({
          lanes: s.lanes.map((lane) =>
            lane.id === laneId ? { ...lane, status: "CANCELLED" as LaneStatus } : lane,
          ),
        }));
      },

      selectLane: (id) => set({ selectedLaneId: id }),

      kpis: () => {
        const { lanes } = get();
        const today = new Date().toISOString().slice(0, 10);
        const active = lanes.filter((l) => l.status !== "CANCELLED");
        const totalExpected = active.reduce((s, l) => s + l.totalExpectedUnits, 0);
        const totalArrived = active.reduce((s, l) => s + l.totalArrivedUnits, 0);
        return {
          activeLanes: lanes.filter((l) => l.status === "STAGING").length,
          readyForCheck: lanes.filter((l) => l.status === "READY").length,
          movedToday: lanes.filter((l) => l.movedAt?.startsWith(today)).length,
          withExceptions: active.filter((l) => l.hasShortage).length,
          arrivalRate: totalExpected > 0 ? `${Math.round((totalArrived / totalExpected) * 100)}%` : "—",
          totalLanes: active.length,
        };
      },

      readyLanes: () => get().lanes.filter((l) => l.status === "READY"),
      stagingLanes: () => get().lanes.filter((l) => l.status === "STAGING"),

      laneProgress: (lane) => {
        if (lane.totalLines === 0) return 0;
        const settled = lane.lines.filter((l) => l.status !== "PENDING").length;
        return Math.round((settled / lane.totalLines) * 100);
      },
    }),
    {
      name: "trilowms-consolidation-v1",
      partialize: (s) => ({ lanes: s.lanes, lastSyncAt: s.lastSyncAt }),
    },
  ),
);
