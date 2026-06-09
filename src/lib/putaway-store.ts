/**
 * TriloWMS — Putaway Module Store
 * Directed putaway engine with rule-based bin assignment, task management
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PutawayStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";
export type PutawayStrategy = "FIXED" | "DIRECTED" | "CHAOTIC" | "ZONE_BASED" | "FEFO" | "FIFO";

export interface PutawayRule {
  id: string;
  name: string;
  description: string;
  skuCategory: string;
  storageType: string;
  targetZone: string;
  strategy: PutawayStrategy;
  priority: number;
  active: boolean;
}

export interface PutawayTask {
  id: string;
  asnId: string | null;
  asnLine: string | null;
  skuCode: string;
  skuName: string;
  quantity: number;
  uom: string;
  lotNumber: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  palletId: string | null;
  sourceLocation: string;          // dock door or staging area
  sourceDock: string | null;
  suggestedBinId: string | null;
  suggestedBinCode: string | null;
  actualBinId: string | null;
  actualBinCode: string | null;
  zone: string;
  aisle: string | null;
  rack: string | null;
  strategy: PutawayStrategy;
  assignedOperator: string | null;
  assignedOperatorId: string | null;
  status: PutawayStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  weight: number;
  equipment: "FORKLIFT" | "PALLET_JACK" | "MANUAL" | null;
  travelDistance: number | null;   // metres (estimated)
  cycleTime: number | null;        // minutes (actual)
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const OPERATORS = [
  { id: "op1", name: "Tommy Wu" },
  { id: "op2", name: "Carlos Mendez" },
  { id: "op3", name: "Marcus Johnson" },
  { id: "op4", name: "Aisha Patel" },
];

const ZONES = ["Zone A — Raw Material", "Zone B — Finished Goods", "Zone C — Fast Moving", "Zone D — Cold Storage", "Zone E — QC Hold"];
const AISLES = ["A-01", "A-02", "B-01", "B-02", "C-01", "C-02"];
const RACKS = ["R-01", "R-02", "R-03", "R-04", "R-05"];
const SKUS = [
  { code: "SKU-10000", name: "Aluminum Extrusion Bracket 40x40" },
  { code: "SKU-10001", name: "Steel Coil 2.5mm Hot-Rolled" },
  { code: "SKU-10002", name: "Hydraulic Pump Assembly 12V" },
  { code: "SKU-10003", name: "Carbon Fiber Filter Element" },
  { code: "SKU-10004", name: "Insulated Wire 14AWG THHN" },
  { code: "SKU-10005", name: "PCB Controller Module Rev3" },
  { code: "SKU-10006", name: "Deep Groove Ball Bearing 6204-2RS" },
  { code: "SKU-10007", name: "Lithium Ion Cell 18650 2600mAh" },
];

const STRATEGIES: PutawayStrategy[] = ["DIRECTED", "DIRECTED", "ZONE_BASED", "FEFO", "CHAOTIC", "FIXED"];
const EQUIPMENT: PutawayTask["equipment"][] = ["FORKLIFT", "PALLET_JACK", "FORKLIFT", "MANUAL", "PALLET_JACK"];

const SEED_RULES: PutawayRule[] = [
  { id: "rule-1", name: "Cold Storage — FEFO", description: "All cold items route to Zone D, FEFO sequence", skuCategory: "Cold", storageType: "Cold", targetZone: "Zone D — Cold Storage", strategy: "FEFO", priority: 1, active: true },
  { id: "rule-2", name: "Hazmat — Fixed Location", description: "Hazmat SKUs to fixed Hazmat zone", skuCategory: "Hazmat", storageType: "Hazmat", targetZone: "Zone F — Hazmat", strategy: "FIXED", priority: 2, active: true },
  { id: "rule-3", name: "Fast Movers — Zone C", description: "High velocity SKUs to Zone C for pick efficiency", skuCategory: "Finished Goods", storageType: "Ambient", targetZone: "Zone C — Fast Moving", strategy: "DIRECTED", priority: 3, active: true },
  { id: "rule-4", name: "Raw Material — Zone A", description: "All raw materials and components to Zone A", skuCategory: "Raw Materials", storageType: "Ambient", targetZone: "Zone A — Raw Material", strategy: "ZONE_BASED", priority: 4, active: true },
  { id: "rule-5", name: "Default — Directed", description: "All other items use directed putaway algorithm", skuCategory: "ALL", storageType: "Ambient", targetZone: "Zone B — Finished Goods", strategy: "DIRECTED", priority: 99, active: true },
];

function buildSeedTasks(): PutawayTask[] {
  const statuses: PutawayStatus[] = ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "COMPLETED", "COMPLETED", "BLOCKED"];
  const priorities: PutawayTask["priority"][] = ["NORMAL", "NORMAL", "HIGH", "URGENT", "NORMAL", "LOW"];

  return Array.from({ length: 45 }, (_, i) => {
    const sku = SKUS[i % SKUS.length];
    const op = i % 5 < 4 ? OPERATORS[i % OPERATORS.length] : null;
    const status = statuses[i % statuses.length];
    const zone = ZONES[i % ZONES.length];
    const aisle = AISLES[i % AISLES.length];
    const rack = RACKS[i % RACKS.length];
    const bin = `${aisle}-${rack}-L${(i % 4) + 1}-P${(i % 5) + 1}`;
    const now = new Date();
    const createdAt = new Date(now.getTime() - i * 1800000);
    const qty = 10 + (i * 13 % 90);

    return {
      id: `PTW-${5000 + i}`,
      asnId: `ASN-20260609-${String((i % 10) + 1).padStart(4, "0")}`,
      asnLine: `line-ASN-20260609-${String((i % 10) + 1).padStart(4, "0")}-1`,
      skuCode: sku.code,
      skuName: sku.name,
      quantity: qty,
      uom: i % 3 === 0 ? "PLT" : "EA",
      lotNumber: `LOT-${10000 + i}`,
      batchNumber: `BATCH-202606-${String(1001 + i * 7).slice(-4)}`,
      expiryDate: i % 5 === 0 ? new Date(now.getTime() + 90 * 24 * 3600000).toISOString().slice(0, 10) : null,
      palletId: `PLT-${50000 + i}`,
      sourceLocation: `Staging-${(i % 4) + 1}`,
      sourceDock: `IN-${String((i % 5) + 1).padStart(2, "0")}`,
      suggestedBinId: `bin-${i * 7 + 1}`,
      suggestedBinCode: bin,
      actualBinId: ["COMPLETED"].includes(status) ? `bin-${i * 7 + 1}` : null,
      actualBinCode: ["COMPLETED"].includes(status) ? bin : null,
      zone,
      aisle,
      rack,
      strategy: STRATEGIES[i % STRATEGIES.length],
      assignedOperator: op?.name ?? null,
      assignedOperatorId: op?.id ?? null,
      status,
      priority: priorities[i % priorities.length],
      createdAt: createdAt.toISOString(),
      assignedAt: op ? new Date(createdAt.getTime() + 300000).toISOString() : null,
      startedAt: ["IN_PROGRESS", "COMPLETED"].includes(status) ? new Date(createdAt.getTime() + 600000).toISOString() : null,
      completedAt: status === "COMPLETED" ? new Date(createdAt.getTime() + 2 * 3600000).toISOString() : null,
      blockedReason: status === "BLOCKED" ? ["Bin obstructed by forklift", "Target bin occupied", "Aisle congestion"][i % 3] : null,
      weight: Math.round(qty * 2.5 * 10) / 10,
      equipment: EQUIPMENT[i % EQUIPMENT.length],
      travelDistance: Math.floor(50 + i * 11 % 300),
      cycleTime: status === "COMPLETED" ? Math.floor(1.5 + i * 0.4 % 6) : null,
    };
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface PutawayFilters {
  search: string;
  status: PutawayStatus | "";
  operator: string;
  zone: string;
  priority: string;
  strategy: PutawayStrategy | "";
}

const DEFAULT_FILTERS: PutawayFilters = {
  search: "",
  status: "",
  operator: "",
  zone: "",
  priority: "",
  strategy: "",
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface PutawayState {
  tasks: PutawayTask[];
  rules: PutawayRule[];
  filters: PutawayFilters;
  selectedTaskId: string | null;
  page: number;
  pageSize: number;

  createTask: (data: Omit<PutawayTask, "id" | "createdAt" | "status">) => PutawayTask;
  assignOperator: (taskId: string, operatorId: string, operatorName: string) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string, actualBinId: string, actualBinCode: string, cycleTime: number) => void;
  blockTask: (taskId: string, reason: string) => void;
  cancelTask: (taskId: string) => void;
  overrideBin: (taskId: string, binId: string, binCode: string) => void;
  selectTask: (id: string | null) => void;
  setFilters: (f: Partial<PutawayFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;

  filteredTasks: () => PutawayTask[];
  pagedTasks: () => PutawayTask[];
  totalPages: () => number;
  kpis: () => {
    open: number;
    assigned: number;
    inProgress: number;
    completedToday: number;
    blocked: number;
    avgCycleTime: string;
    throughputPerHour: number;
  };
  operatorWorkloads: () => { operatorId: string; operatorName: string; assigned: number; inProgress: number; completed: number }[];
}

let _seq = 200;
function nextPtwId() {
  return `PTW-${5000 + ++_seq}`;
}

export const usePutawayStore = create<PutawayState>()(
  persist(
    (set, get) => ({
      tasks: buildSeedTasks(),
      rules: SEED_RULES,
      filters: DEFAULT_FILTERS,
      selectedTaskId: null,
      page: 1,
      pageSize: 20,

      createTask: (data) => {
        const task: PutawayTask = { ...data, id: nextPtwId(), createdAt: new Date().toISOString(), status: "PENDING" };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return task;
      },

      assignOperator: (taskId, operatorId, operatorName) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, assignedOperator: operatorName, assignedOperatorId: operatorId, status: "ASSIGNED" as PutawayStatus, assignedAt: new Date().toISOString() }
              : t
          ),
        }));
      },

      startTask: (taskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: "IN_PROGRESS" as PutawayStatus, startedAt: new Date().toISOString() } : t
          ),
        }));
      },

      completeTask: (taskId, actualBinId, actualBinCode, cycleTime) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, actualBinId, actualBinCode, status: "COMPLETED" as PutawayStatus, completedAt: new Date().toISOString(), cycleTime, blockedReason: null }
              : t
          ),
        }));
      },

      blockTask: (taskId, reason) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: "BLOCKED" as PutawayStatus, blockedReason: reason } : t
          ),
        }));
      },

      cancelTask: (taskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) => t.id === taskId ? { ...t, status: "CANCELLED" as PutawayStatus } : t),
        }));
      },

      overrideBin: (taskId, binId, binCode) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, suggestedBinId: binId, suggestedBinCode: binCode } : t
          ),
        }));
      },

      selectTask: (id) => set({ selectedTaskId: id }),
      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 1 }),
      setPage: (p) => set({ page: p }),

      filteredTasks: () => {
        const { tasks, filters } = get();
        return tasks.filter((t) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!t.id.toLowerCase().includes(q) && !t.skuCode.toLowerCase().includes(q) && !t.skuName.toLowerCase().includes(q) && !(t.palletId?.toLowerCase().includes(q))) return false;
          }
          if (filters.status && t.status !== filters.status) return false;
          if (filters.operator && t.assignedOperator !== filters.operator) return false;
          if (filters.zone && t.zone !== filters.zone) return false;
          if (filters.priority && t.priority !== filters.priority) return false;
          if (filters.strategy && t.strategy !== filters.strategy) return false;
          return true;
        });
      },

      pagedTasks: () => {
        const { page, pageSize } = get();
        const all = get().filteredTasks();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => {
        const { pageSize } = get();
        return Math.max(1, Math.ceil(get().filteredTasks().length / pageSize));
      },

      kpis: () => {
        const { tasks } = get();
        const today = new Date().toISOString().slice(0, 10);
        const completed = tasks.filter((t) => t.status === "COMPLETED");
        const completedToday = completed.filter((t) => t.completedAt?.startsWith(today)).length;
        const times = completed.filter((t) => t.cycleTime).map((t) => t.cycleTime!);
        const avg = times.length ? times.reduce((s, v) => s + v, 0) / times.length : 0;
        return {
          open: tasks.filter((t) => t.status === "PENDING").length,
          assigned: tasks.filter((t) => t.status === "ASSIGNED").length,
          inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
          completedToday,
          blocked: tasks.filter((t) => t.status === "BLOCKED").length,
          avgCycleTime: avg > 0 ? `${avg.toFixed(1)}m` : "—",
          throughputPerHour: Math.round(completedToday / 8),
        };
      },

      operatorWorkloads: () => {
        const { tasks } = get();
        const map = new Map<string, { operatorId: string; operatorName: string; assigned: number; inProgress: number; completed: number }>();
        for (const t of tasks) {
          if (!t.assignedOperatorId || !t.assignedOperator) continue;
          const existing = map.get(t.assignedOperatorId) ?? { operatorId: t.assignedOperatorId, operatorName: t.assignedOperator, assigned: 0, inProgress: 0, completed: 0 };
          if (t.status === "ASSIGNED") existing.assigned++;
          else if (t.status === "IN_PROGRESS") existing.inProgress++;
          else if (t.status === "COMPLETED") existing.completed++;
          map.set(t.assignedOperatorId, existing);
        }
        return Array.from(map.values()).sort((a, b) => (b.assigned + b.inProgress) - (a.assigned + a.inProgress));
      },
    }),
    {
      name: "trilowms-putaway-v1",
      partialize: (s) => ({ tasks: s.tasks, rules: s.rules }),
    }
  )
);

export const PUTAWAY_STATUS_META: Record<PutawayStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING:     { label: "Pending",     color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  ASSIGNED:    { label: "Assigned",    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  COMPLETED:   { label: "Completed",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  BLOCKED:     { label: "Blocked",     color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  CANCELLED:   { label: "Cancelled",   color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};
