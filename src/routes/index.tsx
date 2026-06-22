import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Truck, AlertTriangle, TrendingUp, Forklift, Warehouse,
  Users, ShieldCheck, ArrowDownToLine, ArrowUpFromLine, PackageSearch, CheckCircle2,
  Clock, Activity, ArrowLeftRight, PackageOpen, PackageCheck, Container, Undo2,
  ChevronRight, Gauge, Boxes, ShoppingCart, BarChart3, RefreshCw,
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
import { useStockStore } from "@/lib/stock-store";
import { useSkuStore } from "@/lib/sku-store";
import { useOrdersStore } from "@/lib/orders-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")(({
  head: () => ({ meta: [{ title: "Dashboard — TriloWMS" }, { name: "description", content: "Role-based WMS dashboard" }] }),
  component: RoleDashboard,
}));

const throughput = Array.from({ length: 24 }, (_, i) => ({ h: `${i}:00`, in: 0, out: 0 }));
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
      {txns.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-8">
          <Activity className="h-6 w-6 opacity-30" />
          <span className="text-[11px]">No transactions yet</span>
        </div>
      )}
      {txns.map((txn: InventoryTransaction) => {
        const meta = TXN_TYPE_META[txn.type];
        const statusMeta = TXN_STATUS_META[txn.status];
        const timeStr = new Date(txn.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        return (
          <div key={txn.id} className="flex items-start gap-2 border-b border-border/30 pb-1.5">
            <span className="shrink-0 mt-0.5 font-mono text-[10px] text-muted-foreground w-16">{timeStr}</span>
            <span className={cn("shrink-0 font-mono text-[10px] font-bold", meta?.color ?? "text-primary")}>[{meta?.label ?? txn.type}]</span>
            <span className="font-mono text-[10px] font-bold text-foreground/90 shrink-0">{txn.skuCode}</span>
            <span className="text-muted-foreground truncate min-w-0">{txn.skuName}</span>
            <span className="font-mono font-bold shrink-0">{txn.quantity > 0 ? "+" : ""}{txn.quantity}</span>
            <span className={cn("shrink-0 font-bold", statusMeta?.color ?? "")}>{statusMeta?.label ?? txn.status}</span>
          </div>
        );
      })}
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

// ─── Low Stock Alerts panel ───────────────────────────────────────────────────

function LowStockPanel({ height = 280 }: { height?: number }) {
  const stockList = useStockStore((s) => s.list)();
  const skusFn = useSkuStore((s) => s.skus);
  const skus = skusFn;

  const lowStockItems = useMemo(() => {
    return stockList
      .map((rec) => {
        const sku = skus.find((s) => s.skuCode === rec.skuCode);
        const reorderLevel = sku?.reorderLevel ?? 100;
        const available = Math.max(0, rec.onHand - rec.reserved);
        const deficit = reorderLevel - available;
        return { ...rec, reorderLevel, available, deficit, skuName: sku?.itemName ?? rec.skuName };
      })
      .filter((r) => r.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 8);
  }, [stockList, skus]);

  const outOfStock = lowStockItems.filter((i) => i.available <= 0).length;

  return (
    <Panel title="LOW STOCK ALERTS" className={`h-[${height}px] p-0`}>
      <div className="overflow-y-auto h-full">
        {lowStockItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-8">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
            <span className="text-sm">All SKUs above reorder level</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40 bg-secondary/30">
              <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {lowStockItems.length} SKUs below reorder
              </span>
              {outOfStock > 0 && (
                <span className="text-[11px] font-bold text-red-400 ml-auto">{outOfStock} out of stock</span>
              )}
            </div>
            <div className="divide-y divide-border/30">
              {lowStockItems.map((item) => {
                const pct = item.reorderLevel > 0 ? Math.round((item.available / item.reorderLevel) * 100) : 0;
                const isOut = item.available <= 0;
                return (
                  <Link key={item.skuCode} to="/inventory" className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-primary">{item.skuCode}</span>
                        <span className={cn("text-[11px] font-bold font-mono tabular-nums", isOut ? "text-red-400" : "text-amber-400")}>
                          {item.available} / {item.reorderLevel}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{item.skuName}</div>
                      <div className="mt-1.5 h-1 rounded-full bg-secondary">
                        <div
                          className={cn("h-full rounded-full transition-all", isOut ? "bg-red-500" : "bg-amber-400")}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

// ─── Order Fulfillment panel ──────────────────────────────────────────────────

function OrderFulfillmentPanel() {
  const orderKpisFn = useOrdersStore((s) => s.kpis);
  const orders = useOrdersStore((s) => s.orders);
  const kpis = useMemo(() => orderKpisFn(), [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const stages = [
    { label: "New", value: kpis.newOrders, color: "bg-slate-500" },
    { label: "Allocated", value: kpis.allocated, color: "bg-blue-500" },
    { label: "Fulfilling", value: kpis.inFulfillment, color: "bg-amber-500" },
    { label: "Shipped", value: kpis.shipped, color: "bg-emerald-500" },
    { label: "Exceptions", value: kpis.exceptions, color: "bg-red-500" },
  ];
  const total = stages.reduce((s, st) => s + st.value, 0);

  return (
    <Panel title="ORDER FULFILLMENT" className="h-[280px] p-4">
      <div className="flex flex-col h-full gap-3">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "FILL RATE", value: kpis.fulfillmentRate, color: "text-emerald-400" },
            { label: "AVG CYCLE", value: kpis.avgCycleHrs, color: "text-sky-400" },
            { label: "BACKORDER", value: kpis.backordered, color: kpis.backordered > 0 ? "text-amber-400" : "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-secondary/60 rounded-lg p-2 text-center">
              <div className={`text-base font-black font-mono ${color}`}>{value ?? "—"}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Funnel bars */}
        <div className="flex-1 flex flex-col justify-center gap-1.5">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <ShoppingCart className="h-6 w-6 opacity-30" />
              <span className="text-[11px]">No orders yet</span>
            </div>
          ) : (
            stages.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-16 text-right shrink-0">{s.label}</span>
                <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", s.color)}
                    style={{ width: total > 0 ? `${(s.value / total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold w-6 text-right tabular-nums">{s.value}</span>
              </div>
            ))
          )}
        </div>

        <Link to="/orders" className="text-[10px] text-primary hover:underline font-medium text-right block">
          Open Orders →
        </Link>
      </div>
    </Panel>
  );
}

// ─── Inventory Overview panel ─────────────────────────────────────────────────

function InventoryOverviewPanel() {
  const stockKpisFn = useStockStore((s) => s.kpis);
  const stock = useStockStore((s) => s.stock);
  const skuKpisFn = useSkuStore((s) => s.kpis);
  const skus = useSkuStore((s) => s.skus);
  const stockKpis = useMemo(() => stockKpisFn(), [stock]); // eslint-disable-line react-hooks/exhaustive-deps
  const skuKpis = useMemo(() => skuKpisFn(), [skus]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = [
    { label: "TOTAL SKUs", value: skuKpis.total, icon: Boxes, color: "text-primary" },
    { label: "ON-HAND UNITS", value: stockKpis.totalOnHand.toLocaleString(), icon: Package, color: "text-emerald-400" },
    { label: "RESERVED", value: stockKpis.totalReserved.toLocaleString(), icon: Clock, color: "text-amber-400" },
    { label: "AVAILABLE", value: stockKpis.totalAvailable.toLocaleString(), icon: CheckCircle2, color: "text-sky-400" },
    { label: "LOW STOCK SKUs", value: skuKpis.lowStock, icon: AlertTriangle, color: skuKpis.lowStock > 0 ? "text-red-400" : "text-muted-foreground" },
    { label: "ON HOLD", value: skuKpis.onHold, icon: ShieldCheck, color: skuKpis.onHold > 0 ? "text-orange-400" : "text-muted-foreground" },
  ];

  return (
    <Panel title="INVENTORY OVERVIEW" className="h-[280px] p-4">
      <div className="grid grid-cols-2 gap-2 h-full content-start">
        {items.map(({ label, value, icon: Icon, color }) => (
          <Link key={label} to="/inventory" className="flex items-center gap-2.5 bg-secondary/50 border border-border/40 rounded-lg px-3 py-2.5 hover:bg-accent/20 transition-colors group">
            <Icon className={cn("h-4 w-4 shrink-0", color)} />
            <div className="min-w-0">
              <div className={cn("text-base font-black font-mono tabular-nums", color)}>{value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</div>
            </div>
          </Link>
        ))}
      </div>
    </Panel>
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
  const returns_ = useReturnsStore((s) => s.kpis)();
  const labor = useLaborStore((s) => s.kpis)();

  const orderKpisFn = useOrdersStore((s) => s.kpis);
  const orders = useOrdersStore((s) => s.orders);
  const orderKpis = useMemo(() => orderKpisFn(), [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-module module-health cards
  const modules = [
    { to: "/inbound",   label: "Inbound",   icon: ArrowDownToLine, primary: `${inbound.openAsns} open ASNs`,         alert: inbound.discrepancies,      alertLabel: "discrepancies", accent: "text-cyan-400"    },
    { to: "/putaway",   label: "Putaway",   icon: PackageOpen,     primary: `${putaway.open} open tasks`,             alert: putaway.blocked,            alertLabel: "blocked",       accent: "text-amber-400"   },
    { to: "/orders",    label: "Orders",    icon: ShoppingCart,    primary: `${orderKpis.newOrders} new orders`,      alert: orderKpis.exceptions,       alertLabel: "exceptions",    accent: "text-blue-400"    },
    { to: "/picking",   label: "Picking",   icon: PackageSearch,   primary: `${picking.activeWaves} active waves`,    alert: picking.shorts,             alertLabel: "shorts",        accent: "text-primary"     },
    { to: "/packing",   label: "Packing",   icon: PackageCheck,    primary: `${packing.cartonsPacked} packed`,        alert: packing.rework,             alertLabel: "rework",        accent: "text-indigo-400"  },
    { to: "/outbound",  label: "Outbound",  icon: Truck,           primary: `${outbound.dispatched} dispatched`,      alert: outbound.delayed,           alertLabel: "delayed",       accent: "text-violet-400"  },
    { to: "/yard",      label: "Yard",      icon: Container,       primary: `${yard.inYard} trucks in yard`,          alert: yard.dwellAlerts,           alertLabel: "dwell alerts",  accent: "text-emerald-400" },
    { to: "/qc",        label: "Quality",   icon: ShieldCheck,     primary: `${qc.passRate} pass rate`,               alert: qc.openHolds,               alertLabel: "holds",         accent: "text-green-400"   },
    { to: "/returns",   label: "Returns",   icon: Undo2,           primary: `${returns_.openRmas} open RMAs`,         alert: returns_.pendingInspection, alertLabel: "to inspect",    accent: "text-orange-400"  },
    { to: "/labor",     label: "Labor",     icon: Users,           primary: `${labor.onShift} on shift`,              alert: labor.onBreak,              alertLabel: "on break",      accent: "text-sky-400"     },
  ];

  const totalExceptions = inbound.discrepancies + putaway.blocked + picking.shorts + packing.rework + outbound.exceptionsOpen + yard.dwellAlerts + qc.openHolds + orderKpis.exceptions;

  const exceptions = [
    { to: "/inbound",  label: "Inbound discrepancies",  count: inbound.discrepancies,     icon: ArrowDownToLine },
    { to: "/putaway",  label: "Putaway blocked tasks",  count: putaway.blocked,            icon: PackageOpen     },
    { to: "/orders",   label: "Order exceptions",       count: orderKpis.exceptions,       icon: ShoppingCart    },
    { to: "/picking",  label: "Pick shortages",         count: picking.shorts,             icon: PackageSearch   },
    { to: "/packing",  label: "Carton rework",          count: packing.rework,             icon: PackageCheck    },
    { to: "/outbound", label: "Outbound exceptions",    count: outbound.exceptionsOpen,    icon: Truck           },
    { to: "/yard",     label: "Yard dwell alerts",      count: yard.dwellAlerts,           icon: Container       },
    { to: "/qc",       label: "QC holds",               count: qc.openHolds,               icon: ShieldCheck     },
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
          <KPICard label="DISPATCHED TODAY"  value={outbound.dispatched}                 tone="success"     icon={Truck}         sub={`${outbound.slaCompliance} SLA`}        />
          <KPICard label="PICKED TODAY"      value={picking.pickedToday.toLocaleString()} tone="primary"    icon={TrendingUp}    sub={`${picking.pickAccuracy} accuracy`}     />
          <KPICard label="RECEIVED TODAY"    value={inbound.receivedToday}               tone="info"        icon={ArrowDownToLine} sub={`${inbound.openAsns} open ASNs`}     />
          <KPICard label="ORDERS IN FLIGHT"  value={orderKpis.inFulfillment}             tone="warning"     icon={ShoppingCart}  sub={`${orderKpis.newOrders} new`}           />
          <KPICard label="OPEN EXCEPTIONS"   value={totalExceptions}                     tone="destructive" icon={AlertTriangle} sub="across all modules"                     />
          <KPICard label="WORKFORCE"         value={labor.onShift}                       tone="success"     icon={Users}         sub={`${labor.avgUph} avg UPH`}              />
        </div>

        {/* Module health grid */}
        <Panel title="MODULE HEALTH" className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-border/40">
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

        {/* Row 3: Throughput + Occupancy */}
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

        {/* Row 4: Order Fulfillment + Inventory Overview + Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <OrderFulfillmentPanel />
          <InventoryOverviewPanel />
          <LowStockPanel height={280} />
        </div>

        {/* Row 5: Exceptions + Zone Util + Live Feed */}
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
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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

        {/* Row 6: Transaction strip + quick actions */}
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
                { to: "/orders"    as const, label: "Create Order",     icon: ShoppingCart,    color: "text-blue-400"    },
                { to: "/inbound"   as const, label: "Receive Inbound",  icon: ArrowDownToLine, color: "text-emerald-400" },
                { to: "/inventory" as const, label: "New Transaction",  icon: ArrowLeftRight,  color: "text-primary"     },
                { to: "/builder"   as const, label: "3D Warehouse",     icon: Warehouse,       color: "text-amber-400"   },
              ].map(({ to, label, icon: Icon, color }) => (
                <Link key={to} to={to} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-sidebar-accent border border-border/40 text-xs font-medium transition-colors">
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
    { label: "Occupied", n: occupied - blocked, c: "var(--color-primary)",     dot: "bg-primary" },
    { label: "Blocked",  n: blocked,             c: "var(--color-destructive)", dot: "bg-destructive" },
    { label: "Free",     n: free,                c: "var(--color-secondary)",   dot: "bg-muted-foreground/40" },
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
              <span className="text-2xl font-black font-mono tabular-nums" style={{ color: tone }}>{pct}%</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">utilization</span>
            </div>
          </div>
          {/* Legend */}
          <div className="flex-1 space-y-2">
            {segs.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-sm shrink-0", s.dot)} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <span className={cn("text-xs font-bold font-mono tabular-nums", s.label === "Blocked" && s.n > 0 ? "text-red-400" : "text-foreground")}>
                  {s.n.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Segmented bar */}
        <div className="h-2.5 rounded-full overflow-hidden flex bg-secondary">
          {segs.map((s) => total > 0 && (
            <div key={s.label} className="h-full transition-all" style={{ width: `${(s.n / total) * 100}%`, background: s.c }} />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground -mt-1">
          <span>{total.toLocaleString()} total bins</span>
          <span>{free.toLocaleString()} available</span>
        </div>
        {/* Footer tiles */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <div className="bg-secondary/60 rounded-lg p-2 text-center">
            <div className="text-base font-black font-mono text-emerald-400">{docksOpen}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">Docks open</div>
          </div>
          <div className="bg-secondary/60 rounded-lg p-2 text-center">
            <div className="text-base font-black font-mono text-sky-400">{onShift}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">On shift</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ─── Inventory Manager ────────────────────────────────────────────────────────
function InventoryDashboard() {
  const stockKpisFn = useStockStore((s) => s.kpis);
  const stock = useStockStore((s) => s.stock);
  const skuKpisFn = useSkuStore((s) => s.kpis);
  const skus = useSkuStore((s) => s.skus);
  const stockKpis = useMemo(() => stockKpisFn(), [stock]); // eslint-disable-line react-hooks/exhaustive-deps
  const skuKpis = useMemo(() => skuKpisFn(), [skus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={BarChart3} title="Inventory Management" subtitle="Stock levels · SKU catalog · cycle count"
        actions={<Link to="/inventory" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><Boxes className="h-4 w-4" /> Open Inventory</Link>} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="TOTAL SKUs"     value={skuKpis.total}                         tone="info"        icon={Boxes}          />
          <KPICard label="ON-HAND UNITS"  value={stockKpis.totalOnHand.toLocaleString()} tone="success"    icon={Package}        sub="across all bins"  />
          <KPICard label="RESERVED"       value={stockKpis.totalReserved.toLocaleString()} tone="warning"  icon={Clock}          sub="for orders"       />
          <KPICard label="LOW STOCK"      value={skuKpis.lowStock}                      tone={skuKpis.lowStock > 0 ? "destructive" : "success"} icon={AlertTriangle} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LowStockPanel height={320} />
          <Panel title="TRANSACTION SUMMARY" className="h-[320px]">
            <div className="px-4 py-3 space-y-3"><TxnMiniKPIs /><Link to="/inventory" className="block text-[10px] text-primary hover:underline font-medium text-right">Open Transaction Log →</Link></div>
          </Panel>
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
          <KPICard label="OPEN ASNs"       value={kpis.openAsns}      tone="info"        icon={Truck}          sub="awaiting completion" />
          <KPICard label="RECEIVED TODAY"  value={kpis.receivedToday} tone="success"     icon={CheckCircle2}   />
          <KPICard label="DOCKED NOW"      value={kpis.dockedNow}     tone="primary"     icon={Warehouse}      sub="at door" />
          <KPICard label="DISCREPANCIES"   value={kpis.discrepancies} tone="destructive" icon={AlertTriangle}  sub="open exceptions" />
        </div>
        <Panel title="RECEIVED TRANSACTIONS" className="h-[280px]"><TransactionLiveFeed limit={7} /></Panel>
      </div>
    </div>
  );
}

// ─── Outbound Supervisor ──────────────────────────────────────────────────────
function OutboundDashboard() {
  const kpis = useOutboundStore((s) => s.kpis)();
  const orderKpisFn = useOrdersStore((s) => s.kpis);
  const orders = useOrdersStore((s) => s.orders);
  const orderKpis = useMemo(() => orderKpisFn(), [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ArrowUpFromLine} title="Outbound Operations" subtitle="Shipment planning · loading · dispatch"
        actions={<Link to="/outbound" className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><Truck className="h-4 w-4" /> Open Outbound</Link>} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="DISPATCHED"      value={kpis.dispatched}    tone="success" icon={CheckCircle2}  sub="today"         />
          <KPICard label="STAGED"          value={kpis.staged}        tone="info"    icon={Activity}      sub="at dock"       />
          <KPICard label="LOADING"         value={kpis.loading}       tone="warning" icon={Package}       sub="trucks active" />
          <KPICard label="SLA COMPLIANCE"  value={kpis.slaCompliance} tone="primary" icon={Gauge}         sub="on-time"       />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OrderFulfillmentPanel />
          <Panel title="OUTBOUND MOVEMENTS" className="h-[280px]"><TransactionLiveFeed limit={7} /></Panel>
        </div>
      </div>
    </div>
  );
}

// ─── Picker ───────────────────────────────────────────────────────────────────
function PickerDashboard({ name }: { name: string }) {
  const kpis = usePickingStore((s) => s.kpis)();
  const activePickTasksFn = usePickingStore((s) => s.activePickTasks);
  const waves = usePickingStore((s) => s.waves);
  const myTasks = useMemo(() => activePickTasksFn().slice(0, 6), [waves]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={PackageSearch} title={`Picker — ${name}`} subtitle="Your active pick tasks"
        actions={
          <div className="flex gap-2">
            <Link to="/scan-pick" className="px-3 py-2 rounded bg-emerald-600 text-white text-sm font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Scan Pick</Link>
            <Link to="/picking"   className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><PackageSearch className="h-4 w-4" /> Open Picking</Link>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="OPEN PICKS"    value={kpis.openPicks}                    tone="primary"  icon={PackageSearch} sub="lines outstanding"  />
          <KPICard label="PICKED TODAY"  value={kpis.pickedToday.toLocaleString()} tone="success"  icon={CheckCircle2}  />
          <KPICard label="ACCURACY"      value={kpis.pickAccuracy}                 tone="info"     icon={Gauge}         />
          <KPICard label="UNITS/HR"      value={kpis.avgPicksPerHour}              tone="warning"  icon={TrendingUp}    />
        </div>
        <Panel title="ACTIVE PICK TASKS" className="h-[260px] p-0">
          <div className="divide-y divide-border/30 overflow-y-auto h-full">
            {myTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
                <span className="text-sm">No open pick tasks</span>
                <Link to="/picking" className="text-xs text-primary hover:underline">Check Picking module →</Link>
              </div>
            ) : (
              myTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn("h-2 w-2 rounded-full shrink-0",
                    t.status === "IN_PROGRESS" ? "bg-amber-400" :
                    t.status === "ASSIGNED"    ? "bg-blue-400"  : "bg-muted-foreground/50"
                  )} />
                  <span className="font-mono text-xs font-bold text-primary w-28 shrink-0">{t.binCode}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{t.skuCode} · {t.skuName}</span>
                  <span className="text-xs font-bold font-mono tabular-nums">{t.qtyRequired} {t.uom}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{t.waveNumber}</span>
                </div>
              ))
            )}
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
        actions={
          <div className="flex gap-2">
            <Link to="/scan-putaway" className="px-3 py-2 rounded bg-emerald-600 text-white text-sm font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Scan Putaway</Link>
            <Link to="/putaway"      className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><PackageOpen className="h-4 w-4" /> Open Putaway</Link>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="OPEN TASKS"   value={kpis.open}           tone="primary"     icon={Forklift}      sub="awaiting dispatch" />
          <KPICard label="IN PROGRESS"  value={kpis.inProgress}     tone="warning"     icon={Activity}      />
          <KPICard label="DONE TODAY"   value={kpis.completedToday} tone="success"     icon={CheckCircle2}  />
          <KPICard label="BLOCKED"      value={kpis.blocked}        tone="destructive" icon={AlertTriangle} />
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
          <KPICard label="OPEN HOLDS"     value={kpis.openHolds}     tone="warning"     icon={AlertTriangle}  sub="quarantined"  />
          <KPICard label="PASS RATE"      value={kpis.passRate}      tone="success"     icon={CheckCircle2}   />
          <KPICard label="FAILED"         value={kpis.failed}        tone="destructive" icon={AlertTriangle}  />
          <KPICard label="PENDING REVIEW" value={kpis.pendingReview} tone="info"        icon={Clock}          />
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
        actions={
          <div className="flex gap-2">
            <Link to="/scan-pack" className="px-3 py-2 rounded bg-emerald-600 text-white text-sm font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Scan Pack</Link>
            <Link to="/packing"   className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Open Packing</Link>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="PACKED TODAY"     value={kpis.cartonsPacked} tone="primary"     icon={PackageCheck} />
          <KPICard label="ACTIVE STATIONS"  value={kpis.activeStations} tone="success"   icon={Activity}     />
          <KPICard label="PENDING LABEL"    value={kpis.pendingLabel}  tone="warning"     icon={Clock}        />
          <KPICard label="REWORK"           value={kpis.rework}        tone="destructive" icon={AlertTriangle} />
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
          <KPICard label="TRUCKS IN YARD" value={kpis.inYard}                      tone="primary" icon={Truck}      />
          <KPICard label="DOCKED"         value={kpis.dockedIn + kpis.dockedOut}   tone="success" icon={Warehouse}  sub={`${kpis.availableDocks} open`} />
          <KPICard label="AVG DWELL"      value={kpis.avgDwell}                    tone="warning" icon={Clock}      />
          <KPICard label="DWELL ALERTS"   value={kpis.dwellAlerts}                 tone="destructive" icon={AlertTriangle} />
        </div>
        <Panel title="LIVE TRANSACTION FEED" className="h-[260px]"><TransactionLiveFeed limit={7} /></Panel>
      </div>
    </div>
  );
}

// ─── Auditor ──────────────────────────────────────────────────────────────────
function AuditorDashboard() {
  const txnKpisFn = useTransactionStore((s) => s.kpis);
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName);
  const transactions = useTransactionStore((s) => s.transactions);
  const txnKpis = useMemo(() => txnKpisFn(activeWarehouseName ?? undefined), [transactions, activeWarehouseName]); // eslint-disable-line react-hooks/exhaustive-deps

  const skuKpisFn = useSkuStore((s) => s.kpis);
  const skus = useSkuStore((s) => s.skus);
  const skuKpis = useMemo(() => skuKpisFn(), [skus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader icon={ShieldCheck} title="Audit & Compliance" subtitle="Full transaction audit trail" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="AUDIT EVENTS"    value={txnKpis.total}                     tone="primary" icon={Activity}     sub="all time"          />
          <KPICard label="TODAY"           value={txnKpis.today}                     tone="info"    icon={CheckCircle2} sub="transactions"      />
          <KPICard label="PENDING"         value={txnKpis.pending}                   tone={txnKpis.pending > 0 ? "warning" : "success"} icon={Clock} sub="awaiting post" />
          <KPICard label="SKU CATALOG"     value={skuKpis.total}                     tone="info"    icon={Boxes}        sub="registered SKUs"   />
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
