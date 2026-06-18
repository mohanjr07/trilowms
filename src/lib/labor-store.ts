/**
 * TriloWMS — Labor Management Module Store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EmployeeStatus = "CLOCKED_IN" | "CLOCKED_OUT" | "ON_BREAK" | "ON_LEAVE" | "TRAINING" | "INACTIVE";
export type ShiftType = "A" | "B" | "C" | "FLEX";
export type TaskType = "PICKING" | "PACKING" | "PUTAWAY" | "INBOUND" | "OUTBOUND" | "FORKLIFT" | "QC" | "GENERAL";

export interface LaborEmployee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  shift: ShiftType;
  status: EmployeeStatus;
  clockInTime: string | null;
  clockOutTime: string | null;
  breakStart: string | null;
  currentTaskType: TaskType | null;
  currentTaskId: string | null;
  currentZone: string | null;
  unitsPerHour: number;
  targetUph: number;
  accuracyPct: number;
  hoursToday: number;
  overtimeHours: number;
  idleMinutes: number;
  certifications: string[];
  equipment: string[];  // forklift, reach truck etc
  warehouseId: string;
}

export interface LaborTask {
  id: string;
  type: TaskType;
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string | null;
  duration: number;      // minutes
  units: number;
  uph: number;
  zone: string;
  notes: string | null;
}

export interface Shift {
  id: string;
  shiftType: ShiftType;
  date: string;
  startTime: string;
  endTime: string;
  supervisorId: string;
  supervisorName: string;
  targetHeadcount: number;
  actualHeadcount: number;
  employees: string[];
  notes: string | null;
}

// ─── Seed ────────────────────────────────────────────────────────────────────

const ROLES = ["Picker", "Packer", "Forklift Operator", "QC Inspector", "Inbound Receiver", "Supervisor", "Lead Hand", "General Labor"];
const DEPARTMENTS = ["Inbound", "Outbound", "Inventory", "QC", "Yard", "General"];
const ZONES = ["Fast Pick", "Bulk Zone", "Cold Storage", "Mezzanine", "Docks", "Staging"];
const CERTIFICATIONS = [["Forklift Class I", "Forklift Class II"], ["Reach Truck"], ["Hazmat Handler"], ["QC Inspector Level 2"], [], ["Forklift Class I"], []];

function buildSeedEmployees(): LaborEmployee[] {
  const names = [
    "Marcus Johnson","A.Ng","P.Ortiz","L.Singh","R.Park","S.Diaz","Tommy Wu","Carlos Mendez",
    "Fatima Hassan","John Smith","Maria Garcia","David Lee","Anna Kim","Carlos Ruiz","Sarah Jones",
    "Mike Brown","Lisa Chen","Ahmed Ali","Priya Shah","James Wilson","Emma Davis","Noah Martinez",
    "Olivia Taylor","Liam Anderson","Ava Thomas","Isabella Jackson","William White","Sophia Harris",
    "Benjamin Martin","Mia Thompson","Lucas Garcia","Charlotte Miller","Mason Rodriguez",
    "Amelia Wilson","Ethan Moore","Harper Taylor","Alexander Brown","Evelyn Jackson",
    "Daniel Jones","Sofia Martinez","Henry Clark","Camila Lopez","Jackson Lewis","Aria Lee",
  ];

  const statuses: EmployeeStatus[] = ["CLOCKED_IN","CLOCKED_IN","CLOCKED_IN","ON_BREAK","CLOCKED_OUT","CLOCKED_IN","TRAINING"];

  return Array.from({ length: 44 }, (_, i) => {
    const status = statuses[i % statuses.length];
    const role = ROLES[i % ROLES.length];
    const uph = 120 + (i * 13 % 160);
    const targetUph = 150 + (i % 5) * 20;
    const shift: ShiftType = (["A","B","C","FLEX"] as ShiftType[])[i % 4];
    const now = new Date();
    const clockIn = status === "CLOCKED_IN" || status === "ON_BREAK" ? new Date(now.getTime() - (4 + i % 4) * 3600000).toISOString() : null;

    return {
      id: `emp-${i + 1}`,
      employeeId: `EMP-${String(200 + i).padStart(4, "0")}`,
      name: names[i] ?? `Employee ${i + 1}`,
      email: `emp${i + 1}@trilowms.com`,
      role,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      shift,
      status,
      clockInTime: clockIn,
      clockOutTime: status === "CLOCKED_OUT" ? new Date(now.getTime() - 1 * 3600000).toISOString() : null,
      breakStart: status === "ON_BREAK" ? new Date(now.getTime() - 15 * 60000).toISOString() : null,
      currentTaskType: status === "CLOCKED_IN" ? (["PICKING","PACKING","PUTAWAY","INBOUND","FORKLIFT"] as TaskType[])[i % 5] : null,
      currentTaskId: status === "CLOCKED_IN" ? `WAVE-${300 + i}` : null,
      currentZone: status === "CLOCKED_IN" ? ZONES[i % ZONES.length] : null,
      unitsPerHour: uph,
      targetUph,
      accuracyPct: 95 + (i % 5),
      hoursToday: status === "CLOCKED_IN" ? parseFloat((4 + i % 4).toFixed(1)) : status === "CLOCKED_OUT" ? 8 : 0,
      overtimeHours: status === "CLOCKED_IN" && i % 6 === 0 ? parseFloat((0.5 + i % 3 * 0.5).toFixed(1)) : 0,
      idleMinutes: status === "CLOCKED_IN" ? Math.floor(i * 7 % 45) : 0,
      certifications: CERTIFICATIONS[i % CERTIFICATIONS.length],
      equipment: role === "Forklift Operator" ? ["Reach Truck", "Counterbalance Forklift"] : role === "QC Inspector" ? ["Handheld Scanner"] : ["RF Scanner"],
      warehouseId: "TRILO-DC-01",
    };
  });
}

function buildSeedTasks(): LaborTask[] {
  const now = new Date();
  const types: TaskType[] = ["PICKING","PACKING","PUTAWAY","INBOUND","FORKLIFT","QC"];
  return Array.from({ length: 60 }, (_, i) => {
    const start = new Date(now.getTime() - (i * 1800000 + 3600000));
    const dur = 25 + (i * 11 % 90);
    const emp = buildSeedEmployees()[i % 44];
    return {
      id: `LTASK-${i + 1}`,
      type: types[i % types.length],
      employeeId: emp.id,
      employeeName: emp.name,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + dur * 60000).toISOString(),
      duration: dur,
      units: Math.floor(dur * (1.5 + i % 3)),
      uph: Math.round(Math.floor(dur * (1.5 + i % 3)) / (dur / 60)),
      zone: ZONES[i % ZONES.length],
      notes: null,
    };
  });
}

export interface LaborFilters { search: string; status: EmployeeStatus | ""; shift: ShiftType | ""; role: string; department: string; }
const DEFAULT_FILTERS: LaborFilters = { search: "", status: "", shift: "", role: "", department: "" };

interface LaborState {
  employees: LaborEmployee[];
  tasks: LaborTask[];
  filters: LaborFilters;
  page: number;
  pageSize: number;

  clockIn: (empId: string) => void;
  clockOut: (empId: string) => void;
  startBreak: (empId: string) => void;
  endBreak: (empId: string) => void;
  assignTask: (empId: string, taskType: TaskType, taskId: string, zone: string) => void;
  updateUph: (empId: string, uph: number) => void;
  setFilters: (f: Partial<LaborFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;
  filteredEmployees: () => LaborEmployee[];
  pagedEmployees: () => LaborEmployee[];
  totalPages: () => number;
  kpis: () => { onShift: number; avgUph: number; idleRate: string; overtimeHours: number; targetVsActual: string; activeOnTask: number; onBreak: number };
  shiftBreakdown: () => { shift: ShiftType; count: number; avgUph: number }[];
  departmentStats: () => { department: string; count: number; avgUph: number; avgAccuracy: number }[];
  taskTypeMix: () => { type: TaskType; count: number }[];
  topPerformers: () => LaborEmployee[];
  roleList: () => string[];
  departmentList: () => string[];
}

export const useLaborStore = create<LaborState>()(
  persist(
    (set, get) => ({
      employees: buildSeedEmployees(),
      tasks: buildSeedTasks(),
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 20,

      clockIn: (empId) => {
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === empId ? { ...e, status: "CLOCKED_IN" as EmployeeStatus, clockInTime: new Date().toISOString(), clockOutTime: null } : e
          ),
        }));
      },

      clockOut: (empId) => {
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === empId ? { ...e, status: "CLOCKED_OUT" as EmployeeStatus, clockOutTime: new Date().toISOString(), currentTaskType: null, currentTaskId: null } : e
          ),
        }));
      },

      startBreak: (empId) => {
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === empId ? { ...e, status: "ON_BREAK" as EmployeeStatus, breakStart: new Date().toISOString() } : e
          ),
        }));
      },

      endBreak: (empId) => {
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === empId ? { ...e, status: "CLOCKED_IN" as EmployeeStatus, breakStart: null } : e
          ),
        }));
      },

      assignTask: (empId, taskType, taskId, zone) => {
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === empId ? { ...e, currentTaskType: taskType, currentTaskId: taskId, currentZone: zone } : e
          ),
        }));
      },

      updateUph: (empId, uph) => {
        set((s) => ({
          employees: s.employees.map((e) => e.id === empId ? { ...e, unitsPerHour: uph } : e),
        }));
      },

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setPage: (p) => set({ page: p }),

      filteredEmployees: () => {
        const { employees, filters } = get();
        return employees.filter((e) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!e.name.toLowerCase().includes(q) && !e.employeeId.toLowerCase().includes(q) && !e.role.toLowerCase().includes(q)) return false;
          }
          if (filters.status && e.status !== filters.status) return false;
          if (filters.shift && e.shift !== filters.shift) return false;
          if (filters.role && e.role !== filters.role) return false;
          if (filters.department && e.department !== filters.department) return false;
          return true;
        });
      },

      pagedEmployees: () => {
        const { page, pageSize } = get();
        const all = get().filteredEmployees();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => Math.max(1, Math.ceil(get().filteredEmployees().length / get().pageSize)),

      kpis: () => {
        const active = get().employees.filter((e) => e.status === "CLOCKED_IN" || e.status === "ON_BREAK");
        const onTask = active.filter((e) => e.status === "CLOCKED_IN");
        const uphList = onTask.filter((e) => e.unitsPerHour > 0).map((e) => e.unitsPerHour);
        const targetList = onTask.map((e) => e.targetUph);
        const avgUph = uphList.length > 0 ? Math.round(uphList.reduce((s, u) => s + u, 0) / uphList.length) : 0;
        const avgTarget = targetList.length > 0 ? Math.round(targetList.reduce((s, u) => s + u, 0) / targetList.length) : 0;
        const idleMinutes = onTask.reduce((s, e) => s + e.idleMinutes, 0);
        const totalMinutes = onTask.reduce((s, e) => s + e.hoursToday * 60, 0);
        const overTimes = get().employees.map((e) => e.overtimeHours);
        return {
          onShift: active.length,
          avgUph,
          idleRate: totalMinutes > 0 ? `${((idleMinutes / totalMinutes) * 100).toFixed(1)}%` : "0%",
          overtimeHours: parseFloat(overTimes.reduce((s, h) => s + h, 0).toFixed(1)),
          targetVsActual: avgTarget > 0 ? `${Math.round((avgUph / avgTarget) * 100)}%` : "—",
          activeOnTask: onTask.filter((e) => e.currentTaskId).length,
          onBreak: get().employees.filter((e) => e.status === "ON_BREAK").length,
        };
      },

      shiftBreakdown: () => {
        const { employees } = get();
        const shifts: ShiftType[] = ["A", "B", "C", "FLEX"];
        return shifts.map((shift) => {
          const emps = employees.filter((e) => e.shift === shift && e.status === "CLOCKED_IN");
          const uphList = emps.filter((e) => e.unitsPerHour > 0).map((e) => e.unitsPerHour);
          return {
            shift,
            count: emps.length,
            avgUph: uphList.length > 0 ? Math.round(uphList.reduce((s, u) => s + u, 0) / uphList.length) : 0,
          };
        });
      },

      departmentStats: () => {
        const { employees } = get();
        const deptMap = new Map<string, { count: number; uphSum: number; accSum: number }>();
        for (const e of employees.filter((em) => em.status === "CLOCKED_IN")) {
          const existing = deptMap.get(e.department) ?? { count: 0, uphSum: 0, accSum: 0 };
          deptMap.set(e.department, { count: existing.count + 1, uphSum: existing.uphSum + e.unitsPerHour, accSum: existing.accSum + e.accuracyPct });
        }
        return Array.from(deptMap.entries()).map(([dept, v]) => ({
          department: dept,
          count: v.count,
          avgUph: Math.round(v.uphSum / v.count),
          avgAccuracy: parseFloat((v.accSum / v.count).toFixed(1)),
        }));
      },

      taskTypeMix: () => {
        const onTask = get().employees.filter((e) => e.status === "CLOCKED_IN" && e.currentTaskType);
        const map = new Map<TaskType, number>();
        for (const e of onTask) if (e.currentTaskType) map.set(e.currentTaskType, (map.get(e.currentTaskType) ?? 0) + 1);
        return Array.from(map.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
      },

      topPerformers: () =>
        get().employees
          .filter((e) => e.status === "CLOCKED_IN" && e.unitsPerHour > 0)
          .sort((a, b) => b.unitsPerHour - a.unitsPerHour),

      roleList: () => Array.from(new Set(get().employees.map((e) => e.role))).sort(),
      departmentList: () => Array.from(new Set(get().employees.map((e) => e.department))).sort(),
    }),
    {
      name: "trilowms-labor-v1",
      partialize: (s) => ({ employees: s.employees }),
    }
  )
);

export const EMPLOYEE_STATUS_META: Record<EmployeeStatus, { label: string; color: string; bg: string; border: string }> = {
  CLOCKED_IN:  { label: "Clocked In",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  CLOCKED_OUT: { label: "Clocked Out", color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  ON_BREAK:    { label: "On Break",    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  ON_LEAVE:    { label: "On Leave",    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  TRAINING:    { label: "Training",    color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30"  },
  INACTIVE:    { label: "Inactive",    color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};
