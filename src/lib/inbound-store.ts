/**
 * TriloWMS — Inbound Module Store
 * ASN management, receiving workflow, dock scheduling, discrepancy tracking
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useQCStore } from "@/lib/qc-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AsnStatus =
  | "PENDING"        // Created, truck not arrived
  | "SCHEDULED"      // Dock door assigned
  | "ARRIVED"        // Truck at gate
  | "DOCKED"         // At dock door
  | "RECEIVING"      // Active receiving
  | "PARTIAL"        // Some lines received
  | "RECEIVED"       // All lines received
  | "DISCREPANCY"    // Quantity/quality issues found
  | "CLOSED"         // Completed and closed
  | "CANCELLED";

export type ReceivingLineStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "RECEIVED"
  | "OVER_RECEIPT"
  | "SHORT_RECEIPT"
  | "DAMAGED"
  | "REJECTED";

export type DiscrepancyType =
  | "QUANTITY_OVER"
  | "QUANTITY_SHORT"
  | "WRONG_ITEM"
  | "DAMAGED"
  | "EXPIRED"
  | "LABEL_ERROR"
  | "TEMP_EXCURSION";

export interface AsnLine {
  id: string;
  asnId: string;
  lineNo: number;
  skuCode: string;
  skuName: string;
  poNumber: string;
  orderedQty: number;
  expectedQty: number;
  receivedQty: number;
  damagedQty: number;
  rejectedQty: number;
  uom: string;
  lotNumber: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  status: ReceivingLineStatus;
  receivedAt: string | null;
  receivedBy: string | null;
  notes: string | null;
  putawayTaskId: string | null;
}

export interface Discrepancy {
  id: string;
  asnId: string;
  lineId: string;
  type: DiscrepancyType;
  skuCode: string;
  skuName: string;
  expectedQty: number;
  actualQty: number;
  variance: number;
  variancePct: number;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "ESCALATED";
  reportedBy: string;
  reportedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  notes: string | null;
}

export interface DockDoor {
  id: string;
  code: string;
  type: "INBOUND" | "OUTBOUND" | "BOTH";
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
  assignedAsnId: string | null;
  assignedTruckId: string | null;
  occupiedSince: string | null;
  scheduledUntil: string | null;
}

export interface ASN {
  id: string;                 // ASN-YYYYMMDD-NNNN
  asnNumber: string;
  status: AsnStatus;
  vendor: string;
  vendorCode: string;
  poNumbers: string[];
  carrierName: string;
  truckNumber: string | null;
  trailerNumber: string | null;
  dockId: string | null;
  dockCode: string | null;
  scheduledArrival: string;   // ISO datetime
  actualArrival: string | null;
  completedAt: string | null;
  priority: "NORMAL" | "HIGH" | "URGENT";
  totalLines: number;
  totalUnits: number;
  receivedUnits: number;
  lines: AsnLine[];
  discrepancies: Discrepancy[];
  notes: string | null;
  createdBy: string;
  createdAt: string;
  warehouseId: string;
  temperatureRequired: boolean;
  hazmat: boolean;
  palletCount: number;
  grossWeight: number;        // kg
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const VENDORS = [
  { name: "Globex Industrial", code: "GLBX" },
  { name: "Initech Supply Co.", code: "INTC" },
  { name: "Acme Corporation", code: "ACME" },
  { name: "Stark Industries", code: "STRK" },
  { name: "Wayne Enterprises", code: "WAYN" },
  { name: "Umbrella Corp.", code: "UMBL" },
];

const CARRIERS = ["DHL Freight", "FedEx Ground", "UPS Supply Chain", "DB Schenker", "Maersk Logistics", "XPO Logistics"];

const SKU_LIST = [
  { code: "SKU-10000", name: "Aluminum Extrusion Bracket 40x40" },
  { code: "SKU-10001", name: "Steel Coil 2.5mm Hot-Rolled" },
  { code: "SKU-10002", name: "Hydraulic Pump Assembly 12V" },
  { code: "SKU-10003", name: "Carbon Fiber Filter Element" },
  { code: "SKU-10004", name: "Insulated Wire 14AWG THHN" },
  { code: "SKU-10005", name: "PCB Controller Module Rev3" },
  { code: "SKU-10006", name: "Deep Groove Ball Bearing 6204-2RS" },
  { code: "SKU-10007", name: "Lithium Ion Cell 18650 2600mAh" },
  { code: "SKU-10008", name: "Stainless Steel Hex Bolt M8x40" },
  { code: "SKU-10009", name: "Industrial HDPE Drum 220L" },
];

const DOCK_DOORS: DockDoor[] = Array.from({ length: 8 }, (_, i) => ({
  id: `dock-in-${i + 1}`,
  code: `IN-${String(i + 1).padStart(2, "0")}`,
  type: i < 6 ? "INBOUND" : "BOTH",
  status: i < 3 ? "OCCUPIED" : i === 3 ? "MAINTENANCE" : "AVAILABLE",
  assignedAsnId: i < 3 ? `ASN-20260609-00${i + 1}` : null,
  assignedTruckId: i < 3 ? `TRK-${2000 + i}` : null,
  occupiedSince: i < 3 ? new Date(Date.now() - (i + 1) * 3600000).toISOString() : null,
  scheduledUntil: i < 3 ? new Date(Date.now() + (3 - i) * 3600000).toISOString() : null,
}));

function buildAsnLines(asnId: string, count: number, idx: number, status: AsnStatus): AsnLine[] {
  return Array.from({ length: count }, (_, j) => {
    const sku = SKU_LIST[(idx + j) % SKU_LIST.length];
    const ordered = Math.floor(50 + (idx + j) * 17 % 450);
    const isReceived = ["RECEIVED", "CLOSED"].includes(status);
    const isReceiving = status === "RECEIVING" || status === "PARTIAL";
    const received = isReceived ? ordered : isReceiving ? Math.floor(ordered * 0.6) : 0;
    const damaged = isReceived ? Math.floor(Math.random() * 3) : 0;
    const lineStatus: ReceivingLineStatus = isReceived
      ? "RECEIVED"
      : isReceiving
      ? "IN_PROGRESS"
      : "PENDING";

    return {
      id: `line-${asnId}-${j + 1}`,
      asnId,
      lineNo: j + 1,
      skuCode: sku.code,
      skuName: sku.name,
      poNumber: `PO-${78000 + idx + j}`,
      orderedQty: ordered,
      expectedQty: ordered,
      receivedQty: received,
      damagedQty: damaged,
      rejectedQty: 0,
      uom: j % 3 === 0 ? "PLT" : j % 2 === 0 ? "CS" : "EA",
      lotNumber: `LOT-${10000 + idx * 3 + j}`,
      batchNumber: `BATCH-202606-${String(1001 + idx * 7 + j).slice(-4)}`,
      expiryDate: j % 4 === 0 ? new Date(Date.now() + 90 * 24 * 3600000 + j * 86400000).toISOString().slice(0, 10) : null,
      status: lineStatus,
      receivedAt: isReceived ? new Date(Date.now() - idx * 3600000).toISOString() : null,
      receivedBy: isReceived ? ["Alex Rodriguez", "Maria Chen", "Diego Vasquez"][idx % 3] : null,
      notes: damaged > 0 ? "Minor damage on packaging, product intact" : null,
      putawayTaskId: isReceived ? `PTW-${5000 + idx * count + j}` : null,
    };
  });
}

function buildSeedAsns(): ASN[] {
  const statuses: AsnStatus[] = ["PENDING", "SCHEDULED", "ARRIVED", "DOCKED", "RECEIVING", "PARTIAL", "RECEIVED", "DISCREPANCY", "CLOSED", "CLOSED", "CLOSED"];
  const now = new Date();

  return Array.from({ length: 28 }, (_, i) => {
    const vendor = VENDORS[i % VENDORS.length];
    const status = statuses[i % statuses.length];
    const asnId = `ASN-20260609-${String(i + 1).padStart(4, "0")}`;
    const lineCount = 2 + (i % 5);
    const lines = buildAsnLines(asnId, lineCount, i, status);
    const totalUnits = lines.reduce((s, l) => s + l.orderedQty, 0);
    const receivedUnits = lines.reduce((s, l) => s + l.receivedQty, 0);
    const hasDiscrep = status === "DISCREPANCY" || (status === "RECEIVED" && i % 7 === 0);

    const arrival = new Date(now.getTime() + (i - 10) * 3600000 * 2);

    return {
      id: asnId,
      asnNumber: asnId,
      status,
      vendor: vendor.name,
      vendorCode: vendor.code,
      poNumbers: Array.from({ length: 1 + (i % 3) }, (_, j) => `PO-${78000 + i * 3 + j}`),
      carrierName: CARRIERS[i % CARRIERS.length],
      truckNumber: ["DOCKED", "RECEIVING", "PARTIAL", "RECEIVED", "CLOSED"].includes(status) ? `TRK-${2000 + i}` : null,
      trailerNumber: ["DOCKED", "RECEIVING", "PARTIAL", "RECEIVED", "CLOSED"].includes(status) ? `TRL-${3000 + i}` : null,
      dockId: i < 3 ? DOCK_DOORS[i].id : null,
      dockCode: i < 3 ? DOCK_DOORS[i].code : null,
      scheduledArrival: arrival.toISOString(),
      actualArrival: ["ARRIVED", "DOCKED", "RECEIVING", "PARTIAL", "RECEIVED", "CLOSED"].includes(status)
        ? new Date(arrival.getTime() + (i % 3) * 600000).toISOString()
        : null,
      completedAt: ["RECEIVED", "CLOSED"].includes(status) ? new Date(arrival.getTime() + 4 * 3600000).toISOString() : null,
      priority: i % 8 === 0 ? "URGENT" : i % 4 === 0 ? "HIGH" : "NORMAL",
      totalLines: lineCount,
      totalUnits,
      receivedUnits,
      lines,
      discrepancies: hasDiscrep
        ? [
            {
              id: `DISC-${asnId}-1`,
              asnId,
              lineId: `line-${asnId}-1`,
              type: i % 3 === 0 ? "QUANTITY_SHORT" : "DAMAGED",
              skuCode: lines[0].skuCode,
              skuName: lines[0].skuName,
              expectedQty: lines[0].expectedQty,
              actualQty: lines[0].expectedQty - Math.floor(lines[0].expectedQty * 0.08),
              variance: -Math.floor(lines[0].expectedQty * 0.08),
              variancePct: -8,
              status: i % 5 === 0 ? "RESOLVED" : "OPEN",
              reportedBy: "Diego Vasquez",
              reportedAt: new Date(arrival.getTime() + 1.5 * 3600000).toISOString(),
              resolvedBy: i % 5 === 0 ? "Maria Chen" : null,
              resolvedAt: i % 5 === 0 ? new Date(arrival.getTime() + 3 * 3600000).toISOString() : null,
              resolution: i % 5 === 0 ? "Vendor credit issued for short quantity" : null,
              notes: "Physical count confirmed shortage. Vendor notified.",
            },
          ]
        : [],
      notes: i % 6 === 0 ? "Priority receipt — production line material" : null,
      createdBy: ["Alex Rodriguez", "Maria Chen"][i % 2],
      createdAt: new Date(arrival.getTime() - 48 * 3600000).toISOString(),
      warehouseId: "TRILO-DC-01",
      temperatureRequired: i % 9 === 0,
      hazmat: i % 13 === 0,
      palletCount: 4 + (i % 12),
      grossWeight: 1200 + (i * 113 % 8000),
    };
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface AsnFilters {
  search: string;
  status: AsnStatus | "";
  vendor: string;
  priority: string;
  dateFrom: string;
  dateTo: string;
  dockId: string;
  hazmat: "" | "true" | "false";
}

const DEFAULT_FILTERS: AsnFilters = {
  search: "",
  status: "",
  vendor: "",
  priority: "",
  dateFrom: "",
  dateTo: "",
  dockId: "",
  hazmat: "",
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface InboundState {
  asns: ASN[];
  dockDoors: DockDoor[];
  filters: AsnFilters;
  selectedAsnId: string | null;
  selectedLineId: string | null;
  page: number;
  pageSize: number;

  // Actions
  createAsn: (data: Omit<ASN, "id" | "asnNumber" | "createdAt" | "lines" | "discrepancies">) => ASN;
  // Without this there was no way to put a line item on a newly created ASN —
  // receiveLine had nothing to operate on, which meant a fresh ASN could never
  // actually be received and nothing downstream (Putaway, Stock, QC) could fire.
  addLine: (asnId: string, input: { skuCode: string; skuName: string; poNumber: string; orderedQty: number; uom: string }) => void;
  updateAsnStatus: (id: string, status: AsnStatus) => void;
  assignDock: (asnId: string, dockId: string) => void;
  // Actually occupies a dock door when a truck physically docks (ARRIVED → DOCKED),
  // instead of the status transition happening with no real dock door ever getting
  // marked occupied — which is why the Dock Door Board stayed empty/vacant before.
  dockTruck: (asnId: string, dockId: string) => void;
  receiveLine: (
    asnId: string,
    lineId: string,
    qty: number,
    opts?: { damagedQty?: number; rejectedQty?: number; lotNumber?: string | null; expiryDate?: string | null; notes?: string | null; receivedBy?: string },
  ) => void;
  raiseDiscrepancy: (disc: Omit<Discrepancy, "id" | "reportedAt">) => void;
  resolveDiscrepancy: (asnId: string, discId: string, resolvedBy: string, resolution: string) => void;
  updateDockStatus: (dockId: string, status: DockDoor["status"]) => void;
  selectAsn: (id: string | null) => void;
  setFilters: (f: Partial<AsnFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;

  // Derived
  filteredAsns: () => ASN[];
  pagedAsns: () => ASN[];
  totalPages: () => number;
  kpis: () => {
    openAsns: number;
    receivedToday: number;
    dockedNow: number;
    discrepancies: number;
    urgentPending: number;
    avgReceivingTime: string;
    pendingPutaway: number;
  };
  availableDocks: () => DockDoor[];
  putawayReadyLines: () => { line: AsnLine; asnNumber: string; sourceDock: string | null }[];
  receivingWorklist: () => ASN[];
  allDiscrepancies: () => (Discrepancy & { asnNumber: string; vendor: string; priority: ASN["priority"] })[];
  dockUtilization: () => { occupied: number; available: number; reserved: number; maintenance: number; total: number; pct: number };
  agingBuckets: () => { label: string; count: number }[];
  vendorList: () => string[];
  carrierList: () => string[];
}

let _asnSeq = 100;
function nextAsnId() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ASN-${d}-${String(++_asnSeq).padStart(4, "0")}`;
}

// The 8 dock doors are real physical fixtures of the warehouse (like the bin
// layout or the labor roster), not something derived from transactions — so
// unlike ASNs/stock/etc. they're seeded as reference data. Seeded vacant/clean
// (no fake occupying ASN/truck) so every occupancy from here on is real, driven
// by dockTruck() as actual ASNs get docked.
const SEED_DOCK_DOORS: DockDoor[] = DOCK_DOORS.map((d) => ({
  ...d,
  status: "AVAILABLE",
  assignedAsnId: null,
  assignedTruckId: null,
  occupiedSince: null,
  scheduledUntil: null,
}));

export const useInboundStore = create<InboundState>()(
  persist(
    (set, get) => ({
      asns: [],
      dockDoors: SEED_DOCK_DOORS,
      filters: DEFAULT_FILTERS,
      selectedAsnId: null,
      selectedLineId: null,
      page: 1,
      pageSize: 15,

      createAsn: (data) => {
        const id = nextAsnId();
        const asn: ASN = {
          ...data,
          id,
          asnNumber: id,
          createdAt: new Date().toISOString(),
          lines: [],
          discrepancies: [],
          status: "PENDING",
        };
        set((s) => ({ asns: [asn, ...s.asns] }));
        return asn;
      },

      addLine: (asnId, input) => {
        set((s) => ({
          asns: s.asns.map((a) => {
            if (a.id !== asnId) return a;
            const line: AsnLine = {
              id: `line-${asnId}-${a.lines.length + 1}`,
              asnId,
              lineNo: a.lines.length + 1,
              skuCode: input.skuCode,
              skuName: input.skuName,
              poNumber: input.poNumber || (a.poNumbers[0] ?? "—"),
              orderedQty: input.orderedQty,
              expectedQty: input.orderedQty,
              receivedQty: 0,
              damagedQty: 0,
              rejectedQty: 0,
              uom: input.uom,
              lotNumber: null,
              batchNumber: null,
              expiryDate: null,
              status: "PENDING",
              receivedAt: null,
              receivedBy: null,
              notes: null,
              putawayTaskId: null,
            };
            const lines = [...a.lines, line];
            return { ...a, lines, totalLines: lines.length, totalUnits: lines.reduce((s2, l) => s2 + l.orderedQty, 0) };
          }),
        }));
      },

      updateAsnStatus: (id, status) => {
        const asn = get().asns.find((a) => a.id === id);
        // Free up the physical dock door once this ASN is done with it, so the
        // Dock Door Board reflects reality instead of showing it occupied forever.
        const releaseDock = asn?.dockId && ["RECEIVED", "CLOSED"].includes(status);
        set((s) => ({
          asns: s.asns.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status,
                  actualArrival: status === "ARRIVED" && !a.actualArrival ? new Date().toISOString() : a.actualArrival,
                  completedAt: ["RECEIVED", "CLOSED"].includes(status) && !a.completedAt ? new Date().toISOString() : a.completedAt,
                }
              : a
          ),
          dockDoors: releaseDock
            ? s.dockDoors.map((d) =>
                d.id === asn!.dockId
                  ? { ...d, status: "AVAILABLE", assignedAsnId: null, assignedTruckId: null, occupiedSince: null, scheduledUntil: null }
                  : d
              )
            : s.dockDoors,
        }));
      },

      assignDock: (asnId, dockId) => {
        const dock = get().dockDoors.find((d) => d.id === dockId);
        if (!dock) return;
        set((s) => ({
          asns: s.asns.map((a) =>
            a.id === asnId ? { ...a, dockId, dockCode: dock.code, status: "SCHEDULED" } : a
          ),
          dockDoors: s.dockDoors.map((d) =>
            d.id === dockId
              ? { ...d, status: "RESERVED", assignedAsnId: asnId, scheduledUntil: new Date(Date.now() + 4 * 3600000).toISOString() }
              : d
          ),
        }));
      },

      dockTruck: (asnId, dockId) => {
        const dock = get().dockDoors.find((d) => d.id === dockId);
        const asn = get().asns.find((a) => a.id === asnId);
        if (!dock || !asn || dock.status !== "AVAILABLE" && dock.status !== "RESERVED") return;
        const now = new Date().toISOString();
        set((s) => ({
          asns: s.asns.map((a) =>
            a.id === asnId
              ? { ...a, dockId, dockCode: dock.code, status: "DOCKED", actualArrival: a.actualArrival ?? now }
              : a
          ),
          dockDoors: s.dockDoors.map((d) =>
            d.id === dockId
              ? { ...d, status: "OCCUPIED", assignedAsnId: asnId, assignedTruckId: asn.truckNumber, occupiedSince: now }
              : d
          ),
        }));
      },

      receiveLine: (asnId, lineId, qty, opts = {}) => {
        const { damagedQty = 0, rejectedQty = 0, lotNumber, expiryDate, notes = null, receivedBy = "Current User" } = opts;
        const lineBefore = get().asns.find((a) => a.id === asnId)?.lines.find((l) => l.id === lineId) ?? null;
        set((s) => {
          const asns = s.asns.map((a) => {
            if (a.id !== asnId) return a;
            const lines = a.lines.map((l) => {
              if (l.id !== lineId) return l;
              const newReceived = l.receivedQty + qty;
              let lineStatus: ReceivingLineStatus = "IN_PROGRESS";
              if (newReceived >= l.expectedQty) lineStatus = newReceived > l.expectedQty ? "OVER_RECEIPT" : "RECEIVED";
              else if (newReceived > 0 && newReceived < l.expectedQty) lineStatus = "SHORT_RECEIPT";
              if (rejectedQty > 0 && newReceived === 0) lineStatus = "REJECTED";
              return {
                ...l,
                receivedQty: newReceived,
                damagedQty: l.damagedQty + damagedQty,
                rejectedQty: l.rejectedQty + rejectedQty,
                status: lineStatus,
                lotNumber: lotNumber ?? l.lotNumber,
                expiryDate: expiryDate ?? l.expiryDate,
                receivedAt: new Date().toISOString(),
                receivedBy,
                notes: notes ?? l.notes,
              };
            });
            const allDone = lines.every((l) => ["RECEIVED", "OVER_RECEIPT", "SHORT_RECEIPT", "REJECTED"].includes(l.status));
            const anyDone = lines.some((l) => l.receivedQty > 0 || l.rejectedQty > 0);
            const receivedUnits = lines.reduce((acc, l) => acc + l.receivedQty, 0);
            return {
              ...a,
              lines,
              receivedUnits,
              status: allDone ? "RECEIVED" : anyDone ? "PARTIAL" : a.status,
            };
          });
          return { asns };
        });
        // Every physical receipt gets a QC inspection opened against it — this is the
        // real trigger for QC activity instead of QC being a disconnected seeded list.
        if (lineBefore && qty > 0) {
          useQCStore.getState().createInspection({
            type: "INBOUND",
            skuCode: lineBefore.skuCode,
            skuName: lineBefore.skuName,
            sampleSize: qty,
            lotNumber: lotNumber ?? lineBefore.lotNumber,
            batchNumber: lineBefore.batchNumber,
            expiryDate: expiryDate ?? lineBefore.expiryDate,
            sourceRef: asnId,
          });
        }
      },

      raiseDiscrepancy: (disc) => {
        const id = `DISC-${Date.now()}`;
        const full: Discrepancy = { ...disc, id, reportedAt: new Date().toISOString() };
        set((s) => ({
          asns: s.asns.map((a) =>
            a.id === disc.asnId
              ? { ...a, discrepancies: [...a.discrepancies, full], status: "DISCREPANCY" }
              : a
          ),
        }));
      },

      resolveDiscrepancy: (asnId, discId, resolvedBy, resolution) => {
        set((s) => ({
          asns: s.asns.map((a) => {
            if (a.id !== asnId) return a;
            const discrepancies = a.discrepancies.map((d) =>
              d.id === discId
                ? { ...d, status: "RESOLVED" as const, resolvedBy, resolution, resolvedAt: new Date().toISOString() }
                : d
            );
            const allResolved = discrepancies.every((d) => d.status === "RESOLVED");
            return { ...a, discrepancies, status: allResolved ? "RECEIVED" : a.status };
          }),
        }));
      },

      updateDockStatus: (dockId, status) => {
        set((s) => ({
          dockDoors: s.dockDoors.map((d) =>
            d.id === dockId
              ? {
                  ...d,
                  status,
                  assignedAsnId: status === "AVAILABLE" ? null : d.assignedAsnId,
                  assignedTruckId: status === "AVAILABLE" ? null : d.assignedTruckId,
                  occupiedSince: status === "OCCUPIED" ? new Date().toISOString() : d.occupiedSince,
                }
              : d
          ),
        }));
      },

      selectAsn: (id) => set({ selectedAsnId: id }),

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 1 }),
      setPage: (p) => set({ page: p }),

      filteredAsns: () => {
        const { asns, filters } = get();
        return asns.filter((a) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (
              !a.asnNumber.toLowerCase().includes(q) &&
              !a.vendor.toLowerCase().includes(q) &&
              !a.carrierName.toLowerCase().includes(q) &&
              !a.poNumbers.some((p) => p.toLowerCase().includes(q))
            )
              return false;
          }
          if (filters.status && a.status !== filters.status) return false;
          if (filters.vendor && a.vendor !== filters.vendor) return false;
          if (filters.priority && a.priority !== filters.priority) return false;
          if (filters.dockId && a.dockId !== filters.dockId) return false;
          if (filters.hazmat !== "" && String(a.hazmat) !== filters.hazmat) return false;
          if (filters.dateFrom && a.scheduledArrival < filters.dateFrom) return false;
          if (filters.dateTo && a.scheduledArrival > filters.dateTo + "T23:59:59") return false;
          return true;
        });
      },

      pagedAsns: () => {
        const { page, pageSize } = get();
        const all = get().filteredAsns();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => {
        const { pageSize } = get();
        return Math.max(1, Math.ceil(get().filteredAsns().length / pageSize));
      },

      kpis: () => {
        const { asns } = get();
        const today = new Date().toISOString().slice(0, 10);
        const openStatuses: AsnStatus[] = ["PENDING", "SCHEDULED", "ARRIVED", "DOCKED", "RECEIVING", "PARTIAL", "DISCREPANCY"];
        return {
          openAsns: asns.filter((a) => openStatuses.includes(a.status)).length,
          receivedToday: asns.filter((a) => a.completedAt?.startsWith(today)).length,
          dockedNow: asns.filter((a) => ["DOCKED", "RECEIVING", "PARTIAL"].includes(a.status)).length,
          discrepancies: asns.reduce((s, a) => s + a.discrepancies.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW").length, 0),
          urgentPending: asns.filter((a) => a.priority === "URGENT" && openStatuses.includes(a.status)).length,
          avgReceivingTime: "2h 14m",
          pendingPutaway: asns.reduce((s, a) => s + a.lines.filter((l) => l.status === "RECEIVED" && !l.putawayTaskId).length, 0),
        };
      },

      availableDocks: () => {
        return get().dockDoors.filter((d) => d.status === "AVAILABLE" && (d.type === "INBOUND" || d.type === "BOTH"));
      },

      putawayReadyLines: () => {
        const activeHolds = useQCStore.getState().holds.filter((h) => h.status !== "RESOLVED");
        // A hold blocks a line if it matches on SKU, and additionally on lot when the
        // hold specifies one (a lot-specific hold shouldn't block other lots of the
        // same SKU; a SKU-wide hold with no lot blocks every lot of that SKU).
        const isHeld = (skuCode: string, lotNumber: string | null) =>
          activeHolds.some((h) => h.skuCode === skuCode && (!h.lotNumber || h.lotNumber === lotNumber));

        const out: { line: AsnLine; asnNumber: string; sourceDock: string | null }[] = [];
        for (const a of get().asns) {
          if (!["PARTIAL", "RECEIVED", "DISCREPANCY", "CLOSED"].includes(a.status)) continue;
          for (const l of a.lines) {
            const good = l.receivedQty - l.damagedQty - l.rejectedQty;
            if (l.status === "RECEIVED" && good > 0 && !isHeld(l.skuCode, l.lotNumber)) {
              out.push({ line: l, asnNumber: a.asnNumber, sourceDock: a.dockCode ?? null });
            }
          }
        }
        return out;
      },

      receivingWorklist: () => {
        const active: AsnStatus[] = ["DOCKED", "RECEIVING", "PARTIAL"];
        return get()
          .asns.filter((a) => active.includes(a.status))
          .sort((a, b) => {
            const pr = { URGENT: 0, HIGH: 1, NORMAL: 2 } as const;
            if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
            return a.scheduledArrival.localeCompare(b.scheduledArrival);
          });
      },

      allDiscrepancies: () => {
        return get()
          .asns.flatMap((a) =>
            a.discrepancies.map((d) => ({ ...d, asnNumber: a.asnNumber, vendor: a.vendor, priority: a.priority })),
          )
          .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
      },

      dockUtilization: () => {
        const docks = get().dockDoors;
        const occupied = docks.filter((d) => d.status === "OCCUPIED").length;
        const available = docks.filter((d) => d.status === "AVAILABLE").length;
        const reserved = docks.filter((d) => d.status === "RESERVED").length;
        const maintenance = docks.filter((d) => d.status === "MAINTENANCE").length;
        const total = docks.length;
        return { occupied, available, reserved, maintenance, total, pct: total ? Math.round(((occupied + reserved) / total) * 100) : 0 };
      },

      agingBuckets: () => {
        const open: AsnStatus[] = ["PENDING", "SCHEDULED", "ARRIVED", "DOCKED", "RECEIVING", "PARTIAL", "DISCREPANCY"];
        const now = Date.now();
        const buckets = [
          { label: "On time", count: 0 },
          { label: "< 2h late", count: 0 },
          { label: "2–6h late", count: 0 },
          { label: "> 6h late", count: 0 },
        ];
        get()
          .asns.filter((a) => open.includes(a.status))
          .forEach((a) => {
            const lateMs = now - new Date(a.scheduledArrival).getTime();
            const lateH = lateMs / 3600000;
            if (lateH <= 0) buckets[0].count++;
            else if (lateH < 2) buckets[1].count++;
            else if (lateH < 6) buckets[2].count++;
            else buckets[3].count++;
          });
        return buckets;
      },

      vendorList: () => Array.from(new Set(get().asns.map((a) => a.vendor))).sort(),
      carrierList: () => Array.from(new Set(get().asns.map((a) => a.carrierName))).sort(),
    }),
    {
      name: "trilowms-inbound-v2",
      partialize: (s) => ({ asns: s.asns, dockDoors: s.dockDoors }),
    }
  )
);

// ─── Meta ─────────────────────────────────────────────────────────────────────

export const ASN_STATUS_META: Record<AsnStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING:     { label: "Pending",     color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  SCHEDULED:   { label: "Scheduled",   color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  ARRIVED:     { label: "Arrived",     color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  DOCKED:      { label: "Docked",      color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30"  },
  RECEIVING:   { label: "Receiving",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  PARTIAL:     { label: "Partial",     color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30"  },
  RECEIVED:    { label: "Received",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  DISCREPANCY: { label: "Discrepancy", color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  CLOSED:      { label: "Closed",      color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30"   },
  CANCELLED:   { label: "Cancelled",   color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};

export const PRIORITY_META = {
  NORMAL: { label: "Normal", color: "text-slate-400", bg: "bg-slate-500/10" },
  HIGH:   { label: "High",   color: "text-orange-400", bg: "bg-orange-500/10" },
  URGENT: { label: "Urgent", color: "text-red-400",    bg: "bg-red-500/10" },
};
