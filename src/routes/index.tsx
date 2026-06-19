import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Truck, AlertTriangle, TrendingUp, Forklift, Warehouse,
  Users, ShieldCheck, ArrowDownToLine, ArrowUpFromLine, PackageSearch, CheckCircle2,
  Clock, Activity, ArrowLeftRight, PackageOpen, PackageCheck, Container, Undo2,
  ChevronRight, Gauge, Boxes,
} from "lucide-react";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { warehouse, totalKPIs } from "@/lib/wms-data";
import { useAuthStore } from "@/lib/auth-store";
import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid, Cell,
} from "recharts";
import { useTransactionStore, TXN_TYPE_META, TXN_STATUS_META, type InventoryTransaction } from "@/lib/transaction-store";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { useInboundStore } from "@/lib/inbound-store";
import { usePutawayStore } from "@/lib/putaway-store";
import { usePickingStore } from "@/lib/picking-store";
import { usePackingStore } from "@/lib/packing-store";
import { useOutboundStore } from "@/lib/outbound-store";
import { useYardStore } from "@/lib/yard-store";
import { useQCStore } from "@/lib/qc-store";
import { useReturnsStore } from "@/lib/returns-store";
import { useLaborStore } from "@/lib/labor-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — TriloWMS" }, { name: "description", content: "Role-based WMS dashboard" }] }),
  component: RoleDashboard,
});

const throughput = Array.from({ length: 24 }, (_, i) => ({ h: `${i}:00`, in: Math.floor(20 + Math.abs(Math.sin(i / 2)) * 80), out: Math.floor(15 + Math.abs(Math.cos(i / 2)) * 95) }));
const zoneUtil = warehouse.zones.map((z) => ({ name: z.name.split(" ")[0], util: Math.round(z.utilization * 100), fill: z.color }));

function RoleDashboard() {
  const { session, role } = useAuthStore();
  const roleDef = role();
  if (!session || !roleDef) return null;

  switch (session.user.role) {
    case "super_admin":
    case "warehouse_admin":
    case "operations_manager":
      return <EnterpriseDashboard />;
    case "inventory_manager":
      return <InventoryDashboard />;
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
      return <EnterpriseDashboard />;
  }
}

// ─── Shared widgets ───────────────────────────────────────────────────────────

function TransactionLiveFeed({ limit = 6 }: { limit?: number }) {
  const recentFn = useTransactionStore((s) => s.recentTransactions);
  const txns = useMemo(() => recentFn(limit), [recentFn, limit]);
  return (
    <div className="p-3 space-y-1.5 text-xs overflow-y-auto h-full">
      {txns.map((txn: InventoryTransaction) => {
        const meta = TXN_TYPE_META[txn.type];
        const statusMeta = TXN_STATUS_META[txn.status];
        const timeStr = new Date(txn.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        return (
          <div key={txn.id} className="flex items-center gap-2 border-b border-border/30 pb-1.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
            <span className="text-mono text-muted-foreground tabular-nums">{timeStr}</span>
            <span className={`font-medium ${meta.color}`}>{meta.label}</span>
            <span className="font-mono text-muted-foreground truncate flex-1">{txn.skuCode}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${statusMeta.color} ${statusMeta.bg}`}>{statusMeta.label}</span>
          </div>
        );
      })}
      {txns.length === 0 && <div className="text-center text-muted-foreground py-4">No transactions yet</div>}
    </div>
  );
}

function TxnMiniKPIs() {
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName);
  const kpisFn = useTransactionStore((s) => s.kpis);
  const transactions = useTransactionStore((s) => s.transactions);
  const kpis = useMemo(() => kpisFn(activeWarehouseName ?? undefined), [transactions, activeWarehouseName]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        { label: "Total", value: kpis.total, color: "text-foreground" },
        { label: "Today", value: kpis.today, color: "text-primary" },
        { label: "Pending", value: kpis.pending, color: kpis.pending > 0 ? "text-amber-400" : "text-muted-foreground" },
        { label: "24h Thru", value: kpis.throughput24h, color: "text-sky-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-secondary/60 rounded-lg px-2 py-2">
          <div className={`text-lg font-black font-mono ${color}`}>{value}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ENTERPRISE CONTROL CENTER — live cross-module aggregation
// ════════════════════════════════════════════════════════════════════════════

function EnterpriseDashboard() {
  const k = totalKPIs(warehouse);

  const inbound = useInboundStore((s) => s.kpis)();
  const putaway = usePutawayStore((s) => s.kpis)();
  const picking = usePickingStore((s) => s.kpis)();
  const packing = usePackingStore((s) => s.kpis)();
  const outbound = useOutboundStore((s) => s.kpis)();
  const yard = useYardStore((s) => s.kpis)();
  const qc = useQCStore((s) => s.kpis)();
  const returns = useReturnsStore((s) => s.kpis)();
  const labor = useLaborStore((s) => s.kpis)();

  // Cross-module module-health cards
  const modules = [
    { to: "/inbound",  label: "Inbound",  icon: ArrowDownToLine, primary: `${inbound.openAsns} open ASNs`,   alert: inbound.discrepancies, alertLabel: "discrepancies", accent: "text-cyan-400" },
    { to: "/putaway",  label: "Putaway",  icon: PackageOpen,     primary: `${putaway.open} open tasks`,       alert: putaway.blocked,       alertLabel: "blocked",       accent: "text-amber-400" },
    { to: "/picking",  label: "Picking",  icon: PackageSearch,   primary: `${picking.activeWaves} active waves`, alert: picking.shorts,     alertLabel: "shorts",        accent: "text-primary" },
    { to: "/packing",  label: "Packing",  icon: PackageCheck,    primary: `${packing.cartonsPacked} packed`,  alert: packing.rework,        alertLabel: "rework",        accent: "text-indigo-400" },
    { to: "/outbound", label: "Outbound", icon: Truck,           primary: `${outbound.dispatched} dispatched`, alert: outbound.delayed,    alertLabel: "delayed",       accent: "text-violet-400" },
    { to: "/yard",     label: "Yard",     icon: Container,       primary: `${yard.inYard} trucks in yard`,    alert: yard.dwellAlerts,      alertLabel: "dwell alerts",  accent: "text-emerald-400" },
    { to: "/qc",       label: "Quality",  icon: ShieldCheck,     primary: `${qc.passRate} pass rate`,         alert: qc.openHolds,          alertLabel: "holds",         accent: "text-green-400" },
    { to: "/returns",  label: "Returns",  icon: Undo2,           primary: `${returns.openRmas} open RMAs`,    alert: returns.pendingInspection, alertLabel: "to inspect",  accent: "text-orange-400" },
    { to: "/labor",    label: "Labor",    icon: Users,           primary: `${labor.onShift} on shift`,        alert: labor.onBreak,         alertLabel: "on break",      accent: "text-sky-400" },
  ];

  const totalExceptions = inbound.discrepancies + putaway.blocked + picking.shorts + packing.rework + outbound.exceptionsOpen + yard.dwellAlerts + qc.openHolds;

  const exceptions = [
    { to: "/inbound",  label: "Inbound discrepancies", count: inbound.discrepancies, icon: ArrowDownToLine },
    { to: "/putaway",  label: "Putaway blocked tasks", count: putaway.blocked, icon: PackageOpen },
    { to: "/picking",  label: "Pick shortages", count: picking.shorts, icon: PackageSearch },
    { to: "/packing",  label: "Carton rework", count: packing.rework, icon: PackageCheck },
    { to: "/outbound", label: "Outbound exceptions", count: outbound.exceptionsOpen, icon: Truck },
    { to: "/yard",     label: "Yard dwell alerts", count: yard.dwellAlerts, icon: Container },
    { to: "/qc",       label: "QC holds", count: qc.openHolds, icon: ShieldCheck },
  ].filter((e) => e.count > 0).sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        icon={LayoutDashboard}
        title="Enterprise Control Center"
        subtitle={`${warehouse.name} · Live · ${new Date().toLocaleString()}`}
        actions={
          <Link to="/builder" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium glow-amber flex items-center gap-2">
            <Warehouse className="h-4 w-4" /> Open 3D Builder
          </Link>
        }
      />
      <div className="p-6 space-y-6">
        {/* Headline KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="DISPATCHED TODAY" value={outbound.dispatched} tone="success" icon={Truck} sub={`${outbound.slaCompliance} SLA`} />
          <KPICard label="PICKED TODAY" value={picking.pickedToday.toLocaleString()} tone="primary" icon={TrendingUp} sub={`${picking.pickAccuracy} accuracy`} />
          <KPICard label="RECEIVED TODAY" value={inbound.receivedToday} tone="info" icon={ArrowDownToLine} sub={`${inbound.openAsns} open ASNs`} />
          <KPICard label="CARTONS PACKED" value={packing.cartonsPacked.toLocaleString()} tone="success" icon={PackageCheck} sub={`${packing.pendingLabel} to label`} />
          <KPICard label="OPEN EXCEPTIONS" value={totalExceptions} tone="destructive" icon={AlertTriangle} sub="across all modules" />
          <KPICard label="WORKFORCE" value={labor.onShift} tone="warning" icon={Users} sub={`${labor.avgUph} avg UPH`} />
        </div>

        {/* Module health grid */}
        <Panel title="MODULE HEALTH" className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/40">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <Link key={m.to} to={m.to} className="bg-card hover:bg-accent/20 transition-colors p-4 flex items-center gap-3 group">
                  <div className={cn("h-10 w-10 rounded-lg bg-secondary/60 border border-border/60 flex items-center justify-center shrink-0", m.accent)}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{m.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.primary}</div>
                    {m.alert > 0 ? (
                      <div className="text-[11px] text-amber-400 mt-0.5 font-medium">{m.alert} {m.alertLabel}</div>
                    ) : (
                      <div className="text-[11px] text-emerald-400/80 mt-0.5">all clear</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>

        {/* Throughput + occupancy */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="INBOUND vs OUTBOUND THROUGHPUT (24H)" className="lg:col-span-2 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughput} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} /></linearGradient>
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
          <OccupancyPanel total={k.totalBins} occupied={k.occupied} blocked={k.blocked} util={k.utilization} docksOpen={yard.availableDocks} onShift={labor.onShift} />
        </div>

        {/* Exceptions + live feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="EXCEPTION CENTER" className="h-[280px] p-0">
            <div className="divide-y divide-border/40 overflow-y-auto h-full">
              {exceptions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2"><CheckCircle2 className="h-8 w-8 text-emerald-500/40" /><span className="text-sm">No open exceptions across the floor.</span></div>
              )}
              {exceptions.map((e) => {
                const Icon = e.icon;
                return (
                  <Link key={e.to} to={e.to} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-sm flex-1 min-w-0 truncate">{e.label}</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-amber-400">{e.count}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </Panel>
          <Panel title="ZONE UTILIZATION" className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneUtil} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="util" radius={[4, 4, 0, 0]}>{zoneUtil.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="LIVE TRANSACTION FEED" className="h-[280px]">
            <TransactionLiveFeed limit={7} />
          </Panel>
        </div>

        {/* Transaction strip + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="TRANSACTION THROUGHPUT" className="lg:col-span-2 h-[160px]">
            <div className="px-4 py-3 space-y-2">
              <TxnMiniKPIs />
              <div className="flex justify-end"><Link to="/inventory" className="text-[10px] text-primary hover:underline font-medium">View full transaction log →</Link></div>
            </div>
          </Panel>
          <Panel title="QUICK ACTIONS" className="h-[160px]">
            <div className="p-3 grid grid-cols-1 gap-2">
              {[
                { to: "/inventory" as const, label: "New Transaction", icon: ArrowLeftRight, color: "text-primary" },
                { to: "/inbound" as const, label: "Receive Inbound", icon: ArrowDownToLine, color: "text-emerald-400" },
                { to: "/builder" as const, label: "3D Warehouse", icon: Warehouse, color: "text-amber-400" },
              ].map(({ to, label, icon: Icon, color }) => (
                <Link key={to} to={to} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-sidebar-accent border border-border/40 text-xs font-medium transition-colors">
                  <Icon className={`h-3.5 w-3.5 ${color}`} /> {label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function OccupancyPanel({ total, occupied, blocked, util, docksOpen, onShift }: {
  total: number; occupied: number; blocked: number; util: number; docksOpen: number; onShift: number;
}) {
  const pct = Math.round(util * 100);
  const free = Math.max(0, total - occupied);
  const R = 54, C = 2 * Math.PI * R;
  const tone = pct >= 90 ? "var(--color-destructive)" : pct >= 75 ? "var(--color-warning)" : "var(--color-primary)";

  const segs = [
    { label: "Occupied", n: occupied - blocked, c: "var(--color-primary)", dot: "bg-primary" },
    { label: "Blocked", n: blocked, c: "var(--color-destructive)", dot: "bg-destructive" },
    { label: "Free", n: free, c: "var(--color-secondary)", dot: "bg-muted-foreground/40" },
  ];

  return (
    <Panel title="WAREHOUSE OCCUPANCY" className="h-[280px]">
      <div className="flex flex-col h-full p-4 gap-3">
        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 124, height: 124 }}>
            <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
              <circle cx="64" cy="64" r={R} fill="none" stroke="var(--color-secondary)" strokeWidth="12" />
              <circle
                cx="64" cy="64" r={R} fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - util)}
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[28px] leading-none font-bold font-mono tabular-nums" style={{ color: tone }}>{pct}%</span>
              <span className="text-[9px] text-muted-foreground tracking-wider uppercase mt-1">Utilization</span>
            </div>
          </div>

          {/* Key figures */}
          <div className="flex-1 min-w-0 space-y-2">
            {segs.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-sm shrink-0", s.dot)} />
                <span className="text-xs text-muted-foreground flex-1">{s.label}</span>
                <span className={cn("text-sm font-bold font-mono tabular-nums", s.label === "Blocked" && blocked > 0 ? "text-destructive" : "")}>{Math.max(0, s.n).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Segmented occupancy bar */}
        <div>
          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-secondary">
            {segs.map((s) => s.n > 0 && (
              <div key={s.label} style={{ width: `${(s.n / total) * 100}%`, background: s.c }} title={`${s.label}: ${s.n}`} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
            <span>{total.toLocaleString()} bins total</span>
            <span>{free.toLocaleString()} available</span>
          </div>
        </div>

        {/* Footer figures */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between px-3 py-2 rounded border border-border/60 bg-card/40">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Docks open</span>
            <span className="text-sm font-bold font-mono tabular-nums text-emerald-400">{docksOpen}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded border border-border/60 bg-card/40">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">On shift</span>
            <span className="text-sm font-bold font-mono tabular-nums">{onShift}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ─── Inventory Manager ────────────────────────────────────────────────────────
function InventoryDashboard() {
  const k = totalKPIs(warehouse);
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Package} title="Inventory Control" subtitle="Stock visibility & replenishment alerts" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="TOTAL BINS" value={k.totalBins} tone="primary" icon={Boxes} sub="active locations" />
          <KPICard label="UTILIZATION" value={`${(k.utilization * 100).toFixed(0)}%`} tone={k.utilization > 0.85 ? "destructive" : "success"} icon={Gauge} sub="warehouse fill" />
          <KPICard label="BLOCKED BINS" value={k.blocked} tone="destructive" icon={AlertTriangle} sub="need review" />
          <KPICard label="LOW STOCK" value="34" tone="warning" icon={TrendingUp} sub="below reorder" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="TRANSACTION SUMMARY" className="h-[220px]">
            <div className="px-4 py-3 space-y-3"><TxnMiniKPIs /><Link to="/inventory" className="block text-[10px] text-primary hover:underline font-medium text-right">Open Transaction Log →</Link></div>
          </Panel>
          <Panel title="RECENT MOVEMENTS" className="h-[220px]"><TransactionLiveFeed limit={5} /></Panel>
        </div>
      </div>
    </div>
  );
}

// ─── Inbound Supervisor ───────────────────────────────────────────────────────
function InboundDashboard() {
  const kpis = useInboundStore((s) => s.kpis)();
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ArrowDownToLine} title="Inbound Operations" subtitle="ASN tracking · dock scheduling · receiving"
        actions={<Link to="/inbound" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" /> Open Inbound</Link>} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="OPEN ASNs" value={kpis.openAsns} tone="info" icon={Truck} sub="awaiting completion" />
          <KPICard label="RECEIVED TODAY" value={kpis.receivedToday} tone="success" icon={CheckCircle2} />
          <KPICard label="DOCKED NOW" value={kpis.dockedNow} tone="primary" icon={Warehouse} sub="at door" />
          <KPICard label="DISCREPANCIES" value={kpis.discrepancies} tone="destructive" icon={AlertTriangle} sub="open exceptions" />
        </div>
        <Panel title="RECEIVED TRANSACTIONS" className="h-[280px]"><TransactionLiveFeed limit={7} /></Panel>
      </div>
    </div>
  );
}

// ─── Outbound Supervisor ──────────────────────────────────────────────────────
function OutboundDashboard() {
  const kpis = useOutboundStore((s) => s.kpis)();
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ArrowUpFromLine} title="Outbound Operations" subtitle="Shipment planning · loading · dispatch"
        actions={<Link to="/outbound" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><Truck className="h-4 w-4" /> Open Outbound</Link>} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="DISPATCHED" value={kpis.dispatched} tone="success" icon={CheckCircle2} sub="today" />
          <KPICard label="STAGED" value={kpis.staged} tone="info" icon={Activity} sub="at dock" />
          <KPICard label="LOADING" value={kpis.loading} tone="warning" icon={Package} sub="trucks active" />
          <KPICard label="SLA COMPLIANCE" value={kpis.slaCompliance} tone="primary" icon={Gauge} sub="on-time" />
        </div>
        <Panel title="OUTBOUND MOVEMENTS" className="h-[280px]"><TransactionLiveFeed limit={7} /></Panel>
      </div>
    </div>
  );
}

// ─── Picker ───────────────────────────────────────────────────────────────────
function PickerDashboard({ name }: { name: string }) {
  const kpis = usePickingStore((s) => s.kpis)();
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={PackageSearch} title={`Picker — ${name}`} subtitle="Your active pick tasks"
        actions={<Link to="/picking" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><PackageSearch className="h-4 w-4" /> Open Picking</Link>} />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="OPEN PICKS" value={kpis.openPicks} tone="primary" icon={PackageSearch} sub="lines outstanding" />
          <KPICard label="PICKED TODAY" value={kpis.pickedToday.toLocaleString()} tone="success" icon={CheckCircle2} />
          <KPICard label="ACCURACY" value={kpis.pickAccuracy} tone="info" icon={Gauge} />
          <KPICard label="UNITS/HR" value={kpis.avgPicksPerHour} tone="warning" icon={TrendingUp} />
        </div>
        <Panel title="ACTIVE WAVE TASKS" className="h-[240px]">
          <div className="p-4 space-y-3 text-xs">
            {Array.from({ length: 5 }, (_, i) => ({ bin: `A-0${i + 1}-0${i + 1}-0${i + 1}`, sku: `SKU-1000${i}`, qty: 10 + i * 3, done: i < 3 })).map((t, i) => (
              <div key={i} className={cn("flex items-center gap-3 border-b border-border/40 pb-2", t.done ? "opacity-50 line-through" : "")}>
                <span className={cn("h-2 w-2 rounded-full shrink-0", t.done ? "bg-emerald-400" : "bg-amber-400")} />
                <span className="font-mono">{t.bin}</span><span className="text-muted-foreground flex-1">{t.sku}</span><span className="font-bold">{t.qty} EA</span>
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
  const kpis = usePutawayStore((s) => s.kpis)();
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Forklift} title={`Forklift — ${name}`} subtitle="Putaway & transfer tasks"
        actions={<Link to="/putaway" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><PackageOpen className="h-4 w-4" /> Open Putaway</Link>} />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="OPEN TASKS" value={kpis.open} tone="primary" icon={Forklift} sub="awaiting dispatch" />
          <KPICard label="IN PROGRESS" value={kpis.inProgress} tone="warning" icon={Activity} />
          <KPICard label="DONE TODAY" value={kpis.completedToday} tone="success" icon={CheckCircle2} />
          <KPICard label="BLOCKED" value={kpis.blocked} tone="destructive" icon={AlertTriangle} />
        </div>
        <Panel title="RECENT MOVEMENTS" className="h-[260px]"><TransactionLiveFeed limit={6} /></Panel>
      </div>
    </div>
  );
}

// ─── QC Inspector ─────────────────────────────────────────────────────────────
function QCDashboard() {
  const kpis = useQCStore((s) => s.kpis)();
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ShieldCheck} title="Quality Control" subtitle="Inspection queue · holds management"
        actions={<Link to="/qc" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Open QC</Link>} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="OPEN HOLDS" value={kpis.openHolds} tone="warning" icon={AlertTriangle} sub="quarantined" />
          <KPICard label="PASS RATE" value={kpis.passRate} tone="success" icon={CheckCircle2} />
          <KPICard label="FAILED" value={kpis.failed} tone="destructive" icon={AlertTriangle} />
          <KPICard label="PENDING REVIEW" value={kpis.pendingReview} tone="info" icon={Clock} />
        </div>
        <Panel title="BLOCKED / DAMAGED TRANSACTIONS" className="h-[260px]"><TransactionLiveFeed limit={6} /></Panel>
      </div>
    </div>
  );
}

// ─── Packing Operator ─────────────────────────────────────────────────────────
function PackingDashboard({ name }: { name: string }) {
  const kpis = usePackingStore((s) => s.kpis)();
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={PackageCheck} title={`Packing — ${name}`} subtitle="Pack station tasks"
        actions={<Link to="/packing" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Open Packing</Link>} />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="PACKED TODAY" value={kpis.cartonsPacked} tone="primary" icon={PackageCheck} />
          <KPICard label="ACTIVE STATIONS" value={kpis.activeStations} tone="success" icon={Activity} />
          <KPICard label="PENDING LABEL" value={kpis.pendingLabel} tone="warning" icon={Clock} />
          <KPICard label="REWORK" value={kpis.rework} tone="destructive" icon={AlertTriangle} />
        </div>
        <Panel title="LIVE TRANSACTION FEED" className="h-[240px]"><TransactionLiveFeed limit={6} /></Panel>
      </div>
    </div>
  );
}

// ─── Yard Manager ─────────────────────────────────────────────────────────────
function YardDashboard() {
  const kpis = useYardStore((s) => s.kpis)();
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={Container} title="Yard Management" subtitle="Truck scheduling · dock assignments · dwell"
        actions={<Link to="/yard" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><Container className="h-4 w-4" /> Open Yard</Link>} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="TRUCKS IN YARD" value={kpis.inYard} tone="primary" icon={Truck} />
          <KPICard label="DOCKED" value={kpis.dockedIn + kpis.dockedOut} tone="success" icon={Warehouse} sub={`${kpis.availableDocks} open`} />
          <KPICard label="AVG DWELL" value={kpis.avgDwell} tone="warning" icon={Clock} />
          <KPICard label="DWELL ALERTS" value={kpis.dwellAlerts} tone="destructive" icon={AlertTriangle} />
        </div>
        <Panel title="LIVE TRANSACTION FEED" className="h-[260px]"><TransactionLiveFeed limit={7} /></Panel>
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
          <KPICard label="AUDIT EVENTS" value="1,847" tone="primary" icon={Activity} sub="last 30 days" />
          <KPICard label="DISCREPANCIES" value="12" tone="warning" icon={AlertTriangle} sub="under review" />
          <KPICard label="USERS AUDITED" value="24" tone="info" icon={Users} sub="all active" />
          <KPICard label="COMPLIANCE" value="97.8%" tone="success" icon={CheckCircle2} sub="SOX compliant" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="TRANSACTION AUDIT TRAIL" className="h-[300px]"><TransactionLiveFeed limit={8} /></Panel>
          <Panel title="TRANSACTION STATS" className="h-[300px]">
            <div className="px-4 py-3 space-y-3">
              <TxnMiniKPIs />
              <div className="mt-3 pt-3 border-t border-border/30"><Link to="/inventory" className="block text-center py-2 px-4 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-lg transition-colors">Open Full Transaction Log →</Link></div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
