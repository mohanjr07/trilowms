import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Package, Truck, AlertTriangle, TrendingUp, Forklift, Warehouse, Users, ShieldCheck, BarChart3, ArrowDownToLine, ArrowUpFromLine, PackageSearch, CheckCircle2, Clock, Activity, ArrowLeftRight } from "lucide-react";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { warehouse, totalKPIs } from "@/lib/wms-data";
import { useAuthStore } from "@/lib/auth-store";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis, Cell,
} from "recharts";
import { useTransactionStore, TXN_TYPE_META, TXN_STATUS_META, type InventoryTransaction } from "@/lib/transaction-store";
import { useInvBinStore } from "@/lib/inventory-bin-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TriloWMS" },
      { name: "description", content: "Role-based WMS dashboard" },
    ],
  }),
  component: RoleDashboard,
});

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

function cn_inline(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

function DR({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn_inline("font-mono font-bold", accent === "destructive" ? "text-destructive" : "")}>{value}</span>
    </div>
  );
}

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

// ─── Transaction Live Feed (shared widget) ────────────────────────────────────

function TransactionLiveFeed({ limit = 6 }: { limit?: number }) {
  const recentFn = useTransactionStore((s) => s.recentTransactions);
  const txns = useMemo(() => recentFn(limit), [recentFn, limit]);

  return (
    <div className="p-3 space-y-1.5 text-xs overflow-y-auto h-full">
      {txns.map((txn: InventoryTransaction) => {
        const meta = TXN_TYPE_META[txn.type];
        const statusMeta = TXN_STATUS_META[txn.status];
        const ts = new Date(txn.timestamp);
        const timeStr = ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        return (
          <div key={txn.id} className="flex items-center gap-2 border-b border-border/30 pb-1.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
            <span className="text-mono text-muted-foreground">{timeStr}</span>
            <span className={`font-medium ${meta.color}`}>{meta.label}</span>
            <span className="font-mono text-muted-foreground truncate flex-1">{txn.skuCode}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${statusMeta.color} ${statusMeta.bg}`}>
              {statusMeta.label}
            </span>
          </div>
        );
      })}
      {txns.length === 0 && (
        <div className="text-center text-muted-foreground py-4">No transactions yet</div>
      )}
    </div>
  );
}

// ─── Transaction KPI mini-strip ────────────────────────────────────────────────

function TxnMiniKPIs() {
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName);
  const kpisFn = useTransactionStore((s) => s.kpis);
  const transactions = useTransactionStore((s) => s.transactions);
  const kpis = useMemo(() => kpisFn(activeWarehouseName ?? undefined), [transactions, activeWarehouseName]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeData = (Object.entries(kpis.byType) as [string, number][])
    .filter(([, v]) => v > 0)
    .slice(0, 5)
    .map(([type, count]) => ({ name: type.split("_")[0], count }));

  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        { label: "Total",     value: kpis.total,     color: "text-foreground" },
        { label: "Today",     value: kpis.today,     color: "text-primary" },
        { label: "Pending",   value: kpis.pending,   color: kpis.pending > 0 ? "text-amber-400" : "text-muted-foreground" },
        { label: "24h Thru",  value: kpis.throughput24h, color: "text-sky-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-secondary/60 rounded-lg px-2 py-2">
          <div className={`text-lg font-black font-mono ${color}`}>{value}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
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
                    <RadialBar background={{ fill: "var(--color-secondary)" } as never} dataKey="value" cornerRadius={10} />
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

        {/* NEW: Transaction section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="ZONE UTILIZATION" className="lg:col-span-2 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneUtil} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="util" radius={[4, 4, 0, 0]}>
                  {zoneUtil.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="LIVE TRANSACTION FEED" className="h-[240px]">
            <TransactionLiveFeed limit={6} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="TRANSACTION THROUGHPUT" className="lg:col-span-2 h-[160px]">
            <div className="px-4 py-3 space-y-2">
              <TxnMiniKPIs />
              <div className="flex justify-end">
                <Link to="/inventory" className="text-[10px] text-primary hover:underline font-medium">
                  View full transaction log →
                </Link>
              </div>
            </div>
          </Panel>
          <Panel title="QUICK ACTIONS" className="h-[160px]">
            <div className="p-3 grid grid-cols-1 gap-2">
              {[
                { to: "/inventory", label: "New Transaction", icon: ArrowLeftRight, color: "text-primary" },
                { to: "/inbound",   label: "Receive Inbound", icon: ArrowDownToLine, color: "text-emerald-400" },
                { to: "/builder",   label: "3D Warehouse",    icon: Warehouse,       color: "text-amber-400" },
              ].map(({ to, label, icon: Icon, color }) => (
                <Link key={to} to={to} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-sidebar-accent border border-border/40 text-xs font-medium transition-colors">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  {label}
                </Link>
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
          <Panel title="LIVE TRANSACTION FEED" className="h-[260px]">
            <TransactionLiveFeed limit={7} />
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
          <KPICard label="TOTAL SKUS"    value={k.totalBins}   delta="Active items"  tone="primary" icon={Package} />
          <KPICard label="UTILIZATION"   value={`${(k.utilization * 100).toFixed(0)}%`} delta="Warehouse fill" tone={k.utilization > 0.85 ? "destructive" : "success"} />
          <KPICard label="BLOCKED BINS"  value={k.blocked}     delta="Need review"   tone="destructive" icon={AlertTriangle} />
          <KPICard label="LOW STOCK"     value="34"            delta="Below reorder" tone="warning" icon={TrendingUp} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="TRANSACTION SUMMARY" className="h-[220px]">
            <div className="px-4 py-3 space-y-3">
              <TxnMiniKPIs />
              <Link to="/inventory" className="block text-[10px] text-primary hover:underline font-medium text-right">
                Open Transaction Log →
              </Link>
            </div>
          </Panel>
          <Panel title="RECENT MOVEMENTS" className="h-[220px]">
            <TransactionLiveFeed limit={5} />
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
      <PageHeader icon={ArrowDownToLine} title="Inbound Operations" subtitle="ASN tracking · Dock scheduling · Receiving" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="EXPECTED TODAY" value="14"    delta="8 arrived"    tone="info"      icon={Truck} />
          <KPICard label="LINES RECEIVED" value="2,847" delta="▲ 12.3%"     tone="success"   icon={CheckCircle2} />
          <KPICard label="DOCKS ACTIVE"   value="4/6"   delta="2 available"  tone="primary"   icon={Warehouse} />
          <KPICard label="PENDING PUTAWAY" value="142"  delta="3 hrs old"   tone="warning"   icon={Clock} />
        </div>
        <Panel title="RECEIVED TRANSACTIONS" className="h-[280px]">
          <TransactionLiveFeed limit={7} />
        </Panel>
      </div>
    </div>
  );
}

// ─── Outbound Supervisor ──────────────────────────────────────────────────────
function OutboundDashboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ArrowUpFromLine} title="Outbound Operations" subtitle="Wave management · Shipping · Dock assignments" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="ORDERS SHIPPED" value="847"  delta="Today"        tone="success"   icon={CheckCircle2} />
          <KPICard label="WAVES ACTIVE"   value="4"    delta="2 priority"   tone="warning"   icon={Activity} />
          <KPICard label="UNITS SHIPPED"  value="14,280" delta="▲ 8.4%"    tone="primary"   icon={Package} />
          <KPICard label="DOCK DEPARTURES" value="11"  delta="3 pending"    tone="info"      icon={Truck} />
        </div>
        <Panel title="OUTBOUND MOVEMENTS" className="h-[280px]">
          <TransactionLiveFeed limit={7} />
        </Panel>
      </div>
    </div>
  );
}

// ─── Picker ───────────────────────────────────────────────────────────────────
function PickerDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={PackageSearch} title={`Picker — ${name}`} subtitle="Your active pick tasks" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <KPICard label="PICKS TODAY"  value="184" delta="Goal: 200"   tone="primary"  icon={PackageSearch} />
          <KPICard label="ACCURACY"     value="99.2%" delta="Excellent" tone="success"  icon={CheckCircle2} />
        </div>
        <Panel title="ACTIVE WAVE TASKS" className="h-[240px]">
          <div className="p-4 space-y-3 text-xs">
            {Array.from({ length: 5 }, (_, i) => ({
              bin: `A-0${i + 1}-0${i + 1}-0${i + 1}`,
              sku: `SKU-1000${i}`,
              qty: 10 + i * 3,
              done: i < 3,
            })).map((t, i) => (
              <div key={i} className={cn_inline("flex items-center gap-3 border-b border-border/40 pb-2", t.done ? "opacity-50 line-through" : "")}>
                <span className={cn_inline("h-2 w-2 rounded-full shrink-0", t.done ? "bg-emerald-400" : "bg-amber-400")} />
                <span className="font-mono">{t.bin}</span>
                <span className="text-muted-foreground flex-1">{t.sku}</span>
                <span className="font-bold">{t.qty} EA</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Forklift ─────────────────────────────────────────────────────────────────
function ForkliftDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Forklift} title={`Forklift — ${name}`} subtitle="Putaway & transfer tasks" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <KPICard label="PUTAWAYS TODAY" value="47" delta="On target" tone="primary" icon={Forklift} />
          <KPICard label="TRANSFERS"      value="12" delta="3 pending" tone="info"    />
        </div>
        <Panel title="RECENT MOVEMENTS" className="h-[260px]">
          <TransactionLiveFeed limit={6} />
        </Panel>
      </div>
    </div>
  );
}

// ─── QC Inspector ─────────────────────────────────────────────────────────────
function QCDashboard() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ShieldCheck} title="Quality Control" subtitle="Inspection queue · Holds management" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="IN QC HOLD"    value="23"   delta="6 critical"  tone="warning"     icon={AlertTriangle} />
          <KPICard label="INSPECTED"     value="184"  delta="Today"       tone="success"     icon={CheckCircle2} />
          <KPICard label="FAILED"        value="8"    delta="2 destroyed" tone="destructive" icon={AlertTriangle} />
          <KPICard label="PENDING"       value="15"   delta="Queued"      tone="info"        icon={Clock} />
        </div>
        <Panel title="BLOCKED / DAMAGED TRANSACTIONS" className="h-[260px]">
          <TransactionLiveFeed limit={6} />
        </Panel>
      </div>
    </div>
  );
}

// ─── Packing Operator ─────────────────────────────────────────────────────────
function PackingDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Package} title={`Packing — ${name}`} subtitle="Pack station tasks" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <KPICard label="PACKED TODAY"  value="312" delta="Goal: 350"  tone="primary" icon={Package} />
          <KPICard label="EXCEPTIONS"    value="3"   delta="Needs fix"  tone="warning" icon={AlertTriangle} />
        </div>
        <Panel title="PACK QUEUE" className="h-[240px]">
          <div className="p-4 space-y-2 text-xs">
            {Array.from({ length: 5 }, (_, i) => ({
              order: `ORD-${88200 + i}`,
              lines: 2 + i,
              weight: `${(5 + i * 1.3).toFixed(1)} kg`,
              priority: i === 0 ? "HIGH" : i === 1 ? "MEDIUM" : "NORMAL",
            })).map((o, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border/40 pb-2">
                <span className="font-mono font-bold">{o.order}</span>
                <span className="text-muted-foreground flex-1">{o.lines} lines · {o.weight}</span>
                <span className={cn_inline("text-[9px] font-bold px-1.5 py-0.5 rounded",
                  o.priority === "HIGH" ? "bg-red-500/15 text-red-400" :
                  o.priority === "MEDIUM" ? "bg-amber-500/15 text-amber-400" :
                  "bg-secondary text-muted-foreground"
                )}>{o.priority}</span>
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
      <PageHeader icon={Truck} title="Yard Management" subtitle="Truck scheduling · Dock assignments · Yard inventory" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="TRUCKS IN YARD" value="8"   delta="3 inbound"   tone="primary" icon={Truck} />
          <KPICard label="DEPARTURES"     value="11"  delta="Today"       tone="success" icon={ArrowUpFromLine} />
          <KPICard label="ARRIVALS"       value="14"  delta="Today"       tone="info"    icon={ArrowDownToLine} />
          <KPICard label="DOCK WAIT"      value="22m" delta="Avg wait"    tone="warning" icon={Clock} />
        </div>
        <Panel title="DOCK STATUS" className="h-[260px]">
          <div className="p-4 space-y-2 text-xs">
            {Array.from({ length: 8 }, (_, i) => ({
              dock: i < 6 ? `IN-${i + 1}` : `OUT-${i - 5}`,
              status: i < 4 ? "Occupied" : i === 4 ? "Loading" : i < 7 ? "Available" : "Maintenance",
              truck: i < 4 ? `TRK-${1000 + i}` : i === 4 ? "TRK-1008" : "—",
            })).map((d, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border/40 pb-2">
                <span className="font-mono w-12 font-bold">{d.dock}</span>
                <span className={cn_inline("flex-1 font-medium",
                  d.status === "Occupied" ? "text-success" :
                  d.status === "Loading" ? "text-warning" :
                  d.status === "Maintenance" ? "text-destructive" :
                  "text-muted-foreground"
                )}>{d.status}</span>
                <span className="text-muted-foreground">{d.truck}</span>
              </div>
            ))}
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
      <PageHeader icon={ShieldCheck} title="Audit & Compliance" subtitle="Full transaction audit trail" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="AUDIT EVENTS"   value="1,847" delta="Last 30 days" tone="primary"   icon={Activity} />
          <KPICard label="DISCREPANCIES"  value="12"    delta="Under review"  tone="warning"   icon={AlertTriangle} />
          <KPICard label="USERS AUDITED"  value="24"    delta="All active"    tone="info"      icon={Users} />
          <KPICard label="COMPLIANCE"     value="97.8%" delta="SOX compliant" tone="success"   icon={CheckCircle2} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="TRANSACTION AUDIT TRAIL" className="h-[300px]">
            <TransactionLiveFeed limit={8} />
          </Panel>
          <Panel title="TRANSACTION STATS" className="h-[300px]">
            <div className="px-4 py-3 space-y-3">
              <TxnMiniKPIs />
              <div className="mt-3 pt-3 border-t border-border/30">
                <Link to="/inventory" className="block text-center py-2 px-4 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-lg transition-colors">
                  Open Full Transaction Log →
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
