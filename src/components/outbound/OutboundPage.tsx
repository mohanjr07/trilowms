/**
 * TriloWMS — Outbound Module
 * Shipment planning, dock staging & truck loading, dispatch & manifest (BOL /
 * PRO / seal), carrier performance and delivery exception handling.
 */

import { useMemo, useState } from "react";
import {
  Truck, Search, X, ChevronRight, CheckCircle2, AlertTriangle, LayoutDashboard,
  ClipboardList, CalendarClock, Building2, PackageX, Ship, MapPin, Hash, User,
  Weight, Boxes, Clock, FileDown, Route, Container, BadgeCheck, Layers, Gauge, Send, RefreshCw, ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useOutboundStore, SHIPMENT_STATUS_META, type Shipment, type ShipmentStatus } from "@/lib/outbound-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers & meta ───────────────────────────────────────────────────────────

const fmtNum = (n: number) => n.toLocaleString();
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function etaLabel(iso: string): { text: string; tone: "ok" | "warn" | "late" } {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (diffMin >= 0) return { text: diffMin < 60 ? `in ${diffMin}m` : `in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`, tone: diffMin < 120 ? "warn" : "ok" };
  const late = -diffMin;
  return { text: late < 60 ? `${late}m late` : `${Math.floor(late / 60)}h late`, tone: "late" };
}

const PRIORITY_META: Record<Shipment["priority"], { label: string; cls: string }> = {
  URGENT: { label: "Urgent", cls: "text-red-400 bg-red-500/10" },
  HIGH:   { label: "High",   cls: "text-orange-400 bg-orange-500/10" },
  NORMAL: { label: "Normal", cls: "text-slate-400 bg-slate-500/10" },
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const m = SHIPMENT_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}
function PriorityTag({ p }: { p: Shipment["priority"] }) {
  const m = PRIORITY_META[p];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide", m.cls)}>{m.label}</span>;
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

function DispatchChart() {
  const funnel = useOutboundStore((s) => s.statusFunnel)();
  const data = funnel.map((f) => ({ name: SHIPMENT_STATUS_META[f.status].label, count: f.count }));
  return (
    <Section title="Dispatch Pipeline" sub="Shipments by stage — plan to delivered" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} interval={0} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Shipments" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function CarrierMixCard() {
  const mix = useOutboundStore((s) => s.carrierMix)();
  const total = mix.reduce((s, m) => s + m.count, 0) || 1;
  const colors = ["var(--color-primary)", "var(--color-info)", "var(--color-success)", "var(--color-warning)", "#a78bfa", "#fb923c"];
  return (
    <Section title="Carrier Mix" sub="Shipments by carrier" className="h-[240px]">
      <div className="p-4 space-y-2.5 overflow-y-auto max-h-[200px]">
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
  const funnel = useOutboundStore((s) => s.statusFunnel)();
  const data = funnel.map((f) => ({ status: SHIPMENT_STATUS_META[f.status].label, count: f.count }));
  return (
    <Section title="Shipment Funnel" sub="Shipments across plan-to-deliver flow" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="status" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={70} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 3, 3, 0]} barSize={13} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function DockBoard({ onOpen }: { onOpen: (s: Shipment) => void }) {
  const shipments = useOutboundStore((s) => s.shipments);
  const docks = useMemo(() => {
    const codes = ["OUT-01", "OUT-02", "OUT-03", "OUT-04", "OUT-05"];
    return codes.map((code) => ({ code, shipment: shipments.find((s) => s.dockCode === code && ["STAGED", "LOADING", "LOADED"].includes(s.status)) ?? null }));
  }, [shipments]);
  return (
    <Section title="Outbound Dock Board" sub="Live door assignment & loading state" className="h-full">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 p-4">
        {docks.map(({ code, shipment }) => (
          <div key={code} className={cn("rounded-lg border p-3 min-h-[120px] flex flex-col gap-1.5",
            !shipment ? "border-emerald-500/30 bg-emerald-500/5" : shipment.status === "LOADING" ? "border-amber-500/40 bg-amber-500/5" : shipment.status === "LOADED" ? "border-cyan-500/40 bg-cyan-500/5" : "border-blue-500/40 bg-blue-500/5")}>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-sm">{code}</span>
              <span className="text-[8px] font-semibold uppercase tracking-wider opacity-70">{shipment?.status ?? "OPEN"}</span>
            </div>
            {shipment ? (
              <button onClick={() => onOpen(shipment)} className="text-left flex-1 flex flex-col gap-0.5">
                <span className="text-xs font-mono text-primary hover:underline">{shipment.shipmentNumber}</span>
                <span className="text-[11px] text-muted-foreground truncate">{shipment.carrier} · {shipment.truckPlate ?? "no truck"}</span>
                <span className="text-[10px] text-muted-foreground font-mono mt-auto">{shipment.totalPallets} plt · {shipment.totalWeight} kg</span>
              </button>
            ) : <span className="text-[11px] opacity-40 flex-1 flex items-center justify-center">— available —</span>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function OverviewView({ onOpen }: { onOpen: (s: Shipment) => void }) {
  const kpis = useOutboundStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="DISPATCHED TODAY" value={kpis.dispatched} tone="success" delta="↑ on plan" />
        <KPICard label="STAGED" value={kpis.staged} tone="info" sub="at dock" />
        <KPICard label="LOADING NOW" value={kpis.loading} tone="warning" sub="trucks active" />
        <KPICard label="DELAYED" value={kpis.delayed} tone="destructive" sub="past schedule" />
        <KPICard label="SLA COMPLIANCE" value={kpis.slaCompliance} tone="success" sub="delivered on time" />
        <KPICard label="TRUCKS LOADING" value={kpis.trucksLoading} tone="info" sub="in dock" />
        <KPICard label="OPEN EXCEPTIONS" value={kpis.exceptionsOpen} tone="destructive" sub="need action" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DispatchChart />
        <CarrierMixCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusFunnelChart />
        <DockBoard onOpen={onOpen} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SHIPMENTS
// ════════════════════════════════════════════════════════════════════════════

function ShipmentsView({ onOpen }: { onOpen: (s: Shipment) => void }) {
  const { filters, setFilters, resetFilters, page, setPage, pageSize } = useOutboundStore();
  const all = useOutboundStore((s) => s.filteredShipments)();
  const carriers = useOutboundStore((s) => s.carrierList)();

  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.carrier || filters.priority;

  return (
    <Section title="Shipments" sub={`${all.length} shipments matched`} actions={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search shipment, carrier or truck…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as ShipmentStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(SHIPMENT_STATUS_META) as ShipmentStatus[]).map((s) => <SelectItem key={s} value={s}>{SHIPMENT_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.carrier || "all"} onValueChange={(v) => setFilters({ carrier: v === "all" ? "" : v })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Carrier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All carriers</SelectItem>
            {carriers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {(Object.keys(PRIORITY_META) as Shipment["priority"][]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Shipment #</th>
              <th className="text-left font-semibold py-2.5 px-3">Carrier</th>
              <th className="text-left font-semibold py-2.5 px-3">Truck</th>
              <th className="text-center font-semibold py-2.5 px-3">Dock</th>
              <th className="text-left font-semibold py-2.5 px-3">Route</th>
              <th className="text-right font-semibold py-2.5 px-3">Orders</th>
              <th className="text-right font-semibold py-2.5 px-3">Pallets</th>
              <th className="text-right font-semibold py-2.5 px-3">Weight</th>
              <th className="text-left font-semibold py-2.5 px-3">Dispatch</th>
              <th className="text-left font-semibold py-2.5 px-3">Priority</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((s) => {
              const eta = etaLabel(s.scheduledDispatch);
              const pending = ["PLANNED", "STAGED", "LOADING", "LOADED"].includes(s.status);
              return (
                <tr key={s.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpen(s)}>
                  <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap">{s.shipmentNumber}</td>
                  <td className="py-2 px-3 text-xs whitespace-nowrap">{s.carrier} <span className="text-muted-foreground">{s.serviceLevel}</span></td>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{s.truckPlate ?? "—"}</td>
                  <td className="py-2 px-3 text-center font-mono text-xs">{s.dockCode ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{s.routeCode ?? "—"}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{s.totalOrders}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{s.totalPallets}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{fmtNum(s.totalWeight)}<span className="text-muted-foreground"> kg</span></td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="text-xs font-mono tabular-nums">{fmtDateTime(s.scheduledDispatch)}</div>
                    {pending && <div className={cn("text-[10px]", eta.tone === "ok" ? "text-muted-foreground" : eta.tone === "warn" ? "text-amber-400" : "text-red-400")}>{eta.text}</div>}
                  </td>
                  <td className="py-2 px-3"><PriorityTag p={s.priority} /></td>
                  <td className="py-2 px-3"><StatusBadge status={s.status} /></td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
            {paged.length === 0 && <tr><td colSpan={12} className="text-center py-12 text-sm text-muted-foreground">No shipments match the current filters.</td></tr>}
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
//  DISPATCH SCHEDULE
// ════════════════════════════════════════════════════════════════════════════

function DispatchView({ onOpen }: { onOpen: (s: Shipment) => void }) {
  const schedule = useOutboundStore((s) => s.dispatchSchedule)();
  const { updateStatus } = useOutboundStore();
  return (
    <Section title="Dispatch Schedule" sub={`${schedule.length} shipments planned or staging · earliest first`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-4">Scheduled</th>
              <th className="text-left font-semibold py-2.5 px-3">Shipment</th>
              <th className="text-left font-semibold py-2.5 px-3">Carrier</th>
              <th className="text-left font-semibold py-2.5 px-3">Driver</th>
              <th className="text-center font-semibold py-2.5 px-3">Dock</th>
              <th className="text-right font-semibold py-2.5 px-3">Pallets</th>
              <th className="text-left font-semibold py-2.5 px-3">Punctuality</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="text-right font-semibold py-2.5 px-3 w-40">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {schedule.map((s) => {
              const eta = etaLabel(s.scheduledDispatch);
              return (
                <tr key={s.id} className="hover:bg-accent/15">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-xs whitespace-nowrap">{fmtDateTime(s.scheduledDispatch)}</td>
                  <td className="py-2.5 px-3"><button onClick={() => onOpen(s)} className="font-mono text-primary text-xs hover:underline">{s.shipmentNumber}</button></td>
                  <td className="py-2.5 px-3 text-xs whitespace-nowrap">{s.carrier} <span className="text-muted-foreground">{s.serviceLevel}</span></td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{s.driverName ?? "—"}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-xs">{s.dockCode ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{s.totalPallets}</td>
                  <td className={cn("py-2.5 px-3 text-xs", eta.tone === "ok" ? "text-emerald-400" : eta.tone === "warn" ? "text-amber-400" : "text-red-400")}>{eta.text}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={s.status} /></td>
                  <td className="py-2.5 px-3 text-right">
                    {s.status === "PLANNED" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(s.id, "STAGED")}>Stage</Button>}
                    {s.status === "STAGED" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(s.id, "LOADING")}>Load</Button>}
                    {s.status === "LOADING" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(s.id, "LOADED")}>Mark loaded</Button>}
                    {s.status === "LOADED" && <Button size="sm" className="h-7 text-xs gap-1" onClick={() => updateStatus(s.id, "DISPATCHED")}><Send className="h-3 w-3" /> Dispatch</Button>}
                  </td>
                </tr>
              );
            })}
            {schedule.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-sm text-muted-foreground">No shipments scheduled.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  CARRIERS
// ════════════════════════════════════════════════════════════════════════════

function CarriersView() {
  const perf = useOutboundStore((s) => s.carrierPerformance)();
  const maxShip = Math.max(1, ...perf.map((p) => p.shipments));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="CARRIERS" value={perf.length} tone="primary" sub="in network" />
        <KPICard label="TOTAL SHIPMENTS" value={perf.reduce((s, p) => s + p.shipments, 0)} tone="info" sub="all carriers" />
        <KPICard label="TOTAL WEIGHT" value={`${fmtNum(perf.reduce((s, p) => s + p.weight, 0))} kg`} tone="warning" sub="tendered" />
        <KPICard label="AVG SLA" value={`${Math.round(perf.reduce((s, p) => s + p.slaPct, 0) / (perf.length || 1))}%`} tone="success" sub="on-time" />
      </div>
      <Section title="Carrier Performance" sub="Volume, tonnage and on-time delivery by carrier">
        <div className="divide-y divide-border/40">
          {perf.map((p) => (
            <div key={p.carrier} className="flex items-center gap-4 px-4 py-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0"><Truck className="h-4 w-4" /></div>
              <div className="w-36 shrink-0 min-w-0">
                <div className="text-sm font-medium truncate">{p.carrier}</div>
                <div className="text-[11px] text-muted-foreground">{p.delivered} delivered</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(p.shipments / maxShip) * 100}%` }} /></div>
                <div className="text-[11px] text-muted-foreground mt-1 font-mono">{p.shipments} shipments · {fmtNum(p.weight)} kg</div>
              </div>
              <div className="text-right shrink-0 w-16">
                <div className={cn("text-lg font-bold font-mono tabular-nums", p.slaPct >= 95 ? "text-emerald-400" : p.slaPct >= 85 ? "text-amber-400" : "text-red-400")}>{p.slaPct}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">SLA</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  EXCEPTIONS
// ════════════════════════════════════════════════════════════════════════════

function ExceptionsView({ onOpen }: { onOpen: (s: Shipment) => void }) {
  const shipments = useOutboundStore((s) => s.shipments);
  const exceptions = shipments.filter((s) => s.exceptions.length > 0 || s.status === "EXCEPTION");
  const delayed = shipments.filter((s) => !["DELIVERED", "EXCEPTION", "RETURNED"].includes(s.status) && new Date(s.scheduledDispatch) < new Date());
  const returned = shipments.filter((s) => s.status === "RETURNED");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="EXCEPTIONS" value={exceptions.length} tone="destructive" sub="flagged shipments" />
        <KPICard label="DELAYED" value={delayed.length} tone="warning" sub="past schedule" />
        <KPICard label="RETURNED" value={returned.length} tone="warning" sub="back to DC" />
        <KPICard label="IN TRANSIT" value={shipments.filter((s) => s.status === "IN_TRANSIT").length} tone="info" sub="on the road" />
      </div>

      <Section title="Exception Register" sub={`${exceptions.length} shipments with open exceptions`}>
        <div className="divide-y divide-border/40">
          {exceptions.map((s) => (
            <button key={s.id} onClick={() => onOpen(s)} className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-accent/20">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-primary">{s.shipmentNumber}</span>
                  <span className="text-xs text-muted-foreground">{s.carrier}</span>
                  <StatusBadge status={s.status} />
                </div>
                {s.exceptions.map((e, i) => (
                  <div key={i} className="text-[11px] text-red-400/90 mt-0.5"><span className="font-mono">{e.code}</span> — {e.description}</div>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">{s.exceptions[0] ? fmtTime(s.exceptions[0].ts) : ""}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          {exceptions.length === 0 && <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"><CheckCircle2 className="h-8 w-8 text-emerald-500/40" /><span className="text-sm">No open exceptions.</span></div>}
        </div>
      </Section>

      {delayed.length > 0 && (
        <Section title="Delayed Shipments" sub={`${delayed.length} past scheduled dispatch`}>
          <div className="divide-y divide-border/40">
            {delayed.map((s) => {
              const eta = etaLabel(s.scheduledDispatch);
              return (
                <button key={s.id} onClick={() => onOpen(s)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-accent/20">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="font-mono text-xs text-primary w-24">{s.shipmentNumber}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{s.carrier} · Dock {s.dockCode ?? "—"}</span>
                  <span className="text-xs text-red-400">{eta.text}</span>
                  <StatusBadge status={s.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SHIPMENT DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium mt-1 font-mono tabular-nums break-words">{value}</div>
    </div>
  );
}

function ShipmentDetailDrawer({ shipmentId, onClose }: { shipmentId: string | null; onClose: () => void }) {
  const shipment = useOutboundStore((s) => s.shipments.find((x) => x.id === shipmentId)) ?? null;
  const { updateStatus, recordCartonLoad, sealAndConfirmDispatch, flagException } = useOutboundStore();
  const [tab, setTab] = useState("orders");
  const [seal, setSeal] = useState("");
  if (!shipment) return null;
  const sealMode = false;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{shipment.shipmentNumber}</span>
            <StatusBadge status={shipment.status} />
            <PriorityTag p={shipment.priority} />
          </div>
          <div className="text-sm text-muted-foreground mt-1">{shipment.carrier} {shipment.serviceLevel} · {shipment.routeCode}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="h-4 w-4" /></Button>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Orders" value={`${shipment.totalOrders}`} />
          <MiniStat label="Cartons" value={`${shipment.totalCartons}`} />
          <MiniStat label="Loaded" value={`${shipment.loadedCartons}/${shipment.totalCartons}`} tone={shipment.loadedCartons >= shipment.totalCartons ? "text-emerald-400" : undefined} />
          <MiniStat label="Weight" value={`${fmtNum(shipment.totalWeight)}kg`} />
        </div>

        {["PLANNED", "STAGED", "LOADING", "LOADED"].includes(shipment.status) && (
          <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Loading — scan cartons onto truck</span>
              <span className="text-xs font-mono tabular-nums">{shipment.loadedCartons} / {shipment.totalCartons}</span>
            </div>
            <Progress value={shipment.totalCartons > 0 ? (shipment.loadedCartons / shipment.totalCartons) * 100 : 0} className="h-2" />
            <div className="flex flex-wrap gap-2">
              {shipment.loadedCartons < shipment.totalCartons && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => recordCartonLoad(shipment.id, 1)}><ScanLine className="h-3.5 w-3.5" /> Scan carton</Button>}
              {shipment.loadedCartons < shipment.totalCartons && <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => recordCartonLoad(shipment.id, shipment.totalCartons - shipment.loadedCartons)}>Load all remaining</Button>}
            </div>
          </div>
        )}

        {(shipment.status === "LOADED" || (shipment.status === "LOADING" && shipment.loadedCartons >= shipment.totalCartons) || sealMode) && shipment.status !== "DISPATCHED" && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <span className="text-[11px] uppercase tracking-wide text-amber-400 flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" /> Seal & confirm dispatch</span>
            <Input value={seal} onChange={(e) => setSeal(e.target.value)} placeholder="Seal number (e.g. SL-882134)" className="h-8 text-sm font-mono" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="h-8 text-xs gap-1" disabled={!seal.trim()} onClick={() => { if (sealAndConfirmDispatch(shipment.id, seal.trim())) { setSeal(""); onClose(); } }}><Send className="h-3.5 w-3.5" /> Confirm dispatch</Button>
              {shipment.loadedCartons < shipment.totalCartons && <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={!seal.trim()} onClick={() => { if (sealAndConfirmDispatch(shipment.id, seal.trim(), true)) { setSeal(""); onClose(); } }}>Override (partial load)</Button>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {shipment.status === "PLANNED" && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => updateStatus(shipment.id, "STAGED")}><ChevronRight className="h-3.5 w-3.5" /> Stage at dock</Button>}
          {shipment.status === "DISPATCHED" && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => updateStatus(shipment.id, "IN_TRANSIT")}><Truck className="h-3.5 w-3.5" /> Mark in transit</Button>}
          {shipment.status === "IN_TRANSIT" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => updateStatus(shipment.id, "DELIVERED", { actualDelivery: new Date().toISOString(), slaMet: true })}><CheckCircle2 className="h-3.5 w-3.5" /> Mark delivered</Button>}
          {!["EXCEPTION", "DELIVERED", "RETURNED"].includes(shipment.status) && <Button size="sm" variant="ghost" className="h-8 text-xs text-red-400 ml-auto" onClick={() => flagException(shipment.id, "MANUAL", "Flagged from dispatch desk")}>Flag exception</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-5 mt-3 w-fit">
          <TabsTrigger value="orders" className="text-xs">Orders · {shipment.totalOrders}</TabsTrigger>
          <TabsTrigger value="manifest" className="text-xs">Manifest</TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs">Tracking</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <TabsContent value="orders" className="mt-3 space-y-2">
            {shipment.orders.map((o) => (
              <div key={o.id} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-primary">{o.orderId}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">{o.customer}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {o.address}</div>
                  </div>
                  <div className="text-right shrink-0 font-mono text-[11px] text-muted-foreground">
                    <div>{o.cartons} ctn</div>
                    <div>{o.pallets} plt</div>
                    <div>{o.weight} kg</div>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="manifest" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Container} label="Master BOL" value={shipment.masterBOL ?? "—"} />
              <DetailRow icon={Hash} label="PRO number" value={shipment.proNumber ?? "—"} />
              <DetailRow icon={BadgeCheck} label="Seal number" value={shipment.sealNumber ?? "—"} />
              <DetailRow icon={Route} label="Route" value={shipment.routeCode ?? "—"} />
              <DetailRow icon={Truck} label="Truck" value={shipment.truckPlate ?? "—"} />
              <DetailRow icon={User} label="Driver" value={shipment.driverName ?? "—"} />
              <DetailRow icon={Building2} label="Dock" value={shipment.dockCode ?? "—"} />
              <DetailRow icon={MapPin} label="Stops" value={`${shipment.stopCount}`} />
            </div>
          </TabsContent>

          <TabsContent value="tracking" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={CalendarClock} label="Scheduled dispatch" value={fmtDateTime(shipment.scheduledDispatch)} />
              <DetailRow icon={Send} label="Actual dispatch" value={shipment.actualDispatch ? fmtDateTime(shipment.actualDispatch) : "—"} />
              <DetailRow icon={Clock} label="Est. delivery" value={shipment.estimatedDelivery ? fmtDateTime(shipment.estimatedDelivery) : "—"} />
              <DetailRow icon={CheckCircle2} label="Actual delivery" value={shipment.actualDelivery ? fmtDateTime(shipment.actualDelivery) : "—"} />
              <DetailRow icon={Gauge} label="SLA deadline" value={fmtDateTime(shipment.slaAt)} />
              <DetailRow icon={BadgeCheck} label="SLA met" value={shipment.slaMet === null ? "pending" : shipment.slaMet ? "Yes" : "No"} />
            </div>
            {shipment.exceptions.length > 0 && (
              <div className="mt-3 space-y-2">
                {shipment.exceptions.map((e, i) => (
                  <div key={i} className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                    <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-red-400" /><span className="font-mono text-xs text-red-400">{e.code}</span><span className="text-[10px] text-muted-foreground ml-auto font-mono">{fmtDateTime(e.ts)}</span></div>
                    <div className="text-[11px] text-muted-foreground mt-1">{e.description}</div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "shipments" | "dispatch" | "carriers" | "exceptions";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",   label: "Overview",   icon: LayoutDashboard },
  { id: "shipments",  label: "Shipments",  icon: ClipboardList },
  { id: "dispatch",   label: "Dispatch",   icon: CalendarClock },
  { id: "carriers",   label: "Carriers",   icon: Ship },
  { id: "exceptions", label: "Exceptions", icon: PackageX },
];

export function OutboundPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const kpis = useOutboundStore((s) => s.kpis)();
  const syncFromPacking = useOutboundStore((s) => s.syncFromPacking);

  const open = (s: Shipment) => setOpenId(s.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={Truck}
        title="Outbound"
        subtitle="Shipment planning · dock staging · truck loading · dispatch & manifest"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => syncFromPacking()}><RefreshCw className="h-3.5 w-3.5" /> Sync from Packing</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"><Send className="h-3.5 w-3.5" /> Dispatch next</Button>
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "exceptions" && kpis.exceptionsOpen > 0 ? kpis.exceptionsOpen : id === "dispatch" && kpis.delayed > 0 ? kpis.delayed : null;
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
        {tab === "overview"   && <OverviewView onOpen={open} />}
        {tab === "shipments"  && <ShipmentsView onOpen={open} />}
        {tab === "dispatch"   && <DispatchView onOpen={open} />}
        {tab === "carriers"   && <CarriersView />}
        {tab === "exceptions" && <ExceptionsView onOpen={open} />}
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <ShipmentDetailDrawer shipmentId={openId} onClose={() => setOpenId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
