/**
 * TriloWMS — Reports Module Store
 * Cross-module KPI aggregation and historical metrics
 */

import { create } from "zustand";
import { useInboundStore } from "@/lib/inbound-store";
import { useOutboundStore } from "@/lib/outbound-store";
import { usePickingStore } from "@/lib/picking-store";
import { usePackingStore } from "@/lib/packing-store";
import { usePutawayStore } from "@/lib/putaway-store";
import { useQCStore } from "@/lib/qc-store";
import { useReturnsStore } from "@/lib/returns-store";
import { useLaborStore } from "@/lib/labor-store";
import { useStockStore } from "@/lib/stock-store";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { useTransactionStore } from "@/lib/transaction-store";

export type ReportPeriod = "TODAY" | "WEEK" | "MONTH" | "QUARTER";
export type ReportType = "INBOUND" | "OUTBOUND" | "INVENTORY" | "LABOR" | "RETURNS" | "QC" | "FULFILLMENT";

export interface DailyMetric {
  date: string;
  value: number;
}

export interface WarehouseKPIs {
  // Throughput
  unitsReceivedToday: number;
  unitsShippedToday: number;
  unitsPickedToday: number;
  unitsPackedToday: number;
  // Accuracy
  inventoryAccuracy: string;
  shipmentAccuracy: string;
  receivingAccuracy: string;
  // Velocity
  avgDockToDockHrs: string;
  avgReceivingTimeMin: string;
  avgPutawayTimeMin: string;
  avgPickTimeMin: string;
  // Utilization
  warehouseUtilization: string;
  laborUtilization: string;
  dockUtilization: string;
  // Quality
  qcPassRate: string;
  defectRate: string;
  rmaRate: string;
  // Financial
  laborCostPerUnit: string;
  orderFulfillmentCost: string;
}

export interface TrendData {
  label: string;
  received: number;
  shipped: number;
  returns: number;
  qcFails: number;
}

export interface TopSku {
  skuCode: string;
  skuName: string;
  movedUnits: number;
  returnRate: string;
}

// ─── Computed data — every figure below is derived from the live module stores ──
// (stock ledger, inbound/putaway/picking/packing/outbound, QC, returns, labor,
// bin map, and the transaction log) rather than seeded or randomized here.

function buildTrend(): TrendData[] {
  const txns = useTransactionStore.getState().transactions;
  const shipments = useOutboundStore.getState().shipments;
  const rmas = useReturnsStore.getState().rmas;
  const inspections = useQCStore.getState().inspections;

  const out: TrendData[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: "short" });

    const received = txns
      .filter((t) => t.type === "RECEIVED" && t.timestamp.startsWith(dateStr))
      .reduce((s, t) => s + t.quantity, 0);
    const shipped = shipments
      .filter((s) => s.actualDispatch?.startsWith(dateStr))
      .reduce((s, sh) => s + sh.totalCartons, 0);
    const returns = rmas.filter((r) => r.requestedAt.startsWith(dateStr)).length;
    const qcFails = inspections.filter((ins) => ins.status === "FAILED" && ins.completedAt?.startsWith(dateStr)).length;

    out.push({ label, received, shipped, returns, qcFails });
  }
  return out;
}

function buildTopSkus(): TopSku[] {
  const txns = useTransactionStore.getState().transactions;
  const rmaLines = useReturnsStore.getState().rmas.flatMap((r) => r.lines);

  const moved = new Map<string, { skuName: string; units: number }>();
  for (const t of txns) {
    if (t.type !== "RECEIVED" && t.type !== "MOVED") continue;
    const e = moved.get(t.skuCode) ?? { skuName: t.skuName, units: 0 };
    e.units += t.quantity;
    moved.set(t.skuCode, e);
  }

  const returned = new Map<string, number>();
  for (const l of rmaLines) {
    returned.set(l.skuCode, (returned.get(l.skuCode) ?? 0) + (l.receivedQty || 0));
  }

  return Array.from(moved.entries())
    .map(([skuCode, v]) => {
      const ret = returned.get(skuCode) ?? 0;
      return {
        skuCode,
        skuName: v.skuName,
        movedUnits: v.units,
        returnRate: v.units > 0 ? `${((ret / v.units) * 100).toFixed(1)}%` : "0%",
      };
    })
    .sort((a, b) => b.movedUnits - a.movedUnits)
    .slice(0, 10);
}

function buildKPIs(): WarehouseKPIs {
  const today = new Date().toISOString().slice(0, 10);

  const txns = useTransactionStore.getState().transactions;
  const inboundKpis = useInboundStore.getState().kpis();
  const outboundState = useOutboundStore.getState();
  const outboundKpis = outboundState.kpis();
  const pickingKpis = usePickingStore.getState().kpis();
  const putawayKpis = usePutawayStore.getState().kpis();
  const qcKpis = useQCStore.getState().kpis();
  const laborKpis = useLaborStore.getState().kpis();
  const binKpis = useInvBinStore.getState().kpis();
  const dock = useInboundStore.getState().dockUtilization();
  const adjustments = useStockStore.getState().adjustments;
  const asns = useInboundStore.getState().asns;
  const rmaCount = useReturnsStore.getState().rmas.length;

  const unitsReceivedToday = txns
    .filter((t) => t.type === "RECEIVED" && t.timestamp.startsWith(today))
    .reduce((s, t) => s + t.quantity, 0);
  const unitsShippedToday = outboundState.shipments
    .filter((s) => s.actualDispatch?.startsWith(today))
    .reduce((s, sh) => s + sh.totalCartons, 0);
  const unitsPackedToday = usePackingStore.getState().orders
    .filter((o) => o.packedAt?.startsWith(today))
    .reduce((s, o) => s + o.cartons.length, 0);

  // Receiving accuracy: share of received ASNs that closed with zero discrepancies.
  const receivedAsns = asns.filter((a) => a.receivedUnits > 0);
  const receivingAccuracy = receivedAsns.length > 0
    ? `${Math.round((receivedAsns.filter((a) => a.discrepancies.length === 0).length / receivedAsns.length) * 100)}%`
    : "—";

  // Inventory accuracy: 1 − average |variance| relative to counted qty, from cycle counts.
  const inventoryAccuracy = adjustments.length > 0
    ? `${Math.max(0, Math.round((1 - adjustments.reduce((s, a) => s + Math.abs(a.variance) / Math.max(1, a.newQty), 0) / adjustments.length) * 100))}%`
    : "—";

  // Dock-to-dock: hours from truck arrival (ASN) to putaway completion, for tasks we can trace back to an ASN.
  const dockToDockHrs: number[] = [];
  for (const t of usePutawayStore.getState().tasks) {
    if (!t.completedAt || !t.asnId) continue;
    const asn = asns.find((a) => a.id === t.asnId);
    if (!asn?.actualArrival) continue;
    const hrs = (new Date(t.completedAt).getTime() - new Date(asn.actualArrival).getTime()) / 3600000;
    if (hrs >= 0) dockToDockHrs.push(hrs);
  }
  const avgDockToDockHrs = dockToDockHrs.length > 0
    ? `${(dockToDockHrs.reduce((s, h) => s + h, 0) / dockToDockHrs.length).toFixed(1)}h`
    : "—";

  const avgPickTimeMin = pickingKpis.avgPicksPerHour > 0 ? `${(60 / pickingKpis.avgPicksPerHour).toFixed(1)}m` : "—";

  const rmaRate = outboundState.shipments.length > 0
    ? `${((rmaCount / outboundState.shipments.length) * 100).toFixed(1)}%`
    : "—";

  return {
    unitsReceivedToday,
    unitsShippedToday,
    unitsPickedToday: pickingKpis.pickedToday,
    unitsPackedToday,
    inventoryAccuracy,
    shipmentAccuracy: outboundKpis.slaCompliance,
    receivingAccuracy,
    avgDockToDockHrs,
    avgReceivingTimeMin: inboundKpis.avgReceivingTime,
    avgPutawayTimeMin: putawayKpis.avgCycleTime,
    avgPickTimeMin,
    warehouseUtilization: `${binKpis.avgOccupancyPct}%`,
    laborUtilization: laborKpis.targetVsActual,
    dockUtilization: `${dock.pct}%`,
    qcPassRate: qcKpis.passRate,
    defectRate: qcKpis.avgDefectRate,
    rmaRate,
    // No wage-rate or cost-of-fulfillment data exists anywhere in the app — showing a
    // number here would be fabricated, so these stay unavailable until that data exists.
    laborCostPerUnit: "—",
    orderFulfillmentCost: "—",
  };
}

function buildMonthlyTrend(): { month: string; received: number; shipped: number; }[] {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const txns = useTransactionStore.getState().transactions;
  const shipments = useOutboundStore.getState().shipments;
  const now = new Date();

  const out: { month: string; received: number; shipped: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    const received = txns
      .filter((t) => t.type === "RECEIVED" && t.timestamp.startsWith(ym))
      .reduce((s, t) => s + t.quantity, 0);
    const shipped = shipments
      .filter((s) => s.actualDispatch?.startsWith(ym))
      .reduce((s, sh) => s + sh.totalCartons, 0);
    out.push({ month: monthNames[d.getMonth()], received, shipped });
  }
  return out;
}

function buildCarrierPerf(): { carrier: string; onTime: number; delayed: number; total: number; }[] {
  const map = new Map<string, { onTime: number; delayed: number; total: number }>();
  for (const s of useOutboundStore.getState().shipments) {
    if (s.status !== "DELIVERED") continue;
    const e = map.get(s.carrier) ?? { onTime: 0, delayed: 0, total: 0 };
    e.total += 1;
    if (s.slaMet) e.onTime += 1; else e.delayed += 1;
    map.set(s.carrier, e);
  }
  return Array.from(map.entries())
    .map(([carrier, v]) => ({ carrier, ...v }))
    .sort((a, b) => b.total - a.total);
}

export interface ReportsState {
  period: ReportPeriod;
  setPeriod: (p: ReportPeriod) => void;
  kpis: () => WarehouseKPIs;
  weeklyTrend: () => TrendData[];
  monthlyTrend: () => { month: string; received: number; shipped: number; }[];
  topSkus: () => TopSku[];
  carrierPerformance: () => { carrier: string; onTime: number; delayed: number; total: number; }[];
}

export const useReportsStore = create<ReportsState>()((set) => ({
  period: "WEEK",
  setPeriod: (period) => set({ period }),
  kpis: buildKPIs,
  weeklyTrend: buildTrend,
  monthlyTrend: buildMonthlyTrend,
  topSkus: buildTopSkus,
  carrierPerformance: buildCarrierPerf,
}));
