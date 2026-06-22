/**
 * TriloWMS — Yard & Dock Module Store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useInboundStore } from "@/lib/inbound-store";

export type YardTruckStatus = "GATE_IN" | "WAITING" | "DOCKING" | "DOCKED_IN" | "DOCKED_OUT" | "LOADING" | "UNLOADING" | "LOADED" | "GATE_OUT" | "DEPARTED";
export type DockStatus = "AVAILABLE" | "OCCUPIED_IN" | "OCCUPIED_OUT" | "MAINTENANCE" | "RESERVED";
export type YardPosition = "LANE_A" | "LANE_B" | "LANE_C" | "STAGING" | "OVERFLOW" | "HAZMAT";

export interface YardTruck {
  id: string;
  truckNumber: string;
  plateNumber: string;
  carrier: string;
  direction: "INBOUND" | "OUTBOUND";
  driver: string;
  driverMobile: string;
  status: YardTruckStatus;
  yardPosition: YardPosition | null;
  spotNumber: string | null;
  dockId: string | null;
  dockCode: string | null;
  appointmentId: string | null;
  asnId: string | null;
  shipmentId: string | null;
  gateInTime: string | null;
  dockAssignedTime: string | null;
  departureTime: string | null;
  dwellMinutes: number;
  dwellAlert: boolean;           // > threshold
  dwellThresholdMinutes: number;
  seals: string[];
  hazmat: boolean;
  priority: "NORMAL" | "HIGH" | "URGENT";
  notes: string | null;
}

export interface YardDock {
  id: string;
  code: string;
  type: "INBOUND" | "OUTBOUND" | "BOTH";
  status: DockStatus;
  assignedTruckId: string | null;
  assignedAt: string | null;
  equipment: string[];         // levellers, bumpers, locks
  tempControlled: boolean;
  maxCapacityTons: number;
  currentWeight: number;
}

export interface YardAppointment {
  id: string;
  appointmentNumber: string;
  carrier: string;
  truckType: "DRY_VAN" | "REEFER" | "FLATBED" | "TANKER" | "CONTAINER";
  direction: "INBOUND" | "OUTBOUND";
  scheduledTime: string;
  checkedInTime: string | null;
  status: "SCHEDULED" | "CHECKED_IN" | "DOCKED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
  referenceDoc: string;
  vendor: string | null;
  carrier_contact: string | null;
}

// ─── Seed ────────────────────────────────────────────────────────────────────

const CARRIERS = ["UPS","FedEx","DHL","Maersk","XPO Logistics","DB Schenker","J.B. Hunt"];
const DRIVERS = ["John Smith","Maria Garcia","David Lee","Anna Kim","Carlos Ruiz","Sarah Jones","Mike Brown"];

const YARD_DOCKS: YardDock[] = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `dock-in-${i + 1}`,
    code: `IN-${String(i + 1).padStart(2, "0")}`,
    type: "INBOUND" as const,
    status: (i < 4 ? "OCCUPIED_IN" : i === 4 ? "MAINTENANCE" : "AVAILABLE") as DockStatus,
    assignedTruckId: i < 4 ? `TRK-Y${i + 1}` : null,
    assignedAt: i < 4 ? new Date(Date.now() - i * 3600000).toISOString() : null,
    equipment: ["Dock Leveller", "Wheel Chocks", "Safety Barrier"],
    tempControlled: i === 2,
    maxCapacityTons: 25,
    currentWeight: i < 4 ? 10 + i * 3 : 0,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `dock-out-${i + 1}`,
    code: `OUT-${String(i + 1).padStart(2, "0")}`,
    type: "OUTBOUND" as const,
    status: (i < 3 ? "OCCUPIED_OUT" : "AVAILABLE") as DockStatus,
    assignedTruckId: i < 3 ? `TRK-Y${i + 7}` : null,
    assignedAt: i < 3 ? new Date(Date.now() - i * 1800000).toISOString() : null,
    equipment: ["Dock Leveller", "Wheel Chocks", "Safety Light"],
    tempControlled: false,
    maxCapacityTons: 25,
    currentWeight: i < 3 ? 8 + i * 4 : 0,
  })),
];

function buildSeedTrucks(): YardTruck[] {
  const statuses: YardTruckStatus[] = ["GATE_IN","WAITING","DOCKING","DOCKED_IN","DOCKED_OUT","LOADING","UNLOADING","LOADED","GATE_OUT"];
  const positions: (YardPosition | null)[] = ["LANE_A","LANE_B","LANE_C","STAGING","HAZMAT","OVERFLOW",null];
  const now = new Date();
  return Array.from({ length: 20 }, (_, i) => {
    const status = statuses[i % statuses.length];
    const gateIn = new Date(now.getTime() - (i + 1) * 45 * 60000);
    const dwell = Math.floor((now.getTime() - gateIn.getTime()) / 60000);
    return {
      id: `TRK-Y${i + 1}`,
      truckNumber: `TRK-Y${i + 1}`,
      plateNumber: `MH${10 + i}AB${1000 + i}`,
      carrier: CARRIERS[i % CARRIERS.length],
      direction: i % 2 === 0 ? "INBOUND" : "OUTBOUND",
      driver: DRIVERS[i % DRIVERS.length],
      driverMobile: `+1-555-${String(1000 + i).padStart(4, "0")}`,
      status,
      yardPosition: positions[i % positions.length],
      spotNumber: positions[i % positions.length] ? `${positions[i % positions.length]?.slice(0, 1)}-${String(i + 1).padStart(2, "0")}` : null,
      dockId: ["DOCKED_IN","DOCKED_OUT","LOADING","UNLOADING","LOADED"].includes(status) ? (i % 2 === 0 ? `dock-in-${(i % 4) + 1}` : `dock-out-${(i % 3) + 1}`) : null,
      dockCode: ["DOCKED_IN","DOCKED_OUT","LOADING","UNLOADING","LOADED"].includes(status) ? (i % 2 === 0 ? `IN-${String((i % 4) + 1).padStart(2, "0")}` : `OUT-${String((i % 3) + 1).padStart(2, "0")}`) : null,
      appointmentId: `APPT-${100 + i}`,
      asnId: i % 2 === 0 ? `ASN-20260609-${String(i + 1).padStart(4, "0")}` : null,
      shipmentId: i % 2 !== 0 ? `SHIP-${2000 + i}` : null,
      gateInTime: gateIn.toISOString(),
      dockAssignedTime: ["DOCKED_IN","DOCKED_OUT","LOADING","UNLOADING","LOADED"].includes(status) ? new Date(gateIn.getTime() + 15 * 60000).toISOString() : null,
      departureTime: status === "GATE_OUT" ? new Date(now.getTime() - 10 * 60000).toISOString() : null,
      dwellMinutes: dwell,
      dwellAlert: dwell > 120,
      dwellThresholdMinutes: 120,
      seals: [`SEAL-${1000 + i}`, `SEAL-${2000 + i}`],
      hazmat: i % 11 === 0,
      priority: i % 7 === 0 ? "URGENT" : i % 4 === 0 ? "HIGH" : "NORMAL",
      notes: i % 8 === 0 ? "Temp-controlled cargo — refrigerated dock required" : null,
    };
  });
}

function buildSeedAppointments(): YardAppointment[] {
  const now = new Date();
  const statuses: YardAppointment["status"][] = ["SCHEDULED","CHECKED_IN","DOCKED","COMPLETED","SCHEDULED","NO_SHOW"];
  return Array.from({ length: 24 }, (_, i) => ({
    id: `APPT-${100 + i}`,
    appointmentNumber: `APPT-${100 + i}`,
    carrier: CARRIERS[i % CARRIERS.length],
    truckType: (["DRY_VAN","REEFER","FLATBED","CONTAINER","DRY_VAN"] as YardAppointment["truckType"][])[i % 5],
    direction: i % 2 === 0 ? "INBOUND" : "OUTBOUND",
    scheduledTime: new Date(now.getTime() + (i - 6) * 3600000 * 2).toISOString(),
    checkedInTime: ["CHECKED_IN","DOCKED","COMPLETED"].includes(statuses[i % statuses.length]) ? new Date(now.getTime() - i * 1800000).toISOString() : null,
    status: statuses[i % statuses.length],
    referenceDoc: i % 2 === 0 ? `ASN-20260609-${String(i + 1).padStart(4, "0")}` : `SHIP-${2000 + i}`,
    vendor: i % 2 === 0 ? CARRIERS[i % CARRIERS.length] : null,
    carrier_contact: `contact${i}@carrier.com`,
  }));
}

export interface YardFilters { search: string; status: YardTruckStatus | ""; direction: "INBOUND" | "OUTBOUND" | ""; dwellAlert: boolean; }
const DEFAULT_FILTERS: YardFilters = { search: "", status: "", direction: "", dwellAlert: false };

interface YardState {
  trucks: YardTruck[];
  docks: YardDock[];
  appointments: YardAppointment[];
  filters: YardFilters;
  page: number;

  gateIn: (truck: Omit<YardTruck, "id" | "gateInTime" | "dwellMinutes" | "dwellAlert">) => YardTruck;
  gateOut: (truckId: string) => void;
  assignDock: (truckId: string, dockId: string) => void;
  updateTruckStatus: (truckId: string, status: YardTruckStatus) => void;
  releaseDock: (dockId: string) => void;
  setFilters: (f: Partial<YardFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;

  filteredTrucks: () => YardTruck[];
  kpis: () => { inYard: number; dockedIn: number; dockedOut: number; avgDwell: string; dwellAlerts: number; gateMoves: number; availableDocks: number };
  yardOccupancy: () => { position: YardPosition; count: number }[];
  statusFunnel: () => { status: YardTruckStatus; count: number }[];
  dwellTrucks: () => YardTruck[];
  upcomingAppointments: () => YardAppointment[];
  carrierList: () => string[];
}

export const useYardStore = create<YardState>()(
  persist(
    (set, get) => ({
      trucks: [],
      docks: [],
      appointments: [],
      filters: DEFAULT_FILTERS,
      page: 1,

      gateIn: (data) => {
        const truck: YardTruck = { ...data, id: `TRK-Y${Date.now()}`, gateInTime: new Date().toISOString(), dwellMinutes: 0, dwellAlert: false };
        // Inbound trucks register an arrival in the Inbound module so receiving sees them.
        if (truck.direction === "INBOUND") {
          const inbound = useInboundStore.getState();
          if (truck.asnId) {
            inbound.updateAsnStatus(truck.asnId, "ARRIVED");
          } else {
            const asn = inbound.createAsn({
              status: "PENDING",
              vendor: truck.carrier, vendorCode: truck.carrier.slice(0, 4).toUpperCase(),
              poNumbers: [], carrierName: truck.carrier, truckNumber: truck.truckNumber, trailerNumber: truck.plateNumber,
              dockId: null, dockCode: null, scheduledArrival: truck.gateInTime ?? new Date().toISOString(),
              actualArrival: new Date().toISOString(), completedAt: null, priority: truck.priority,
              totalLines: 0, totalUnits: 0, receivedUnits: 0, notes: `Gate-in from yard · ${truck.truckNumber}`,
              createdBy: "Yard Gate", warehouseId: "WH-01", temperatureRequired: false, hazmat: truck.hazmat,
              palletCount: 0, grossWeight: 0,
            });
            inbound.updateAsnStatus(asn.id, "ARRIVED");
            truck.asnId = asn.id;   // link back
          }
        }
        set((s) => ({ trucks: [truck, ...s.trucks] }));
        return truck;
      },

      gateOut: (truckId) => {
        set((s) => ({
          trucks: s.trucks.map((t) =>
            t.id === truckId ? { ...t, status: "GATE_OUT" as YardTruckStatus, departureTime: new Date().toISOString() } : t
          ),
        }));
      },

      assignDock: (truckId, dockId) => {
        const dock = get().docks.find((d) => d.id === dockId);
        if (!dock) return;
        const truck = get().trucks.find((t) => t.id === truckId);
        if (truck?.direction === "INBOUND" && truck.asnId) {
          useInboundStore.getState().updateAsnStatus(truck.asnId, "DOCKED");
        }
        set((s) => ({
          trucks: s.trucks.map((t) =>
            t.id === truckId
              ? { ...t, dockId, dockCode: dock.code, status: "DOCKING" as YardTruckStatus, dockAssignedTime: new Date().toISOString() }
              : t
          ),
          docks: s.docks.map((d) =>
            d.id === dockId
              ? { ...d, status: "OCCUPIED_IN" as DockStatus, assignedTruckId: truckId, assignedAt: new Date().toISOString() }
              : d
          ),
        }));
      },

      updateTruckStatus: (truckId, status) => {
        set((s) => ({ trucks: s.trucks.map((t) => t.id === truckId ? { ...t, status } : t) }));
      },

      releaseDock: (dockId) => {
        set((s) => ({
          docks: s.docks.map((d) =>
            d.id === dockId ? { ...d, status: "AVAILABLE" as DockStatus, assignedTruckId: null, assignedAt: null, currentWeight: 0 } : d
          ),
        }));
      },

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setPage: (p) => set({ page: p }),

      filteredTrucks: () => {
        const { trucks, filters } = get();
        return trucks.filter((t) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!t.truckNumber.toLowerCase().includes(q) && !t.carrier.toLowerCase().includes(q) && !t.driver.toLowerCase().includes(q)) return false;
          }
          if (filters.status && t.status !== filters.status) return false;
          if (filters.direction && t.direction !== filters.direction) return false;
          if (filters.dwellAlert && !t.dwellAlert) return false;
          return true;
        });
      },

      kpis: () => {
        const { trucks, docks } = get();
        const active = trucks.filter((t) => !["GATE_OUT","DEPARTED"].includes(t.status));
        const dwells = active.map((t) => t.dwellMinutes).filter((d) => d > 0);
        return {
          inYard: active.length,
          dockedIn: trucks.filter((t) => ["DOCKED_IN","UNLOADING"].includes(t.status)).length,
          dockedOut: trucks.filter((t) => ["DOCKED_OUT","LOADING","LOADED"].includes(t.status)).length,
          avgDwell: dwells.length > 0 ? `${Math.round(dwells.reduce((s, d) => s + d, 0) / dwells.length)}m` : "—",
          dwellAlerts: trucks.filter((t) => t.dwellAlert).length,
          gateMoves: trucks.filter((t) => t.gateInTime?.startsWith(new Date().toISOString().slice(0, 10))).length,
          availableDocks: docks.filter((d) => d.status === "AVAILABLE").length,
        };
      },

      yardOccupancy: () => {
        const order: YardPosition[] = ["LANE_A", "LANE_B", "LANE_C", "STAGING", "OVERFLOW", "HAZMAT"];
        const active = get().trucks.filter((t) => !["GATE_OUT", "DEPARTED"].includes(t.status));
        const map = new Map<YardPosition, number>();
        for (const t of active) if (t.yardPosition) map.set(t.yardPosition, (map.get(t.yardPosition) ?? 0) + 1);
        return order.map((position) => ({ position, count: map.get(position) ?? 0 }));
      },

      statusFunnel: () => {
        const order: YardTruckStatus[] = ["GATE_IN", "WAITING", "DOCKING", "DOCKED_IN", "UNLOADING", "DOCKED_OUT", "LOADING", "LOADED", "GATE_OUT"];
        const map = new Map<YardTruckStatus, number>();
        for (const t of get().trucks) map.set(t.status, (map.get(t.status) ?? 0) + 1);
        return order.map((status) => ({ status, count: map.get(status) ?? 0 })).filter((x) => x.count > 0);
      },

      dwellTrucks: () => get().trucks.filter((t) => t.dwellAlert && !["GATE_OUT", "DEPARTED"].includes(t.status)).sort((a, b) => b.dwellMinutes - a.dwellMinutes),

      upcomingAppointments: () =>
        get().appointments.filter((a) => ["SCHEDULED", "CHECKED_IN"].includes(a.status)).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),

      carrierList: () => Array.from(new Set(get().trucks.map((t) => t.carrier))).sort(),
    }),
    {
      name: "trilowms-yard-v2",
      partialize: (s) => ({ trucks: s.trucks, docks: s.docks, appointments: s.appointments }),
    }
  )
);

export const YARD_STATUS_META: Record<YardTruckStatus, { label: string; color: string; bg: string; border: string }> = {
  GATE_IN:    { label: "Gate In",    color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  WAITING:    { label: "Waiting",    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  DOCKING:    { label: "Docking",    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  DOCKED_IN:  { label: "Docked In",  color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30"  },
  DOCKED_OUT: { label: "Docked Out", color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30"  },
  LOADING:    { label: "Loading",    color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30"  },
  UNLOADING:  { label: "Unloading",  color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  LOADED:     { label: "Loaded",     color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  GATE_OUT:   { label: "Gate Out",   color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30"   },
  DEPARTED:   { label: "Departed",   color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};
