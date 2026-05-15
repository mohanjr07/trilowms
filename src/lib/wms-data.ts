// Mock WMS data + types
export type ZoneType =
  | "Raw Material"
  | "Finished Goods"
  | "Fast Moving"
  | "Slow Moving"
  | "Hazardous"
  | "Cold Storage"
  | "Returns"
  | "QC Hold";

export type BinStatus = "Empty" | "Partial" | "Full" | "Reserved" | "Blocked" | "Damaged";

export interface Bin {
  id: string;
  code: string;
  status: BinStatus;
  occupancy: number; // 0-1
  sku?: string;
  pallets: number;
}

export interface Rack {
  id: string;
  code: string;
  position: [number, number]; // x, z grid
  rotation: 0 | 90;
  levels: number;
  binsPerLevel: number;
  bins: Bin[];
}

export interface Aisle {
  id: string;
  code: string;
  racks: Rack[];
}

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  color: string;
  bounds: { x: number; z: number; w: number; d: number };
  utilization: number;
  activity: number;
  aisles: Aisle[];
}

export interface Dock {
  id: string;
  code: string;
  kind: "Inbound" | "Outbound";
  occupied: boolean;
  truckId?: string;
  position: [number, number];
}

export interface Forklift {
  id: string;
  code: string;
  path: [number, number][];
  speed: number;
}

export interface Warehouse {
  name: string;
  size: { w: number; d: number };
  zones: Zone[];
  docks: Dock[];
  forklifts: Forklift[];
}

export const ZONE_COLORS: Record<ZoneType, string> = {
  "Raw Material": "#d97706",
  "Finished Goods": "#0891b2",
  "Fast Moving": "#16a34a",
  "Slow Moving": "#6366f1",
  Hazardous: "#dc2626",
  "Cold Storage": "#06b6d4",
  Returns: "#a855f7",
  "QC Hold": "#eab308",
};

function makeBins(rackId: string, levels: number, perLevel: number): Bin[] {
  const bins: Bin[] = [];
  const statuses: BinStatus[] = ["Empty", "Partial", "Full", "Reserved", "Blocked"];
  for (let l = 0; l < levels; l++) {
    for (let p = 0; p < perLevel; p++) {
      const r = Math.random();
      const status: BinStatus =
        r < 0.15 ? "Empty" :
        r < 0.45 ? "Partial" :
        r < 0.85 ? "Full" :
        r < 0.95 ? "Reserved" :
        statuses[Math.floor(Math.random() * statuses.length)];
      bins.push({
        id: `${rackId}-L${l + 1}-${p + 1}`,
        code: `${rackId}-${String.fromCharCode(65 + l)}${p + 1}`,
        status,
        occupancy: status === "Empty" ? 0 : status === "Full" ? 1 : Math.random(),
        sku: status !== "Empty" ? `SKU-${Math.floor(10000 + Math.random() * 89999)}` : undefined,
        pallets: status === "Full" ? 2 : status === "Partial" ? 1 : 0,
      });
    }
  }
  return bins;
}

export function makeZone(
  name: string,
  type: ZoneType,
  bounds: Zone["bounds"],
  aisleCount: number,
  racksPerAisle: number,
): Zone {
  const aisles: Aisle[] = [];
  for (let a = 0; a < aisleCount; a++) {
    const racks: Rack[] = [];
    for (let r = 0; r < racksPerAisle; r++) {
      const rid = `${name.slice(0, 2).toUpperCase()}-A${a + 1}-R${r + 1}`;
      const levels = 4;
      const binsPerLevel = 4;
      // Two rows of racks per aisle
      for (const side of [0, 1]) {
        const rackId = `${rid}-${side === 0 ? "L" : "R"}`;
        const x = bounds.x + 1.5 + a * 4 + (side === 0 ? -0.9 : 0.9);
        const z = bounds.z + 1.5 + r * 2.2;
        racks.push({
          id: rackId,
          code: rackId,
          position: [x, z],
          rotation: 0,
          levels,
          binsPerLevel,
          bins: makeBins(rackId, levels, binsPerLevel),
        });
      }
    }
    aisles.push({ id: `${name}-A${a + 1}`, code: `Aisle ${a + 1}`, racks });
  }
  const allBins = aisles.flatMap((a) => a.racks.flatMap((r) => r.bins));
  const utilization =
    allBins.reduce((s, b) => s + b.occupancy, 0) / Math.max(1, allBins.length);
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    type,
    color: ZONE_COLORS[type],
    bounds,
    utilization,
    activity: Math.random() * 0.8 + 0.2,
    aisles,
  };
}

export const warehouse: Warehouse = {
  name: "TRILO-DC-01",
  size: { w: 60, d: 40 },
  zones: [
    makeZone("Inbound Staging", "Raw Material", { x: -28, z: -18, w: 14, d: 10 }, 2, 4),
    makeZone("Fast Pick", "Fast Moving", { x: -12, z: -18, w: 14, d: 16 }, 3, 6),
    makeZone("Bulk Storage", "Finished Goods", { x: 4, z: -18, w: 14, d: 16 }, 3, 6),
    makeZone("Cold Chain", "Cold Storage", { x: 20, z: -18, w: 8, d: 10 }, 2, 4),
    makeZone("Hazmat", "Hazardous", { x: 20, z: -6, w: 8, d: 6 }, 1, 3),
    makeZone("Returns / QC", "QC Hold", { x: -28, z: -6, w: 14, d: 8 }, 2, 3),
    makeZone("Slow Movers", "Slow Moving", { x: 4, z: 0, w: 14, d: 10 }, 2, 4),
    makeZone("Outbound Staging", "Finished Goods", { x: -12, z: 0, w: 14, d: 10 }, 2, 4),
  ],
  docks: [
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `dock-in-${i + 1}`,
      code: `IN-${i + 1}`,
      kind: "Inbound" as const,
      occupied: Math.random() > 0.4,
      truckId: Math.random() > 0.4 ? `TRK-${1000 + i}` : undefined,
      position: [-22 + i * 6, -19.8] as [number, number],
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `dock-out-${i + 1}`,
      code: `OUT-${i + 1}`,
      kind: "Outbound" as const,
      occupied: Math.random() > 0.5,
      truckId: Math.random() > 0.5 ? `TRK-${2000 + i}` : undefined,
      position: [-22 + i * 6, 11.8] as [number, number],
    })),
  ],
  forklifts: [
    { id: "fl-1", code: "FL-01", path: [[-20, -10], [-10, -10], [-10, 0], [-20, 0]], speed: 0.4 },
    { id: "fl-2", code: "FL-02", path: [[6, -10], [16, -10], [16, 4], [6, 4]], speed: 0.3 },
    { id: "fl-3", code: "FL-03", path: [[-4, -16], [10, -16], [10, -4], [-4, -4]], speed: 0.5 },
  ],
};

export function totalKPIs(w: Warehouse) {
  const allBins = w.zones.flatMap((z) =>
    z.aisles.flatMap((a) => a.racks.flatMap((r) => r.bins)),
  );
  const total = allBins.length;
  const occupied = allBins.filter((b) => b.status !== "Empty").length;
  const blocked = allBins.filter((b) => b.status === "Blocked" || b.status === "Damaged").length;
  const utilization = allBins.reduce((s, b) => s + b.occupancy, 0) / total;
  return { totalBins: total, occupied, blocked, utilization };
}
