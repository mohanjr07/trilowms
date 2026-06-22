/**
 * TriloWMS — Picking Module Store
 * Wave management, batch/zone/cluster picking, pick lists, shortage handling
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useStockStore } from "@/lib/stock-store";

export type WaveStatus = "DRAFT" | "RELEASED" | "IN_PROGRESS" | "PARTIAL" | "COMPLETED" | "CANCELLED" | "SHORTED";
export type PickTaskStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "PICKED" | "SHORT" | "SUBSTITUTED" | "SKIPPED";
export type PickingMethod = "SINGLE" | "BATCH" | "ZONE" | "CLUSTER" | "WAVE_PICK";
export type PickPriority = "STANDARD" | "RUSH" | "SAME_DAY" | "OVERNIGHT";

export interface PickTask {
  id: string;
  waveId: string;
  orderId: string;
  lineNumber: number;
  skuCode: string;
  skuName: string;
  uom: string;
  qtyRequired: number;
  qtyPicked: number;
  qtyShort: number;
  binId: string;
  binCode: string;
  zone: string;
  aisle: string;
  rack: string;
  level: string;
  lotNumber: string | null;
  expiryDate: string | null;
  batchNumber: string | null;
  assignedPickerId: string | null;
  assignedPickerName: string | null;
  status: PickTaskStatus;
  pickMethod: PickingMethod;
  sortationBay: string | null;    // staging/packing bay
  toteId: string | null;
  scanConfirmed: boolean;
  startedAt: string | null;
  completedAt: string | null;
  shortReason: string | null;
  substituteSkuCode: string | null;
}

export interface Wave {
  id: string;
  waveNumber: string;
  status: WaveStatus;
  pickMethod: PickingMethod;
  priority: PickPriority;
  totalOrders: number;
  totalLines: number;
  totalUnits: number;
  pickedUnits: number;
  shortUnits: number;
  zones: string[];
  assignedPickers: string[];
  tasks: PickTask[];
  createdAt: string;
  releasedAt: string | null;
  completedAt: string | null;
  dueBy: string;
  packingBay: string;
  carrier: string;
  sourceOrderId: string | null;
}

export interface Shortage {
  id: string;
  waveId: string;
  taskId: string;
  orderId: string;
  skuCode: string;
  skuName: string;
  qtyRequired: number;
  qtyAvailable: number;
  qtyShort: number;
  reason: "OUT_OF_STOCK" | "BIN_EMPTY" | "DAMAGED" | "WRONG_LOCATION" | "RESERVED";
  status: "OPEN" | "SUBSTITUTED" | "BACKORDER" | "CANCELLED";
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const PICKERS = [
  { id: "pk1", name: "Marcus Johnson" },
  { id: "pk2", name: "A.Ng" },
  { id: "pk3", name: "P.Ortiz" },
  { id: "pk4", name: "L.Singh" },
  { id: "pk5", name: "R.Park" },
];

const ZONES = ["Fast Pick", "Bulk", "Cold", "Mezzanine", "Reserve"];
const CARRIERS = ["UPS", "FedEx", "DHL", "USPS", "Local Delivery"];
const METHODS: PickingMethod[] = ["BATCH", "ZONE", "WAVE_PICK", "CLUSTER", "SINGLE"];
const PRIORITIES: PickPriority[] = ["STANDARD", "RUSH", "SAME_DAY", "OVERNIGHT"];
const SKUS = [
  { code: "SKU-10000", name: "Aluminum Extrusion Bracket" },
  { code: "SKU-10001", name: "Steel Coil 2.5mm" },
  { code: "SKU-10002", name: "Hydraulic Pump Assembly" },
  { code: "SKU-10003", name: "Carbon Fiber Filter" },
  { code: "SKU-10004", name: "Insulated Wire 14AWG" },
  { code: "SKU-10005", name: "PCB Controller Module" },
  { code: "SKU-10006", name: "Deep Groove Ball Bearing" },
  { code: "SKU-10007", name: "Lithium Ion Cell 18650" },
];

function buildPickTasks(waveId: string, lineCount: number, idx: number, waveStatus: WaveStatus): PickTask[] {
  const taskStatuses: PickTaskStatus[] = waveStatus === "COMPLETED" ? ["PICKED"] :
    waveStatus === "IN_PROGRESS" ? ["PICKED", "IN_PROGRESS", "PENDING", "SHORT"] :
    waveStatus === "SHORTED" ? ["PICKED", "SHORT", "SHORT"] :
    ["PENDING"];

  return Array.from({ length: lineCount }, (_, j) => {
    const sku = SKUS[(idx + j) % SKUS.length];
    const status = taskStatuses[(idx + j) % taskStatuses.length];
    const required = 5 + (idx + j) * 7 % 45;
    const picked = status === "PICKED" ? required : status === "IN_PROGRESS" ? Math.floor(required * 0.5) : 0;
    const short = status === "SHORT" ? required - picked : 0;
    const picker = j % 4 < 4 ? PICKERS[(idx + j) % PICKERS.length] : null;
    const aisle = `A-0${(j % 3) + 1}`;
    const rack = `R-0${(j % 5) + 1}`;

    return {
      id: `PICK-${waveId}-${j + 1}`,
      waveId,
      orderId: `ORD-${30000 + idx * lineCount + j}`,
      lineNumber: j + 1,
      skuCode: sku.code,
      skuName: sku.name,
      uom: j % 3 === 0 ? "CS" : "EA",
      qtyRequired: required,
      qtyPicked: picked,
      qtyShort: short,
      binId: `bin-pick-${idx * lineCount + j}`,
      binCode: `${aisle}-${rack}-L${(j % 4) + 1}-P${(j % 5) + 1}`,
      zone: ZONES[(idx + j) % ZONES.length],
      aisle,
      rack,
      level: `L${(j % 4) + 1}`,
      lotNumber: j % 4 === 0 ? `LOT-${10000 + idx + j}` : null,
      expiryDate: j % 6 === 0 ? new Date(Date.now() + 90 * 24 * 3600000).toISOString().slice(0, 10) : null,
      batchNumber: `BATCH-202606-${String(1001 + idx * 10 + j).slice(-4)}`,
      assignedPickerId: picker?.id ?? null,
      assignedPickerName: picker?.name ?? null,
      status,
      pickMethod: METHODS[idx % METHODS.length],
      sortationBay: `BAY-${(idx % 4) + 1}`,
      toteId: status !== "PENDING" ? `TOTE-${3000 + idx * lineCount + j}` : null,
      scanConfirmed: status === "PICKED",
      startedAt: status !== "PENDING" ? new Date(Date.now() - (idx + 1) * 3600000).toISOString() : null,
      completedAt: status === "PICKED" ? new Date(Date.now() - idx * 1800000).toISOString() : null,
      shortReason: status === "SHORT" ? ["Bin empty at pick location", "Damaged product", "Location discrepancy"][j % 3] : null,
      substituteSkuCode: null,
    };
  });
}

function buildSeedWaves(): Wave[] {
  const statuses: WaveStatus[] = ["COMPLETED", "IN_PROGRESS", "RELEASED", "DRAFT", "SHORTED", "COMPLETED", "PARTIAL"];
  const now = new Date();

  return Array.from({ length: 18 }, (_, i) => {
    const status = statuses[i % statuses.length];
    const lineCount = 4 + (i % 8);
    const waveId = `WAVE-${300 + i}`;
    const tasks = buildPickTasks(waveId, lineCount, i, status);
    const totalUnits = tasks.reduce((s, t) => s + t.qtyRequired, 0);
    const pickedUnits = tasks.reduce((s, t) => s + t.qtyPicked, 0);
    const shortUnits = tasks.reduce((s, t) => s + t.qtyShort, 0);
    const pickers = [...new Set(tasks.filter((t) => t.assignedPickerName).map((t) => t.assignedPickerName!))];
    const dueBy = new Date(now.getTime() + (i - 4) * 3600000 * 2);

    return {
      id: waveId,
      waveNumber: waveId,
      status,
      pickMethod: METHODS[i % METHODS.length],
      priority: PRIORITIES[i % PRIORITIES.length],
      totalOrders: 2 + (i % 8),
      totalLines: lineCount,
      totalUnits,
      pickedUnits,
      shortUnits,
      zones: [...new Set(tasks.map((t) => t.zone))],
      assignedPickers: pickers,
      tasks,
      createdAt: new Date(now.getTime() - (i + 1) * 3600000 * 3).toISOString(),
      releasedAt: status !== "DRAFT" ? new Date(now.getTime() - (i + 1) * 3600000 * 2).toISOString() : null,
      completedAt: ["COMPLETED"].includes(status) ? new Date(now.getTime() - i * 3600000).toISOString() : null,
      dueBy: dueBy.toISOString(),
      packingBay: `BAY-${(i % 4) + 1}`,
      carrier: CARRIERS[i % CARRIERS.length],
      sourceOrderId: null,
    };
  });
}

function buildSeedShortages(waves: Wave[]): Shortage[] {
  const shorts: Shortage[] = [];
  for (const wave of waves) {
    for (const task of wave.tasks) {
      if (task.status === "SHORT" && task.qtyShort > 0) {
        shorts.push({
          id: `SHORT-${shorts.length + 1}`,
          waveId: wave.id,
          taskId: task.id,
          orderId: task.orderId,
          skuCode: task.skuCode,
          skuName: task.skuName,
          qtyRequired: task.qtyRequired,
          qtyAvailable: task.qtyPicked,
          qtyShort: task.qtyShort,
          reason: "BIN_EMPTY",
          status: "OPEN",
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          resolution: null,
        });
      }
    }
  }
  return shorts;
}

let _waveSeq = 400;
const nextWaveId = () => `WAVE-${++_waveSeq}`;

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function locationFor(skuCode: string, idx: number) {
  const h = hashCode(skuCode) + idx;
  const aisle = `A-0${(h % 3) + 1}`;
  const rack = `R-0${(h % 5) + 1}`;
  const level = `L${(h % 4) + 1}`;
  const bin = `P${(h % 6) + 1}`;
  return { zone: ZONES[h % ZONES.length], aisle, rack, level, binCode: `${aisle}-${rack}-${level}-${bin}` };
}

/** Round-robins new work to whichever picker currently has the fewest open tasks. */
function leastLoadedPicker(waves: Wave[]): { id: string; name: string } {
  const openStatuses: PickTaskStatus[] = ["PENDING", "ASSIGNED", "IN_PROGRESS"];
  const load = new Map<string, number>(PICKERS.map((p) => [p.id, 0]));
  for (const w of waves) {
    for (const t of w.tasks) {
      if (t.assignedPickerId && openStatuses.includes(t.status)) {
        load.set(t.assignedPickerId, (load.get(t.assignedPickerId) ?? 0) + 1);
      }
    }
  }
  return PICKERS.reduce((best, p) => ((load.get(p.id) ?? 0) < (load.get(best.id) ?? 0) ? p : best), PICKERS[0]);
}

export interface WaveSourceLine { skuCode: string; skuName: string; uom: string; qty: number; }
export interface CreateWaveFromOrderInput {
  sourceOrderId: string;
  orderNumber: string;
  priority: PickPriority;
  carrier?: string;
  dueBy?: string;
  lines: WaveSourceLine[];
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface WaveFilters {
  search: string;
  status: WaveStatus | "";
  method: PickingMethod | "";
  priority: PickPriority | "";
  zone: string;
}

const DEFAULT_FILTERS: WaveFilters = { search: "", status: "", method: "", priority: "", zone: "" };

// ─── Store ────────────────────────────────────────────────────────────────────

interface PickingState {
  waves: Wave[];
  shortages: Shortage[];
  filters: WaveFilters;
  selectedWaveId: string | null;
  page: number;
  pageSize: number;

  releaseWave: (id: string) => void;
  startWave: (id: string) => void;
  completeWave: (id: string) => void;
  cancelWave: (id: string) => void;
  createWaveFromOrder: (input: CreateWaveFromOrderInput) => Wave;
  applyRouteOrder: (waveId: string, orderedTaskIds: string[]) => void;
  pickTask: (waveId: string, taskId: string, qtyPicked: number) => void;
  reportShort: (waveId: string, taskId: string, qtyAvailable: number, reason: Shortage["reason"]) => void;
  resolveShortage: (shortageId: string, resolution: string) => void;
  assignPicker: (waveId: string, taskId: string, pickerId: string, pickerName: string) => void;
  selectWave: (id: string | null) => void;
  setFilters: (f: Partial<WaveFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;

  filteredWaves: () => Wave[];
  pagedWaves: () => Wave[];
  totalPages: () => number;
  kpis: () => {
    activeWaves: number;
    openPicks: number;
    pickedToday: number;
    pickAccuracy: string;
    shorts: number;
    avgPicksPerHour: number;
    pendingRelease: number;
  };
  pickerProductivity: () => { name: string; picked: number; short: number; accuracy: number }[];
  methodMix: () => { method: PickingMethod; count: number }[];
  zoneLoad: () => { zone: string; open: number; picked: number; total: number }[];
  activePickTasks: () => (PickTask & { waveNumber: string; priority: PickPriority; dueBy: string })[];
  zoneList: () => string[];
}

const _seedWaves = buildSeedWaves();

export const usePickingStore = create<PickingState>()(
  persist(
    (set, get) => ({
      waves: [],
      shortages: [],
      filters: DEFAULT_FILTERS,
      selectedWaveId: null,
      page: 1,
      pageSize: 15,

      releaseWave: (id) => set((s) => ({
        waves: s.waves.map((w) =>
          w.id === id ? { ...w, status: "RELEASED" as WaveStatus, releasedAt: new Date().toISOString() } : w
        ),
      })),

      startWave: (id) => set((s) => ({
        waves: s.waves.map((w) => w.id === id ? { ...w, status: "IN_PROGRESS" as WaveStatus } : w),
      })),

      completeWave: (id) => set((s) => ({
        waves: s.waves.map((w) =>
          w.id === id ? { ...w, status: "COMPLETED" as WaveStatus, completedAt: new Date().toISOString() } : w
        ),
      })),

      cancelWave: (id) => set((s) => ({
        waves: s.waves.map((w) => w.id === id ? { ...w, status: "CANCELLED" as WaveStatus } : w),
      })),

      createWaveFromOrder: (input) => {
        const picker = leastLoadedPicker(get().waves);
        const waveId = nextWaveId();
        const now = new Date().toISOString();
        const tasks: PickTask[] = input.lines.map((l, j) => {
          const loc = locationFor(l.skuCode, j);
          return {
            id: `PICK-${waveId}-${j + 1}`,
            waveId,
            orderId: input.orderNumber,
            lineNumber: j + 1,
            skuCode: l.skuCode,
            skuName: l.skuName,
            uom: l.uom || "EA",
            qtyRequired: l.qty,
            qtyPicked: 0,
            qtyShort: 0,
            binId: `bin-${waveId}-${j}`,
            binCode: loc.binCode,
            zone: loc.zone,
            aisle: loc.aisle,
            rack: loc.rack,
            level: loc.level,
            lotNumber: null,
            expiryDate: null,
            batchNumber: null,
            assignedPickerId: picker.id,
            assignedPickerName: picker.name,
            status: "ASSIGNED",
            pickMethod: "SINGLE",
            sortationBay: `BAY-${(j % 4) + 1}`,
            toteId: null,
            scanConfirmed: false,
            startedAt: null,
            completedAt: null,
            shortReason: null,
            substituteSkuCode: null,
          };
        });
        const totalUnits = tasks.reduce((s, t) => s + t.qtyRequired, 0);
        const wave: Wave = {
          id: waveId,
          waveNumber: waveId,
          status: "RELEASED",
          pickMethod: "SINGLE",
          priority: input.priority,
          totalOrders: 1,
          totalLines: tasks.length,
          totalUnits,
          pickedUnits: 0,
          shortUnits: 0,
          zones: Array.from(new Set(tasks.map((t) => t.zone))),
          assignedPickers: [picker.name],
          tasks,
          createdAt: now,
          releasedAt: now,
          completedAt: null,
          dueBy: input.dueBy ?? new Date(Date.now() + 4 * 3600000).toISOString(),
          packingBay: `BAY-${(tasks.length % 4) + 1}`,
          carrier: input.carrier ?? "Unassigned",
          sourceOrderId: input.sourceOrderId,
        };
        set((s) => ({ waves: [wave, ...s.waves] }));
        return wave;
      },

      pickTask: (waveId, taskId, qtyPicked) => {
        // Pulling the picked units out of the physical stock ledger here — this is the
        // moment goods leave their bin, so on-hand (and the matching reservation) must
        // drop now rather than staying parked forever as "reserved".
        if (qtyPicked > 0) {
          const wave = get().waves.find((w) => w.id === waveId);
          const task = wave?.tasks.find((t) => t.id === taskId);
          if (task) useStockStore.getState().consume(task.skuCode, qtyPicked);
        }
        set((s) => ({
          waves: s.waves.map((w) => {
            if (w.id !== waveId) return w;
            const tasks = w.tasks.map((t) => {
              if (t.id !== taskId) return t;
              const newPicked = t.qtyPicked + qtyPicked;
              const newStatus: PickTaskStatus = newPicked >= t.qtyRequired ? "PICKED" : "IN_PROGRESS";
              return { ...t, qtyPicked: newPicked, status: newStatus, scanConfirmed: true, completedAt: newStatus === "PICKED" ? new Date().toISOString() : null };
            });
            const allPicked = tasks.every((t) => ["PICKED", "SHORT", "SKIPPED"].includes(t.status));
            const anyPicked = tasks.some((t) => t.qtyPicked > 0);
            const pickedUnits = tasks.reduce((s, t) => s + t.qtyPicked, 0);
            return {
              ...w,
              tasks,
              pickedUnits,
              status: allPicked ? "COMPLETED" as WaveStatus : anyPicked ? "IN_PROGRESS" as WaveStatus : w.status,
              completedAt: allPicked ? new Date().toISOString() : null,
            };
          }),
        }));
      },

      reportShort: (waveId, taskId, qtyAvailable, reason) => {
        const wavePre = get().waves.find((w) => w.id === waveId);
        const taskPre = wavePre?.tasks.find((t) => t.id === taskId);
        if (taskPre) {
          const stock = useStockStore.getState();
          // Whatever was actually found and picked leaves the ledger now.
          if (qtyAvailable > 0) stock.consume(taskPre.skuCode, qtyAvailable);
          // The remainder was reserved for this task but will never be fulfilled from
          // this bin — release that reservation so it doesn't sit phantom-reserved.
          const shortQty = taskPre.qtyRequired - qtyAvailable;
          if (shortQty > 0) stock.release(taskPre.skuCode, shortQty);
        }
        set((s) => {
          const wave = s.waves.find((w) => w.id === waveId);
          const task = wave?.tasks.find((t) => t.id === taskId);
          if (!task) return s;
          const shortage: Shortage = {
            id: `SHORT-${Date.now()}`,
            waveId,
            taskId,
            orderId: task.orderId,
            skuCode: task.skuCode,
            skuName: task.skuName,
            qtyRequired: task.qtyRequired,
            qtyAvailable,
            qtyShort: task.qtyRequired - qtyAvailable,
            reason,
            status: "OPEN",
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            resolution: null,
          };
          return {
            ...s,
            shortages: [...s.shortages, shortage],
            waves: s.waves.map((w) => {
              if (w.id !== waveId) return w;
              const tasks = w.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, qtyPicked: qtyAvailable, status: "SHORT" as PickTaskStatus, qtyShort: task.qtyRequired - qtyAvailable, shortReason: reason }
                  : t
              );
              // Recompute wave status exactly like pickTask does — a task resolved via
              // "Report short" still counts as settled for the wave's purposes. Without
              // this, a wave whose only remaining task gets shorted (rather than picked)
              // stays stuck at RELEASED/IN_PROGRESS forever and never reaches Consolidation.
              const allSettled = tasks.every((t) => ["PICKED", "SHORT", "SKIPPED"].includes(t.status));
              const anySettled = tasks.some((t) => t.qtyPicked > 0 || t.status === "SHORT" || t.status === "SKIPPED");
              const pickedUnits = tasks.reduce((sum, t) => sum + t.qtyPicked, 0);
              const allShort = tasks.every((t) => t.status === "SHORT");
              return {
                ...w,
                tasks,
                pickedUnits,
                shortUnits: w.shortUnits + (task.qtyRequired - qtyAvailable),
                status: allSettled ? (allShort ? "SHORTED" as WaveStatus : "COMPLETED" as WaveStatus) : anySettled ? "IN_PROGRESS" as WaveStatus : w.status,
                completedAt: allSettled ? new Date().toISOString() : w.completedAt,
              };
            }),
          };
        });
      },

      resolveShortage: (shortageId, resolution) => {
        set((s) => ({
          shortages: s.shortages.map((sh) =>
            sh.id === shortageId
              ? { ...sh, status: "BACKORDER" as const, resolvedAt: new Date().toISOString(), resolution }
              : sh
          ),
        }));
      },

      assignPicker: (waveId, taskId, pickerId, pickerName) => {
        set((s) => ({
          waves: s.waves.map((w) => {
            if (w.id !== waveId) return w;
            return {
              ...w,
              tasks: w.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, assignedPickerId: pickerId, assignedPickerName: pickerName, status: "ASSIGNED" as PickTaskStatus }
                  : t
              ),
            };
          }),
        }));
      },

      selectWave: (id) => set({ selectedWaveId: id }),

      applyRouteOrder: (waveId, orderedTaskIds) => {
        const rank = new Map(orderedTaskIds.map((id, i) => [id, i]));
        set((s) => ({
          waves: s.waves.map((w) =>
            w.id === waveId
              ? { ...w, tasks: [...w.tasks].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999)) }
              : w
          ),
        }));
      },
      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 1 }),
      setPage: (p) => set({ page: p }),

      filteredWaves: () => {
        const { waves, filters } = get();
        return waves.filter((w) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!w.waveNumber.toLowerCase().includes(q) && !w.carrier.toLowerCase().includes(q)) return false;
          }
          if (filters.status && w.status !== filters.status) return false;
          if (filters.method && w.pickMethod !== filters.method) return false;
          if (filters.priority && w.priority !== filters.priority) return false;
          if (filters.zone && !w.zones.includes(filters.zone)) return false;
          return true;
        });
      },

      pagedWaves: () => {
        const { page, pageSize } = get();
        const all = get().filteredWaves();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => {
        const { pageSize } = get();
        return Math.max(1, Math.ceil(get().filteredWaves().length / pageSize));
      },

      kpis: () => {
        const { waves, shortages } = get();
        const today = new Date().toISOString().slice(0, 10);
        const allTasks = waves.flatMap((w) => w.tasks);
        const totalPicked = allTasks.reduce((s, t) => s + t.qtyPicked, 0);
        const totalRequired = allTasks.reduce((s, t) => s + t.qtyRequired, 0);
        const todayCompleted = waves.filter((w) => w.completedAt?.startsWith(today));
        const todayUnits = todayCompleted.reduce((s, w) => s + w.pickedUnits, 0);
        return {
          activeWaves: waves.filter((w) => ["RELEASED", "IN_PROGRESS"].includes(w.status)).length,
          openPicks: allTasks.filter((t) => t.status === "PENDING" || t.status === "ASSIGNED").length,
          pickedToday: todayUnits,
          pickAccuracy: totalRequired > 0 ? `${((1 - allTasks.reduce((s, t) => s + t.qtyShort, 0) / totalRequired) * 100).toFixed(1)}%` : "—",
          shorts: shortages.filter((s) => s.status === "OPEN").length,
          avgPicksPerHour: Math.round(todayUnits / 8),
          pendingRelease: waves.filter((w) => w.status === "DRAFT").length,
        };
      },

      pickerProductivity: () => {
        const allTasks = get().waves.flatMap((w) => w.tasks);
        const map = new Map<string, { name: string; picked: number; short: number; required: number }>();
        for (const t of allTasks) {
          if (!t.assignedPickerName) continue;
          const existing = map.get(t.assignedPickerName) ?? { name: t.assignedPickerName, picked: 0, short: 0, required: 0 };
          existing.picked += t.qtyPicked;
          existing.short += t.qtyShort;
          existing.required += t.qtyRequired;
          map.set(t.assignedPickerName, existing);
        }
        return Array.from(map.values()).map((v) => ({
          name: v.name,
          picked: v.picked,
          short: v.short,
          accuracy: v.required > 0 ? Math.round(((v.required - v.short) / v.required) * 100) : 100,
        }));
      },

      methodMix: () => {
        const active: WaveStatus[] = ["RELEASED", "IN_PROGRESS", "PARTIAL"];
        const map = new Map<PickingMethod, number>();
        for (const w of get().waves) {
          if (!active.includes(w.status)) continue;
          map.set(w.pickMethod, (map.get(w.pickMethod) ?? 0) + 1);
        }
        return Array.from(map.entries()).map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count);
      },

      zoneLoad: () => {
        const map = new Map<string, { open: number; picked: number; total: number }>();
        for (const w of get().waves) {
          for (const t of w.tasks) {
            const e = map.get(t.zone) ?? { open: 0, picked: 0, total: 0 };
            e.total++;
            if (t.status === "PICKED") e.picked++;
            else e.open++;
            map.set(t.zone, e);
          }
        }
        return Array.from(map.entries()).map(([zone, v]) => ({ zone, ...v })).sort((a, b) => b.total - a.total);
      },

      activePickTasks: () => {
        const active: WaveStatus[] = ["RELEASED", "IN_PROGRESS", "PARTIAL"];
        const openTask: PickTaskStatus[] = ["PENDING", "ASSIGNED", "IN_PROGRESS"];
        return get()
          .waves.filter((w) => active.includes(w.status))
          .flatMap((w) => w.tasks.filter((t) => openTask.includes(t.status)).map((t) => ({ ...t, waveNumber: w.waveNumber, priority: w.priority, dueBy: w.dueBy })))
          .sort((a, b) => a.dueBy.localeCompare(b.dueBy));
      },

      zoneList: () => Array.from(new Set(get().waves.flatMap((w) => w.zones))).sort(),
    }),
    {
      name: "trilowms-picking-v3",
      partialize: (s) => ({ waves: s.waves, shortages: s.shortages }),
    }
  )
);

export const WAVE_STATUS_META: Record<WaveStatus, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:       { label: "Draft",       color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  RELEASED:    { label: "Released",    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  PARTIAL:     { label: "Partial",     color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30"  },
  COMPLETED:   { label: "Completed",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  SHORTED:     { label: "Shorted",     color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  CANCELLED:   { label: "Cancelled",   color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};
