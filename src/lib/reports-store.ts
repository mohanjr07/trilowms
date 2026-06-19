/**
 * TriloWMS — Reports Module Store
 * Cross-module KPI aggregation and historical metrics
 */

import { create } from "zustand";

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

// ─── Seed / computed data ─────────────────────────────────────────────────────

function buildTrend(): TrendData[] {
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  return days.map((label) => ({ label, received: 0, shipped: 0, returns: 0, qcFails: 0 }));
}

function buildTopSkus(): TopSku[] {
  return [];
}

function buildKPIs(): WarehouseKPIs {
  return {
    unitsReceivedToday: 0,
    unitsShippedToday: 0,
    unitsPickedToday: 0,
    unitsPackedToday: 0,
    inventoryAccuracy: "0%",
    shipmentAccuracy: "0%",
    receivingAccuracy: "0%",
    avgDockToDockHrs: "0h",
    avgReceivingTimeMin: "0m",
    avgPutawayTimeMin: "0m",
    avgPickTimeMin: "0m",
    warehouseUtilization: "0%",
    laborUtilization: "0%",
    dockUtilization: "0%",
    qcPassRate: "0%",
    defectRate: "0%",
    rmaRate: "0%",
    laborCostPerUnit: "$0.00",
    orderFulfillmentCost: "$0.00",
  };
}

function buildMonthlyTrend(): { month: string; received: number; shipped: number; }[] {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months.map((month) => ({ month, received: 0, shipped: 0 }));
}

function buildCarrierPerf(): { carrier: string; onTime: number; delayed: number; total: number; }[] {
  return [];
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
