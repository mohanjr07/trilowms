import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "./supabase";
import {
  warehouse as defaultWarehouse,
  type Warehouse,
  type ZoneType,
  type Dock,
  type Rack,
  type Bin,
  makeZone,
  makeEmptyZone,
  makeEmptyRack,
  generateBinsForRack,
} from "./wms-data";

export interface ZoneFormData {
  name: string;
  type: ZoneType;
  x: number;
  z: number;
  w: number;
  d: number;
  aisleCount: number;
  racksPerAisle: number;
}

export interface DockFormData {
  code: string;
  kind: "Inbound" | "Outbound";
  x: number;
  z: number;
}

export interface NewWarehouseFormData {
  name: string;
  w: number;
  d: number;
}

function makeBlankWarehouse(form: NewWarehouseFormData): Warehouse {
  return {
    name: form.name,
    size: { w: form.w, d: form.d },
    zones: [],
    docks: [],
    forklifts: [],
  };
}

interface EditorState {
  warehouses: Warehouse[];
  activeId: string;

  // Autosave tracking (not persisted — reset fresh each page load)
  lastSavedAt: number | null;
  isDirty: boolean;
  isSaving: boolean;
  isHydrating: boolean;
  syncError: string | null;
  _saveToCloud: () => Promise<void>;
  _loadFromCloud: () => Promise<void>;

  // Computed active warehouse
  readonly warehouse: Warehouse;

  // Multi-warehouse
  createWarehouse: (form: NewWarehouseFormData) => void;
  switchWarehouse: (name: string) => void;
  deleteWarehouse: (name: string) => void;
  duplicateWarehouse: (name: string) => void;

  // Zone CRUD (on active warehouse)
  addZone: (form: ZoneFormData) => void;
  addEmptyZone: (name: string, type: ZoneType, bounds: { x: number; z: number; w: number; d: number }) => void;
  updateZone: (id: string, form: Partial<ZoneFormData>) => void;
  deleteZone: (id: string) => void;

  // Rack CRUD — racks are placed inside a specific zone
  addRackToZone: (zoneId: string, position: [number, number]) => void;
  addBinsToRack: (zoneId: string, rackId: string, count: number) => void;

  // Dock CRUD (on active warehouse)
  addDock: (form: DockFormData) => void;
  deleteDock: (id: string) => void;

  // Active warehouse meta
  renameWarehouse: (name: string) => void;
  resizeWarehouse: (w: number, d: number) => void;

  // Reset active to default
  resetToDefault: () => void;

  // Atomically switch to a warehouse and bulk-add zones+docks in one set() call
  commitLayout: (
    name: string,
    zones: ZoneFormData[],
    docks: DockFormData[],
  ) => void;

  // Atomically write empty zones + docks (from drag-drop builder) in one set() call
  commitEmptyLayout: (
    name: string,
    zones: { name: string; type: ZoneType; bounds: { x: number; z: number; w: number; d: number } }[],
    docks: { code: string; kind: "Inbound" | "Outbound"; position: [number, number] }[],
  ) => void;
}

// Helper — update active warehouse in list
function updateActive(warehouses: Warehouse[], activeId: string, fn: (w: Warehouse) => Warehouse): Warehouse[] {
  return warehouses.map((w) => (w.name === activeId ? fn(w) : w));
}

export const useEditorStore = create<EditorState>()(
  persist(
    (rawSet, get) => {
      // Wrap set so any mutation to warehouses/activeId auto-marks dirty
      const set: typeof rawSet = (updater, replace?) => {
        if (typeof updater === "function") {
          rawSet((s) => {
            const next = (updater as (s: EditorState) => Partial<EditorState>)(s);
            const hasMutation = "warehouses" in next || "activeId" in next;
            return hasMutation ? { isDirty: true, ...next } : next;
          }, replace as never);
        } else {
          rawSet(updater, replace as never);
        }
      };

      return {
        warehouses: [defaultWarehouse],
        activeId: defaultWarehouse.name,

        // Autosave UI state — starts clean on every page load
        lastSavedAt: null,
        isDirty: false,
        isSaving: false,
        isHydrating: false,
        syncError: null,
        _loadFromCloud: async () => {
          rawSet({ isHydrating: true, syncError: null });
          try {
            // Fetch the single snapshot row (we store everything in one row keyed by id=1)
            const { data, error } = await supabase
              .from("wms_snapshots")
              .select("warehouses, active_id")
              .eq("id", 1)
              .maybeSingle();
            if (error) throw error;
            if (data && Array.isArray(data.warehouses) && data.warehouses.length > 0) {
              rawSet({
                warehouses: data.warehouses as Warehouse[],
                activeId: data.active_id as string,
                isHydrating: false,
              });
            } else {
              // Nothing in Supabase yet — keep whatever is in localStorage
              rawSet({ isHydrating: false });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            // On error, keep localStorage data and surface the error
            rawSet({ syncError: msg, isHydrating: false });
          }
        },
        _saveToCloud: async () => {
          const { warehouses, activeId } = get();
          rawSet({ isSaving: true, syncError: null });
          try {
            // Upsert a single row (id=1) that holds the entire warehouse list.
            // This avoids per-warehouse rows and unique constraint issues.
            const { error } = await supabase
              .from("wms_snapshots")
              .upsert(
                { id: 1, warehouses, active_id: activeId, updated_at: new Date().toISOString() },
                { onConflict: "id" },
              );
            if (error) throw error;
            rawSet({ lastSavedAt: Date.now(), isDirty: false, isSaving: false });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            rawSet({ syncError: msg, isSaving: false });
          }
        },

        get warehouse() {
          const { warehouses, activeId } = get();
          return warehouses.find((w) => w.name === activeId) ?? warehouses[0];
        },

        createWarehouse: (form) => set((s) => {
          const newW = makeBlankWarehouse(form);
          return { warehouses: [...s.warehouses, newW], activeId: newW.name };
        }),

        switchWarehouse: (name) => set({ activeId: name }),

        deleteWarehouse: (name) => set((s) => {
          if (s.warehouses.length <= 1) return s; // keep at least one
          const remaining = s.warehouses.filter((w) => w.name !== name);
          const newActive = s.activeId === name ? remaining[0].name : s.activeId;
          return { warehouses: remaining, activeId: newActive };
        }),

        duplicateWarehouse: (name) => set((s) => {
          const src = s.warehouses.find((w) => w.name === name);
          if (!src) return s;
          const copy: Warehouse = { ...src, name: `${src.name} (Copy)` };
          return { warehouses: [...s.warehouses, copy], activeId: copy.name };
        }),

        addZone: (form) => set((s) => {
          const zone = makeZone(
            form.name, form.type,
            { x: form.x, z: form.z, w: form.w, d: form.d },
            form.aisleCount, form.racksPerAisle,
          );
          return { warehouses: updateActive(s.warehouses, s.activeId, (w) => ({ ...w, zones: [...w.zones, zone] })) };
        }),

        addEmptyZone: (name, type, bounds) => set((s) => {
          const zone = makeEmptyZone(name, type, bounds);
          return { warehouses: updateActive(s.warehouses, s.activeId, (w) => ({ ...w, zones: [...w.zones, zone] })) };
        }),

        updateZone: (id, form) => set((s) => ({
          warehouses: updateActive(s.warehouses, s.activeId, (w) => ({
            ...w,
            zones: w.zones.map((z) => {
              if (z.id !== id) return z;
              return makeZone(
                form.name ?? z.name,
                form.type ?? z.type,
                { x: form.x ?? z.bounds.x, z: form.z ?? z.bounds.z, w: form.w ?? z.bounds.w, d: form.d ?? z.bounds.d },
                form.aisleCount ?? z.aisles.length,
                form.racksPerAisle ?? (z.aisles[0]?.racks.length / 2 || 4),
              );
            }),
          })),
        })),

        deleteZone: (id) => set((s) => ({
          warehouses: updateActive(s.warehouses, s.activeId, (w) => ({
            ...w, zones: w.zones.filter((z) => z.id !== id),
          })),
        })),

        addDock: (form) => set((s) => {
          const dock: Dock = {
            id: `dock-${Date.now()}`,
            code: form.code,
            kind: form.kind,
            occupied: false,
            position: [form.x, form.z],
          };
          return { warehouses: updateActive(s.warehouses, s.activeId, (w) => ({ ...w, docks: [...w.docks, dock] })) };
        }),

        deleteDock: (id) => set((s) => ({
          warehouses: updateActive(s.warehouses, s.activeId, (w) => ({
            ...w, docks: w.docks.filter((d) => d.id !== id),
          })),
        })),

        addRackToZone: (zoneId, position) => set((s) => {
          return {
            warehouses: updateActive(s.warehouses, s.activeId, (w) => ({
              ...w,
              zones: w.zones.map((z) => {
                if (z.id !== zoneId) return z;
                const existingCount = z.aisles.reduce((sum, a) => sum + a.racks.length, 0);
                const rack = makeEmptyRack(zoneId, existingCount + 1, position);
                if (z.aisles.length === 0) {
                  return {
                    ...z,
                    aisles: [{ id: `${zoneId}-A1`, code: "Aisle 1", racks: [rack] }],
                  };
                }
                const [firstAisle, ...rest] = z.aisles;
                return {
                  ...z,
                  aisles: [{ ...firstAisle, racks: [...firstAisle.racks, rack] }, ...rest],
                };
              }),
            })),
          };
        }),

        addBinsToRack: (zoneId, rackId, count) => set((s) => {
          return {
            warehouses: updateActive(s.warehouses, s.activeId, (w) => ({
              ...w,
              zones: w.zones.map((z) => {
                if (z.id !== zoneId) return z;
                return {
                  ...z,
                  aisles: z.aisles.map((a) => ({
                    ...a,
                    racks: a.racks.map((r) => {
                      if (r.id !== rackId) return r;
                      const newBins = generateBinsForRack(r, count);
                      return { ...r, bins: [...r.bins, ...newBins] };
                    }),
                  })),
                };
              }),
            })),
          };
        }),

        renameWarehouse: (name) => set((s) => ({
          warehouses: updateActive(s.warehouses, s.activeId, (w) => ({ ...w, name })),
          activeId: name,
        })),

        resizeWarehouse: (w, d) => set((s) => ({
          warehouses: updateActive(s.warehouses, s.activeId, (wh) => ({ ...wh, size: { w, d } })),
        })),

        resetToDefault: () => set((s) => ({
          warehouses: updateActive(s.warehouses, s.activeId, () => defaultWarehouse),
          activeId: defaultWarehouse.name,
        })),

        commitLayout: (name, zoneForms, dockForms) => set((s) => {
          const zones = zoneForms.map((form) =>
            makeZone(form.name, form.type, { x: form.x, z: form.z, w: form.w, d: form.d }, form.aisleCount, form.racksPerAisle),
          );
          const docks: Dock[] = dockForms.map((form, i) => ({
            id: `dock-${Date.now()}-${i}`,
            code: form.code,
            kind: form.kind,
            occupied: false,
            position: [form.x, form.z] as [number, number],
          }));
          const warehouses = s.warehouses.map((w) =>
            w.name === name ? { ...w, zones, docks } : w,
          );
          return { warehouses, activeId: name };
        }),

        commitEmptyLayout: (name, zoneDefs, dockDefs) => set((s) => {
          const zones = zoneDefs.map((z) => makeEmptyZone(z.name, z.type, z.bounds));
          const docks: Dock[] = dockDefs.map((d, i) => ({
            id: `dock-${Date.now()}-${i}`,
            code: d.code,
            kind: d.kind,
            occupied: false,
            position: d.position,
          }));
          const warehouses = s.warehouses.map((w) =>
            w.name === name ? { ...w, zones, docks } : w,
          );
          return { warehouses, activeId: name };
        }),
      };
    },
    {
      name: "trilowms-warehouse-editor",
      // Only persist warehouse data — NOT isDirty/lastSavedAt (those reset each page load)
      partialize: (state) => ({
        warehouses: state.warehouses,
        activeId: state.activeId,
      }),
      // Forklift paths are reference/fixture data (like the default zone layout),
      // not something users edit — so anyone who already has the old, rack-clipping
      // paths persisted from before that fix keeps replaying them forever unless we
      // backfill the shipped default warehouse's forklifts here too.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<EditorState, "warehouses" | "activeId">>;
        const warehouses = (p.warehouses ?? current.warehouses).map((w) =>
          w.name === defaultWarehouse.name ? { ...w, forklifts: defaultWarehouse.forklifts } : w,
        );
        return { ...current, ...p, warehouses };
      },
    },
  ),
);
