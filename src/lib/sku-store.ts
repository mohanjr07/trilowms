/**
 * TriloWMS — SKU Master Store
 * Enterprise SKU management with full CRUD, filtering, and RBAC
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkuStatus = "Active" | "Inactive" | "Hold" | "Discontinued" | "Pending";
export type StorageType = "Ambient" | "Cold" | "Frozen" | "Hazmat" | "Secure" | "Bulk";
export type UnitOfMeasure = "EA" | "CS" | "PLT" | "KG" | "LB" | "L" | "MT" | "FT" | "M" | "PK";

export interface SkuDimensions {
  length: number;
  width: number;
  height: number;
  unit: "mm" | "cm" | "in";
}

export interface PalletConfig {
  unitsPerLayer: number;
  layersPerPallet: number;
  totalUnitsPerPallet: number;
}

export interface SKU {
  id: string;
  skuCode: string;
  barcode: string;
  itemName: string;
  description: string;
  category: string;
  subcategory: string;
  uom: UnitOfMeasure;
  dimensions: SkuDimensions;
  weight: number;          // in kg
  weightUnit: "kg" | "lb";
  palletConfig: PalletConfig;
  batchTracking: boolean;
  serialTracking: boolean;
  expiryTracking: boolean;
  reorderLevel: number;
  storageType: StorageType;
  status: SkuStatus;
  // Computed/additional fields
  onHand?: number;
  allocated?: number;
  available?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
  imageUrl?: string;
  notes?: string;
  supplier?: string;
  costPrice?: number;
  sellingPrice?: number;
  taxCode?: string;
  countryOfOrigin?: string;
  hsCode?: string;
}

export const SKU_CATEGORIES: Record<string, string[]> = {
  "Electronics": ["PCBs & Modules", "Cables & Connectors", "Power Supplies", "Sensors", "Batteries"],
  "Hardware": ["Fasteners", "Brackets & Mounts", "Bearings", "Tools", "Springs & Clips"],
  "Raw Materials": ["Metals", "Plastics", "Chemicals", "Textiles", "Composites"],
  "Packaging": ["Boxes", "Bags", "Foam", "Labels", "Strapping"],
  "Consumables": ["Lubricants", "Adhesives", "Cleaning", "Safety", "Office"],
  "Finished Goods": ["Assemblies", "Subassemblies", "Kits", "Sets", "Bundles"],
};

// ─── Seed data ────────────────────────────────────────────────────────────────

function makeSKU(i: number): SKU {
  const categories = Object.keys(SKU_CATEGORIES);
  const cat = categories[i % categories.length];
  const subcats = SKU_CATEGORIES[cat];
  const statuses: SkuStatus[] = ["Active", "Active", "Active", "Active", "Hold", "Inactive", "Pending", "Discontinued"];
  const storageTypes: StorageType[] = ["Ambient", "Ambient", "Cold", "Frozen", "Hazmat", "Secure", "Bulk", "Ambient"];
  const uoms: UnitOfMeasure[] = ["EA", "CS", "PLT", "KG", "LB", "PK", "MT", "EA"];
  const names = [
    "Aluminum Extrusion Bracket 40x40",
    "Steel Coil 2.5mm Hot-Rolled",
    "Hydraulic Pump Assembly 12V",
    "Carbon Fiber Filter Element",
    "Insulated Wire 14AWG THHN",
    "PCB Controller Module Rev3",
    "Deep Groove Ball Bearing 6204-2RS",
    "Lithium Ion Cell 18650 2600mAh",
    "Stainless Steel Hex Bolt M8x40",
    "Industrial HDPE Drum 220L",
    "Anti-Static Bubble Wrap Roll",
    "Servo Motor NEMA 23 3Nm",
    "Pneumatic Cylinder 50mm Bore",
    "Optical Fiber Cable OM3 50m",
    "Zinc Die-Cast Housing IP67",
    "Polycarbonate Sheet 10mm",
    "Industrial Epoxy Adhesive 1L",
    "Proximity Sensor NPN 18mm",
    "Conveyor Belt PVC 600mm",
    "AC Contactor 40A 24VDC Coil",
    "Foam Insert Custom Molded",
    "RFID Tag UHF 860-960MHz",
    "Emergency Stop Button NC",
    "Thermal Grease Compound 50g",
    "Safety Gloves Cut Level 5",
  ];

  const onHand = Math.floor(50 + Math.random() * 5000);
  const allocated = Math.floor(Math.random() * onHand * 0.45);

  return {
    id: `sku-${String(i + 1).padStart(4, "0")}`,
    skuCode: `SKU-${String(10000 + i)}`,
    barcode: `8901${String(234567890 + i * 13).slice(-9)}`,
    itemName: names[i % names.length],
    description: `Enterprise-grade ${names[i % names.length].toLowerCase()} for industrial warehouse operations. Compliant with ISO 9001 standards.`,
    category: cat,
    subcategory: subcats[i % subcats.length],
    uom: uoms[i % uoms.length],
    dimensions: {
      length: parseFloat((50 + Math.random() * 450).toFixed(1)),
      width: parseFloat((30 + Math.random() * 250).toFixed(1)),
      height: parseFloat((20 + Math.random() * 200).toFixed(1)),
      unit: ["mm", "cm", "in"][i % 3] as "mm" | "cm" | "in",
    },
    weight: parseFloat((0.1 + Math.random() * 50).toFixed(2)),
    weightUnit: i % 5 === 0 ? "lb" : "kg",
    palletConfig: {
      unitsPerLayer: [6, 8, 10, 12, 16, 20, 24][i % 7],
      layersPerPallet: [4, 5, 6, 8][i % 4],
      totalUnitsPerPallet: [24, 40, 60, 96, 128][i % 5],
    },
    batchTracking: i % 3 === 0,
    serialTracking: i % 7 === 0,
    expiryTracking: i % 4 === 0,
    reorderLevel: Math.floor(50 + Math.random() * 500),
    storageType: storageTypes[i % storageTypes.length],
    status: statuses[i % statuses.length],
    onHand,
    allocated,
    available: onHand - allocated,
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000).toISOString(),
    createdBy: ["Priya Nair", "Alex Rodriguez", "Maria Chen"][i % 3],
    lastModifiedBy: ["Priya Nair", "Alex Rodriguez", "Maria Chen", "Robert Steele"][i % 4],
    supplier: ["GlobalParts Inc.", "TechSupply Co.", "IndustrialHub Ltd.", "MegaSource Corp."][i % 4],
    costPrice: parseFloat((5 + Math.random() * 995).toFixed(2)),
    sellingPrice: parseFloat((8 + Math.random() * 1500).toFixed(2)),
    countryOfOrigin: ["USA", "Germany", "China", "Japan", "India", "South Korea"][i % 6],
    hsCode: `${8400 + (i * 17 % 99)}.${String(10 + (i * 7 % 90)).padStart(2, "0")}`,
    taxCode: ["GST18", "GST12", "GST5", "EXEMPT"][i % 4],
    notes: i % 5 === 0 ? "Handle with care. Fragile item. Requires special packaging." : undefined,
  };
}

const SEED_SKUS: SKU[] = Array.from({ length: 48 }, (_, i) => makeSKU(i));

// ─── Store ────────────────────────────────────────────────────────────────────

export interface SkuFilters {
  search: string;
  category: string;
  status: string;
  storageType: string;
  batchTracking: "" | "true" | "false";
  serialTracking: "" | "true" | "false";
  expiryTracking: "" | "true" | "false";
  lowStock: boolean;
}

export const DEFAULT_FILTERS: SkuFilters = {
  search: "",
  category: "",
  status: "",
  storageType: "",
  batchTracking: "",
  serialTracking: "",
  expiryTracking: "",
  lowStock: false,
};

interface SkuState {
  skus: SKU[];
  filters: SkuFilters;
  sortKey: keyof SKU | "";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;

  // Actions
  addSku: (sku: Omit<SKU, "id" | "createdAt" | "updatedAt">) => SKU;
  updateSku: (id: string, patch: Partial<SKU>) => void;
  deleteSku: (id: string) => void;
  setFilters: (f: Partial<SkuFilters>) => void;
  resetFilters: () => void;
  setSort: (key: keyof SKU) => void;
  setPage: (p: number) => void;
  setPageSize: (ps: number) => void;

  // Derived
  filteredSkus: () => SKU[];
  pagedSkus: () => SKU[];
  totalPages: () => number;
  kpis: () => { total: number; active: number; onHold: number; lowStock: number; totalOnHand: number };
}

export const useSkuStore = create<SkuState>()(
  persist(
    (set, get) => ({
      skus: [],
      filters: DEFAULT_FILTERS,
      sortKey: "",
      sortDir: "asc",
      page: 1,
      pageSize: 20,

      addSku: (sku) => {
        const id = `sku-${Date.now()}`;
        const now = new Date().toISOString();
        const newSku: SKU = { ...sku, id, createdAt: now, updatedAt: now };
        set((s) => ({ skus: [newSku, ...s.skus] }));
        return newSku;
      },

      updateSku: (id, patch) => {
        set((s) => ({
          skus: s.skus.map((sk) =>
            sk.id === id ? { ...sk, ...patch, updatedAt: new Date().toISOString() } : sk
          ),
        }));
      },

      deleteSku: (id) => {
        set((s) => ({ skus: s.skus.filter((sk) => sk.id !== id) }));
      },

      setFilters: (f) => {
        set((s) => ({ filters: { ...s.filters, ...f }, page: 1 }));
      },

      resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 1 }),

      setSort: (key) => {
        set((s) => ({
          sortKey: key,
          sortDir: s.sortKey === key && s.sortDir === "asc" ? "desc" : "asc",
        }));
      },

      setPage: (p) => set({ page: p }),
      setPageSize: (ps) => set({ pageSize: ps, page: 1 }),

      filteredSkus: () => {
        const { skus, filters, sortKey, sortDir } = get();
        let result = [...skus];

        if (filters.search) {
          const q = filters.search.toLowerCase();
          result = result.filter(
            (s) =>
              s.skuCode.toLowerCase().includes(q) ||
              s.itemName.toLowerCase().includes(q) ||
              s.barcode.includes(q) ||
              s.category.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q)
          );
        }
        if (filters.category) result = result.filter((s) => s.category === filters.category);
        if (filters.status) result = result.filter((s) => s.status === filters.status);
        if (filters.storageType) result = result.filter((s) => s.storageType === filters.storageType);
        if (filters.batchTracking !== "") result = result.filter((s) => String(s.batchTracking) === filters.batchTracking);
        if (filters.serialTracking !== "") result = result.filter((s) => String(s.serialTracking) === filters.serialTracking);
        if (filters.expiryTracking !== "") result = result.filter((s) => String(s.expiryTracking) === filters.expiryTracking);
        if (filters.lowStock) result = result.filter((s) => (s.available ?? 0) < (s.reorderLevel ?? 100));

        if (sortKey) {
          result.sort((a, b) => {
            const av = a[sortKey] ?? "";
            const bv = b[sortKey] ?? "";
            const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
            return sortDir === "asc" ? cmp : -cmp;
          });
        }

        return result;
      },

      pagedSkus: () => {
        const { page, pageSize } = get();
        const all = get().filteredSkus();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => {
        const { pageSize } = get();
        return Math.max(1, Math.ceil(get().filteredSkus().length / pageSize));
      },

      kpis: () => {
        const skus = get().skus;
        return {
          total: skus.length,
          active: skus.filter((s) => s.status === "Active").length,
          onHold: skus.filter((s) => s.status === "Hold").length,
          lowStock: skus.filter((s) => (s.available ?? 0) < (s.reorderLevel ?? 100)).length,
          totalOnHand: skus.reduce((acc, s) => acc + (s.onHand ?? 0), 0),
        };
      },
    }),
    {
      name: "trilowms-sku-master-v2",
      partialize: (state) => ({ skus: state.skus }),
    }
  )
);
