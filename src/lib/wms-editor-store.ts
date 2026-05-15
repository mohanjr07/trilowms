import { create } from "zustand";
import { persist } from "zustand/middleware";
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
    (set, get) => ({
      warehouses: [defaultWarehouse],
      activeId: defaultWarehouse.name,

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
              // Count existing racks across all aisles for unique index
              const existingCount = z.aisles.reduce((sum, a) => sum + a.racks.length, 0);
              const rack = makeEmptyRack(zoneId, existingCount + 1, position);
              // Place in a single default aisle or create one
              if (z.aisles.length === 0) {
                return {
                  ...z,
                  aisles: [{ id: `${zoneId}-A1`, code: "Aisle 1", racks: [rack] }],
                };
              }
              // Add to first aisle
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
        // Build zone objects
        const zones = zoneForms.map((form) =>
          makeZone(form.name, form.type, { x: form.x, z: form.z, w: form.w, d: form.d }, form.aisleCount, form.racksPerAisle),
        );
        // Build dock objects
        const docks: Dock[] = dockForms.map((form, i) => ({
          id: `dock-${Date.now()}-${i}`,
          code: form.code,
          kind: form.kind,
          occupied: false,
          position: [form.x, form.z] as [number, number],
        }));
        // Write zones+docks into the named warehouse and switch to it atomically
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
    }),
    { name: "trilowms-warehouse-editor" },
  ),
);
