/**
 * TriloWMS — Yard & Dock Module
 * Gatehouse check-in/out, yard map & spotting, dock-door control, truck dwell
 * monitoring and appointment scheduling.
 */

import { useMemo, useState } from "react";
import {
  Container, Search, X, ChevronRight, CheckCircle2, AlertTriangle, LayoutDashboard,
  Map as MapIcon, Truck, Building2, CalendarClock, LogIn, LogOut, Clock, Hash,
  User, Phone, MapPin, Flame, Snowflake, ShieldCheck, FileDown, Gauge, Anchor, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useYardStore, YARD_STATUS_META,
  type YardTruck, type YardTruckStatus, type YardDock, type DockStatus, type YardPosition, type YardAppointment,
} from "@/lib/yard-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers & meta ───────────────────────────────────────────────────────────

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dwellFmt = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);

const PRIORITY_META: Record<YardTruck["priority"], { label: string; cls: string }> = {
  URGENT: { label: "Urgent", cls: "text-red-400 bg-red-500/10" },
  HIGH:   { label: "High",   cls: "text-orange-400 bg-orange-500/10" },
  NORMAL: { label: "Normal", cls: "text-slate-400 bg-slate-500/10" },
};

const DOCK_STATUS_META: Record<DockStatus, { label: string; cls: string }> = {
  AVAILABLE:    { label: "Available",    cls: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400" },
  OCCUPIED_IN:  { label: "Occupied · In", cls: "border-indigo-500/40 bg-indigo-500/5 text-indigo-400" },
  OCCUPIED_OUT: { label: "Occupied · Out", cls: "border-violet-500/40 bg-violet-500/5 text-violet-400" },
  MAINTENANCE:  { label: "Maintenance",  cls: "border-red-500/40 bg-red-500/5 text-red-400" },
  RESERVED:     { label: "Reserved",     cls: "border-blue-500/40 bg-blue-500/5 text-blue-400" },
};

const POSITION_META: Record<YardPosition, { label: string; icon: typeof MapPin }> = {
  LANE_A:   { label: "Lane A",   icon: MapPin },
  LANE_B:   { label: "Lane B",   icon: MapPin },
  LANE_C:   { label: "Lane C",   icon: MapPin },
  STAGING:  { label: "Staging",  icon: Anchor },
  OVERFLOW: { label: "Overflow", icon: MapPin },
  HAZMAT:   { label: "Hazmat",   icon: Flame },
};

const APPT_STATUS_META: Record<YardAppointment["status"], { label: string; cls: string }> = {
  SCHEDULED:  { label: "Scheduled",  cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  CHECKED_IN: { label: "Checked In", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  DOCKED:     { label: "Docked",     cls: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" },
  COMPLETED:  { label: "Completed",  cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  NO_SHOW:    { label: "No Show",    cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  CANCELLED:  { label: "Cancelled",  cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: YardTruckStatus }) {
  const m = YARD_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}
function PriorityTag({ p }: { p: YardTruck["priority"] }) {
  const m = PRIORITY_META[p];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide", m.cls)}>{m.label}</span>;
}
function DirectionTag({ d }: { d: "INBOUND" | "OUTBOUND" }) {
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide border", d === "INBOUND" ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" : "text-violet-400 bg-violet-500/10 border-violet-500/30")}>{d === "INBOUND" ? "Inbound" : "Outbound"}</span>;
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

function GateActivityChart() {
  const data = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      hour: `${String((6 + i) % 24).padStart(2, "0")}:00`,
      in: Math.floor(2 + Math.abs(Math.sin(i + 1)) * 7),
      out: Math.floor(1 + Math.abs(Math.cos(i)) * 6),
    })),
    [],
  );
  return (
    <Section title="Gate Activity" sub="Gate-in vs gate-out moves — last 12 hours" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} interval={1} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="in" fill="var(--color-info)" radius={[3, 3, 0, 0]} name="Gate In" />
            <Bar dataKey="out" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Gate Out" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function YardOccupancyCard() {
  const occ = useYardStore((s) => s.yardOccupancy)();
  const total = occ.reduce((s, o) => s + o.count, 0) || 1;
  const colors = ["var(--color-primary)", "var(--color-info)", "var(--color-success)", "var(--color-warning)", "#a78bfa", "var(--color-destructive)"];
  return (
    <Section title="Yard Occupancy" sub="Trucks parked by yard position" className="h-[240px]">
      <div className="p-4 space-y-2.5">
        {occ.map((o, i) => (
          <div key={o.position}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors[i % colors.length] }} /> {POSITION_META[o.position].label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">{o.count}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(o.count / total) * 100}%`, background: colors[i % colors.length] }} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function StatusFunnelChart() {
  const funnel = useYardStore((s) => s.statusFunnel)();
  const data = funnel.map((f) => ({ status: YARD_STATUS_META[f.status].label, count: f.count }));
  return (
    <Section title="Truck Status Mix" sub="Trucks by current yard stage" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="status" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={72} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 3, 3, 0]} barSize={13} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function DwellAlerts({ onOpen }: { onOpen: (t: YardTruck) => void }) {
  const dwell = useYardStore((s) => s.dwellTrucks)();
  return (
    <Section title="Dwell Alerts" sub={`${dwell.length} trucks over threshold`} className="h-full">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
        {dwell.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/40" /><span className="text-sm">No dwell-time breaches.</span>
          </div>
        )}
        {dwell.map((t) => (
          <button key={t.id} onClick={() => onOpen(t)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-accent/20">
            <Timer className="h-4 w-4 text-red-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-mono text-xs text-primary">{t.truckNumber}</span><span className="text-xs text-muted-foreground truncate">{t.carrier}</span></div>
              <div className="text-[11px] text-muted-foreground">{t.yardPosition ? POSITION_META[t.yardPosition].label : "no spot"} · {t.driver}</div>
            </div>
            <span className="text-sm font-bold font-mono text-red-400 shrink-0">{dwellFmt(t.dwellMinutes)}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function OverviewView({ onOpen }: { onOpen: (t: YardTruck) => void }) {
  const kpis = useYardStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="TRUCKS IN YARD" value={kpis.inYard} tone="primary" sub="active on site" />
        <KPICard label="DOCKED IN" value={kpis.dockedIn} tone="info" sub="unloading" />
        <KPICard label="DOCKED OUT" value={kpis.dockedOut} tone="info" sub="loading" />
        <KPICard label="AVG DWELL" value={kpis.avgDwell} tone="warning" sub="gate to dock" />
        <KPICard label="DWELL ALERTS" value={kpis.dwellAlerts} tone="destructive" sub="over threshold" />
        <KPICard label="GATE MOVES" value={kpis.gateMoves} tone="success" sub="today" />
        <KPICard label="OPEN DOCKS" value={kpis.availableDocks} tone="success" sub="available" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GateActivityChart />
        <YardOccupancyCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusFunnelChart />
        <DwellAlerts onOpen={onOpen} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  YARD MAP
// ════════════════════════════════════════════════════════════════════════════

function TruckChip({ truck, onOpen }: { truck: YardTruck; onOpen: (t: YardTruck) => void }) {
  return (
    <button onClick={() => onOpen(truck)} className={cn("rounded-md border p-2 text-left transition-colors hover:bg-accent/30", truck.dwellAlert ? "border-red-500/40 bg-red-500/5" : "border-border bg-card/40")}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] text-primary">{truck.truckNumber}</span>
        {truck.hazmat && <Flame className="h-3 w-3 text-red-400" />}
      </div>
      <div className="text-[10px] text-muted-foreground truncate">{truck.carrier}</div>
      <div className="flex items-center justify-between mt-1">
        <span className={cn("text-[9px]", truck.direction === "INBOUND" ? "text-cyan-400" : "text-violet-400")}>{truck.direction === "INBOUND" ? "IN" : "OUT"}</span>
        <span className={cn("text-[9px] font-mono", truck.dwellAlert ? "text-red-400" : "text-muted-foreground")}>{dwellFmt(truck.dwellMinutes)}</span>
      </div>
    </button>
  );
}

function YardMapView({ onOpen }: { onOpen: (t: YardTruck) => void }) {
  const trucks = useYardStore((s) => s.trucks);
  const active = trucks.filter((t) => !["GATE_OUT", "DEPARTED"].includes(t.status));
  const positions: YardPosition[] = ["LANE_A", "LANE_B", "LANE_C", "STAGING", "OVERFLOW", "HAZMAT"];
  const gateQueue = active.filter((t) => t.status === "GATE_IN" || t.status === "WAITING");

  return (
    <div className="space-y-5">
      <Section title="Gate Queue" sub={`${gateQueue.length} trucks waiting for a spot or dock`}>
        <div className="flex gap-2 p-4 overflow-x-auto">
          {gateQueue.length === 0 && <div className="text-sm text-muted-foreground py-4">Gate queue is clear.</div>}
          {gateQueue.map((t) => <div key={t.id} className="w-40 shrink-0"><TruckChip truck={t} onOpen={onOpen} /></div>)}
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {positions.map((pos) => {
          const parked = active.filter((t) => t.yardPosition === pos);
          const Icon = POSITION_META[pos].icon;
          return (
            <Section key={pos} title={POSITION_META[pos].label} sub={`${parked.length} parked`} actions={<Icon className="h-3.5 w-3.5 text-muted-foreground" />} className="min-h-[160px]">
              <div className="grid grid-cols-2 gap-2 p-3">
                {parked.map((t) => <TruckChip key={t.id} truck={t} onOpen={onOpen} />)}
                {parked.length === 0 && <div className="col-span-2 text-center text-[11px] text-muted-foreground py-6">— empty —</div>}
              </div>
            </Section>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  TRUCKS
// ════════════════════════════════════════════════════════════════════════════

function TrucksView({ onOpen }: { onOpen: (t: YardTruck) => void }) {
  const { filters, setFilters, resetFilters, page, setPage } = useYardStore();
  const all = useYardStore((s) => s.filteredTrucks)();
  const pageSize = 14;
  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.direction || filters.dwellAlert;

  return (
    <Section title="Trucks On Site" sub={`${all.length} trucks matched`} actions={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search truck, carrier or driver…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as YardTruckStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(YARD_STATUS_META) as YardTruckStatus[]).map((s) => <SelectItem key={s} value={s}>{YARD_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.direction || "all"} onValueChange={(v) => setFilters({ direction: v === "all" ? "" : v as "INBOUND" | "OUTBOUND" })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both ways</SelectItem>
            <SelectItem value="INBOUND">Inbound</SelectItem>
            <SelectItem value="OUTBOUND">Outbound</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={filters.dwellAlert ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1" onClick={() => setFilters({ dwellAlert: !filters.dwellAlert })}>
          <Timer className="h-3.5 w-3.5" /> Dwell alerts
        </Button>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Truck</th>
              <th className="text-left font-semibold py-2.5 px-3">Plate</th>
              <th className="text-left font-semibold py-2.5 px-3">Carrier</th>
              <th className="text-left font-semibold py-2.5 px-3">Driver</th>
              <th className="text-left font-semibold py-2.5 px-3">Dir</th>
              <th className="text-left font-semibold py-2.5 px-3">Spot</th>
              <th className="text-center font-semibold py-2.5 px-3">Dock</th>
              <th className="text-right font-semibold py-2.5 px-3">Dwell</th>
              <th className="text-left font-semibold py-2.5 px-3">Priority</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((t) => (
              <tr key={t.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpen(t)}>
                <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap">{t.truckNumber}{t.hazmat && <Flame className="h-3 w-3 text-red-400 inline ml-1" />}</td>
                <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{t.plateNumber}</td>
                <td className="py-2 px-3 text-xs whitespace-nowrap">{t.carrier}</td>
                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{t.driver}</td>
                <td className="py-2 px-3"><DirectionTag d={t.direction} /></td>
                <td className="py-2 px-3 font-mono text-xs">{t.spotNumber ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="py-2 px-3 text-center font-mono text-xs">{t.dockCode ?? <span className="text-muted-foreground">—</span>}</td>
                <td className={cn("py-2 px-3 text-right font-mono tabular-nums text-xs", t.dwellAlert ? "text-red-400 font-bold" : "")}>{dwellFmt(t.dwellMinutes)}</td>
                <td className="py-2 px-3"><PriorityTag p={t.priority} /></td>
                <td className="py-2 px-3"><StatusBadge status={t.status} /></td>
                <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
              </tr>
            ))}
            {paged.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-sm text-muted-foreground">No trucks match the current filters.</td></tr>}
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
//  DOCKS
// ════════════════════════════════════════════════════════════════════════════

function DocksView({ onOpen }: { onOpen: (t: YardTruck) => void }) {
  const docks = useYardStore((s) => s.docks);
  const trucks = useYardStore((s) => s.trucks);
  const releaseDock = useYardStore((s) => s.releaseDock);

  const inbound = docks.filter((d) => d.type === "INBOUND" || d.type === "BOTH");
  const outbound = docks.filter((d) => d.type === "OUTBOUND");

  const renderGroup = (title: string, list: YardDock[]) => (
    <Section title={title} sub={`${list.filter((d) => d.status === "AVAILABLE").length} available of ${list.length}`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
        {list.map((dock) => {
          const truck = dock.assignedTruckId ? trucks.find((t) => t.id === dock.assignedTruckId) : null;
          const cap = dock.maxCapacityTons > 0 ? Math.round((dock.currentWeight / dock.maxCapacityTons) * 100) : 0;
          return (
            <div key={dock.id} className={cn("rounded-lg border p-3 flex flex-col gap-1.5 min-h-[132px]", DOCK_STATUS_META[dock.status].cls)}>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm">{dock.code}</span>
                {dock.tempControlled && <Snowflake className="h-3 w-3 text-cyan-400" />}
              </div>
              <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">{DOCK_STATUS_META[dock.status].label}</span>
              {truck ? (
                <button onClick={() => onOpen(truck)} className="text-left text-[11px] opacity-90 hover:underline truncate">{truck.truckNumber} · {truck.carrier.split(" ")[0]}</button>
              ) : <span className="text-[11px] opacity-40">— vacant —</span>}
              {dock.status.startsWith("OCCUPIED") && (
                <div className="mt-0.5">
                  <div className="h-1 w-full rounded-full bg-black/30 overflow-hidden"><div className="h-full bg-current" style={{ width: `${cap}%` }} /></div>
                  <span className="text-[9px] opacity-60 font-mono">{dock.currentWeight}/{dock.maxCapacityTons}t</span>
                </div>
              )}
              <div className="mt-auto pt-1">
                {dock.status.startsWith("OCCUPIED") && <button onClick={() => releaseDock(dock.id)} className="text-[10px] underline opacity-70 hover:opacity-100">Release</button>}
                {dock.status === "AVAILABLE" && <span className="text-[10px] opacity-40">ready</span>}
                {dock.status === "MAINTENANCE" && <span className="text-[10px] opacity-60">under service</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="TOTAL DOORS" value={docks.length} tone="primary" sub="inbound + outbound" />
        <KPICard label="AVAILABLE" value={docks.filter((d) => d.status === "AVAILABLE").length} tone="success" sub="ready" />
        <KPICard label="OCCUPIED" value={docks.filter((d) => d.status.startsWith("OCCUPIED")).length} tone="warning" sub="in use" />
        <KPICard label="MAINTENANCE" value={docks.filter((d) => d.status === "MAINTENANCE").length} tone="destructive" sub="down" />
      </div>
      {renderGroup("Inbound Docks", inbound)}
      {renderGroup("Outbound Docks", outbound)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  APPOINTMENTS
// ════════════════════════════════════════════════════════════════════════════

function AppointmentsView() {
  const appointments = useYardStore((s) => s.appointments);
  const [filter, setFilter] = useState("all");
  const filtered = appointments.filter((a) => filter === "all" || a.status === filter).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const counts = {
    scheduled: appointments.filter((a) => a.status === "SCHEDULED").length,
    checkedIn: appointments.filter((a) => a.status === "CHECKED_IN").length,
    completed: appointments.filter((a) => a.status === "COMPLETED").length,
    noShow: appointments.filter((a) => a.status === "NO_SHOW").length,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="SCHEDULED" value={counts.scheduled} tone="info" sub="upcoming" />
        <KPICard label="CHECKED IN" value={counts.checkedIn} tone="warning" sub="on site" />
        <KPICard label="COMPLETED" value={counts.completed} tone="success" sub="closed" />
        <KPICard label="NO SHOW" value={counts.noShow} tone="destructive" sub="missed slot" />
      </div>

      <Section
        title="Appointment Schedule"
        sub={`${filtered.length} appointments`}
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(APPT_STATUS_META) as YardAppointment["status"][]).map((s) => <SelectItem key={s} value={s}>{APPT_STATUS_META[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-semibold py-2.5 px-4">Scheduled</th>
                <th className="text-left font-semibold py-2.5 px-3">Appt #</th>
                <th className="text-left font-semibold py-2.5 px-3">Carrier</th>
                <th className="text-left font-semibold py-2.5 px-3">Truck Type</th>
                <th className="text-left font-semibold py-2.5 px-3">Dir</th>
                <th className="text-left font-semibold py-2.5 px-3">Reference</th>
                <th className="text-left font-semibold py-2.5 px-3">Checked In</th>
                <th className="text-left font-semibold py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-accent/15">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-xs whitespace-nowrap">{fmtDateTime(a.scheduledTime)}</td>
                  <td className="py-2.5 px-3 font-mono text-primary text-xs">{a.appointmentNumber}</td>
                  <td className="py-2.5 px-3 text-xs">{a.carrier}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{a.truckType.replace("_", " ").toLowerCase()}</td>
                  <td className="py-2.5 px-3"><DirectionTag d={a.direction} /></td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{a.referenceDoc}</td>
                  <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">{a.checkedInTime ? fmtTime(a.checkedInTime) : "—"}</td>
                  <td className="py-2.5 px-3"><span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border", APPT_STATUS_META[a.status].cls)}>{APPT_STATUS_META[a.status].label}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">No appointments in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  TRUCK DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium mt-1 font-mono tabular-nums break-words">{value}</div>
    </div>
  );
}

function TruckDetailDrawer({ truckId, onClose }: { truckId: string | null; onClose: () => void }) {
  const truck = useYardStore((s) => s.trucks.find((t) => t.id === truckId)) ?? null;
  const docks = useYardStore((s) => s.docks);
  const { updateTruckStatus, assignDock, gateOut } = useYardStore();
  const [assignOpen, setAssignOpen] = useState(false);
  if (!truck) return null;

  const flow: YardTruckStatus[] = ["GATE_IN", "WAITING", "DOCKING", truck.direction === "INBOUND" ? "DOCKED_IN" : "DOCKED_OUT", truck.direction === "INBOUND" ? "UNLOADING" : "LOADING", "LOADED", "GATE_OUT"];
  const idx = flow.indexOf(truck.status);
  const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  const availDocks = docks.filter((d) => d.status === "AVAILABLE" && (truck.direction === "INBOUND" ? d.type !== "OUTBOUND" : d.type !== "INBOUND"));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{truck.truckNumber}</span>
            <StatusBadge status={truck.status} />
            <PriorityTag p={truck.priority} />
            <DirectionTag d={truck.direction} />
            {truck.hazmat && <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded"><Flame className="h-3 w-3" /> Hazmat</span>}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{truck.carrier} · {truck.plateNumber}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="h-4 w-4" /></Button>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Dwell" value={dwellFmt(truck.dwellMinutes)} tone={truck.dwellAlert ? "text-red-400" : undefined} />
          <MiniStat label="Spot" value={truck.spotNumber ?? "—"} />
          <MiniStat label="Dock" value={truck.dockCode ?? "—"} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!truck.dockCode && availDocks.length > 0 && (
            assignOpen ? (
              <div className="w-full flex items-center gap-2">
                <Select onValueChange={(dockId) => { assignDock(truck.id, dockId); setAssignOpen(false); }}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Choose a dock door…" /></SelectTrigger>
                  <SelectContent>{availDocks.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} · {d.type.toLowerCase()}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAssignOpen(false)}>Cancel</Button>
              </div>
            ) : <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setAssignOpen(true)}><Building2 className="h-3.5 w-3.5" /> Assign dock</Button>
          )}
          {next && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => updateTruckStatus(truck.id, next)}><ChevronRight className="h-3.5 w-3.5" /> {YARD_STATUS_META[next].label}</Button>}
          {truck.status !== "GATE_OUT" && <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-emerald-400 ml-auto" onClick={() => { gateOut(truck.id); onClose(); }}><LogOut className="h-3.5 w-3.5" /> Gate out</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <DetailRow icon={Hash} label="Truck number" value={truck.truckNumber} />
          <DetailRow icon={Hash} label="Plate" value={truck.plateNumber} />
          <DetailRow icon={User} label="Driver" value={truck.driver} />
          <DetailRow icon={Phone} label="Driver mobile" value={truck.driverMobile} />
          <DetailRow icon={MapPin} label="Yard position" value={truck.yardPosition ? POSITION_META[truck.yardPosition].label : "—"} />
          <DetailRow icon={Building2} label="Dock door" value={truck.dockCode ?? "Unassigned"} />
          <DetailRow icon={CalendarClock} label="Appointment" value={truck.appointmentId ?? "—"} />
          <DetailRow icon={Hash} label="Reference" value={truck.asnId ?? truck.shipmentId ?? "—"} />
          <DetailRow icon={LogIn} label="Gate in" value={truck.gateInTime ? fmtDateTime(truck.gateInTime) : "—"} />
          <DetailRow icon={Building2} label="Dock assigned" value={truck.dockAssignedTime ? fmtDateTime(truck.dockAssignedTime) : "—"} />
          <DetailRow icon={Timer} label="Dwell / threshold" value={`${dwellFmt(truck.dwellMinutes)} / ${dwellFmt(truck.dwellThresholdMinutes)}`} />
          <DetailRow icon={LogOut} label="Departed" value={truck.departureTime ? fmtDateTime(truck.departureTime) : "—"} />
        </div>

        <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><ShieldCheck className="h-3 w-3" /> Seals</div>
          <div className="text-sm font-medium mt-1 font-mono flex flex-wrap gap-2">{truck.seals.map((s) => <span key={s} className="px-1.5 py-0.5 rounded bg-secondary text-xs">{s}</span>)}</div>
        </div>

        {truck.notes && <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">{truck.notes}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "map" | "trucks" | "docks" | "appointments";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",     label: "Overview",     icon: LayoutDashboard },
  { id: "map",          label: "Yard Map",     icon: MapIcon },
  { id: "trucks",       label: "Trucks",       icon: Truck },
  { id: "docks",        label: "Docks",        icon: Building2 },
  { id: "appointments", label: "Appointments", icon: CalendarClock },
];

export function YardPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const kpis = useYardStore((s) => s.kpis)();

  const open = (t: YardTruck) => setOpenId(t.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={Container}
        title="Yard & Dock"
        subtitle="Gatehouse check-in · yard spotting · dock-door control · dwell monitoring"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><LogOut className="h-3.5 w-3.5" /> Gate out</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"><LogIn className="h-3.5 w-3.5" /> Gate in</Button>
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "overview" && kpis.dwellAlerts > 0 ? kpis.dwellAlerts : id === "docks" && kpis.availableDocks > 0 ? kpis.availableDocks : null;
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
        {tab === "overview"     && <OverviewView onOpen={open} />}
        {tab === "map"          && <YardMapView onOpen={open} />}
        {tab === "trucks"       && <TrucksView onOpen={open} />}
        {tab === "docks"        && <DocksView onOpen={open} />}
        {tab === "appointments" && <AppointmentsView />}
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <TruckDetailDrawer truckId={openId} onClose={() => setOpenId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
