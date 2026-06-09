/**
 * TriloWMS — Reports & Analytics Module Page
 */

import { BarChart2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportsStore } from "@/lib/reports-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  ComposedChart, Area,
} from "recharts";
import { cn } from "@/lib/utils";

const TOOLTIP_STYLE = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 },
};

function ThroughputKPIs() {
  const kpis = useReportsStore((s) => s.kpis)();
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today's Throughput</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="UNITS RECEIVED" value={kpis.unitsReceivedToday.toLocaleString()} tone="info" />
          <KPICard label="UNITS SHIPPED" value={kpis.unitsShippedToday.toLocaleString()} tone="success" />
          <KPICard label="UNITS PICKED" value={kpis.unitsPickedToday.toLocaleString()} tone="primary" />
          <KPICard label="UNITS PACKED" value={kpis.unitsPackedToday.toLocaleString()} tone="info" />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Accuracy</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPICard label="INVENTORY ACCURACY" value={kpis.inventoryAccuracy} tone="success" />
          <KPICard label="SHIPMENT ACCURACY" value={kpis.shipmentAccuracy} tone="success" />
          <KPICard label="RECEIVING ACCURACY" value={kpis.receivingAccuracy} tone="success" />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Velocity</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="DOCK-TO-DOCK" value={kpis.avgDockToDockHrs} tone="info" />
          <KPICard label="AVG RECEIVING" value={kpis.avgReceivingTimeMin} tone="info" />
          <KPICard label="AVG PUTAWAY" value={kpis.avgPutawayTimeMin} tone="info" />
          <KPICard label="AVG PICK TIME" value={kpis.avgPickTimeMin} tone="info" />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Utilization & Quality</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="WAREHOUSE UTIL" value={kpis.warehouseUtilization} tone="primary" />
          <KPICard label="LABOR UTIL" value={kpis.laborUtilization} tone="primary" />
          <KPICard label="DOCK UTIL" value={kpis.dockUtilization} tone="primary" />
          <KPICard label="QC PASS RATE" value={kpis.qcPassRate} tone="success" />
          <KPICard label="DEFECT RATE" value={kpis.defectRate} tone="warning" />
          <KPICard label="RMA RATE" value={kpis.rmaRate} tone="warning" />
        </div>
      </div>
    </div>
  );
}

function WeeklyTrendChart() {
  const data = useReportsStore((s) => s.weeklyTrend)();
  return (
    <Panel title="WEEKLY THROUGHPUT TREND">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="received" name="Received" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          <Bar dataKey="shipped" name="Shipped" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="returns" name="Returns" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="qcFails" name="QC Fails" stroke="hsl(45 96% 53%)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function MonthlyVolumeChart() {
  const data = useReportsStore((s) => s.monthlyTrend)();
  return (
    <Panel title="12-MONTH VOLUME TREND">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="received" name="Received" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="shipped" name="Shipped" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function TopSkuTable() {
  const skus = useReportsStore((s) => s.topSkus)();
  return (
    <Panel title="TOP MOVING SKUs (THIS WEEK)">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] text-muted-foreground uppercase">
            {["Rank","SKU","Name","Units Moved","Return Rate"].map((h) => (
              <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {skus.map((s, i) => (
            <tr key={s.skuCode} className="hover:bg-accent/30">
              <td className="py-2 px-2 font-bold text-muted-foreground text-xs">#{i + 1}</td>
              <td className="py-2 px-2 font-mono text-xs text-primary">{s.skuCode}</td>
              <td className="py-2 px-2 text-xs">{s.skuName}</td>
              <td className="py-2 px-2 text-right font-mono text-xs font-bold">{s.movedUnits.toLocaleString()}</td>
              <td className="py-2 px-2 text-right">
                <span className={cn("text-xs font-mono",
                  parseFloat(s.returnRate) > 3 ? "text-red-400" : parseFloat(s.returnRate) > 1.5 ? "text-amber-400" : "text-emerald-400"
                )}>{s.returnRate}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function CarrierPerformance() {
  const data = useReportsStore((s) => s.carrierPerformance)();
  const chartData = data.map((c) => ({
    ...c,
    onTimePct: parseFloat(((c.onTime / c.total) * 100).toFixed(1)),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="CARRIER ON-TIME PERFORMANCE">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <XAxis dataKey="carrier" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "On-Time"]} />
            <Bar dataKey="onTimePct" name="On-Time %" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="CARRIER SHIPMENT VOLUME">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase">
              {["Carrier","On-Time","Delayed","Total","On-Time %"].map((h) => (
                <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {chartData.map((c) => (
              <tr key={c.carrier}>
                <td className="py-2 px-2 text-xs font-medium">{c.carrier}</td>
                <td className="py-2 px-2 text-center text-emerald-400 text-xs">{c.onTime}</td>
                <td className="py-2 px-2 text-center text-red-400 text-xs">{c.delayed}</td>
                <td className="py-2 px-2 text-center text-xs">{c.total}</td>
                <td className="py-2 px-2 text-right">
                  <span className={cn("font-mono text-xs font-bold",
                    c.onTimePct >= 95 ? "text-emerald-400" : c.onTimePct >= 90 ? "text-amber-400" : "text-red-400"
                  )}>{c.onTimePct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function FinancialKPIs() {
  const kpis = useReportsStore((s) => s.kpis)();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPICard label="LABOR COST/UNIT" value={kpis.laborCostPerUnit} tone="info" />
      <KPICard label="FULFILLMENT COST/ORDER" value={kpis.orderFulfillmentCost} tone="info" />
      <KPICard label="WAREHOUSE UTIL" value={kpis.warehouseUtilization} tone="primary" />
      <KPICard label="LABOR UTIL" value={kpis.laborUtilization} tone="primary" />
    </div>
  );
}

export function ReportsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={BarChart2} title="Reports & Analytics" subtitle="Warehouse performance dashboard, throughput trends, carrier scorecard & SKU velocity" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="throughput">Throughput</TabsTrigger>
            <TabsTrigger value="carriers">Carriers</TabsTrigger>
            <TabsTrigger value="skus">SKU Velocity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-5">
            <ThroughputKPIs />
          </TabsContent>

          <TabsContent value="throughput" className="mt-4 space-y-5">
            <WeeklyTrendChart />
            <MonthlyVolumeChart />
          </TabsContent>

          <TabsContent value="carriers" className="mt-4 space-y-5">
            <CarrierPerformance />
          </TabsContent>

          <TabsContent value="skus" className="mt-4 space-y-5">
            <TopSkuTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
