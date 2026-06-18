/**
 * TriloWMS — Quality Control Module Store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type InspectionStatus = "QUEUED" | "IN_PROGRESS" | "PASSED" | "FAILED" | "CONDITIONAL_PASS" | "PENDING_REVIEW" | "SAMPLED" | "HOLD" | "DISPOSED";
export type DispositionType = "ACCEPT" | "REJECT" | "REWORK" | "RETURN_TO_VENDOR" | "SCRAP" | "QUARANTINE" | "CONDITIONAL_RELEASE";
export type HoldType = "QC_HOLD" | "VENDOR_HOLD" | "RECALL_HOLD" | "DAMAGE_HOLD" | "EXPIRY_HOLD" | "REGULATORY_HOLD";
export type SamplingPlan = "ZERO_DEFECT" | "AQL_1_0" | "AQL_2_5" | "AQL_4_0" | "AQL_6_5" | "100_PCT";

export interface InspectionCheckpoint {
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
  result: "PASS" | "FAIL" | "N/A" | null;
  value: string | null;
  tolerance: string | null;
  notes: string | null;
}

export interface QCHold {
  id: string;
  holdNumber: string;
  type: HoldType;
  skuCode: string;
  skuName: string;
  binCode: string | null;
  lotNumber: string | null;
  quantity: number;
  reason: string;
  raisedBy: string;
  raisedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: DispositionType | null;
  notes: string | null;
  status: "ACTIVE" | "RESOLVED" | "ESCALATED";
}

export interface QCInspection {
  id: string;
  inspectionNumber: string;
  type: "INBOUND" | "PUTAWAY" | "CYCLE_COUNT" | "RETURNS" | "OUTBOUND" | "AD_HOC";
  status: InspectionStatus;
  skuCode: string;
  skuName: string;
  lotNumber: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  sampleSize: number;
  inspectedQty: number;
  passedQty: number;
  failedQty: number;
  defectCount: number;
  defectRate: number;         // %
  aqlLevel: SamplingPlan;
  disposition: DispositionType | null;
  inspectorId: string;
  inspectorName: string;
  sourceRef: string | null;   // ASN / RMA / wave id
  binCode: string | null;
  checkpoints: InspectionCheckpoint[];
  findings: string | null;
  images: string[];           // URLs
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

// ─── Seed ────────────────────────────────────────────────────────────────────

const INSPECTORS = [
  { id: "qc1", name: "Aisha Patel" },
  { id: "qc2", name: "R.Park" },
  { id: "qc3", name: "S.Diaz" },
];

const SKUS = [
  { code: "SKU-10000", name: "Aluminum Extrusion Bracket 40x40" },
  { code: "SKU-10001", name: "Steel Coil 2.5mm Hot-Rolled" },
  { code: "SKU-10002", name: "Hydraulic Pump Assembly 12V" },
  { code: "SKU-10003", name: "Carbon Fiber Filter Element" },
  { code: "SKU-10005", name: "PCB Controller Module Rev3" },
];

const CHECKPOINT_TEMPLATES: InspectionCheckpoint[][] = [
  [
    { id: "cp1", name: "Visual Inspection", description: "Check for physical damage, scratches, dents", mandatory: true, result: null, value: null, tolerance: null, notes: null },
    { id: "cp2", name: "Quantity Verification", description: "Count units against PO quantity", mandatory: true, result: null, value: null, tolerance: "±2%", notes: null },
    { id: "cp3", name: "Label Check", description: "Verify barcode, lot, expiry labels", mandatory: true, result: null, value: null, tolerance: null, notes: null },
    { id: "cp4", name: "Dimensional Check", description: "Measure L×W×H against spec", mandatory: false, result: null, value: null, tolerance: "±1mm", notes: null },
    { id: "cp5", name: "Weight Check", description: "Weigh sample and compare to spec weight", mandatory: false, result: null, value: null, tolerance: "±5%", notes: null },
  ],
  [
    { id: "cp1", name: "Visual Inspection", description: "Surface defects, contamination check", mandatory: true, result: null, value: null, tolerance: null, notes: null },
    { id: "cp2", name: "Functionality Test", description: "Test functional performance", mandatory: true, result: null, value: null, tolerance: null, notes: null },
    { id: "cp3", name: "Documentation Check", description: "Verify CoA, test reports", mandatory: true, result: null, value: null, tolerance: null, notes: null },
  ],
];

function buildSeedInspections(): QCInspection[] {
  const statuses: InspectionStatus[] = ["QUEUED","IN_PROGRESS","PASSED","FAILED","PASSED","PASSED","CONDITIONAL_PASS","HOLD","PENDING_REVIEW"];
  const types: QCInspection["type"][] = ["INBOUND","INBOUND","PUTAWAY","RETURNS","OUTBOUND","AD_HOC"];
  const now = new Date();

  return Array.from({ length: 30 }, (_, i) => {
    const sku = SKUS[i % SKUS.length];
    const insp = INSPECTORS[i % INSPECTORS.length];
    const status = statuses[i % statuses.length];
    const type = types[i % types.length];
    const sample = 10 + (i * 7 % 40);
    const failed = ["FAILED","CONDITIONAL_PASS"].includes(status) ? Math.floor(sample * (0.05 + i % 5 * 0.02)) : 0;
    const defectRate = parseFloat(((failed / sample) * 100).toFixed(1));
    const cpTemplate = CHECKPOINT_TEMPLATES[i % CHECKPOINT_TEMPLATES.length];
    const checkpoints = cpTemplate.map((cp, j) => ({
      ...cp,
      id: `${cp.id}-${i}`,
      result: ["PASSED","FAILED","CONDITIONAL_PASS"].includes(status)
        ? (j === 0 && status === "FAILED" ? "FAIL" : "PASS") as "PASS" | "FAIL" | "N/A"
        : null,
      value: cp.tolerance ? `${(100 + j * 2.1).toFixed(1)} mm` : null,
    }));

    return {
      id: `QC-${i + 1000}`,
      inspectionNumber: `QC-${i + 1000}`,
      type,
      status,
      skuCode: sku.code,
      skuName: sku.name,
      lotNumber: `LOT-${10000 + i}`,
      batchNumber: `BATCH-202606-${String(1001 + i * 7).slice(-4)}`,
      expiryDate: i % 5 === 0 ? new Date(now.getTime() + 90 * 24 * 3600000).toISOString().slice(0, 10) : null,
      sampleSize: sample,
      inspectedQty: ["QUEUED"].includes(status) ? 0 : sample,
      passedQty: sample - failed,
      failedQty: failed,
      defectCount: failed,
      defectRate,
      aqlLevel: (["ZERO_DEFECT","AQL_1_0","AQL_2_5","AQL_4_0","100_PCT"] as SamplingPlan[])[i % 5],
      disposition: ["PASSED"].includes(status) ? "ACCEPT" : status === "FAILED" ? "REJECT" : status === "CONDITIONAL_PASS" ? "CONDITIONAL_RELEASE" : null,
      inspectorId: insp.id,
      inspectorName: insp.name,
      sourceRef: type === "INBOUND" ? `ASN-20260609-${String(i + 1).padStart(4, "0")}` : type === "RETURNS" ? `RMA-${3000 + i}` : null,
      binCode: status !== "QUEUED" ? `A-01-R-01-L${(i % 4) + 1}-P1` : null,
      checkpoints,
      findings: ["FAILED","CONDITIONAL_PASS"].includes(status) ? "Minor surface scratches on 3 units. Dimensional deviation detected in 2 samples." : null,
      images: [],
      createdAt: new Date(now.getTime() - (i + 1) * 3600000 * 2).toISOString(),
      startedAt: status !== "QUEUED" ? new Date(now.getTime() - i * 3600000).toISOString() : null,
      completedAt: ["PASSED","FAILED","CONDITIONAL_PASS"].includes(status) ? new Date(now.getTime() - i * 1800000).toISOString() : null,
      reviewedBy: ["PASSED","FAILED"].includes(status) && i % 3 === 0 ? "Aisha Patel" : null,
      reviewedAt: ["PASSED","FAILED"].includes(status) && i % 3 === 0 ? new Date(now.getTime() - i * 900000).toISOString() : null,
    };
  });
}

function buildSeedHolds(): QCHold[] {
  const types: HoldType[] = ["QC_HOLD","VENDOR_HOLD","DAMAGE_HOLD","EXPIRY_HOLD","REGULATORY_HOLD"];
  const now = new Date();
  return Array.from({ length: 15 }, (_, i) => ({
    id: `HOLD-${i + 1}`,
    holdNumber: `HOLD-${String(i + 1).padStart(4, "0")}`,
    type: types[i % types.length],
    skuCode: SKUS[i % SKUS.length].code,
    skuName: SKUS[i % SKUS.length].name,
    binCode: `A-01-R-0${(i % 5) + 1}-L1-P1`,
    lotNumber: `LOT-${10000 + i}`,
    quantity: 20 + i * 7 % 100,
    reason: ["Failed incoming QC inspection", "Vendor non-conformance report", "Forklift damage detected", "Approaching expiry date", "Regulatory compliance check"][i % 5],
    raisedBy: INSPECTORS[i % INSPECTORS.length].name,
    raisedAt: new Date(now.getTime() - i * 3 * 3600000).toISOString(),
    resolvedBy: i % 4 === 0 ? "Maria Chen" : null,
    resolvedAt: i % 4 === 0 ? new Date(now.getTime() - i * 1800000).toISOString() : null,
    resolution: i % 4 === 0 ? (["ACCEPT","REJECT","SCRAP","RETURN_TO_VENDOR"] as DispositionType[])[i % 4] : null,
    notes: i % 3 === 0 ? "Vendor notification sent. Awaiting vendor response." : null,
    status: i % 4 === 0 ? "RESOLVED" : i % 7 === 0 ? "ESCALATED" : "ACTIVE",
  }));
}

export interface QCFilters { search: string; status: InspectionStatus | ""; type: string; inspector: string; }
const DEFAULT_FILTERS: QCFilters = { search: "", status: "", type: "", inspector: "" };

interface QCState {
  inspections: QCInspection[];
  holds: QCHold[];
  filters: QCFilters;
  page: number;
  pageSize: number;

  startInspection: (id: string) => void;
  updateCheckpoint: (inspId: string, cpId: string, result: "PASS" | "FAIL" | "N/A", value?: string, notes?: string) => void;
  completeInspection: (id: string, disposition: DispositionType, findings: string) => void;
  raiseHold: (hold: Omit<QCHold, "id" | "holdNumber" | "raisedAt" | "resolvedBy" | "resolvedAt" | "resolution" | "status">) => void;
  resolveHold: (holdId: string, resolvedBy: string, resolution: DispositionType, notes?: string) => void;
  setFilters: (f: Partial<QCFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;
  filteredInspections: () => QCInspection[];
  pagedInspections: () => QCInspection[];
  totalPages: () => number;
  kpis: () => { openHolds: number; passRate: string; failed: number; inProgress: number; avgDefectRate: string; inspectorsActive: number; pendingReview: number };
  inspectorWorkload: () => { id: string; name: string; total: number; passed: number; failed: number; inProgress: number; passRate: number }[];
  typeMix: () => { type: QCInspection["type"]; count: number }[];
  statusFunnel: () => { status: InspectionStatus; count: number }[];
  activeHolds: () => QCHold[];
  inspectorList: () => string[];
}

export const useQCStore = create<QCState>()(
  persist(
    (set, get) => ({
      inspections: buildSeedInspections(),
      holds: buildSeedHolds(),
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 15,

      startInspection: (id) => {
        set((s) => ({
          inspections: s.inspections.map((i) =>
            i.id === id ? { ...i, status: "IN_PROGRESS" as InspectionStatus, startedAt: new Date().toISOString() } : i
          ),
        }));
      },

      updateCheckpoint: (inspId, cpId, result, value, notes) => {
        set((s) => ({
          inspections: s.inspections.map((i) => {
            if (i.id !== inspId) return i;
            return { ...i, checkpoints: i.checkpoints.map((cp) => cp.id === cpId ? { ...cp, result, value: value ?? cp.value, notes: notes ?? cp.notes } : cp) };
          }),
        }));
      },

      completeInspection: (id, disposition, findings) => {
        set((s) => ({
          inspections: s.inspections.map((i) => {
            if (i.id !== id) return i;
            const failed = i.checkpoints.filter((cp) => cp.result === "FAIL").length;
            const status: InspectionStatus = failed === 0 ? "PASSED" : failed === 1 ? "CONDITIONAL_PASS" : "FAILED";
            return { ...i, status, disposition, findings, failedQty: failed, defectRate: parseFloat(((failed / Math.max(1, i.sampleSize)) * 100).toFixed(1)), completedAt: new Date().toISOString() };
          }),
        }));
      },

      raiseHold: (holdData) => {
        const hold: QCHold = {
          ...holdData,
          id: `HOLD-${Date.now()}`,
          holdNumber: `HOLD-${String(Date.now()).slice(-4)}`,
          raisedAt: new Date().toISOString(),
          resolvedBy: null,
          resolvedAt: null,
          resolution: null,
          status: "ACTIVE",
        };
        set((s) => ({ holds: [hold, ...s.holds] }));
      },

      resolveHold: (holdId, resolvedBy, resolution, notes) => {
        set((s) => ({
          holds: s.holds.map((h) =>
            h.id === holdId
              ? { ...h, status: "RESOLVED" as const, resolvedBy, resolution, resolvedAt: new Date().toISOString(), notes: notes ?? h.notes }
              : h
          ),
        }));
      },

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setPage: (p) => set({ page: p }),

      filteredInspections: () => {
        const { inspections, filters } = get();
        return inspections.filter((i) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!i.inspectionNumber.toLowerCase().includes(q) && !i.skuCode.toLowerCase().includes(q) && !i.skuName.toLowerCase().includes(q)) return false;
          }
          if (filters.status && i.status !== filters.status) return false;
          if (filters.type && i.type !== filters.type) return false;
          if (filters.inspector && i.inspectorName !== filters.inspector) return false;
          return true;
        });
      },

      pagedInspections: () => {
        const { page, pageSize } = get();
        const all = get().filteredInspections();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => Math.max(1, Math.ceil(get().filteredInspections().length / get().pageSize)),

      kpis: () => {
        const { inspections, holds } = get();
        const completed = inspections.filter((i) => ["PASSED","FAILED","CONDITIONAL_PASS"].includes(i.status));
        const passed = completed.filter((i) => i.status === "PASSED" || i.status === "CONDITIONAL_PASS").length;
        const defectRates = completed.filter((i) => i.defectRate > 0).map((i) => i.defectRate);
        return {
          openHolds: holds.filter((h) => h.status === "ACTIVE").length,
          passRate: completed.length > 0 ? `${((passed / completed.length) * 100).toFixed(1)}%` : "—",
          failed: inspections.filter((i) => i.status === "FAILED").length,
          inProgress: inspections.filter((i) => i.status === "IN_PROGRESS").length,
          avgDefectRate: defectRates.length > 0 ? `${(defectRates.reduce((s, r) => s + r, 0) / defectRates.length).toFixed(1)}%` : "0%",
          inspectorsActive: new Set(inspections.filter((i) => i.status === "IN_PROGRESS").map((i) => i.inspectorId)).size,
          pendingReview: inspections.filter((i) => i.status === "PENDING_REVIEW").length,
        };
      },

      inspectorWorkload: () => {
        const map = new Map<string, { id: string; name: string; total: number; passed: number; failed: number; inProgress: number }>();
        for (const i of get().inspections) {
          const e = map.get(i.inspectorId) ?? { id: i.inspectorId, name: i.inspectorName, total: 0, passed: 0, failed: 0, inProgress: 0 };
          e.total++;
          if (i.status === "PASSED" || i.status === "CONDITIONAL_PASS") e.passed++;
          else if (i.status === "FAILED") e.failed++;
          else if (i.status === "IN_PROGRESS") e.inProgress++;
          map.set(i.inspectorId, e);
        }
        return Array.from(map.values())
          .map((v) => ({ ...v, passRate: v.passed + v.failed > 0 ? Math.round((v.passed / (v.passed + v.failed)) * 100) : 100 }))
          .sort((a, b) => b.total - a.total);
      },

      typeMix: () => {
        const map = new Map<QCInspection["type"], number>();
        for (const i of get().inspections) map.set(i.type, (map.get(i.type) ?? 0) + 1);
        return Array.from(map.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
      },

      statusFunnel: () => {
        const order: InspectionStatus[] = ["QUEUED", "IN_PROGRESS", "PENDING_REVIEW", "PASSED", "CONDITIONAL_PASS", "FAILED", "HOLD", "DISPOSED"];
        const map = new Map<InspectionStatus, number>();
        for (const i of get().inspections) map.set(i.status, (map.get(i.status) ?? 0) + 1);
        return order.map((status) => ({ status, count: map.get(status) ?? 0 })).filter((x) => x.count > 0);
      },

      activeHolds: () => get().holds.filter((h) => h.status !== "RESOLVED").sort((a, b) => b.raisedAt.localeCompare(a.raisedAt)),

      inspectorList: () => Array.from(new Set(get().inspections.map((i) => i.inspectorName))).sort(),
    }),
    {
      name: "trilowms-qc-v1",
      partialize: (s) => ({ inspections: s.inspections, holds: s.holds }),
    }
  )
);

export const QC_STATUS_META: Record<InspectionStatus, { label: string; color: string; bg: string; border: string }> = {
  QUEUED:           { label: "Queued",           color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  IN_PROGRESS:      { label: "In Progress",      color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  PASSED:           { label: "Passed",           color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  FAILED:           { label: "Failed",           color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  CONDITIONAL_PASS: { label: "Conditional Pass", color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30"  },
  PENDING_REVIEW:   { label: "Pending Review",   color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30"  },
  SAMPLED:          { label: "Sampled",          color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  HOLD:             { label: "On Hold",          color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  DISPOSED:         { label: "Disposed",         color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};
