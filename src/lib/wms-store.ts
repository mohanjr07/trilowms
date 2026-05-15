import { create } from "zustand";

export type ViewMode =
  | "default"
  | "occupancy"
  | "picking"
  | "congestion"
  | "activity"
  | "movement";

interface WMSState {
  selectedId: string | null;
  selectedKind: "zone" | "rack" | "bin" | "dock" | null;
  viewMode: ViewMode;
  showForklifts: boolean;
  showDocks: boolean;
  showLabels: boolean;
  showHeatmap: boolean;
  zoneFilter: string | null;

  /** Tracks active warehouse so switching resets per-warehouse UI state */
  activeWarehouseId: string | null;

  select: (id: string | null, kind: WMSState["selectedKind"]) => void;
  setViewMode: (m: ViewMode) => void;
  toggle: (k: "showForklifts" | "showDocks" | "showLabels" | "showHeatmap") => void;
  setZoneFilter: (id: string | null) => void;

  /** Call when switching active warehouse – resets selection/view */
  onWarehouseSwitch: (newId: string) => void;
}

export const useWMSStore = create<WMSState>((set) => ({
  selectedId: null,
  selectedKind: null,
  viewMode: "default",
  showForklifts: true,
  showDocks: true,
  showLabels: true,
  showHeatmap: false,
  zoneFilter: null,
  activeWarehouseId: null,

  select: (id, kind) => set({ selectedId: id, selectedKind: kind }),
  setViewMode: (m) => set({ viewMode: m, showHeatmap: m !== "default" }),
  toggle: (k) => set((s) => ({ ...s, [k]: !s[k] })),
  setZoneFilter: (id) => set({ zoneFilter: id }),

  onWarehouseSwitch: (newId) =>
    set({
      activeWarehouseId: newId,
      selectedId: null,
      selectedKind: null,
      zoneFilter: null,
      viewMode: "default",
      showHeatmap: false,
    }),
}));
