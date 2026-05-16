import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Package, Truck, AlertTriangle, TrendingUp, Forklift, Warehouse, Users, ShieldCheck, BarChart3, ArrowDownToLine, ArrowUpFromLine, PackageSearch, CheckCircle2, Clock, Activity } from "lucide-react";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { warehouse, totalKPIs } from "@/lib/wms-data";
import { useAuthStore } from "@/lib/auth-store";
import { Link } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";

export const Route = createFileRoute("/")(({
  head: () => ({
    meta: [
      { title: "Dashboard — TriloWMS" },
      { name: "description", content: "Role-based WMS dashboard" },
    ],
  }),
  component: RoleDashboard,
}));

const throughput = Array.from({ length: 24 }, (_, i) => ({
  h: `${i}:00`,
  in:  Math.floor(20 + Math.random() * 80),
  out: Math.floor(15 + Math.random() * 95),
}));
const zoneUtil = warehouse.zones.map((z) => ({
  name: z.name.split(" ")[0],
  util: Math.round(z.utilization * 100),
  fill: z.color,
}));

function RoleDashboard() {
  const { session, role } = useAuthStore();
  const roleDef = role();
  const k = totalKPIs(warehouse);

  if (!session || !roleDef) return null;

  switch (session.user.role) {
    case "super_admin":
    case "warehouse_admin":
      return <EnterpriseDashboard k={k} />;
    case "operations_manager":
      return <OperationsDashboard />;
    case "inventory_manager":
      return <InventoryDashboard k={k} />;
    case "inbound_supervisor":
      return <InboundDashboard />;
    case "outbound_supervisor":
      return <OutboundDashboard />;
    case "picker":
      return <PickerDashboard name={session.user.name} />;
    case "forklift_operator":
      return <ForkliftDashboard name={session.user.name} />;
    case "qc_inspector":
      return <QCDashboard />;
    case "packing_operator":
      return <PackingDashboard name={session.user.name} />;
    case "yard_manager":
      return <YardDashboard />;
    case "auditor":
      return <AuditorDashboard />;
    default:
      return <EnterpriseDashboard k={k} />;
  }
}

// ─── Enterprise / Super Admin ─────────────────────────────────────────────────
function EnterpriseDashboard({ k }: { k: ReturnType<typeof totalKPIs> }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={LayoutDashboard} title="Enterprise Control Center"
        subtitle={`${warehouse.name} · Live · ${new Date().toLocaleString()}`}
        actions={
          <Link to="/builder" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium glow-amber flex items-center gap-2">
            <Warehouse className="h-4 w-4" /> Open 3D Builder
          </Link>
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="ORDERS TODAY"   value="1,284"  delta="▲ 8.2% vs yesterday" tone="primary"     icon={Package}   sub="284 SLA at risk" />
          <KPICard label="UNITS PICKED"   value="42,108" delta="▲ 4.1%"               tone="success"     icon={TrendingUp} sub="98.7% accuracy" />
          <KPICard label="DOCK UTIL"      value="78%"    delta="▼ 2.0%"               tone="info"        icon={Truck}      sub="7 of 10 docks active" />
          <KPICard label="EXCEPTIONS"     value="23"     delta="▲ 5 in last hour"      tone="destructive" icon={AlertTriangle} sub="14 awaiting QC" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="INBOUND vs OUTBOUND THROUGHPUT (24H)" className="lg:col-span-2 h-[280px]">
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
                <Area type="monotone" dataKey="in"  stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="out" stroke="var(--color-accent)"  fill="url(#g2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="WAREHOUSE OCCUPANCY" className="h-[280px]">
            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={130}>
                  <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: Math.round(k.utilization * 100), fill: "var(--color-primary)" }]} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background={{ fill: "var(--color-secondary)" } as any} dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="text-2xl font-bold text-mono text-primary -mt-10">{(k.utilization * 100).toFixed(0)}%</div>
                <div className="text-[10px] text-muted-foreground">UTILIZATION</div>
              </div>
              <div className="space-y-2 text-xs pt-2">
                <DR label="Total bins"   value={k.totalBins.toLocaleString()} />
                <DR label="Occupied"     value={k.occupied.toLocaleString()} />
                <DR label="Free"         value={(k.totalBins - k.occupied).toLocaleString()} />
                <DR label="Blocked"      value={k.blocked.toLocaleString()} accent="destructive" />
                <DR label="Forklifts"    value={warehouse.forklifts.length} />
                <DR label="Pickers"      value={42} />
              </div>
            </div>
          </Panel>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="ZONE UTILIZATION" className="lg:col-span-2 h-[240px]">
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
          <Panel title="LIVE OPERATIONS FEED" className="h-[240px]">
            <div className="p-3 space-y-2 text-xs overflow-y-auto h-full">
              {[
                { t: "12:42:08", e: "PUTAWAY confirmed",     d: "FL-02 → BU-A2-R3-L", c: "text-success" },
                { t: "12:41:51", e: "PICK shorted",          d: "WAVE 219 / line 4",   c: "text-warning" },
                { t: "12:41:23", e: "TRK-1004 docked",       d: "IN-3",                c: "text-info" },
                { t: "12:40:55", e: "QC HOLD released",      d: "PO-78211",            c: "text-success" },
                { t: "12:40:12", e: "Cycle count variance",  d: "FA-A1-R2-A2 (-3 EA)", c: "text-destructive" },
                { t: "12:39:48", e: "Outbound dispatched",   d: "TRK-2003 / 24 pals",  c: "text-success" },
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

// ─── Operations Manager ───────────────────────────────────────────────────────
function OperationsDashboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Activity} title="Operations Control" subtitle="Daily operational monitoring · Live" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="ACTIVE WAVES"  value="12"   delta="3 at risk" tone="warning"   icon={Activity} />
          <KPICard label="PICKS/HR"      value="847"  delta="▲ 6.1%"   tone="success"   icon={PackageSearch} />
          <KPICard label="DOCK UTIL"     value="78%"  delta="7 active" tone="info"      icon={Truck} />
          <KPICard label="LABOR HOURS"   value="184"  delta="On budget" tone="primary"   icon={Users} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="WAVE PROGRESS" className="h-[260px]">
            <div className="p-4 space-y-3">
              {[
                { id: "WAVE-219", progress: 87, lines: 240, status: "Active", c: "text-success" },
                { id: "WAVE-220", progress: 43, lines: 180, status: "Active", c: "text-success" },
                { id: "WAVE-221", progress: 12, lines: 310, status: "Staged", c: "text-warning" },
                { id: "WAVE-222", progress: 0,  lines: 90,  status: "Pending", c: "text-muted-foreground" },
              ].map((w) => (
                <div key={w.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono font-bold">{w.id}</span>
                    <span className={w.c}>{w.status} — {w.lines} lines</span>
                    <span className="text-muted-foreground">{w.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${w.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="DOCK ACTIVITY" className="h-[260px]">
            <div className="p-4 space-y-2 text-xs">
              {Array.from({ length: 7 }, (_, i) => ({
                dock: `IN-${i + 1}`,
                status: i < 4 ? "Occupied" : i === 4 ? "Loading" : "Available",
                truck: i < 4 ? `TRK-${1000 + i}` : i === 4 ? "TRK-1008" : "—",
                c: i < 4 ? "text-success" : i === 4 ? "text-warning" : "text-muted-foreground",
              })).map((d) => (
                <div key={d.dock} className="flex items-center gap-3 border-b border-border/40 pb-2">
                  <div className="w-12 font-mono font-bold">{d.dock}</div>
                  <div className={cn_inline(d.c, "flex-1 font-medium")}>{d.status}</div>
                  <div className="text-muted-foreground">{d.truck}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Manager ────────────────────────────────────────────────────────
function InventoryDashboard({ k }: { k: ReturnType<typeof totalKPIs> }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Package} title="Inventory Control" subtitle="Stock visibility & replenishment alerts" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="TOTAL BINS"    value={k.totalBins.toLocaleString()} delta="Across all zones"   tone="primary"     icon={Package} />
          <KPICard label="UTILIZATION"   value={`${(k.utilization * 100).toFixed(0)}%`} delta="▲ 1.2% this week" tone="info" icon={TrendingUp} />
          <KPICard label="REPLEN ALERTS" value="14" delta="3 critical"   tone="destructive" icon={AlertTriangle} />
          <KPICard label="CYCLE COUNTS"  value="8"  delta="Due today"    tone="warning"     icon={CheckCircle2} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="ZONE STOCK LEVELS" className="h-[280px]">
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
          <Panel title="REPLENISHMENT QUEUE" className="h-[280px]">
            <div className="p-4 space-y-2 text-xs overflow-y-auto h-full">
              {[
                { sku: "SKU-10442", zone: "Fast Pick", qty: 24, priority: "Critical", c: "text-destructive" },
                { sku: "SKU-20881", zone: "Fast Pick", qty: 12, priority: "High",     c: "text-warning" },
                { sku: "SKU-33021", zone: "Bulk",      qty: 48, priority: "Normal",   c: "text-info" },
                { sku: "SKU-41190", zone: "Cold Chain",qty: 6,  priority: "Normal",   c: "text-info" },
                { sku: "SKU-55302", zone: "Fast Pick", qty: 18, priority: "High",     c: "text-warning" },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border/40 pb-2">
                  <div className="font-mono text-[11px] flex-1">{r.sku}</div>
                  <div className="text-muted-foreground">{r.zone}</div>
                  <div className="w-8 text-right">{r.qty}</div>
                  <div className={cn_inline("w-14 text-right font-medium", r.c)}>{r.priority}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ─── Inbound Supervisor ───────────────────────────────────────────────────────
function InboundDashboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ArrowDownToLine} title="Inbound Operations" subtitle="Receiving & putaway management" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="EXPECTED TODAY" value="18"  delta="4 overdue"     tone="warning"   icon={Truck} />
          <KPICard label="RECEIVED"       value="11"  delta="▲ 61% of plan" tone="success"   icon={CheckCircle2} />
          <KPICard label="PENDING PUTAWAY"value="284" delta="↑ 42 pallets"  tone="info"      icon={PackageSearch} />
          <KPICard label="DOCK OCCUPANCY" value="70%" delta="7 of 10 busy"  tone="primary"   icon={Activity} />
        </div>
        <Panel title="INCOMING SHIPMENTS" className="h-[320px]">
          <div className="p-4 space-y-2 text-xs overflow-y-auto h-full">
            {[
              { asn: "ASN-78211", carrier: "FedEx Freight", eta: "13:30", pallets: 24, status: "Docked",   dock: "IN-3", c: "text-success" },
              { asn: "ASN-78209", carrier: "UPS Freight",   eta: "14:00", pallets: 18, status: "En Route", dock: "IN-5", c: "text-info" },
              { asn: "ASN-78214", carrier: "USPS",          eta: "14:45", pallets: 6,  status: "En Route", dock: "—",    c: "text-info" },
              { asn: "ASN-78215", carrier: "DHL Supply",    eta: "15:20", pallets: 32, status: "Scheduled",dock: "—",    c: "text-muted-foreground" },
              { asn: "ASN-78201", carrier: "Coyote Lgx",   eta: "LATE",  pallets: 12, status: "Delayed",  dock: "—",    c: "text-destructive" },
            ].map((s, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 border-b border-border/40 pb-2 items-center">
                <div className="font-mono font-bold text-[11px]">{s.asn}</div>
                <div className="text-muted-foreground truncate">{s.carrier}</div>
                <div className="font-mono">{s.eta}</div>
                <div className="text-muted-foreground">{s.pallets} pals</div>
                <div className={cn_inline("font-medium text-right", s.c)}>{s.status}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Outbound Supervisor ──────────────────────────────────────────────────────
function OutboundDashboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ArrowUpFromLine} title="Outbound Operations" subtitle="Picking, packing & dispatch" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="SHIPMENTS DUE"  value="47"   delta="12 before 15:00"   tone="warning"   icon={Truck} />
          <KPICard label="PACKED READY"   value="31"   delta="66% complete"       tone="success"   icon={Package} />
          <KPICard label="ACTIVE PICKS"   value="217"  delta="12 pickers on wave" tone="info"      icon={PackageSearch} />
          <KPICard label="EXCEPTIONS"     value="8"    delta="3 urgent"           tone="destructive" icon={AlertTriangle} />
        </div>
        <Panel title="DISPATCH QUEUE" className="h-[320px]">
          <div className="p-4 space-y-2 text-xs overflow-y-auto h-full">
            {[
              { so: "SO-44102", carrier: "FedEx", cut: "14:30", pallets: 8,  status: "Packed",   c: "text-success" },
              { so: "SO-44098", carrier: "UPS",   cut: "15:00", pallets: 12, status: "Picking",  c: "text-warning" },
              { so: "SO-44099", carrier: "DHL",   cut: "15:00", pallets: 4,  status: "Picking",  c: "text-warning" },
              { so: "SO-44103", carrier: "USPS",  cut: "16:00", pallets: 2,  status: "Staged",   c: "text-info" },
              { so: "SO-44088", carrier: "FedEx", cut: "LATE",  pallets: 6,  status: "Exception",c: "text-destructive" },
            ].map((s, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 border-b border-border/40 pb-2 items-center">
                <div className="font-mono font-bold">{s.so}</div>
                <div className="text-muted-foreground">{s.carrier}</div>
                <div className="font-mono">{s.cut}</div>
                <div className="text-muted-foreground">{s.pallets} pals</div>
                <div className={cn_inline("font-medium text-right", s.c)}>{s.status}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Picker ───────────────────────────────────────────────────────────────────
function PickerDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={PackageSearch} title={`Pick Queue — ${name.split(" ")[0]}`} subtitle="Your assigned picking tasks" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="ASSIGNED TASKS" value="24"    delta="In your queue"  tone="primary"   icon={PackageSearch} />
          <KPICard label="COMPLETED TODAY"value="87"    delta="▲ 94% accuracy" tone="success"   icon={CheckCircle2} />
          <KPICard label="CURRENT WAVE"   value="W-219" delta="87% complete"   tone="info"      icon={Activity} />
          <KPICard label="PICKS/HR"       value="124"   delta="Target: 110"    tone="success"   icon={TrendingUp} />
        </div>
        <Panel title="PICK QUEUE" className="h-[360px]">
          <div className="p-4 space-y-2 text-xs overflow-y-auto h-full">
            {Array.from({ length: 8 }, (_, i) => ({
              id: `TASK-${2190 + i}`,
              bin: `FA-A${i % 3 + 1}-R${i % 5 + 1}-L${i % 4 + 1}`,
              sku: `SKU-${10000 + i * 1337}`,
              qty: Math.floor(Math.random() * 12) + 1,
              status: i === 0 ? "In Progress" : i < 3 ? "Pending" : "Queued",
              c: i === 0 ? "text-warning" : i < 3 ? "text-info" : "text-muted-foreground",
            })).map((t, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 border-b border-border/40 pb-2 items-center">
                <div className="font-mono font-bold text-[11px]">{t.id}</div>
                <div className="font-mono text-[10px]">{t.bin}</div>
                <div className="text-muted-foreground text-[10px]">{t.sku}</div>
                <div className="text-center">×{t.qty}</div>
                <div className={cn_inline("text-right font-medium", t.c)}>{t.status}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Forklift Operator ────────────────────────────────────────────────────────
function ForkliftDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Forklift} title={`Forklift Tasks — ${name.split(" ")[0]}`} subtitle="Putaway & movement assignments" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="TASKS TODAY"   value="18" delta="6 remaining"    tone="primary"   icon={Forklift} />
          <KPICard label="COMPLETED"     value="12" delta="67% done"       tone="success"   icon={CheckCircle2} />
          <KPICard label="PALLETS MOVED" value="48" delta="Target: 60"     tone="info"      icon={Package} />
          <KPICard label="IDLE TIME"     value="4m" delta="Below 10m avg"  tone="success"   icon={Clock} />
        </div>
        <Panel title="MOVEMENT QUEUE" className="h-[320px]">
          <div className="p-4 space-y-2 text-xs overflow-y-auto h-full">
            {[
              { task: "PUTAWAY-1204", from: "IN-3",       to: "BU-A2-R4",    pals: 4, status: "In Progress", c: "text-warning" },
              { task: "PUTAWAY-1205", from: "IN-5",       to: "FA-A1-R2",    pals: 2, status: "Pending",     c: "text-info" },
              { task: "REPLEN-0881",  from: "BU-A3-R1",   to: "FA-A2-R3",    pals: 6, status: "Pending",     c: "text-info" },
              { task: "PUTAWAY-1206", from: "IN-3",       to: "CC-A1-R1",    pals: 1, status: "Queued",      c: "text-muted-foreground" },
            ].map((t, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 border-b border-border/40 pb-2 items-center">
                <div className="font-mono font-bold text-[11px] col-span-2">{t.task}</div>
                <div className="text-muted-foreground text-[10px] truncate">{t.from} → {t.to}</div>
                <div className="text-center">{t.pals} pals</div>
                <div className={cn_inline("text-right font-medium", t.c)}>{t.status}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── QC Inspector ─────────────────────────────────────────────────────────────
function QCDashboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ShieldCheck} title="QC Inspection" subtitle="Quality control & quarantine management" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="PENDING INSP."  value="14" delta="3 critical"     tone="warning"     icon={ShieldCheck} />
          <KPICard label="COMPLETED"      value="31" delta="Today"          tone="success"     icon={CheckCircle2} />
          <KPICard label="ON HOLD"        value="8"  delta="Awaiting approval" tone="destructive" icon={AlertTriangle} />
          <KPICard label="PASS RATE"      value="94%" delta="▲ 2% this week" tone="success"    icon={TrendingUp} />
        </div>
        <Panel title="QC QUEUE" className="h-[320px]">
          <div className="p-4 space-y-2 text-xs overflow-y-auto h-full">
            {[
              { id: "QC-3301", po: "PO-78211", item: "SKU-10442", qty: 48, result: "Pending",  c: "text-warning" },
              { id: "QC-3302", po: "PO-78209", item: "SKU-20881", qty: 24, result: "Pass",     c: "text-success" },
              { id: "QC-3303", po: "PO-78201", item: "SKU-33021", qty: 12, result: "Fail",     c: "text-destructive" },
              { id: "QC-3304", po: "PO-78215", item: "SKU-41190", qty: 6,  result: "Pending",  c: "text-warning" },
              { id: "QC-3305", po: "PO-78208", item: "SKU-55302", qty: 36, result: "Pass",     c: "text-success" },
            ].map((q, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 border-b border-border/40 pb-2 items-center">
                <div className="font-mono font-bold text-[11px]">{q.id}</div>
                <div className="font-mono text-muted-foreground text-[10px]">{q.po}</div>
                <div className="text-muted-foreground text-[10px]">{q.item}</div>
                <div className="text-center">×{q.qty}</div>
                <div className={cn_inline("text-right font-bold", q.c)}>{q.result}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Packing Operator ─────────────────────────────────────────────────────────
function PackingDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Package} title={`Packing Station — ${name.split(" ")[0]}`} subtitle="Packing queue & completed shipments" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="TO PACK"       value="18"  delta="In queue"        tone="primary"   icon={Package} />
          <KPICard label="PACKED TODAY"  value="64"  delta="▲ 12% target"   tone="success"   icon={CheckCircle2} />
          <KPICard label="CARTONS USED"  value="128" delta="Avg 2/order"     tone="info"      icon={Package} />
          <KPICard label="LABELS PRINTED"value="64"  delta="All compliant"   tone="success"   icon={Activity} />
        </div>
        <Panel title="PACKING QUEUE" className="h-[320px]">
          <div className="p-4 space-y-2 text-xs overflow-y-auto h-full">
            {Array.from({ length: 7 }, (_, i) => ({
              id: `PACK-${8801 + i}`,
              so: `SO-441${10 + i}`,
              items: Math.floor(Math.random() * 8) + 1,
              cartons: Math.floor(Math.random() * 3) + 1,
              status: i === 0 ? "Packing" : i < 3 ? "Ready" : "Queued",
              c: i === 0 ? "text-warning" : i < 3 ? "text-info" : "text-muted-foreground",
            })).map((p, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 border-b border-border/40 pb-2 items-center">
                <div className="font-mono font-bold text-[11px]">{p.id}</div>
                <div className="font-mono text-muted-foreground">{p.so}</div>
                <div className="text-center">{p.items} items</div>
                <div className="text-center">{p.cartons} ctns</div>
                <div className={cn_inline("text-right font-medium", p.c)}>{p.status}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Yard Manager ─────────────────────────────────────────────────────────────
function YardDashboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Truck} title="Yard & Dock Management" subtitle="Truck scheduling & dock occupancy" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="TRUCKS IN YARD"  value="8"   delta="3 loading"      tone="info"      icon={Truck} />
          <KPICard label="DOCKS OCCUPIED"  value="7"   delta="of 10 total"    tone="primary"   icon={Activity} />
          <KPICard label="EXPECTED TODAY"  value="22"  delta="9 remaining"    tone="warning"   icon={Clock} />
          <KPICard label="AVG DWELL TIME"  value="1h 24m" delta="▲ 12min vs target" tone="destructive" icon={AlertTriangle} />
        </div>
        <Panel title="DOCK STATUS" className="h-[340px]">
          <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto h-full">
            {Array.from({ length: 10 }, (_, i) => {
              const occupied = i < 7;
              const kind = i < 5 ? "IN" : "OUT";
              return (
                <div key={i} className={cn_inline(
                  "border rounded-lg p-3 text-xs",
                  occupied ? (i < 5 ? "border-blue-500/30 bg-blue-500/5" : "border-orange-500/30 bg-orange-500/5") : "border-border/40 bg-secondary/20",
                )}>
                  <div className="flex justify-between mb-1">
                    <span className="font-mono font-bold">{kind}-{i + 1}</span>
                    <span className={occupied ? (i < 5 ? "text-blue-400" : "text-orange-400") : "text-muted-foreground"}>
                      {occupied ? "Occupied" : "Free"}
                    </span>
                  </div>
                  {occupied && (
                    <div className="text-muted-foreground">TRK-{1000 + i} · {i < 5 ? "Receiving" : "Loading"}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Auditor ──────────────────────────────────────────────────────────────────
function AuditorDashboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={BarChart3} title="Audit & Analytics" subtitle="Read-only operational reports" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="ORDERS (MTD)"    value="18,402" delta="▲ 12.3% vs LM"  tone="primary"   icon={Package} />
          <KPICard label="ACCURACY (MTD)"  value="98.7%"  delta="▲ 0.4% vs LM"  tone="success"   icon={CheckCircle2} />
          <KPICard label="EXCEPTIONS (MTD)"value="312"    delta="▼ 8.1% vs LM"  tone="info"      icon={AlertTriangle} />
          <KPICard label="LABOR HOURS (MTD)"value="4,208" delta="▼ 2.8% vs LM"  tone="warning"   icon={Users} />
        </div>
        <Panel title="MONTHLY THROUGHPUT" className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={throughput} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="h" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
              <Area type="monotone" dataKey="in" stroke="var(--color-primary)" fill="url(#ga)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function DR({ label, value, accent }: { label: string; value: React.ReactNode; accent?: "destructive" }) {
  return (
    <div className="flex justify-between border-b border-border/40 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-mono font-medium ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}

function cn_inline(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
