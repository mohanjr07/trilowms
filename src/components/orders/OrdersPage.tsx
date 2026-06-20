/**
 * TriloWMS — Orders Module
 * Order intake (manual + CSV import), stock allocation/reservation, and
 * lifecycle tracking. Allocation feeds the Picking module downstream.
 */

import { useMemo, useState } from "react";
import {
  ClipboardList, Search, X, ChevronRight, Plus, Upload, AlertTriangle,
  LayoutDashboard, ListChecks, FilePlus2, Trash2, Zap, Package, Truck, Hash, User,
  MapPin, Clock, FileDown, Boxes, Circle, CheckCircle, Layers, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  useOrdersStore, ORDER_STATUS_META,
  type Order, type OrderStatus, type OrderPriority, type OrderLineInput, type AllocStatus,
} from "@/lib/orders-store";
import { usePickingStore } from "@/lib/picking-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

const fmtNum = (n: number) => n.toLocaleString();
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function dueLabel(iso: string): { text: string; tone: "ok" | "warn" | "late" } {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (diffMin >= 0) return { text: diffMin < 60 ? `${diffMin}m left` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m left`, tone: diffMin < 120 ? "warn" : "ok" };
  const late = -diffMin;
  return { text: late < 60 ? `${late}m over SLA` : `${Math.floor(late / 60)}h over SLA`, tone: "late" };
}

const PRIORITY_META: Record<OrderPriority, { label: string; cls: string }> = {
  RUSH:   { label: "Rush",   cls: "text-red-400 bg-red-500/10" },
  NORMAL: { label: "Normal", cls: "text-slate-400 bg-slate-500/10" },
};
const ALLOC_META: Record<AllocStatus, { label: string; cls: string }> = {
  UNALLOCATED: { label: "Unallocated", cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
  PARTIAL:     { label: "Partial",     cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  ALLOCATED:   { label: "Allocated",   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
};
const TIMELINE: OrderStatus[] = ["NEW", "ALLOCATED", "PICKING", "PACKED", "SHIPPED", "DELIVERED"];
const TIMELINE_LABEL: Record<string, string> = { NEW: "Created", ALLOCATED: "Allocated", PICKING: "Picking", PACKED: "Packed", SHIPPED: "Shipped", DELIVERED: "Delivered" };

function StatusBadge({ status }: { status: OrderStatus }) {
  const m = ORDER_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}
function PriorityTag({ p }: { p: OrderPriority }) {
  const m = PRIORITY_META[p];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide", m.cls)}>{m.label}</span>;
}
function AllocTag({ s }: { s: AllocStatus }) {
  const m = ALLOC_META[s];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border tracking-wide", m.cls)}>{m.label}</span>;
}

function Section({ title, sub, actions, children, className }: {
  title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("panel rounded-md flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
        <div className="min-w-0">
          <h3 className="text-[11px] font-bold tracking-wider uppercase truncate">{title}</h3>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2 rounded border border-border/60 bg-card/40">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold font-mono tabular-nums", tone)}>{value}</span>
    </div>
  );
}

function StatusFunnelChart() {
  const funnel = useOrdersStore((s) => s.statusFunnel)();
  const data = funnel.map((f) => ({ status: ORDER_STATUS_META[f.status].label, count: f.count }));
  return (
    <Section title="Order Funnel" sub="Orders across the fulfillment flow" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="status" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function RecentOrders({ onOpen }: { onOpen: (o: Order) => void }) {
  const orders = useOrdersStore((s) => s.orders);
  const recent = useMemo(() => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [orders]);
  return (
    <Section title="Recent Orders" sub={`${orders.length} total in system`} className="h-full">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
        {recent.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"><Package className="h-8 w-8 opacity-30" /><span className="text-sm">No orders yet — create one to begin.</span></div>
        )}
        {recent.map((o) => (
          <button key={o.id} onClick={() => onOpen(o)} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20">
            <span className="font-mono text-xs text-primary w-24 shrink-0">{o.orderNumber}</span>
            <span className="text-xs flex-1 min-w-0 truncate">{o.customer}</span>
            <span className="text-[11px] text-muted-foreground font-mono shrink-0">{o.totalUnits}u</span>
            <StatusBadge status={o.status} />
          </button>
        ))}
      </div>
    </Section>
  );
}

function OverviewView({ onOpen }: { onOpen: (o: Order) => void }) {
  const kpis = useOrdersStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="NEW ORDERS" value={kpis.newOrders} tone="primary" sub="awaiting allocation" />
        <KPICard label="ALLOCATED" value={kpis.allocated} tone="info" sub="ready to pick" />
        <KPICard label="IN FULFILLMENT" value={kpis.inFulfillment} tone="warning" sub="picking / packed" />
        <KPICard label="SHIPPED TODAY" value={kpis.shipped} tone="success" sub="outbound" />
        <KPICard label="EXCEPTIONS" value={kpis.exceptions} tone="destructive" sub="allocation conflicts" />
        <KPICard label="FILL RATE" value={kpis.fulfillmentRate} tone="success" sub="clean fulfillment" />
        <KPICard label="AVG CYCLE" value={kpis.avgCycleHrs} tone="info" sub="order → shipped" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusFunnelChart />
        <RecentOrders onOpen={onOpen} />
      </div>
    </div>
  );
}

function OrderQueueView({ onOpen }: { onOpen: (o: Order) => void }) {
  const { filters, setFilters, resetFilters, page, setPage, pageSize } = useOrdersStore();
  const all = useOrdersStore((s) => s.filteredOrders)();
  const customers = useOrdersStore((s) => s.customerList)();
  const bulkAllocate = useOrdersStore((s) => s.bulkAllocate);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.customer || filters.priority;

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectableOnPage = paged.filter((o) => o.status === "NEW").map((o) => o.id);
  const allSel = selectableOnPage.length > 0 && selectableOnPage.every((id) => selected.has(id));

  return (
    <Section
      title="Order Queue"
      sub={`${all.length} orders matched`}
      actions={
        <div className="flex items-center gap-2">
          {selected.size > 0 && <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { bulkAllocate([...selected]); setSelected(new Set()); }}><Zap className="h-3.5 w-3.5" /> Bulk allocate ({selected.size})</Button>}
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search order or customer…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as OrderStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(ORDER_STATUS_META) as OrderStatus[]).map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.customer || "all"} onValueChange={(v) => setFilters({ customer: v === "all" ? "" : v })}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Customer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v as OrderPriority })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            <SelectItem value="RUSH">Rush</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3 w-8"><input type="checkbox" checked={allSel} onChange={() => setSelected(allSel ? new Set() : new Set(selectableOnPage))} className="accent-primary" /></th>
              <th className="text-left font-semibold py-2.5 px-3">Order #</th>
              <th className="text-left font-semibold py-2.5 px-3">Customer</th>
              <th className="text-left font-semibold py-2.5 px-3">Channel</th>
              <th className="text-right font-semibold py-2.5 px-3">Lines</th>
              <th className="text-right font-semibold py-2.5 px-3">Units</th>
              <th className="text-left font-semibold py-2.5 px-3 w-32">Allocated</th>
              <th className="text-left font-semibold py-2.5 px-3">Due (SLA)</th>
              <th className="text-left font-semibold py-2.5 px-3">Priority</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((o) => {
              const pct = o.totalUnits > 0 ? Math.round((o.allocatedUnits / o.totalUnits) * 100) : 0;
              const due = dueLabel(o.dueBy);
              const isOpen = !["SHIPPED", "DELIVERED", "CANCELLED"].includes(o.status);
              return (
                <tr key={o.id} className="hover:bg-accent/20 transition-colors">
                  <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                    {o.status === "NEW" ? <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="accent-primary" /> : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap cursor-pointer" onClick={() => onOpen(o)}>{o.orderNumber}</td>
                  <td className="py-2 px-3 cursor-pointer max-w-40 truncate" onClick={() => onOpen(o)}>{o.customer}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">{o.channel}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{o.totalLines}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{fmtNum(o.totalUnits)}</td>
                  <td className="py-2 px-3"><div className="flex items-center gap-2"><Progress value={pct} className="h-1.5 w-14 shrink-0" /><span className="text-[11px] font-mono tabular-nums w-8 text-right">{pct}%</span></div></td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="text-xs font-mono tabular-nums">{fmtDateTime(o.dueBy)}</div>
                    {isOpen && <div className={cn("text-[10px]", due.tone === "ok" ? "text-muted-foreground" : due.tone === "warn" ? "text-amber-400" : "text-red-400")}>{due.text}</div>}
                  </td>
                  <td className="py-2 px-3"><PriorityTag p={o.priority} /></td>
                  <td className="py-2 px-3"><StatusBadge status={o.status} /></td>
                  <td className="py-2 px-2 cursor-pointer" onClick={() => onOpen(o)}><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
            {paged.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-sm text-muted-foreground">No orders match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs text-muted-foreground">
        <span className="font-mono">Showing {paged.length} of {all.length}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</Button>
          <span className="px-3 font-mono tabular-nums">{page} / {total}</span>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= total} onClick={() => setPage(page + 1)}>Next ›</Button>
        </div>
      </div>
    </Section>
  );
}

function CreateOrderView({ onCreated }: { onCreated: (o: Order) => void }) {
  const createOrder = useOrdersStore((s) => s.createOrder);
  const importOrders = useOrdersStore((s) => s.importOrders);
  const [mode, setMode] = useState<"manual" | "import">("manual");

  const [customer, setCustomer] = useState("");
  const [channel, setChannel] = useState("Web");
  const [shipping, setShipping] = useState("Standard Ground");
  const [priority, setPriority] = useState<OrderPriority>("NORMAL");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<OrderLineInput[]>([{ skuCode: "", skuName: "", uom: "EA", requestedQty: 1 }]);

  const setLine = (i: number, patch: Partial<OrderLineInput>) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines((ls) => [...ls, { skuCode: "", skuName: "", uom: "EA", requestedQty: 1 }]);
  const rmLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const validManual = !!(customer.trim() && address.trim() && lines.some((l) => l.skuCode.trim() && l.requestedQty > 0));
  const totalUnits = lines.reduce((s, l) => s + (l.requestedQty || 0), 0);

  const submitManual = () => {
    if (!validManual) return;
    const o = createOrder({
      customer: customer.trim(), channel, shippingMethod: shipping, priority, shipToAddress: address.trim(),
      lines: lines.filter((l) => l.skuCode.trim() && l.requestedQty > 0).map((l) => ({ ...l, skuName: l.skuName.trim() || l.skuCode.trim() })),
    });
    setCustomer(""); setAddress(""); setLines([{ skuCode: "", skuName: "", uom: "EA", requestedQty: 1 }]);
    onCreated(o);
  };

  const [csv, setCsv] = useState("");
  const parsed = useMemo(() => {
    return csv.split("\n").map((row) => row.trim()).filter(Boolean).map((row) => {
      const [c, skuCode, skuName, qty] = row.split(",").map((x) => x.trim());
      return { customer: c || "", skuCode: skuCode || "", skuName: skuName || skuCode || "", qty: parseInt(qty) || 0 };
    }).filter((r) => r.customer && r.skuCode && r.qty > 0);
  }, [csv]);
  const importCount = new Set(parsed.map((p) => p.customer)).size;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2">
        <Section title="Create Order" sub="Manual entry or CSV import" actions={
          <div className="flex rounded-md border border-border overflow-hidden">
            <button onClick={() => setMode("manual")} className={cn("px-3 py-1 text-xs font-medium", mode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Manual</button>
            <button onClick={() => setMode("import")} className={cn("px-3 py-1 text-xs font-medium", mode === "import" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>CSV Import</button>
          </div>
        }>
          {mode === "manual" ? (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Customer *</span>
                  <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Acme Retail Co." className="h-9 mt-1 text-sm" /></label>
                <label className="block"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Channel</span>
                  <Select value={channel} onValueChange={setChannel}><SelectTrigger className="h-9 mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Web", "EDI", "Phone", "Marketplace", "Wholesale"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></label>
                <label className="block"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Shipping method</span>
                  <Select value={shipping} onValueChange={setShipping}><SelectTrigger className="h-9 mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Standard Ground", "2-Day Air", "Overnight", "Freight LTL", "Same Day"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></label>
                <label className="block"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Priority</span>
                  <Select value={priority} onValueChange={(v) => setPriority(v as OrderPriority)}><SelectTrigger className="h-9 mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="RUSH">Rush</SelectItem></SelectContent></Select></label>
                <label className="block col-span-2"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ship-to address *</span>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="1200 Industrial Pkwy, Columbus OH 43219" className="h-9 mt-1 text-sm" /></label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Line items</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={addLine}><Plus className="h-3.5 w-3.5" /> Add line</Button>
                </div>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={l.skuCode} onChange={(e) => setLine(i, { skuCode: e.target.value })} placeholder="SKU code" className="h-8 text-sm font-mono w-32" />
                      <Input value={l.skuName} onChange={(e) => setLine(i, { skuName: e.target.value })} placeholder="Description" className="h-8 text-sm flex-1" />
                      <Input type="number" value={l.requestedQty} onChange={(e) => setLine(i, { requestedQty: parseInt(e.target.value) || 0 })} className="h-8 text-sm w-20" />
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => rmLine(i)} disabled={lines.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="text-xs text-muted-foreground font-mono">{lines.filter((l) => l.skuCode).length} lines · {totalUnits} units</span>
                <Button disabled={!validManual} onClick={submitManual} className="gap-1"><FilePlus2 className="h-4 w-4" /> Create order</Button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="text-[11px] text-muted-foreground">Paste rows as <span className="font-mono text-foreground">customer, skuCode, description, qty</span> — one line per order line. Rows with the same customer group into one order.</div>
              <textarea
                value={csv} onChange={(e) => setCsv(e.target.value)} rows={8}
                placeholder={"Acme Retail, SKU-1001, Widget A, 12\nAcme Retail, SKU-1002, Widget B, 5\nGlobex, SKU-2001, Gizmo, 20"}
                className="w-full rounded-md border border-border bg-card/40 p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="text-xs text-muted-foreground font-mono">{parsed.length} valid rows · {importCount} orders</span>
                <Button disabled={parsed.length === 0} onClick={() => { importOrders(parsed); setCsv(""); }} className="gap-1"><Upload className="h-4 w-4" /> Import{parsed.length > 0 ? ` (${importCount})` : ""}</Button>
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section title={mode === "manual" ? "Order Preview" : "Import Preview"} sub="Validation before commit" className="h-fit">
        <div className="p-4">
          {mode === "manual" ? (
            <div className="space-y-2">
              <MiniStat label="Customer" value={customer || "—"} />
              <MiniStat label="Priority" value={PRIORITY_META[priority].label} />
              <MiniStat label="Lines" value={`${lines.filter((l) => l.skuCode).length}`} />
              <MiniStat label="Total units" value={`${totalUnits}`} />
              <div className={cn("text-xs mt-2 px-3 py-2 rounded border", validManual ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "text-amber-400 border-amber-500/30 bg-amber-500/5")}>
                {validManual ? "Ready to create" : "Fill customer, address & at least one line"}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {parsed.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Paste rows to preview.</div>}
              {parsed.slice(0, 30).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-background/30 border border-border/40">
                  <span className="text-muted-foreground truncate flex-1">{r.customer}</span>
                  <span className="font-mono text-primary">{r.skuCode}</span>
                  <span className="font-mono tabular-nums">×{r.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium mt-1 font-mono tabular-nums break-words">{value}</div>
    </div>
  );
}

function OrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useOrdersStore((s) => s.orders.find((o) => o.id === orderId)) ?? null;
  const { autoAllocate, setLineAllocation, updateStatus, cancelOrder, linkPickWave } = useOrdersStore();
  const createWaveFromOrder = usePickingStore((s) => s.createWaveFromOrder);
  const [tab, setTab] = useState("alloc");
  if (!order) return null;

  const pct = order.totalUnits > 0 ? Math.round((order.allocatedUnits / order.totalUnits) * 100) : 0;
  const hasConflict = order.lines.some((l) => l.allocStatus === "PARTIAL") || order.status === "EXCEPTION";
  const flowIdx = TIMELINE.indexOf(order.status === "EXCEPTION" ? "ALLOCATED" : order.status);
  const next: Record<string, OrderStatus> = { PICKING: "PACKED", PACKED: "SHIPPED", SHIPPED: "DELIVERED" };

  const releaseToPicking = () => {
    const wave = createWaveFromOrder({
      sourceOrderId: order.id,
      orderNumber: order.orderNumber,
      priority: order.priority === "RUSH" ? "RUSH" : "STANDARD",
      carrier: order.carrier ?? undefined,
      dueBy: order.dueBy,
      lines: order.lines.filter((l) => l.allocatedQty > 0).map((l) => ({ skuCode: l.skuCode, skuName: l.skuName, uom: l.uom, qty: l.allocatedQty })),
    });
    linkPickWave(order.id, wave.waveNumber);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{order.orderNumber}</span>
            <StatusBadge status={order.status} />
            <PriorityTag p={order.priority} />
          </div>
          <div className="text-sm text-muted-foreground mt-1">{order.customer} · {order.channel} · {order.shippingMethod}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="h-4 w-4" /></Button>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Lines" value={`${order.totalLines}`} />
          <MiniStat label="Units" value={fmtNum(order.totalUnits)} />
          <MiniStat label="Allocated" value={fmtNum(order.allocatedUnits)} tone="text-emerald-400" />
          <MiniStat label="Due" value={new Date(order.dueBy).toLocaleDateString([], { month: "short", day: "numeric" })} />
        </div>
        <div><div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Allocation</span><span className="font-mono">{pct}%</span></div><Progress value={pct} className="h-2" /></div>

        {hasConflict && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-medium"><AlertTriangle className="h-4 w-4" /> Allocation conflict</div>
            <div className="text-[11px] text-muted-foreground mt-1">Some lines can't be fully reserved. Choose how to proceed:</div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(order.id, "ALLOCATED")}>Ship partial now</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(order.id, "NEW")}>Backorder shortfall</Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {order.status === "NEW" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => autoAllocate(order.id)}><Zap className="h-3.5 w-3.5" /> Auto-allocate</Button>}
          {order.status === "ALLOCATED" && <Button size="sm" className="h-8 text-xs gap-1" onClick={releaseToPicking}><Send className="h-3.5 w-3.5" /> Release to picking</Button>}
          {next[order.status] && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => updateStatus(order.id, next[order.status])}>{order.status === "PACKED" ? <Send className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Advance to {ORDER_STATUS_META[next[order.status]].label}</Button>}
          {!["SHIPPED", "DELIVERED", "CANCELLED"].includes(order.status) && <Button size="sm" variant="ghost" className="h-8 text-xs text-red-400 ml-auto" onClick={() => { cancelOrder(order.id); onClose(); }}>Cancel</Button>}
        </div>
        {order.pickWaveNumber && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Layers className="h-3 w-3" /> Pick wave <span className="font-mono text-foreground">{order.pickWaveNumber}</span></div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-5 mt-3 w-fit">
          <TabsTrigger value="alloc" className="text-xs">Lines & Allocation</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">Status</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Details</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <TabsContent value="alloc" className="mt-3 space-y-2">
            {order.lines.map((l) => (
              <div key={l.id} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] font-mono text-muted-foreground">#{l.lineNo}</span><span className="font-mono text-xs text-primary">{l.skuCode}</span><span className="text-xs text-muted-foreground truncate">{l.skuName}</span></div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span>Avail {l.availableQty}</span>
                      <span>Bin {l.binCode ?? "—"}</span>
                    </div>
                  </div>
                  <AllocTag s={l.allocStatus} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                  <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Requested</div><div className="text-sm font-bold font-mono tabular-nums">{l.requestedQty} <span className="text-[9px] text-muted-foreground font-normal">{l.uom}</span></div></div>
                  <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Allocated</div><div className="text-sm font-bold font-mono tabular-nums text-emerald-400">{l.allocatedQty}</div></div>
                  <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Open</div><div className={cn("text-sm font-bold font-mono tabular-nums", l.requestedQty - l.allocatedQty > 0 ? "text-amber-400" : "")}>{l.requestedQty - l.allocatedQty}</div></div>
                </div>
                {order.status === "NEW" && l.allocStatus !== "ALLOCATED" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs w-full mt-2" onClick={() => setLineAllocation(order.id, l.id, Math.min(l.requestedQty, l.availableQty), "PICK-FACE")}>Reserve this line</Button>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <div className="space-y-0">
              {TIMELINE.map((st, i) => {
                const stage = order.stages.find((s) => s.status === st);
                const reached = !!stage || i < flowIdx;
                const current = i === flowIdx && order.status !== "DELIVERED";
                return (
                  <div key={st} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {reached || current ? <CheckCircle className={cn("h-5 w-5", current ? "text-amber-400" : "text-emerald-400")} /> : <Circle className="h-5 w-5 text-muted-foreground/40" />}
                      {i < TIMELINE.length - 1 && <div className={cn("w-0.5 flex-1 min-h-[28px]", reached ? "bg-emerald-500/40" : "bg-border")} />}
                    </div>
                    <div className="pb-4">
                      <div className={cn("text-sm font-medium", reached || current ? "" : "text-muted-foreground")}>{TIMELINE_LABEL[st]}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{stage ? fmtDateTime(stage.ts) : "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {order.status === "EXCEPTION" && <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400 mt-2">Order held — allocation conflict needs resolution above.</div>}
          </TabsContent>

          <TabsContent value="info" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Hash} label="Order" value={order.orderNumber} />
              <DetailRow icon={User} label="Customer code" value={order.customerCode} />
              <DetailRow icon={Layers} label="Channel" value={order.channel} />
              <DetailRow icon={Truck} label="Shipping" value={order.shippingMethod} />
              <DetailRow icon={Clock} label="Created" value={fmtDateTime(order.createdAt)} />
              <DetailRow icon={Clock} label="Due (SLA)" value={`${fmtDateTime(order.dueBy)} (${order.slaHours}h)`} />
              <DetailRow icon={User} label="Created by" value={order.createdBy} />
              <DetailRow icon={Boxes} label="Units" value={`${order.totalUnits}`} />
              {order.pickWaveNumber && <DetailRow icon={Layers} label="Pick wave" value={order.pickWaveNumber} />}
            </div>
            <div className="rounded border border-border/60 bg-card/30 px-3 py-2 mt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><MapPin className="h-3 w-3" /> Ship to</div>
              <div className="text-sm font-medium mt-1">{order.shipToAddress}</div>
            </div>
            {order.notes && <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400 mt-2">{order.notes}</div>}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

type Tab = "overview" | "queue" | "create";
const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview",        icon: LayoutDashboard },
  { id: "queue",    label: "Order Queue",     icon: ListChecks },
  { id: "create",   label: "Create / Import", icon: FilePlus2 },
];

export function OrdersPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const kpis = useOrdersStore((s) => s.kpis)();
  const open = (o: Order) => setOpenId(o.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={ClipboardList}
        title="Orders"
        subtitle="Order intake · stock allocation · fulfillment tracking"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setTab("create")}><Upload className="h-3.5 w-3.5" /> Import</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setTab("create")}><Plus className="h-3.5 w-3.5" /> New order</Button>
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "queue" && kpis.newOrders > 0 ? kpis.newOrders : id === "overview" && kpis.exceptions > 0 ? kpis.exceptions : null;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && <span className={cn("ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums", id === "overview" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview" && <OverviewView onOpen={open} />}
        {tab === "queue"    && <OrderQueueView onOpen={open} />}
        {tab === "create"   && <CreateOrderView onCreated={(o) => { setTab("queue"); open(o); }} />}
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <OrderDrawer orderId={openId} onClose={() => setOpenId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
