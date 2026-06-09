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
  const bases = [320,285,410,390,450,210,180];
  return days.map((label, i) => ({
    label,
    received: bases[i] + (i * 23 % 80),
    shipped: bases[i] - 20 + (i * 17 % 60),
    returns: Math.floor(bases[i] * 0.03 + i * 2),
    qcFails: Math.floor(bases[i] * 0.01 + i),
  }));
}

function buildTopSkus(): TopSku[] {
  return [
    { skuCode: "SKU-10000", skuName: "Aluminum Extrusion Bracket 40x40", movedUnits: 1240, returnRate: "1.2%" },
    { skuCode: "SKU-10002", skuName: "Hydraulic Pump Assembly 12V",       movedUnits: 890,  returnRate: "2.8%" },
    { skuCode: "SKU-10005", skuName: "PCB Controller Module Rev3",         movedUnits: 780,  returnRate: "3.1%" },
    { skuCode: "SKU-10006", skuName: "Deep Groove Ball Bearing 6204-2RS",  movedUnits: 650,  returnRate: "0.9%" },
    { skuCode: "SKU-10007", skuName: "Lithium Ion Cell 18650 2600mAh",     movedUnits: 540,  returnRate: "1.5%" },
    { skuCode: "SKU-10001", skuName: "Steel Coil 2.5mm Hot-Rolled",        movedUnits: 430,  returnRate: "0.5%" },
    { skuCode: "SKU-10003", skuName: "Carbon Fiber Filter Element",         movedUnits: 380,  returnRate: "4.2%" },
    { skuCode: "SKU-10004", skuName: "Precision Gear Set Module 42T",       movedUnits: 310,  returnRate: "1.8%" },
  ];
}

function buildKPIs(): WarehouseKPIs {
  return {
    unitsReceivedToday: 1_240,
    unitsShippedToday: 1_085,
    unitsPickedToday: 2_310,
    unitsPackedToday: 2_120,
    inventoryAccuracy: "98.7%",
    shipmentAccuracy: "99.4%",
    receivingAccuracy: "99.1%",
    avgDockToDockHrs: "4.2h",
    avgReceivingTimeMin: "18m",
    avgPutawayTimeMin: "12m",
    avgPickTimeMin: "3.4m",
    warehouseUtilization: "73%",
    laborUtilization: "86%",
    dockUtilization: "64%",
    qcPassRate: "97.3%",
    defectRate: "0.8%",
    rmaRate: "2.1%",
    laborCostPerUnit: "$0.42",
    orderFulfillmentCost: "$3.18",
  };
}

function buildMonthlyTrend(): { month: string; received: number; shipped: number; }[] {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const base = [8500,7900,9200,8800,10200,9600,11000,10500,9800,10800,11500,12000];
  return months.map((month, i) => ({
    month,
    received: base[i] + (i * 113 % 500),
    shipped: base[i] - 200 + (i * 89 % 400),
  }));
}

function buildCarrierPerf(): { carrier: string; onTime: number; delayed: number; total: number; }[] {
  return [
    { carrier: "UPS",   onTime: 142, delayed: 8,  total: 150 },
    { carrier: "FedEx", onTime: 118, delayed: 12, total: 130 },
    { carrier: "DHL",   onTime: 95,  delayed: 5,  total: 100 },
    { carrier: "USPS",  onTime: 67,  delayed: 13, total: 80  },
  ];
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
