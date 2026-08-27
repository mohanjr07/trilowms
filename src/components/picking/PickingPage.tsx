/**
 * TriloWMS — Picking Module
 * Wave management, pick-floor dispatch, batch/zone/cluster picking, picker
 * productivity and shortage resolution.
 */

import { useMemo, useState } from "react";
import {
  PackageSearch, Search, X, ChevronRight, Play, CheckCircle2, AlertTriangle, Zap,
  Users, LayoutDashboard, Waves as WavesIcon, ListChecks, PackageX, ArrowRight,
  Hash, MapPin, Boxes, Clock, User, Truck, Layers, ScanLine, FileDown, Timer, Target,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  usePickingStore, WAVE_STATUS_META,
  type Wave, type WaveStatus, type PickingMethod, type PickPriority, type PickTask, type PickTaskStatus, type Shortage,
} from "@/lib/picking-store";
import { usePickPathStore, type RouteResult } from "@/lib/pickpath-store";
import { useEditorStore } from "@/lib/wms-editor-store";
import { useAuthStore } from "@/lib/auth-store";
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

const PRIORITY_META: Record<PickPriority, { label: string; cls: string }> = {
  OVERNIGHT: { label: "Overnight", cls: "text-purple-400 bg-purple-500/10" },
  SAME_DAY:  { label: "Same Day",  cls: "text-red-400 bg-red-500/10" },
  RUSH:      { label: "Rush",      cls: "text-orange-400 bg-orange-500/10" },
  STANDARD:  { label: "Standard",  cls: "text-slate-400 bg-slate-500/10" },
};

const METHOD_META: Record<PickingMethod, { label: string; color: string }> = {
  BATCH:     { label: "Batch",   color: "var(--color-primary)" },
  ZONE:      { label: "Zone",    color: "var(--color-info)" },
  CLUSTER:   { label: "Cluster", color: "var(--color-success)" },
  WAVE_PICK: { label: "Wave",    color: "var(--color-warning)" },
  SINGLE:    { label: "Single",  color: "#a78bfa" },
};

const TASK_STATUS_META: Record<PickTaskStatus, { label: string; cls: string }> = {
  PENDING:     { label: "Pending",     cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
  ASSIGNED:    { label: "Assigned",    cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  IN_PROGRESS: { label: "In Progress", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  PICKED:      { label: "Picked",      cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  SHORT:       { label: "Short",       cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  SUBSTITUTED: { label: "Substituted", cls: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  SKIPPED:     { label: "Skipped",     cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
};

const SHORT_REASON_LABEL: Record<Shortage["reason"], string> = {
  OUT_OF_STOCK: "Out of stock", BIN_EMPTY: "Bin empty", DAMAGED: "Damaged", WRONG_LOCATION: "Wrong location", RESERVED: "Reserved",
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function WaveStatusBadge({ status }: { status: WaveStatus }) {
  const m = WAVE_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}
function PriorityTag({ p }: { p: PickPriority }) {
  const m = PRIORITY_META[p];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide", m.cls)}>{m.label}</span>;
}
function MethodTag({ m: method }: { m: PickingMethod }) {
  const meta = METHOD_META[method];
  return <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide border" style={{ color: meta.color, borderColor: meta.color + "55", background: meta.color + "15" }}>{meta.label}</span>;
}
function TaskStatusTag({ status }: { status: PickTaskStatus }) {
  const m = TASK_STATUS_META[status];
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

function PickThroughputChart() {
  const data = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      hour: `${String((6 + i) % 24).padStart(2, "0")}:00`,
      picked: Math.floor(120 + Math.abs(Math.sin(i + 1)) * 480),
      short: i % 3 === 0 ? Math.floor(5 + Math.random() * 18) : Math.floor(Math.random() * 8),
    })),
    [],
  );
  return (
    <Section title="Pick Throughput" sub="Units picked vs shorted — last 12 hours" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} interval={1} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={36} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="picked" stackId="a" fill="var(--color-primary)" name="Picked" />
            <Bar dataKey="short" stackId="a" fill="var(--color-destructive)" radius={[3, 3, 0, 0]} name="Short" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function MethodMixCard() {
  const mix = usePickingStore((s) => s.methodMix)();
  const total = mix.reduce((s, m) => s + m.count, 0) || 1;
  return (
    <Section title="Pick Method Mix" sub="Active waves by strategy" className="h-[240px]">
      <div className="p-4 space-y-2.5">
        {mix.map((m) => {
          const meta = METHOD_META[m.method];
          return (
            <div key={m.method}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: meta.color }} /> {meta.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{m.count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(m.count / total) * 100}%`, background: meta.color }} />
              </div>
            </div>
          );
        })}
        {mix.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No active waves.</div>}
      </div>
    </Section>
  );
}

function ZoneLoadChart() {
  const dist = usePickingStore((s) => s.zoneLoad)();
  const data = dist.map((d) => ({ zone: d.zone, open: d.open, picked: d.picked }));
  return (
    <Section title="Zone Pick Load" sub="Open vs picked lines by zone" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="zone" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={72} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="open" stackId="z" fill="var(--color-warning)" name="Open" barSize={14} />
            <Bar dataKey="picked" stackId="z" fill="var(--color-success)" radius={[0, 3, 3, 0]} name="Picked" barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function ShortageAlerts() {
  const shortages = usePickingStore((s) => s.shortages);
  const open = shortages.filter((s) => s.status === "OPEN").slice(0, 9);
  return (
    <Section title="Open Shortages" sub={`${shortages.filter((s) => s.status === "OPEN").length} unresolved`} className="h-full">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
        {open.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/40" /><span className="text-sm">No open shortages.</span>
          </div>
        )}
        {open.map((s) => (
          <div key={s.id} className="flex items-start gap-3 px-4 py-3">
            <PackageX className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-primary">{s.skuCode}</span>
                <span className="text-xs text-muted-foreground truncate">{s.orderId}</span>
              </div>
              <div className="text-[11px] text-red-400/90 mt-0.5">{SHORT_REASON_LABEL[s.reason]} · short {s.qtyShort} of {s.qtyRequired}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function OverviewView() {
  const kpis = usePickingStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="ACTIVE WAVES" value={kpis.activeWaves} tone="primary" sub="released / in progress" />
        <KPICard label="OPEN PICKS" value={kpis.openPicks} tone="info" sub="lines outstanding" />
        <KPICard label="PICKED TODAY" value={fmtNum(kpis.pickedToday)} tone="success" delta="↑ 6% vs avg" />
        <KPICard label="PICK ACCURACY" value={kpis.pickAccuracy} tone="info" sub="units vs short" />
        <KPICard label="OPEN SHORTS" value={kpis.shorts} tone="destructive" sub="need resolution" />
        <KPICard label="UNITS / HR" value={kpis.avgPicksPerHour} tone="success" sub="pick rate" />
        <KPICard label="PENDING RELEASE" value={kpis.pendingRelease} tone="warning" sub="draft waves" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PickThroughputChart />
        <MethodMixCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ZoneLoadChart />
        <ShortageAlerts />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  WAVES
// ════════════════════════════════════════════════════════════════════════════

function WavesView({ onOpen }: { onOpen: (w: Wave) => void }) {
  const { filters, setFilters, resetFilters, page, setPage, pageSize } = usePickingStore();
  const all = usePickingStore((s) => s.filteredWaves)();
  const zones = usePickingStore((s) => s.zoneList)();

  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.method || filters.priority || filters.zone;

  return (
    <Section title="Wave Queue" sub={`${all.length} waves matched`} actions={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search wave or carrier…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as WaveStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(WAVE_STATUS_META) as WaveStatus[]).map((s) => <SelectItem key={s} value={s}>{WAVE_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.method || "all"} onValueChange={(v) => setFilters({ method: v === "all" ? "" : v as PickingMethod })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {(Object.keys(METHOD_META) as PickingMethod[]).map((m) => <SelectItem key={m} value={m}>{METHOD_META[m].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v as PickPriority })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {(Object.keys(PRIORITY_META) as PickPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.zone || "all"} onValueChange={(v) => setFilters({ zone: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All zones</SelectItem>
            {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Wave #</th>
              <th className="text-left font-semibold py-2.5 px-3">Method</th>
              <th className="text-right font-semibold py-2.5 px-3">Orders</th>
              <th className="text-right font-semibold py-2.5 px-3">Lines</th>
              <th className="text-right font-semibold py-2.5 px-3">Units</th>
              <th className="text-left font-semibold py-2.5 px-3 w-36">Progress</th>
              <th className="text-right font-semibold py-2.5 px-3">Short</th>
              <th className="text-left font-semibold py-2.5 px-3">Carrier</th>
              <th className="text-left font-semibold py-2.5 px-3">Due</th>
              <th className="text-left font-semibold py-2.5 px-3">Priority</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((w) => {
              const pct = w.totalUnits > 0 ? Math.round((w.pickedUnits / w.totalUnits) * 100) : 0;
              const due = dueLabel(w.dueBy);
              const active = !["COMPLETED", "CANCELLED"].includes(w.status);
              return (
                <tr key={w.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpen(w)}>
                  <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap">{w.waveNumber}</td>
                  <td className="py-2 px-3"><MethodTag m={w.pickMethod} /></td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{w.totalOrders}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{w.totalLines}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{fmtNum(w.totalUnits)}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5 w-16 shrink-0" />
                      <span className="text-[11px] font-mono tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className={cn("py-2 px-3 text-right font-mono tabular-nums text-xs", w.shortUnits > 0 ? "text-red-400" : "text-muted-foreground")}>{w.shortUnits || "—"}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{w.carrier}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="text-xs font-mono tabular-nums">{fmtDateTime(w.dueBy)}</div>
                    {active && <div className={cn("text-[10px]", due.tone === "ok" ? "text-muted-foreground" : due.tone === "warn" ? "text-amber-400" : "text-red-400")}>{due.text}</div>}
                  </td>
                  <td className="py-2 px-3"><PriorityTag p={w.priority} /></td>
                  <td className="py-2 px-3"><WaveStatusBadge status={w.status} /></td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
            {paged.length === 0 && <tr><td colSpan={12} className="text-center py-12 text-sm text-muted-foreground">No waves match the current filters.</td></tr>}
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
//  PICK FLOOR
// ════════════════════════════════════════════════════════════════════════════

function PickFloorView({ onOpenWave }: { onOpenWave: (w: Wave) => void }) {
  const allActive = usePickingStore((s) => s.activePickTasks)();
  const waves = usePickingStore((s) => s.waves);
  const pickTask = usePickingStore((s) => s.pickTask);
  const reportShort = usePickingStore((s) => s.reportShort);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const currentUserName = useAuthStore((s) => s.session?.user.name);
  // "My Tasks" filters to whatever's assigned to the logged-in user's name — the
  // only link between login identity and pick-floor assignment right now, since
  // the demo login roster and the labor roster are separate seed sources with no
  // shared id. Defaults on for non-admin roles so a picker only sees their own work.
  const [myTasksOnly, setMyTasksOnly] = useState(true);
  const active = myTasksOnly && currentUserName
    ? allActive.filter((t) => t.assignedPickerName === currentUserName)
    : allActive;

  return (
    <Section
      title="Pick Floor"
      sub={`${active.length} open pick lines${myTasksOnly && currentUserName ? ` assigned to ${currentUserName}` : " across active waves"} · sorted by due time`}
      actions={
        currentUserName ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={myTasksOnly} onChange={(e) => setMyTasksOnly(e.target.checked)} className="accent-primary" />
            My tasks only
          </label>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Wave</th>
              <th className="text-left font-semibold py-2.5 px-3">Order</th>
              <th className="text-left font-semibold py-2.5 px-3">SKU</th>
              <th className="text-left font-semibold py-2.5 px-3">Bin</th>
              <th className="text-left font-semibold py-2.5 px-3">Loc</th>
              <th className="text-left font-semibold py-2.5 px-3">Zone</th>
              <th className="text-left font-semibold py-2.5 px-3">Lot / Batch</th>
              <th className="text-left font-semibold py-2.5 px-3">Exp</th>
              <th className="text-left font-semibold py-2.5 px-3">Tote / Bay</th>
              <th className="text-right font-semibold py-2.5 px-3">Req</th>
              <th className="text-right font-semibold py-2.5 px-3">Picked</th>
              <th className="text-left font-semibold py-2.5 px-3">Picker</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="text-right font-semibold py-2.5 px-3 w-52">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {active.map((t) => {
              const wave = waves.find((w) => w.id === t.waveId);
              return (
                <tr key={t.id} className="hover:bg-accent/15 transition-colors">
                  <td className="py-2 px-3"><button onClick={() => wave && onOpenWave(wave)} className="font-mono text-primary text-xs hover:underline">{t.waveNumber}</button></td>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{t.orderId}</td>
                  <td className="py-2 px-3">
                    <div className="text-xs font-mono text-primary">{t.skuCode}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-36">{t.skuName}</div>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">{t.binCode}</td>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{t.aisle}/{t.rack}/{t.level}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">{t.zone}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{t.lotNumber ?? "—"}<span className="opacity-50"> / </span>{t.batchNumber ?? "—"}</td>
                  <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap">{t.expiryDate ? <span className="text-amber-400">{t.expiryDate}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{t.toteId ?? "—"}<span className="opacity-50"> / </span>{t.sortationBay ?? "—"}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{t.qtyRequired} <span className="text-muted-foreground">{t.uom}</span></td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-emerald-400">{t.qtyPicked}</td>
                  <td className="py-2 px-3 text-xs whitespace-nowrap">{t.assignedPickerName ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-3"><TaskStatusTag status={t.status} /></td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      {pickingId === t.id ? (
                        <>
                          <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={`${t.qtyRequired - t.qtyPicked}`} className="w-16 h-7 text-xs" />
                          <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { const q = parseInt(qty); if (q > 0) { pickTask(t.waveId, t.id, q); setPickingId(null); setQty(""); } }}><ScanLine className="h-3 w-3" /> OK</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => setPickingId(null)}><X className="h-3 w-3" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPickingId(t.id)}>Pick</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => reportShort(t.waveId, t.id, t.qtyPicked, "BIN_EMPTY")}>Short</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {active.length === 0 && (
              <tr><td colSpan={14} className="text-center py-12 text-sm text-muted-foreground">No open pick lines. Release a wave to populate the floor.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  PICKERS
// ════════════════════════════════════════════════════════════════════════════

function PickersView() {
  const prod = usePickingStore((s) => s.pickerProductivity)();
  const sorted = [...prod].sort((a, b) => b.picked - a.picked);
  const maxPicked = Math.max(1, ...prod.map((p) => p.picked));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="ACTIVE PICKERS" value={prod.length} tone="primary" sub="on shift" />
        <KPICard label="UNITS PICKED" value={fmtNum(prod.reduce((s, p) => s + p.picked, 0))} tone="success" sub="this shift" />
        <KPICard label="UNITS SHORT" value={prod.reduce((s, p) => s + p.short, 0)} tone="destructive" sub="exceptions" />
        <KPICard label="AVG ACCURACY" value={`${Math.round(prod.reduce((s, p) => s + p.accuracy, 0) / (prod.length || 1))}%`} tone="info" sub="fill rate" />
      </div>
      <Section title="Picker Productivity" sub="Units picked, shorts and accuracy by operator">
        <div className="divide-y divide-border/40">
          {sorted.map((p) => (
            <div key={p.name} className="flex items-center gap-4 px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">{initials(p.name)}</div>
              <div className="w-40 shrink-0 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">{p.short > 0 ? `${p.short} short units` : "no shorts"}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(p.picked / maxPicked) * 100}%` }} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 font-mono">{fmtNum(p.picked)} units picked</div>
              </div>
              <div className="text-right shrink-0 w-16">
                <div className={cn("text-lg font-bold font-mono tabular-nums", p.accuracy >= 98 ? "text-emerald-400" : p.accuracy >= 90 ? "text-amber-400" : "text-red-400")}>{p.accuracy}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">accuracy</div>
              </div>
            </div>
          ))}
          {sorted.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">No picker activity yet.</div>}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SHORTAGES
// ════════════════════════════════════════════════════════════════════════════

function ShortagesView() {
  const shortages = usePickingStore((s) => s.shortages);
  const resolveShortage = usePickingStore((s) => s.resolveShortage);
  const [filter, setFilter] = useState("all");

  const filtered = shortages.filter((s) => filter === "all" || s.status === filter);
  const counts = {
    open: shortages.filter((s) => s.status === "OPEN").length,
    backorder: shortages.filter((s) => s.status === "BACKORDER").length,
    substituted: shortages.filter((s) => s.status === "SUBSTITUTED").length,
    cancelled: shortages.filter((s) => s.status === "CANCELLED").length,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="OPEN" value={counts.open} tone="destructive" sub="awaiting action" />
        <KPICard label="BACKORDERED" value={counts.backorder} tone="warning" sub="re-sourced" />
        <KPICard label="SUBSTITUTED" value={counts.substituted} tone="info" sub="alt SKU" />
        <KPICard label="CANCELLED" value={counts.cancelled} tone="success" sub="closed" />
      </div>

      <Section
        title="Shortage Register"
        sub={`${filtered.length} records`}
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="BACKORDER">Backorder</SelectItem>
              <SelectItem value="SUBSTITUTED">Substituted</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-semibold py-2.5 px-3">SKU</th>
                <th className="text-left font-semibold py-2.5 px-3">Order</th>
                <th className="text-left font-semibold py-2.5 px-3">Wave</th>
                <th className="text-left font-semibold py-2.5 px-3">Reason</th>
                <th className="text-right font-semibold py-2.5 px-3">Req</th>
                <th className="text-right font-semibold py-2.5 px-3">Avail</th>
                <th className="text-right font-semibold py-2.5 px-3">Short</th>
                <th className="text-left font-semibold py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-accent/15">
                  <td className="py-2.5 px-3">
                    <div className="text-xs font-mono text-primary">{s.skuCode}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-36">{s.skuName}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{s.orderId}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{s.waveId}</td>
                  <td className="py-2.5 px-3 text-xs">{SHORT_REASON_LABEL[s.reason]}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{s.qtyRequired}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{s.qtyAvailable}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-red-400">{s.qtyShort}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border",
                      s.status === "OPEN" ? "text-red-400 bg-red-500/10 border-red-500/30" :
                      s.status === "BACKORDER" ? "text-amber-400 bg-amber-500/10 border-amber-500/30" :
                      s.status === "SUBSTITUTED" ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" :
                      "text-slate-400 bg-slate-500/10 border-slate-500/30")}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {s.status === "OPEN" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolveShortage(s.id, "Backordered — replenishment requested")}>Resolve</Button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">No shortages in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  WAVE DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function RouteMap({ route }: { route: RouteResult }) {
  const wh = useEditorStore((s) => s.warehouse);
  const W = 360, H = 220, pad = 14;
  const sx = (wh.size.w || 1), sz = (wh.size.d || 1);
  const px = (x: number) => pad + (x / sx) * (W - pad * 2);
  const pz = (z: number) => pad + (z / sz) * (H - pad * 2);
  const pts = [route.start, ...route.stops, route.end];
  const line = pts.map((p) => `${px(p.x).toFixed(1)},${pz(p.z).toFixed(1)}`).join(" ");

  return (
    <div className="rounded-lg border border-border bg-background/40 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
        {wh.zones.map((z) => (
          <rect key={z.id} x={px(z.bounds.x)} y={pz(z.bounds.z)} width={(z.bounds.w / sx) * (W - pad * 2)} height={(z.bounds.d / sz) * (H - pad * 2)}
            fill={z.color} fillOpacity={0.08} stroke={z.color} strokeOpacity={0.3} strokeWidth={0.5} rx={2} />
        ))}
        <polyline points={line} fill="none" stroke="var(--color-primary)" strokeWidth={1.6} strokeOpacity={0.7} strokeDasharray="3 2" />
        <circle cx={px(route.start.x)} cy={pz(route.start.z)} r={6} fill="var(--color-secondary)" stroke="var(--color-border)" />
        <text x={px(route.start.x)} y={pz(route.start.z) + 2.5} textAnchor="middle" fontSize={6} fill="var(--color-foreground)">S</text>
        {route.stops.map((st) => (
          <g key={st.taskId}>
            <circle cx={px(st.x)} cy={pz(st.z)} r={7} fill="var(--color-primary)" fillOpacity={0.85} />
            <text x={px(st.x)} y={pz(st.z) + 2.5} textAnchor="middle" fontSize={6.5} fontWeight="bold" fill="var(--color-primary-foreground)">{st.seq}</text>
          </g>
        ))}
        <circle cx={px(route.end.x)} cy={pz(route.end.z)} r={6} fill="#16a34a" />
        <text x={px(route.end.x)} y={pz(route.end.z) + 2.5} textAnchor="middle" fontSize={6} fill="#fff">P</text>
      </svg>
    </div>
  );
}

function WaveDetailDrawer({ waveId, onClose }: { waveId: string | null; onClose: () => void }) {
  const wave = usePickingStore((s) => s.waves.find((w) => w.id === waveId)) ?? null;
  const { releaseWave, startWave, completeWave, cancelWave, pickTask, reportShort } = usePickingStore();
  const route = usePickPathStore((s) => (waveId ? s.routes[waveId] : null)) ?? null;
  const optimize = usePickPathStore((s) => s.optimize);
  const [tab, setTab] = useState("lines");
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [qty, setQty] = useState("");

  if (!wave) return null;
  const pct = wave.totalUnits > 0 ? Math.round((wave.pickedUnits / wave.totalUnits) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{wave.waveNumber}</span>
            <WaveStatusBadge status={wave.status} />
            <PriorityTag p={wave.priority} />
            <MethodTag m={wave.pickMethod} />
          </div>
          <div className="text-sm text-muted-foreground mt-1">{wave.carrier} · Bay {wave.packingBay} · Due {fmtDateTime(wave.dueBy)}</div>
        </div>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-5 gap-2">
          <MiniStat label="Orders" value={`${wave.totalOrders}`} />
          <MiniStat label="Lines" value={`${wave.totalLines}`} />
          <MiniStat label="Units" value={fmtNum(wave.totalUnits)} />
          <MiniStat label="Picked" value={fmtNum(wave.pickedUnits)} tone="text-emerald-400" />
          <MiniStat label="Short" value={`${wave.shortUnits}`} tone={wave.shortUnits ? "text-red-400" : undefined} />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Wave progress</span><span className="font-mono">{pct}%</span></div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          {wave.status === "DRAFT" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => releaseWave(wave.id)}><Zap className="h-3.5 w-3.5" /> Release wave</Button>}
          {wave.status === "RELEASED" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => startWave(wave.id)}><Play className="h-3.5 w-3.5" /> Start wave</Button>}
          {["IN_PROGRESS", "PARTIAL"].includes(wave.status) && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => completeWave(wave.id)}><CheckCircle2 className="h-3.5 w-3.5" /> Complete wave</Button>}
          {!["COMPLETED", "CANCELLED"].includes(wave.status) && <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground ml-auto" onClick={() => { cancelWave(wave.id); onClose(); }}>Cancel</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-5 mt-3 w-fit">
          <TabsTrigger value="lines" className="text-xs">Pick Lines · {wave.totalLines}</TabsTrigger>
          <TabsTrigger value="route" className="text-xs">Route</TabsTrigger>
          <TabsTrigger value="pickers" className="text-xs">Pickers · {wave.assignedPickers.length}</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <TabsContent value="lines" className="mt-3 space-y-2">
            {wave.tasks.map((task) => {
              const tpct = task.qtyRequired > 0 ? Math.min(100, Math.round((task.qtyPicked / task.qtyRequired) * 100)) : 0;
              const canPick = ["IN_PROGRESS", "RELEASED", "PARTIAL"].includes(wave.status) && !["PICKED", "SHORT"].includes(task.status);
              return (
                <div key={task.id} className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">#{task.lineNumber}</span>
                        <span className="font-mono text-xs text-primary">{task.skuCode}</span>
                        <span className="text-xs text-muted-foreground truncate">{task.skuName}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground font-mono">
                        <span>Order <span className="text-foreground">{task.orderId}</span></span>
                        <span>Bin <span className="text-foreground">{task.binCode}</span></span>
                        <span>Loc <span className="text-foreground">{task.aisle}/{task.rack}/{task.level}</span></span>
                        <span>Zone <span className="text-foreground">{task.zone}</span></span>
                        <span>Tote {task.toteId ?? "—"}</span>
                        <span>Bay {task.sortationBay ?? "—"}</span>
                        <span>Lot {task.lotNumber ?? "—"}</span>
                        <span>Batch {task.batchNumber ?? "—"}</span>
                        {task.expiryDate && <span>Exp <span className="text-amber-400">{task.expiryDate}</span></span>}
                        {task.scanConfirmed && <span className="text-emerald-400 inline-flex items-center gap-0.5"><ScanLine className="h-3 w-3" /> scan ok</span>}
                        {task.assignedPickerName && <span>{task.assignedPickerName}</span>}
                      </div>
                      {task.shortReason && <div className="text-[11px] text-red-400 mt-0.5">{task.shortReason}</div>}
                    </div>
                    <TaskStatusTag status={task.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                    <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Req</div><div className="text-sm font-bold font-mono tabular-nums">{task.qtyRequired} <span className="text-[9px] text-muted-foreground font-normal">{task.uom}</span></div></div>
                    <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Picked</div><div className="text-sm font-bold font-mono tabular-nums text-emerald-400">{task.qtyPicked}</div></div>
                    <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Short</div><div className={cn("text-sm font-bold font-mono tabular-nums", task.qtyShort ? "text-red-400" : "")}>{task.qtyShort}</div></div>
                  </div>
                  <div className="flex items-center gap-2 mt-2"><Progress value={tpct} className="h-1.5 flex-1" /><span className="text-[11px] font-mono tabular-nums w-9 text-right">{tpct}%</span></div>
                  {canPick && (
                    pickingId === task.id ? (
                      <div className="flex items-center gap-1 mt-2">
                        <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={`${task.qtyRequired - task.qtyPicked}`} className="h-7 text-xs flex-1" />
                        <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { const q = parseInt(qty); if (q > 0) { pickTask(wave.id, task.id, q); setPickingId(null); setQty(""); } }}><ScanLine className="h-3 w-3" /> Confirm</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => setPickingId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setPickingId(task.id)}>Pick line</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => reportShort(wave.id, task.id, task.qtyPicked, "BIN_EMPTY")}>Report short</Button>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="route" className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">{route ? route.note : "Optimize the shortest pick path for this wave."}</div>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => optimize(wave.id, true)}><Sparkles className="h-3.5 w-3.5" /> {route ? "Re-optimize" : "Optimize route"}</Button>
            </div>

            {route && route.stops.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Stops" value={`${route.stops.length}`} />
                  <MiniStat label="Distance" value={`${route.totalDistance} m`} />
                  <MiniStat label="Walk ETA" value={`${route.etaMin} min`} tone="text-primary" />
                </div>
                <RouteMap route={route} />
                <div className="space-y-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Turn-by-turn</div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-2"><span className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold">S</span> Pick start</div>
                  {route.stops.map((st) => (
                    <div key={st.taskId} className="flex items-center gap-2 rounded border border-border/60 bg-card/40 px-2.5 py-1.5">
                      <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{st.seq}</span>
                      <span className="font-mono text-xs text-foreground w-28 shrink-0">{st.binCode}</span>
                      <span className="font-mono text-[11px] text-primary shrink-0">{st.skuCode}</span>
                      <span className="text-[11px] text-muted-foreground ml-auto shrink-0">×{st.qty}</span>
                      <span className="text-[10px] text-muted-foreground font-mono w-14 text-right shrink-0">{st.legDistance}m</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-2"><span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-bold">P</span> Packing bay {wave.packingBay}</div>
                </div>
              </>
            )}
            {route && route.stops.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">{route.note}</div>}
          </TabsContent>

          <TabsContent value="pickers" className="mt-3 space-y-2">
            {wave.assignedPickers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No pickers assigned to this wave.</div>
            ) : wave.assignedPickers.map((picker) => {
              const tasks = wave.tasks.filter((t) => t.assignedPickerName === picker);
              const picked = tasks.filter((t) => t.status === "PICKED").length;
              const ppct = tasks.length > 0 ? Math.round((picked / tasks.length) * 100) : 0;
              return (
                <div key={picker} className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center text-xs font-bold">{initials(picker)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{picker}</span>
                        <span className="text-xs text-muted-foreground font-mono">{picked}/{tasks.length} lines</span>
                      </div>
                      <Progress value={ppct} className="h-1.5 mt-1.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "waves" | "floor" | "pickers" | "shortages";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",  label: "Overview",   icon: LayoutDashboard },
  { id: "waves",     label: "Waves",      icon: WavesIcon },
  { id: "floor",     label: "Pick Floor", icon: ListChecks },
  { id: "pickers",   label: "Pickers",    icon: Users },
  { id: "shortages", label: "Shortages",  icon: PackageX },
];

export function PickingPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openWaveId, setOpenWaveId] = useState<string | null>(null);
  const kpis = usePickingStore((s) => s.kpis)();

  const openWave = (w: Wave) => setOpenWaveId(w.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={PackageSearch}
        title="Picking"
        subtitle="Wave management · pick-floor dispatch · picker productivity · shortage resolution"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><Target className="h-3.5 w-3.5" /> Plan wave</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"><Zap className="h-3.5 w-3.5" /> Release next</Button>
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "shortages" && kpis.shorts > 0 ? kpis.shorts : id === "floor" && kpis.openPicks > 0 ? kpis.openPicks : null;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && <span className={cn("ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums", id === "shortages" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview"  && <OverviewView />}
        {tab === "waves"     && <WavesView onOpen={openWave} />}
        {tab === "floor"     && <PickFloorView onOpenWave={openWave} />}
        {tab === "pickers"   && <PickersView />}
        {tab === "shortages" && <ShortagesView />}
      </div>

      <Sheet open={!!openWaveId} onOpenChange={(o) => !o && setOpenWaveId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <WaveDetailDrawer waveId={openWaveId} onClose={() => setOpenWaveId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
