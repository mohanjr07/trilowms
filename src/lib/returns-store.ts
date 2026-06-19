/**
 * TriloWMS — Returns (RMA) Module Store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RmaStatus = "REQUESTED" | "APPROVED" | "IN_TRANSIT" | "RECEIVED" | "INSPECTING" | "INSPECTED" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED";
export type ReturnReason = "DAMAGED_IN_TRANSIT" | "WRONG_ITEM" | "QUALITY_DEFECT" | "CUSTOMER_CHANGE_MIND" | "OVERSHIPMENT" | "EXPIRED" | "WARRANTY_CLAIM" | "VENDOR_RECALL";
export type DispositionType = "RESTOCK" | "REPAIR" | "SCRAP" | "RETURN_TO_VENDOR" | "DONATE" | "QUARANTINE" | "PENDING_REVIEW";

export interface RmaLine {
  id: string;
  rmaId: string;
  lineNo: number;
  skuCode: string;
  skuName: string;
  uom: string;
  returnQty: number;
  receivedQty: number;
  approvedQty: number;
  reason: ReturnReason;
  disposition: DispositionType | null;
  condition: "NEW" | "OPENED" | "DAMAGED" | "DEFECTIVE" | "EXPIRED" | null;
  creditAmount: number;
  batchNumber: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  inspectionNotes: string | null;
  restockBinCode: string | null;
  status: "PENDING" | "RECEIVED" | "INSPECTED" | "DISPOSED";
}

export interface RMA {
  id: string;
  rmaNumber: string;
  status: RmaStatus;
  orderId: string;
  orderDate: string;
  customer: string;
  customerCode: string;
  carrier: string;
  trackingNumber: string | null;
  returnTrackingNumber: string | null;
  lines: RmaLine[];
  totalLines: number;
  totalReturnQty: number;
  totalReceivedQty: number;
  totalCreditAmount: number;
  creditIssued: boolean;
  creditMemoNumber: string | null;
  priority: "NORMAL" | "HIGH" | "URGENT";
  requestedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  approvedBy: string | null;
  processedBy: string | null;
  warehouseId: string;
  receiptDockId: string | null;
  receiptDockCode: string | null;
  notes: string | null;
  images: string[];
}

// ─── Seed ────────────────────────────────────────────────────────────────────

const CUSTOMERS = ["TechHub Inc.", "MegaStore Corp.", "RetailPlus", "BuildWorld", "AutoParts Direct"];
const CARRIERS = ["UPS", "FedEx", "DHL", "USPS"];
const SKUS = [
  { code: "SKU-10000", name: "Aluminum Extrusion Bracket 40x40" },
  { code: "SKU-10002", name: "Hydraulic Pump Assembly 12V" },
  { code: "SKU-10005", name: "PCB Controller Module Rev3" },
  { code: "SKU-10006", name: "Deep Groove Ball Bearing 6204-2RS" },
  { code: "SKU-10007", name: "Lithium Ion Cell 18650 2600mAh" },
];
const REASONS: ReturnReason[] = ["DAMAGED_IN_TRANSIT","WRONG_ITEM","QUALITY_DEFECT","CUSTOMER_CHANGE_MIND","OVERSHIPMENT","WARRANTY_CLAIM"];
const DISPOSITIONS: (DispositionType | null)[] = ["RESTOCK","SCRAP","REPAIR","RETURN_TO_VENDOR","QUARANTINE",null];

function buildRmaLines(rmaId: string, count: number, idx: number, status: RmaStatus): RmaLine[] {
  return Array.from({ length: count }, (_, j) => {
    const sku = SKUS[(idx + j) % SKUS.length];
    const reason = REASONS[(idx + j) % REASONS.length];
    const qty = 1 + (idx + j) % 8;
    const isCompleted = ["COMPLETED"].includes(status);
    const isInspected = ["INSPECTED","PROCESSING","COMPLETED"].includes(status);
    const disposition = isInspected ? DISPOSITIONS[(idx + j) % (DISPOSITIONS.length - 1)] as DispositionType : null;
    const condition = isInspected ? (["NEW","OPENED","DAMAGED","DEFECTIVE","EXPIRED"] as const)[(idx + j) % 5] : null;
    return {
      id: `rline-${rmaId}-${j + 1}`,
      rmaId,
      lineNo: j + 1,
      skuCode: sku.code,
      skuName: sku.name,
      uom: "EA",
      returnQty: qty,
      receivedQty: ["RECEIVED","INSPECTING","INSPECTED","PROCESSING","COMPLETED"].includes(status) ? qty : 0,
      approvedQty: qty,
      reason,
      disposition,
      condition,
      creditAmount: disposition === "RESTOCK" || disposition === "REPAIR" ? parseFloat((qty * (50 + (idx + j) * 13 % 200)).toFixed(2)) : 0,
      batchNumber: `BATCH-202606-${String(1001 + idx * 10 + j).slice(-4)}`,
      lotNumber: j % 3 === 0 ? `LOT-${10000 + idx + j}` : null,
      expiryDate: j % 5 === 0 ? "2026-12-31" : null,
      inspectionNotes: isInspected && condition === "DAMAGED" ? "Visible impact damage on packaging and product" : null,
      restockBinCode: disposition === "RESTOCK" ? `A-01-R-01-L1-P${(j % 5) + 1}` : null,
      status: isCompleted ? "DISPOSED" : isInspected ? "INSPECTED" : ["RECEIVED","INSPECTING"].includes(status) ? "RECEIVED" : "PENDING",
    };
  });
}

function buildSeedRMAs(): RMA[] {
  const statuses: RmaStatus[] = ["REQUESTED","APPROVED","IN_TRANSIT","RECEIVED","INSPECTING","INSPECTED","PROCESSING","COMPLETED","REJECTED","COMPLETED"];
  const now = new Date();

  return Array.from({ length: 30 }, (_, i) => {
    const status = statuses[i % statuses.length];
    const rmaId = `RMA-${3000 + i}`;
    const lineCount = 1 + (i % 4);
    const lines = buildRmaLines(rmaId, lineCount, i, status);
    const totalReturnQty = lines.reduce((s, l) => s + l.returnQty, 0);
    const totalReceivedQty = lines.reduce((s, l) => s + l.receivedQty, 0);
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
    const requestedAt = new Date(now.getTime() - (i + 2) * 24 * 3600000);

    return {
      id: rmaId,
      rmaNumber: rmaId,
      status,
      orderId: `ORD-${30000 + i * 7}`,
      orderDate: new Date(requestedAt.getTime() - 7 * 24 * 3600000).toISOString().slice(0, 10),
      customer: CUSTOMERS[i % CUSTOMERS.length],
      customerCode: `CUST-${1000 + i}`,
      carrier: CARRIERS[i % CARRIERS.length],
      trackingNumber: status !== "REQUESTED" ? `TRK${String(999 + i * 13).slice(-9)}` : null,
      returnTrackingNumber: ["IN_TRANSIT","RECEIVED","INSPECTING","INSPECTED","PROCESSING","COMPLETED"].includes(status) ? `RTN${String(888 + i * 17).slice(-9)}` : null,
      lines,
      totalLines: lineCount,
      totalReturnQty,
      totalReceivedQty,
      totalCreditAmount: parseFloat(totalCredit.toFixed(2)),
      creditIssued: status === "COMPLETED" && totalCredit > 0,
      creditMemoNumber: status === "COMPLETED" && totalCredit > 0 ? `CM-${50000 + i}` : null,
      priority: i % 8 === 0 ? "URGENT" : i % 4 === 0 ? "HIGH" : "NORMAL",
      requestedAt: requestedAt.toISOString(),
      approvedAt: status !== "REQUESTED" ? new Date(requestedAt.getTime() + 8 * 3600000).toISOString() : null,
      receivedAt: ["RECEIVED","INSPECTING","INSPECTED","PROCESSING","COMPLETED"].includes(status) ? new Date(requestedAt.getTime() + 3 * 24 * 3600000).toISOString() : null,
      completedAt: status === "COMPLETED" ? new Date(requestedAt.getTime() + 5 * 24 * 3600000).toISOString() : null,
      approvedBy: status !== "REQUESTED" ? "Maria Chen" : null,
      processedBy: ["INSPECTED","PROCESSING","COMPLETED"].includes(status) ? "Aisha Patel" : null,
      warehouseId: "TRILO-DC-01",
      receiptDockId: ["RECEIVED","INSPECTING","INSPECTED","PROCESSING","COMPLETED"].includes(status) ? "dock-in-1" : null,
      receiptDockCode: ["RECEIVED","INSPECTING","INSPECTED","PROCESSING","COMPLETED"].includes(status) ? "IN-01" : null,
      notes: i % 7 === 0 ? "High-value item — expedite processing" : null,
      images: [],
    };
  });
}

export interface RmaFilters { search: string; status: RmaStatus | ""; customer: string; priority: string; }
const DEFAULT_FILTERS: RmaFilters = { search: "", status: "", customer: "", priority: "" };

interface ReturnsState {
  rmas: RMA[];
  filters: RmaFilters;
  page: number;
  pageSize: number;

  approveRma: (id: string, approvedBy: string) => void;
  receiveRma: (id: string, dockCode: string) => void;
  inspectLine: (rmaId: string, lineId: string, condition: RmaLine["condition"], disposition: DispositionType, notes?: string) => void;
  completeRma: (id: string, processedBy: string) => void;
  rejectRma: (id: string, reason: string) => void;
  setFilters: (f: Partial<RmaFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;
  filteredRmas: () => RMA[];
  pagedRmas: () => RMA[];
  totalPages: () => number;
  kpis: () => { openRmas: number; received: number; restocked: number; scrapped: number; creditPending: string; avgProcessingDays: string; pendingInspection: number };
  reasonMix: () => { reason: ReturnReason; count: number }[];
  dispositionMix: () => { disposition: DispositionType; count: number; qty: number }[];
  statusFunnel: () => { status: RmaStatus; count: number }[];
  inspectionWorklist: () => RMA[];
  customerList: () => string[];
}

export const useReturnsStore = create<ReturnsState>()(
  persist(
    (set, get) => ({
      rmas: [],
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 15,

      approveRma: (id, approvedBy) => {
        set((s) => ({
          rmas: s.rmas.map((r) =>
            r.id === id ? { ...r, status: "APPROVED" as RmaStatus, approvedBy, approvedAt: new Date().toISOString() } : r
          ),
        }));
      },

      receiveRma: (id, dockCode) => {
        set((s) => ({
          rmas: s.rmas.map((r) => {
            if (r.id !== id) return r;
            const lines = r.lines.map((l) => ({ ...l, receivedQty: l.approvedQty, status: "RECEIVED" as const }));
            const totalReceivedQty = lines.reduce((s, l) => s + l.receivedQty, 0);
            return { ...r, status: "RECEIVED" as RmaStatus, lines, totalReceivedQty, receiptDockCode: dockCode, receivedAt: new Date().toISOString() };
          }),
        }));
      },

      inspectLine: (rmaId, lineId, condition, disposition, notes) => {
        set((s) => ({
          rmas: s.rmas.map((r) => {
            if (r.id !== rmaId) return r;
            const lines = r.lines.map((l) =>
              l.id === lineId
                ? { ...l, condition, disposition, inspectionNotes: notes ?? null, status: "INSPECTED" as const,
                    creditAmount: disposition === "RESTOCK" ? parseFloat((l.receivedQty * 75).toFixed(2)) : 0,
                    restockBinCode: disposition === "RESTOCK" ? "A-01-R-01-L1-P1" : null }
                : l
            );
            const allInspected = lines.every((l) => l.status === "INSPECTED");
            return {
              ...r,
              lines,
              status: allInspected ? "INSPECTED" as RmaStatus : "INSPECTING" as RmaStatus,
              totalCreditAmount: parseFloat(lines.reduce((s, l) => s + l.creditAmount, 0).toFixed(2)),
            };
          }),
        }));
      },

      completeRma: (id, processedBy) => {
        set((s) => ({
          rmas: s.rmas.map((r) => {
            if (r.id !== id) return r;
            const lines = r.lines.map((l) => ({ ...l, status: "DISPOSED" as const }));
            return { ...r, status: "COMPLETED" as RmaStatus, lines, processedBy, completedAt: new Date().toISOString(), creditIssued: r.totalCreditAmount > 0, creditMemoNumber: r.totalCreditAmount > 0 ? `CM-${Date.now()}` : null };
          }),
        }));
      },

      rejectRma: (id, reason) => {
        set((s) => ({
          rmas: s.rmas.map((r) => r.id === id ? { ...r, status: "REJECTED" as RmaStatus, notes: reason } : r),
        }));
      },

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setPage: (p) => set({ page: p }),

      filteredRmas: () => {
        const { rmas, filters } = get();
        return rmas.filter((r) => {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!r.rmaNumber.toLowerCase().includes(q) && !r.customer.toLowerCase().includes(q) && !r.orderId.toLowerCase().includes(q)) return false;
          }
          if (filters.status && r.status !== filters.status) return false;
          if (filters.customer && r.customer !== filters.customer) return false;
          if (filters.priority && r.priority !== filters.priority) return false;
          return true;
        });
      },

      pagedRmas: () => {
        const { page, pageSize } = get();
        const all = get().filteredRmas();
        return all.slice((page - 1) * pageSize, page * pageSize);
      },

      totalPages: () => Math.max(1, Math.ceil(get().filteredRmas().length / get().pageSize)),

      kpis: () => {
        const { rmas } = get();
        const allLines = rmas.flatMap((r) => r.lines);
        const openStatuses: RmaStatus[] = ["REQUESTED","APPROVED","IN_TRANSIT","RECEIVED","INSPECTING","INSPECTED","PROCESSING"];
        const open = rmas.filter((r) => openStatuses.includes(r.status));
        const completed = rmas.filter((r) => r.status === "COMPLETED");
        const credited = rmas.filter((r) => !r.creditIssued && r.totalCreditAmount > 0);
        const processingTimes = completed.filter((r) => r.completedAt && r.requestedAt).map((r) => (new Date(r.completedAt!).getTime() - new Date(r.requestedAt).getTime()) / 86400000);
        return {
          openRmas: open.length,
          received: rmas.filter((r) => r.status === "RECEIVED").length,
          restocked: allLines.filter((l) => l.disposition === "RESTOCK").length,
          scrapped: allLines.filter((l) => l.disposition === "SCRAP").length,
          creditPending: `$${credited.reduce((s, r) => s + r.totalCreditAmount, 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          avgProcessingDays: processingTimes.length > 0 ? `${(processingTimes.reduce((s, d) => s + d, 0) / processingTimes.length).toFixed(1)}d` : "—",
          pendingInspection: rmas.filter((r) => r.status === "RECEIVED").length,
        };
      },

      reasonMix: () => {
        const map = new Map<ReturnReason, number>();
        for (const r of get().rmas) for (const l of r.lines) map.set(l.reason, (map.get(l.reason) ?? 0) + 1);
        return Array.from(map.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
      },

      dispositionMix: () => {
        const map = new Map<DispositionType, { count: number; qty: number }>();
        for (const r of get().rmas) for (const l of r.lines) {
          if (!l.disposition) continue;
          const e = map.get(l.disposition) ?? { count: 0, qty: 0 };
          e.count++; e.qty += l.receivedQty;
          map.set(l.disposition, e);
        }
        return Array.from(map.entries()).map(([disposition, v]) => ({ disposition, ...v })).sort((a, b) => b.count - a.count);
      },

      statusFunnel: () => {
        const order: RmaStatus[] = ["REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED", "INSPECTING", "INSPECTED", "PROCESSING", "COMPLETED", "REJECTED"];
        const map = new Map<RmaStatus, number>();
        for (const r of get().rmas) map.set(r.status, (map.get(r.status) ?? 0) + 1);
        return order.map((status) => ({ status, count: map.get(status) ?? 0 })).filter((x) => x.count > 0);
      },

      inspectionWorklist: () =>
        get().rmas.filter((r) => ["RECEIVED", "INSPECTING"].includes(r.status)).sort((a, b) => {
          const pr = { URGENT: 0, HIGH: 1, NORMAL: 2 } as const;
          if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
          return (a.receivedAt ?? "").localeCompare(b.receivedAt ?? "");
        }),

      customerList: () => Array.from(new Set(get().rmas.map((r) => r.customer))).sort(),
    }),
    {
      name: "trilowms-returns-v2",
      partialize: (s) => ({ rmas: s.rmas }),
    }
  )
);

export const RMA_STATUS_META: Record<RmaStatus, { label: string; color: string; bg: string; border: string }> = {
  REQUESTED:  { label: "Requested",  color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  APPROVED:   { label: "Approved",   color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  IN_TRANSIT: { label: "In Transit", color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  RECEIVED:   { label: "Received",   color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30"  },
  INSPECTING: { label: "Inspecting", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  INSPECTED:  { label: "Inspected",  color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30"  },
  PROCESSING: { label: "Processing", color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30"  },
  COMPLETED:  { label: "Completed",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  REJECTED:   { label: "Rejected",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  CANCELLED:  { label: "Cancelled",  color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};
