/**
 * TriloWMS — Packing Module
 * Pack-station dispatch, carton build, weigh & dimension capture, label /
 * manifest workflow and exception handling.
 */

import { useMemo, useState } from "react";
import {
  PackageCheck, Search, X, ChevronRight, Play, CheckCircle2, AlertTriangle,
  LayoutDashboard, ClipboardList, Monitor, Box, PackageX, Printer, Truck,
  Hash, User, Weight, Ruler, MapPin, Clock, Scale, ScanLine, FileDown, Boxes, Tag, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  usePackingStore, PACK_STATUS_META,
  type PackOrder, type PackOrderStatus, type PackStation, type Carton, type CartonStatus,
} from "@/lib/packing-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers & meta ───────────────────────────────────────────────────────────

const fmtNum = (n: number) => n.toLocaleString();
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const initials = (name: string) => name.split(/[\s.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

function dueLabel(iso: string): { text: string; tone: "ok" | "warn" | "late" } {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (diffMin >= 0) return { text: diffMin < 60 ? `${diffMin}m left` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m left`, tone: diffMin < 60 ? "warn" : "ok" };
  const late = -diffMin;
  return { text: late < 60 ? `${late}m overdue` : `${Math.floor(late / 60)}h overdue`, tone: "late" };
}

const PRIORITY_META: Record<PackOrder["priority"], { label: string; cls: string }> = {
  SAME_DAY: { label: "Same Day", cls: "text-red-400 bg-red-500/10" },
  RUSH:     { label: "Rush",     cls: "text-orange-400 bg-orange-500/10" },
  STANDARD: { label: "Standard", cls: "text-slate-400 bg-slate-500/10" },
};

const STATION_STATUS_META: Record<PackStation["status"], string> = {
  ACTIVE:      "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
  PAUSED:      "border-amber-500/40 bg-amber-500/5 text-amber-400",
  IDLE:        "border-slate-500/40 bg-slate-500/5 text-slate-400",
  MAINTENANCE: "border-red-500/40 bg-red-500/5 text-red-400",
};

const CARTON_STATUS_META: Record<CartonStatus, { label: string; cls: string }> = {
  OPEN:      { label: "Open",      cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
  CLOSED:    { label: "Closed",    cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  LABELLED:  { label: "Labelled",  cls: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" },
  SCANNED:   { label: "Scanned",   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  EXCEPTION: { label: "Exception", cls: "text-red-400 bg-red-500/10 border-red-500/30" },
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PackOrderStatus }) {
  const m = PACK_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}
function PriorityTag({ p }: { p: PackOrder["priority"] }) {
  const m = PRIORITY_META[p];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide", m.cls)}>{m.label}</span>;
}
function CartonStatusTag({ status }: { status: CartonStatus }) {
  const m = CARTON_STATUS_META[status];
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

// ════════════════════════════════════════════════════════════════════════════
//  OVERVIEW
// ════════════════════════════════════════════════════════════════════════════

function PackThroughputChart() {
  const data = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      hour: `${String((6 + i) % 24).padStart(2, "0")}:00`,
      cartons: Math.floor(18 + Math.abs(Math.sin(i + 1)) * 46),
      rework: i % 4 === 0 ? Math.floor(1 + Math.random() * 3) : Math.floor(Math.random() * 2),
    })),
    [],
  );
  return (
    <Section title="Pack Throughput" sub="Cartons completed vs rework — last 12 hours" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} interval={1} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={32} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="cartons" stackId="a" fill="var(--color-primary)" name="Cartons" />
            <Bar dataKey="rework" stackId="a" fill="var(--color-destructive)" radius={[3, 3, 0, 0]} name="Rework" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function CarrierMixCard() {
  const mix = usePackingStore((s) => s.carrierMix)();
  const total = mix.reduce((s, m) => s + m.count, 0) || 1;
  const colors = ["var(--color-primary)", "var(--color-info)", "var(--color-success)", "var(--color-warning)", "#a78bfa"];
  return (
    <Section title="Carrier Mix" sub="Orders by carrier" className="h-[240px]">
      <div className="p-4 space-y-2.5">
        {mix.map((m, i) => (
          <div key={m.carrier}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors[i % colors.length] }} /> {m.carrier}</span>
              <span className="font-mono tabular-nums text-muted-foreground">{m.count}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(m.count / total) * 100}%`, background: colors[i % colors.length] }} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function StatusFunnelChart() {
  const funnel = usePackingStore((s) => s.statusFunnel)();
  const data = funnel.map((f) => ({ status: PACK_STATUS_META[f.status].label, count: f.count }));
  return (
    <Section title="Order Status Funnel" sub="Orders across the pack-to-dispatch flow" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="status" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={72} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 3, 3, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function StationStrip() {
  const stations = usePackingStore((s) => s.stations);
  return (
    <Section title="Pack Stations" sub={`${stations.filter((s) => s.status === "ACTIVE").length} active of ${stations.length}`} className="h-full">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 overflow-y-auto max-h-[300px]">
        {stations.map((st) => (
          <div key={st.id} className={cn("rounded-lg border p-2.5 flex flex-col gap-1", STATION_STATUS_META[st.status])}>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xs">{st.code}</span>
              <span className="text-[8px] font-semibold uppercase tracking-wider opacity-80">{st.status}</span>
            </div>
            <span className="text-[11px] opacity-90 truncate">{st.operatorName ?? "— unstaffed —"}</span>
            <div className="text-[10px] opacity-60 font-mono">{st.packedToday} today · {st.avgPackTime}m avg</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function OverviewView() {
  const kpis = usePackingStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="ACTIVE STATIONS" value={kpis.activeStations} tone="primary" sub="staffed & running" />
        <KPICard label="CARTONS PACKED" value={fmtNum(kpis.cartonsPacked)} tone="success" delta="↑ on pace" />
        <KPICard label="AVG PACK TIME" value={kpis.avgPackTime} tone="info" sub="per order" />
        <KPICard label="PENDING LABEL" value={kpis.pendingLabel} tone="warning" sub="awaiting print" />
        <KPICard label="REWORK" value={kpis.rework} tone="destructive" sub="cartons flagged" />
        <KPICard label="DISPATCHED" value={kpis.dispatched} tone="success" sub="today" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PackThroughputChart />
        <CarrierMixCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusFunnelChart />
        <StationStrip />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  PACK QUEUE
// ════════════════════════════════════════════════════════════════════════════

function PackQueueView({ onOpen }: { onOpen: (o: PackOrder) => void }) {
  const { filters, setFilters, resetFilters, page, setPage, pageSize } = usePackingStore();
  const all = usePackingStore((s) => s.filteredOrders)();
  const stations = usePackingStore((s) => s.stations);
  const carriers = usePackingStore((s) => s.carrierList)();

  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.priority || filters.carrier || filters.stationId;

  return (
    <Section title="Pack Queue" sub={`${all.length} orders matched`} actions={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search order or customer…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as PackOrderStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(PACK_STATUS_META) as PackOrderStatus[]).map((s) => <SelectItem key={s} value={s}>{PACK_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.carrier || "all"} onValueChange={(v) => setFilters({ carrier: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Carrier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All carriers</SelectItem>
            {carriers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.stationId || "all"} onValueChange={(v) => setFilters({ stationId: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Station" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stations</SelectItem>
            {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.code}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {(Object.keys(PRIORITY_META) as PackOrder["priority"][]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Order #</th>
              <th className="text-left font-semibold py-2.5 px-3">Customer</th>
              <th className="text-center font-semibold py-2.5 px-3">Station</th>
              <th className="text-right font-semibold py-2.5 px-3">Lines</th>
              <th className="text-left font-semibold py-2.5 px-3 w-32">Packed</th>
              <th className="text-right font-semibold py-2.5 px-3">Cartons</th>
              <th className="text-right font-semibold py-2.5 px-3">Weight</th>
              <th className="text-left font-semibold py-2.5 px-3">Carrier</th>
              <th className="text-left font-semibold py-2.5 px-3">Due</th>
              <th className="text-left font-semibold py-2.5 px-3">Priority</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((o) => {
              const pct = o.totalUnits > 0 ? Math.round((o.packedUnits / o.totalUnits) * 100) : 0;
              const due = dueLabel(o.dueBy);
              const active = !["DISPATCHED", "MANIFESTED"].includes(o.status);
              return (
                <tr key={o.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpen(o)}>
                  <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap">{o.orderNumber}</td>
                  <td className="py-2 px-3 whitespace-nowrap max-w-40 truncate">{o.customer}</td>
                  <td className="py-2 px-3 text-center font-mono text-xs">{o.stationCode ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{o.totalLines}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2"><Progress value={pct} className="h-1.5 w-14 shrink-0" /><span className="text-[11px] font-mono tabular-nums w-8 text-right">{pct}%</span></div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{o.cartons.length}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{o.totalWeight}<span className="text-muted-foreground"> kg</span></td>
                  <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{o.carrier} · {o.serviceLevel}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="text-xs font-mono tabular-nums">{fmtDateTime(o.dueBy)}</div>
                    {active && <div className={cn("text-[10px]", due.tone === "ok" ? "text-muted-foreground" : due.tone === "warn" ? "text-amber-400" : "text-red-400")}>{due.text}</div>}
                  </td>
                  <td className="py-2 px-3"><PriorityTag p={o.priority} /></td>
                  <td className="py-2 px-3"><StatusBadge status={o.status} /></td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
            {paged.length === 0 && <tr><td colSpan={12} className="text-center py-12 text-sm text-muted-foreground">No orders match the current filters.</td></tr>}
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

// ════════════════════════════════════════════════════════════════════════════
//  STATIONS
// ════════════════════════════════════════════════════════════════════════════

function StationsView() {
  const stations = usePackingStore((s) => s.stations);
  const orders = usePackingStore((s) => s.orders);
  const maxPacked = Math.max(1, ...stations.map((s) => s.packedToday));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="ACTIVE" value={stations.filter((s) => s.status === "ACTIVE").length} tone="success" sub="running" />
        <KPICard label="PAUSED" value={stations.filter((s) => s.status === "PAUSED").length} tone="warning" sub="on hold" />
        <KPICard label="IDLE" value={stations.filter((s) => s.status === "IDLE").length} tone="info" sub="available" />
        <KPICard label="MAINTENANCE" value={stations.filter((s) => s.status === "MAINTENANCE").length} tone="destructive" sub="down" />
      </div>
      <Section title="Station Board" sub="Live operator assignment, current order and throughput">
        <div className="divide-y divide-border/40">
          {stations.map((st) => {
            const current = st.currentOrderId ? orders.find((o) => o.id === st.currentOrderId) : null;
            return (
              <div key={st.id} className="flex items-center gap-4 px-4 py-3">
                <div className={cn("h-9 w-12 rounded-md border flex items-center justify-center font-mono font-bold text-xs shrink-0", STATION_STATUS_META[st.status])}>{st.code}</div>
                <div className="w-40 shrink-0 min-w-0">
                  <div className="text-sm font-medium truncate">{st.operatorName ?? "Unstaffed"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{current ? `On ${current.orderNumber}` : st.status === "ACTIVE" ? "Awaiting order" : st.status.toLowerCase()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(st.packedToday / maxPacked) * 100}%` }} /></div>
                  <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span>{st.equipment.length} devices</span>
                    {st.lastActivity && <span>Last {fmtTime(st.lastActivity)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 w-20"><div className="text-lg font-bold font-mono tabular-nums">{st.packedToday}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wide">packed</div></div>
                <div className="text-right shrink-0 w-16"><div className="text-lg font-bold font-mono tabular-nums text-cyan-400">{st.avgPackTime}m</div><div className="text-[10px] text-muted-foreground uppercase tracking-wide">avg</div></div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  CARTONS
// ════════════════════════════════════════════════════════════════════════════

function CartonsView() {
  const cartons = usePackingStore((s) => s.allCartons)();
  const [filter, setFilter] = useState("all");
  const filtered = cartons.filter((c) => filter === "all" || c.status === filter);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="TOTAL CARTONS" value={cartons.length} tone="primary" sub="all orders" />
        <KPICard label="LABELLED" value={cartons.filter((c) => c.status === "LABELLED" || c.status === "SCANNED").length} tone="success" sub="ready to ship" />
        <KPICard label="OPEN" value={cartons.filter((c) => c.status === "OPEN").length} tone="warning" sub="being built" />
        <KPICard label="REWORK" value={cartons.filter((c) => c.reworkRequired).length} tone="destructive" sub="flagged" />
      </div>

      <Section
        title="Carton Manifest"
        sub={`${filtered.length} cartons`}
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(CARTON_STATUS_META) as CartonStatus[]).map((s) => <SelectItem key={s} value={s}>{CARTON_STATUS_META[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-semibold py-2.5 px-3">Carton</th>
                <th className="text-left font-semibold py-2.5 px-3">Order</th>
                <th className="text-left font-semibold py-2.5 px-3">Customer</th>
                <th className="text-right font-semibold py-2.5 px-3">Items</th>
                <th className="text-left font-semibold py-2.5 px-3">Dimensions</th>
                <th className="text-right font-semibold py-2.5 px-3">Gross</th>
                <th className="text-left font-semibold py-2.5 px-3">Tracking</th>
                <th className="text-left font-semibold py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.slice(0, 60).map((c) => (
                <tr key={c.id} className="hover:bg-accent/15">
                  <td className="py-2.5 px-3 font-mono text-primary text-xs whitespace-nowrap">{c.cartonCode}{c.reworkRequired && <AlertTriangle className="h-3 w-3 text-red-400 inline ml-1.5" />}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{c.orderNumber}</td>
                  <td className="py-2.5 px-3 max-w-36 truncate">{c.customer}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{c.items.length}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{c.length}×{c.width}×{c.height} cm</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{c.grossWeight} kg</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{c.trackingNumber ?? "—"}</td>
                  <td className="py-2.5 px-3"><CartonStatusTag status={c.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">No cartons in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  EXCEPTIONS
// ════════════════════════════════════════════════════════════════════════════

function ExceptionsView({ onOpen }: { onOpen: (o: PackOrder) => void }) {
  const orders = usePackingStore((s) => s.orders);
  const exceptions = orders.filter((o) => o.status === "EXCEPTION");
  const rework = orders.flatMap((o) => o.cartons.filter((c) => c.reworkRequired).map((c) => ({ carton: c, order: o })));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="ORDER EXCEPTIONS" value={exceptions.length} tone="destructive" sub="held orders" />
        <KPICard label="CARTON REWORK" value={rework.length} tone="warning" sub="re-pack needed" />
        <KPICard label="PENDING LABEL" value={orders.filter((o) => o.status === "PACKED").length} tone="info" sub="awaiting print" />
        <KPICard label="MANIFESTED" value={orders.filter((o) => o.status === "MANIFESTED").length} tone="success" sub="ready to ship" />
      </div>

      <Section title="Held Orders" sub={`${exceptions.length} orders flagged as exceptions`}>
        <div className="divide-y divide-border/40">
          {exceptions.map((o) => (
            <button key={o.id} onClick={() => onOpen(o)} className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-accent/20">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-primary">{o.orderNumber}</span><span className="text-xs text-muted-foreground truncate">{o.customer}</span></div>
                <div className="text-[11px] text-red-400/90 mt-0.5">{o.notes ?? "Exception flagged"}</div>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">{o.stationCode ?? "—"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          {exceptions.length === 0 && <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"><CheckCircle2 className="h-8 w-8 text-emerald-500/40" /><span className="text-sm">No held orders.</span></div>}
        </div>
      </Section>

      <Section title="Carton Rework Queue" sub={`${rework.length} cartons need re-pack`}>
        <div className="divide-y divide-border/40">
          {rework.map(({ carton, order }) => (
            <button key={carton.id} onClick={() => onOpen(order)} className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-accent/20">
              <Box className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-primary">{carton.cartonCode}</span><span className="text-xs text-muted-foreground">{order.orderNumber}</span></div>
                <div className="text-[11px] text-amber-400/90 mt-0.5">{carton.reworkReason}</div>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">{carton.grossWeight} kg</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          {rework.length === 0 && <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"><CheckCircle2 className="h-8 w-8 text-emerald-500/40" /><span className="text-sm">No rework queued.</span></div>}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ORDER DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium mt-1 font-mono tabular-nums break-words">{value}</div>
    </div>
  );
}

function OrderDetailDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = usePackingStore((s) => s.orders.find((o) => o.id === orderId)) ?? null;
  const { startPacking, completeOrder, labelCarton, manifestOrder, dispatchOrder, flagException } = usePackingStore();
  const [tab, setTab] = useState("cartons");

  if (!order) return null;
  const pct = order.totalUnits > 0 ? Math.round((order.packedUnits / order.totalUnits) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{order.orderNumber}</span>
            <StatusBadge status={order.status} />
            <PriorityTag p={order.priority} />
          </div>
          <div className="text-sm text-muted-foreground mt-1">{order.customer} · {order.carrier} {order.serviceLevel}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="h-4 w-4" /></Button>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Lines" value={`${order.totalLines}`} />
          <MiniStat label="Units" value={fmtNum(order.totalUnits)} />
          <MiniStat label="Cartons" value={`${order.cartons.length}`} />
          <MiniStat label="Weight" value={`${order.totalWeight}kg`} />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Pack progress</span><span className="font-mono">{pct}%</span></div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          {["QUEUED", "ASSIGNED"].includes(order.status) && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => startPacking(order.id)}><Play className="h-3.5 w-3.5" /> Start packing</Button>}
          {order.status === "PACKING" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => completeOrder(order.id)}><CheckCircle2 className="h-3.5 w-3.5" /> Complete pack</Button>}
          {order.status === "PACKED" && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => order.cartons[0] && labelCarton(order.id, order.cartons[0].id, `1Z${Date.now().toString().slice(-9)}`)}><Printer className="h-3.5 w-3.5" /> Print labels</Button>}
          {order.status === "LABELLED" && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => manifestOrder(order.id)}><FileText className="h-3.5 w-3.5" /> Add to manifest</Button>}
          {order.status === "MANIFESTED" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => dispatchOrder(order.id)}><Truck className="h-3.5 w-3.5" /> Confirm dispatch</Button>}
          {!["EXCEPTION", "DISPATCHED"].includes(order.status) && <Button size="sm" variant="ghost" className="h-8 text-xs text-red-400 ml-auto" onClick={() => flagException(order.id, "Flagged from pack station")}>Flag exception</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-5 mt-3 w-fit">
          <TabsTrigger value="cartons" className="text-xs">Cartons · {order.cartons.length}</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Shipment</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <TabsContent value="cartons" className="mt-3 space-y-2">
            {order.cartons.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="font-mono text-xs text-primary">{c.cartonCode}</span>{c.reworkRequired && <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 px-1 rounded">Rework</span>}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span>{c.length}×{c.width}×{c.height} cm</span>
                      <span>{c.grossWeight} kg gross</span>
                      <span>Track {c.trackingNumber ?? "—"}</span>
                    </div>
                  </div>
                  <CartonStatusTag status={c.status} />
                </div>
                <div className="mt-2 space-y-1">
                  {c.items.map((it) => (
                    <div key={it.lineId} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-background/30 border border-border/40">
                      <span className="font-mono text-primary">{it.skuCode}</span>
                      <span className="text-muted-foreground truncate flex-1 mx-2">{it.skuName}</span>
                      <span className="font-mono tabular-nums">{it.qtyPacked}/{it.qtyRequired} {it.uom}</span>
                    </div>
                  ))}
                </div>
                {c.reworkReason && <div className="text-[11px] text-red-400 mt-1.5">{c.reworkReason}</div>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="info" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Hash} label="Order" value={order.orderNumber} />
              <DetailRow icon={User} label="Customer" value={order.customer} />
              <DetailRow icon={Truck} label="Carrier" value={`${order.carrier} ${order.serviceLevel}`} />
              <DetailRow icon={Monitor} label="Station" value={order.stationCode ?? "Unassigned"} />
              <DetailRow icon={Tag} label="Packing slip" value={order.packingSlip ?? "—"} />
              <DetailRow icon={Boxes} label="Wave" value={order.waveId ?? "—"} />
              <DetailRow icon={Weight} label="Total weight" value={`${order.totalWeight} kg`} />
              <DetailRow icon={Clock} label="Due by" value={fmtDateTime(order.dueBy)} />
              <DetailRow icon={Clock} label="Started" value={order.startedAt ? fmtDateTime(order.startedAt) : "—"} />
              <DetailRow icon={CheckCircle2} label="Completed" value={order.completedAt ? fmtDateTime(order.completedAt) : "—"} />
            </div>
            <div className="rounded border border-border/60 bg-card/30 px-3 py-2 mt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><MapPin className="h-3 w-3" /> Ship to</div>
              <div className="text-sm font-medium mt-1">{order.shippingAddress}</div>
            </div>
            {order.notes && <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">{order.notes}</div>}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "queue" | "stations" | "cartons" | "exceptions";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",   label: "Overview",   icon: LayoutDashboard },
  { id: "queue",      label: "Pack Queue", icon: ClipboardList },
  { id: "stations",   label: "Stations",   icon: Monitor },
  { id: "cartons",    label: "Cartons",    icon: Box },
  { id: "exceptions", label: "Exceptions", icon: PackageX },
];

export function PackingPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const kpis = usePackingStore((s) => s.kpis)();
  const orders = usePackingStore((s) => s.orders);
  const exceptionCount = orders.filter((o) => o.status === "EXCEPTION").length;

  const open = (o: PackOrder) => setOpenOrderId(o.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={PackageCheck}
        title="Packing"
        subtitle="Pack-station dispatch · carton build · weigh & label · manifest & dispatch"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><Scale className="h-3.5 w-3.5" /> Cartonize</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"><Printer className="h-3.5 w-3.5" /> Print manifest</Button>
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "exceptions" && exceptionCount > 0 ? exceptionCount : id === "queue" && kpis.pendingLabel > 0 ? kpis.pendingLabel : null;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && <span className={cn("ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums", id === "exceptions" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview"   && <OverviewView />}
        {tab === "queue"      && <PackQueueView onOpen={open} />}
        {tab === "stations"   && <StationsView />}
        {tab === "cartons"    && <CartonsView />}
        {tab === "exceptions" && <ExceptionsView onOpen={open} />}
      </div>

      <Sheet open={!!openOrderId} onOpenChange={(o) => !o && setOpenOrderId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <OrderDetailDrawer orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
