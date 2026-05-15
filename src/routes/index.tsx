import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Package, Truck, AlertTriangle, TrendingUp, Activity, Forklift, Warehouse } from "lucide-react";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { warehouse, totalKPIs } from "@/lib/wms-data";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TriloWMS" },
      { name: "description", content: "Real-time warehouse operations dashboard with KPIs, throughput, and dock activity." },
    ],
  }),
  component: Dashboard,
});

const throughput = Array.from({ length: 24 }, (_, i) => ({
  h: `${i}:00`,
  in: Math.floor(20 + Math.random() * 80),
  out: Math.floor(15 + Math.random() * 95),
}));

const zoneUtil = warehouse.zones.map((z) => ({
  name: z.name.split(" ")[0],
  util: Math.round(z.utilization * 100),
  fill: z.color,
}));

function Dashboard() {
  const k = totalKPIs(warehouse);
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        icon={LayoutDashboard}
        title="Operations Control Center"
        subtitle={`${warehouse.name} · Live · ${new Date().toLocaleString()}`}
        actions={
          <Link to="/builder" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium glow-amber flex items-center gap-2">
            <Warehouse className="h-4 w-4" /> Open 3D Builder
          </Link>
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="ORDERS TODAY" value="1,284" delta="▲ 8.2% vs yesterday" tone="primary" icon={Package} sub="284 SLA at risk" />
          <KPICard label="UNITS PICKED" value="42,108" delta="▲ 4.1%" tone="success" icon={TrendingUp} sub="98.7% accuracy" />
          <KPICard label="DOCK UTILIZATION" value="78%" delta="▼ 2.0%" tone="info" icon={Truck} sub="7 of 10 docks active" />
          <KPICard label="EXCEPTIONS" value="23" delta="▲ 5 in last hour" tone="destructive" icon={AlertTriangle} sub="14 awaiting QC" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="INBOUND vs OUTBOUND THROUGHPUT (24H)" className="lg:col-span-2 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughput} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="h" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                <Area type="monotone" dataKey="in" stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="out" stroke="var(--color-accent)" fill="url(#g2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="WAREHOUSE OCCUPANCY" className="h-[300px]">
            <div className="grid grid-cols-2 gap-4 p-4">
              <div className="flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={140}>
                  <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: "util", value: Math.round(k.utilization * 100), fill: "var(--color-primary)" }]} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background={{ fill: "var(--color-secondary)" } as any} dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="text-2xl font-bold text-mono text-primary -mt-12">{(k.utilization * 100).toFixed(0)}%</div>
                <div className="text-[10px] text-muted-foreground tracking-wider">UTILIZATION</div>
              </div>
              <div className="space-y-2 text-xs">
                <Row label="Total bins" value={k.totalBins.toLocaleString()} />
                <Row label="Occupied" value={k.occupied.toLocaleString()} />
                <Row label="Free" value={(k.totalBins - k.occupied).toLocaleString()} />
                <Row label="Blocked" value={k.blocked.toLocaleString()} accent="destructive" />
                <Row label="Active forklifts" value={warehouse.forklifts.length} />
                <Row label="Pickers on shift" value={42} />
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="ZONE UTILIZATION" className="lg:col-span-2 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneUtil} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="util" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="LIVE OPERATIONS FEED" className="h-[260px]">
            <div className="p-3 space-y-2 text-xs overflow-y-auto h-full">
              {[
                { t: "12:42:08", e: "PUTAWAY confirmed", d: "FL-02 → BU-A2-R3-L", c: "text-success" },
                { t: "12:41:51", e: "PICK shorted", d: "WAVE 219 / line 4", c: "text-warning" },
                { t: "12:41:23", e: "Inbound TRK-1004 docked", d: "IN-3", c: "text-info" },
                { t: "12:40:55", e: "QC HOLD released", d: "PO-78211", c: "text-success" },
                { t: "12:40:12", e: "Cycle count variance", d: "FA-A1-R2-A2 (-3 EA)", c: "text-destructive" },
                { t: "12:39:48", e: "Outbound dispatched", d: "TRK-2003 / 24 pallets", c: "text-success" },
                { t: "12:39:01", e: "Replen triggered", d: "Bulk → Fast Pick (12 pallets)", c: "text-info" },
                { t: "12:38:30", e: "Forklift FL-03 idle 5m", d: "Aisle 4", c: "text-warning" },
              ].map((i, idx) => (
                <div key={idx} className="flex gap-2 border-b border-border/40 pb-1.5">
                  <span className="text-mono text-muted-foreground">{i.t}</span>
                  <span className={`font-medium ${i.c}`}>{i.e}</span>
                  <span className="ml-auto text-muted-foreground truncate">{i.d}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: "destructive" }) {
  return (
    <div className="flex justify-between border-b border-border/40 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-mono font-medium ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}
