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
  select: (id: string | null, kind: WMSState["selectedKind"]) => void;
  setViewMode: (m: ViewMode) => void;
  toggle: (k: "showForklifts" | "showDocks" | "showLabels" | "showHeatmap") => void;
  setZoneFilter: (id: string | null) => void;
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
  select: (id, kind) => set({ selectedId: id, selectedKind: kind }),
  setViewMode: (m) => set({ viewMode: m, showHeatmap: m !== "default" }),
  toggle: (k) => set((s) => ({ ...s, [k]: !s[k] })),
  setZoneFilter: (id) => set({ zoneFilter: id }),
}));
