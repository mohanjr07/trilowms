/**
 * TriloWMS — Putaway Module
 * Directed putaway engine: task queue, operator dispatch, rule-based bin
 * routing, exception handling and throughput analytics.
 *
 * Layout: PageHeader → sub-tab workspace (Overview · Task Queue · Operators ·
 * Rules) → shared task detail drawer.
 */

import { useMemo, useState } from "react";
import {
  PackageOpen, Search, X, ChevronRight, MapPin, User, AlertTriangle, CheckCircle2,
  RefreshCw, LayoutDashboard, ClipboardList, Users, Settings2, Boxes, Forklift,
  Hash, Layers, Weight, Route, Timer, ArrowRight, Ban, PlayCircle, FileDown, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  usePutawayStore, PUTAWAY_STATUS_META,
  type PutawayTask, type PutawayStatus, type PutawayStrategy,
} from "@/lib/putaway-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers & meta ───────────────────────────────────────────────────────────

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const zoneShort = (z: string) => z.split(" — ")[1] ?? z;

const PRIORITY_META: Record<PutawayTask["priority"], { label: string; cls: string }> = {
  URGENT: { label: "Urgent", cls: "text-red-400 bg-red-500/10" },
  HIGH:   { label: "High",   cls: "text-orange-400 bg-orange-500/10" },
  NORMAL: { label: "Normal", cls: "text-slate-300 bg-slate-600/10" },
  LOW:    { label: "Low",    cls: "text-slate-400 bg-slate-500/10" },
};

const STRATEGY_META: Record<PutawayStrategy, { label: string; color: string }> = {
  DIRECTED:   { label: "Directed",   color: "var(--color-primary)" },
  ZONE_BASED: { label: "Zone-based", color: "var(--color-info)" },
  FEFO:       { label: "FEFO",       color: "var(--color-success)" },
  FIFO:       { label: "FIFO",       color: "#a78bfa" },
  CHAOTIC:    { label: "Chaotic",    color: "var(--color-warning)" },
  FIXED:      { label: "Fixed",      color: "#fb923c" },
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PutawayStatus }) {
  const m = PUTAWAY_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}

function PriorityTag({ p }: { p: PutawayTask["priority"] }) {
  const m = PRIORITY_META[p];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide", m.cls)}>{m.label}</span>;
}

function StrategyTag({ s }: { s: PutawayStrategy }) {
  const m = STRATEGY_META[s];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide border" style={{ color: m.color, borderColor: m.color + "55", background: m.color + "15" }}>
      {m.label}
    </span>
  );
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

function ThroughputChart() {
  const data = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      hour: `${String((6 + i) % 24).padStart(2, "0")}:00`,
      completed: Math.floor(22 + Math.abs(Math.sin(i + 1)) * 52),
      blocked: i % 4 === 0 ? Math.floor(1 + Math.random() * 4) : Math.floor(Math.random() * 2),
    })),
    [],
  );
  return (
    <Section title="Putaway Throughput" sub="Completed vs blocked tasks — last 12 hours" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} interval={1} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={32} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="completed" stackId="a" fill="var(--color-primary)" radius={[0, 0, 0, 0]} name="Completed" />
            <Bar dataKey="blocked" stackId="a" fill="var(--color-destructive)" radius={[3, 3, 0, 0]} name="Blocked" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function StrategyMixCard() {
  const mix = usePutawayStore((s) => s.strategyMix)();
  const totalCount = mix.reduce((s, m) => s + m.count, 0) || 1;
  return (
    <Section title="Strategy Mix" sub="Active tasks by routing strategy" className="h-[240px]">
      <div className="p-4 space-y-2.5">
        {mix.map((m) => {
          const meta = STRATEGY_META[m.strategy];
          return (
            <div key={m.strategy}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: meta.color }} /> {meta.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{m.count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(m.count / totalCount) * 100}%`, background: meta.color }} />
              </div>
            </div>
          );
        })}
        {mix.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No active tasks.</div>}
      </div>
    </Section>
  );
}

function ZoneLoadChart() {
  const dist = usePutawayStore((s) => s.zoneDistribution)();
  const data = dist.map((d) => ({ zone: zoneShort(d.zone), open: d.open, completed: d.completed }));
  return (
    <Section title="Zone Load" sub="Open vs completed putaway by storage zone" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="zone" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={84} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="open" stackId="z" fill="var(--color-warning)" name="Open" barSize={14} />
            <Bar dataKey="completed" stackId="z" fill="var(--color-success)" radius={[0, 3, 3, 0]} name="Completed" barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function BlockedAlerts({ onOpen }: { onOpen: (t: PutawayTask) => void }) {
  const blocked = usePutawayStore((s) => s.blockedTasks)();
  return (
    <Section title="Exceptions" sub={`${blocked.length} blocked tasks need attention`} className="h-full">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
        {blocked.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
            <span className="text-sm">No blocked tasks. Floor is clear.</span>
          </div>
        )}
        {blocked.map((t) => (
          <button key={t.id} onClick={() => onOpen(t)} className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-primary">{t.id}</span>
                <span className="text-xs text-muted-foreground truncate">{t.skuCode}</span>
              </div>
              <div className="text-[11px] text-red-400/90 mt-0.5 truncate">{t.blockedReason}</div>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{fmtTime(t.createdAt)}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function OverviewView({ onOpen }: { onOpen: (t: PutawayTask) => void }) {
  const kpis = usePutawayStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="OPEN TASKS" value={kpis.open} tone="primary" sub="awaiting dispatch" />
        <KPICard label="ASSIGNED" value={kpis.assigned} tone="info" sub="operator queued" />
        <KPICard label="IN PROGRESS" value={kpis.inProgress} tone="warning" sub="on the floor" />
        <KPICard label="DONE TODAY" value={kpis.completedToday} tone="success" delta="↑ on target" />
        <KPICard label="BLOCKED" value={kpis.blocked} tone="destructive" sub="exceptions" />
        <KPICard label="AVG CYCLE" value={kpis.avgCycleTime} tone="info" sub="per task" />
        <KPICard label="THRUPUT/HR" value={kpis.throughputPerHour} tone="success" sub="completed rate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ThroughputChart />
        <StrategyMixCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ZoneLoadChart />
        <BlockedAlerts onOpen={onOpen} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  TASK QUEUE
// ════════════════════════════════════════════════════════════════════════════

function TaskQueueView({ onOpen }: { onOpen: (t: PutawayTask) => void }) {
  const { filters, setFilters, resetFilters, page, setPage, pageSize } = usePutawayStore();
  const all = usePutawayStore((s) => s.filteredTasks)();
  const operators = usePutawayStore((s) => s.operatorList)();
  const zones = usePutawayStore((s) => s.zoneList)();

  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.priority || filters.zone || filters.operator || filters.strategy;

  return (
    <Section
      title="Putaway Task Queue"
      sub={`${all.length} tasks matched`}
      actions={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>}
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search task, SKU or pallet…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as PutawayStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED"] as PutawayStatus[]).map((s) => <SelectItem key={s} value={s}>{PUTAWAY_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.zone || "all"} onValueChange={(v) => setFilters({ zone: v === "all" ? "" : v })}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All zones</SelectItem>
            {zones.map((z) => <SelectItem key={z} value={z}>{zoneShort(z)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.operator || "all"} onValueChange={(v) => setFilters({ operator: v === "all" ? "" : v })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Operator" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All operators</SelectItem>
            {operators.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {["URGENT", "HIGH", "NORMAL", "LOW"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Task ID</th>
              <th className="text-left font-semibold py-2.5 px-3">SKU</th>
              <th className="text-right font-semibold py-2.5 px-3">Qty</th>
              <th className="text-left font-semibold py-2.5 px-3">Pallet</th>
              <th className="text-left font-semibold py-2.5 px-3">Routing</th>
              <th className="text-left font-semibold py-2.5 px-3">Zone</th>
              <th className="text-left font-semibold py-2.5 px-3">Strategy</th>
              <th className="text-left font-semibold py-2.5 px-3">Operator</th>
              <th className="text-left font-semibold py-2.5 px-3">Priority</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((t) => (
              <tr key={t.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpen(t)}>
                <td className="py-2 px-3 font-mono text-xs text-primary whitespace-nowrap">{t.id}</td>
                <td className="py-2 px-3">
                  <div className="text-xs font-mono text-primary">{t.skuCode}</div>
                  <div className="text-[11px] text-muted-foreground truncate max-w-40">{t.skuName}</div>
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-xs whitespace-nowrap">{t.quantity} <span className="text-muted-foreground">{t.uom}</span></td>
                <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">{t.palletId ?? "—"}</td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono">
                    <span className="text-muted-foreground">{t.sourceDock ?? t.sourceLocation}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={cn(t.actualBinCode ? "text-emerald-400" : "text-foreground")}>{t.actualBinCode ?? t.suggestedBinCode ?? "—"}</span>
                  </span>
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{zoneShort(t.zone)}</td>
                <td className="py-2 px-3"><StrategyTag s={t.strategy} /></td>
                <td className="py-2 px-3 text-xs whitespace-nowrap">{t.assignedOperator ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                <td className="py-2 px-3"><PriorityTag p={t.priority} /></td>
                <td className="py-2 px-3"><StatusBadge status={t.status} /></td>
                <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
              </tr>
            ))}
            {paged.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-sm text-muted-foreground">No tasks match the current filters.</td></tr>}
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
//  OPERATORS
// ════════════════════════════════════════════════════════════════════════════

function OperatorsView() {
  const workloads = usePutawayStore((s) => s.operatorWorkloads)();
  const tasks = usePutawayStore((s) => s.tasks);
  const maxLoad = Math.max(1, ...workloads.map((w) => w.assigned + w.inProgress + w.completed));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="ACTIVE OPERATORS" value={workloads.length} tone="primary" sub="on shift" />
        <KPICard label="ASSIGNED" value={workloads.reduce((s, w) => s + w.assigned, 0)} tone="info" sub="queued tasks" />
        <KPICard label="IN PROGRESS" value={workloads.reduce((s, w) => s + w.inProgress, 0)} tone="warning" sub="being worked" />
        <KPICard label="COMPLETED" value={workloads.reduce((s, w) => s + w.completed, 0)} tone="success" sub="this shift" />
      </div>

      <Section title="Operator Workload" sub="Live task distribution across forklift & pallet-jack operators">
        <div className="divide-y divide-border/40">
          {workloads.map((op) => {
            const active = op.assigned + op.inProgress;
            const totalT = active + op.completed;
            const lastTask = tasks.find((t) => t.assignedOperatorId === op.operatorId && t.status === "IN_PROGRESS");
            return (
              <div key={op.operatorId} className="flex items-center gap-4 px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">{initials(op.operatorName)}</div>
                <div className="min-w-0 w-44 shrink-0">
                  <div className="text-sm font-medium truncate">{op.operatorName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{lastTask ? `On ${lastTask.id} · ${zoneShort(lastTask.zone)}` : "Idle / queued"}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex h-2 w-full rounded-full overflow-hidden bg-secondary">
                    <div className="bg-blue-500" style={{ width: `${(op.assigned / maxLoad) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(op.inProgress / maxLoad) * 100}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${(op.completed / maxLoad) * 100}%` }} />
                  </div>
                  <div className="flex gap-4 mt-1.5 text-[11px]">
                    <span className="text-blue-400">Assigned {op.assigned}</span>
                    <span className="text-amber-400">In progress {op.inProgress}</span>
                    <span className="text-emerald-400">Done {op.completed}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 w-20">
                  <div className={cn("text-lg font-bold font-mono tabular-nums", active > 3 ? "text-amber-400" : "text-emerald-400")}>{active}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">active</div>
                </div>
              </div>
            );
          })}
          {workloads.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">No operators currently assigned.</div>}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  RULES
// ════════════════════════════════════════════════════════════════════════════

function RulesView() {
  const rules = usePutawayStore((s) => s.rules);
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="TOTAL RULES" value={rules.length} tone="primary" sub="in rule book" />
        <KPICard label="ACTIVE" value={rules.filter((r) => r.active).length} tone="success" sub="enforced" />
        <KPICard label="STRATEGIES" value={new Set(rules.map((r) => r.strategy)).size} tone="info" sub="distinct" />
        <KPICard label="TARGET ZONES" value={new Set(rules.map((r) => r.targetZone)).size} tone="warning" sub="routed to" />
      </div>

      <Section title="Putaway Rule Book" sub="Evaluated top-to-bottom by priority; first match wins">
        <div className="divide-y divide-border/40">
          {sorted.map((rule) => (
            <div key={rule.id} className="flex items-start gap-4 px-4 py-3">
              <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0 font-mono">{rule.priority}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{rule.name}</span>
                  <StrategyTag s={rule.strategy} />
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border", rule.active ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-slate-400 bg-slate-500/10 border-slate-500/30")}>
                    {rule.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{rule.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                  <span>Category <span className="text-foreground">{rule.skuCategory}</span></span>
                  <span>Storage <span className="text-foreground">{rule.storageType}</span></span>
                  <span className="inline-flex items-center gap-1">Routes to <span className="text-cyan-400 inline-flex items-center gap-1"><ArrowRight className="h-3 w-3" /> {rule.targetZone}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  TASK DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function DetailRow({ icon: Icon, label, value, accent }: { icon: typeof Hash; label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Icon className="h-3 w-3" /> {label}</div>
      <div className={cn("text-sm font-medium mt-1 font-mono tabular-nums break-words", accent)}>{value}</div>
    </div>
  );
}

function TaskDetailDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const task = usePutawayStore((s) => s.tasks.find((t) => t.id === taskId)) ?? null;
  const { assignOperator, startTask, completeTask, blockTask, cancelTask } = usePutawayStore();
  const [completeBin, setCompleteBin] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [mode, setMode] = useState<"none" | "complete" | "block">("none");

  if (!task) return null;
  const m = PUTAWAY_STATUS_META[task.status];
  const binMatch = task.actualBinCode && task.actualBinCode === task.suggestedBinCode;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{task.id}</span>
            <StatusBadge status={task.status} />
            <PriorityTag p={task.priority} />
          </div>
          <div className="text-sm text-muted-foreground mt-1">{task.skuName}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Routing strip */}
        <div className="rounded-lg border border-border bg-card/40 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Directed Routing</div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-center flex-1">
              <div className="text-[10px] text-muted-foreground">From</div>
              <div className="text-sm font-mono font-bold">{task.sourceDock ?? task.sourceLocation}</div>
            </div>
            <Route className="h-4 w-4 text-primary shrink-0" />
            <div className="text-center flex-1">
              <div className="text-[10px] text-muted-foreground">Suggested bin</div>
              <div className="text-sm font-mono font-bold text-primary">{task.suggestedBinCode ?? "—"}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-center flex-1">
              <div className="text-[10px] text-muted-foreground">Actual bin</div>
              <div className={cn("text-sm font-mono font-bold", task.actualBinCode ? "text-emerald-400" : "text-muted-foreground")}>{task.actualBinCode ?? "pending"}</div>
            </div>
          </div>
          {task.actualBinCode && (
            <div className={cn("mt-2 text-[11px] text-center", binMatch ? "text-emerald-400" : "text-amber-400")}>
              {binMatch ? "Putaway confirmed at suggested location" : "Operator override — stored off-suggestion"}
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2">
          <DetailRow icon={Hash} label="SKU code" value={task.skuCode} accent="text-primary" />
          <DetailRow icon={Boxes} label="Quantity" value={`${task.quantity} ${task.uom}`} />
          <DetailRow icon={Layers} label="Pallet" value={task.palletId ?? "—"} />
          <DetailRow icon={Zap} label="Strategy" value={STRATEGY_META[task.strategy].label} />
          <DetailRow icon={MapPin} label="Zone" value={zoneShort(task.zone)} />
          <DetailRow icon={Forklift} label="Equipment" value={task.equipment ?? "—"} />
          <DetailRow icon={Weight} label="Weight" value={`${task.weight} kg`} />
          <DetailRow icon={Route} label="Travel" value={task.travelDistance ? `${task.travelDistance} m` : "—"} />
          <DetailRow icon={Timer} label="Cycle time" value={task.cycleTime ? `${task.cycleTime} m` : "—"} />
          <DetailRow icon={User} label="Operator" value={task.assignedOperator ?? "Unassigned"} />
          <DetailRow icon={Layers} label="Lot / batch" value={task.lotNumber ?? task.batchNumber ?? "—"} />
          <DetailRow icon={Timer} label="Expiry" value={task.expiryDate ?? "—"} />
          <DetailRow icon={Hash} label="Source ASN" value={task.asnId ?? "—"} />
          <DetailRow icon={Timer} label="Created" value={fmtDateTime(task.createdAt)} />
        </div>

        {/* Blocked banner */}
        {task.blockedReason && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-red-400">Task blocked</div>
              <div className="text-xs text-muted-foreground mt-0.5">{task.blockedReason}</div>
            </div>
          </div>
        )}

        {/* Complete form */}
        {mode === "complete" && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <div className="text-sm font-semibold text-emerald-400">Confirm putaway completion</div>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Actual bin code</span>
              <Input placeholder={task.suggestedBinCode ?? "A-01-R-02-L2-P1"} value={completeBin} onChange={(e) => setCompleteBin(e.target.value)} className="h-8 text-sm mt-1 font-mono" />
            </label>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMode("none")}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => { completeTask(task.id, "bin-actual", completeBin || (task.suggestedBinCode ?? ""), 2.3); setMode("none"); setCompleteBin(""); }}>Confirm receipt</Button>
            </div>
          </div>
        )}

        {/* Block form */}
        {mode === "block" && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
            <div className="text-sm font-semibold text-red-400">Block task</div>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</span>
              <Input placeholder="Bin obstructed, aisle congestion…" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="h-8 text-sm mt-1" />
            </label>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMode("none")}>Cancel</Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { blockTask(task.id, blockReason || "Blocked by operator"); setMode("none"); setBlockReason(""); }}>Block task</Button>
            </div>
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="border-t border-border p-4 flex flex-wrap gap-2">
        {task.status === "PENDING" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => assignOperator(task.id, "op1", "Tommy Wu")}><User className="h-3.5 w-3.5" /> Assign operator</Button>}
        {task.status === "ASSIGNED" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => startTask(task.id)}><PlayCircle className="h-3.5 w-3.5" /> Start task</Button>}
        {task.status === "IN_PROGRESS" && mode === "none" && (
          <>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setMode("complete")}><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-red-400 border-red-500/30" onClick={() => setMode("block")}><Ban className="h-3.5 w-3.5" /> Block</Button>
          </>
        )}
        {task.status === "BLOCKED" && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => startTask(task.id)}><RefreshCw className="h-3.5 w-3.5" /> Unblock & resume</Button>}
        {!["COMPLETED", "CANCELLED"].includes(task.status) && mode === "none" && <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground ml-auto" onClick={() => { cancelTask(task.id); onClose(); }}>Cancel task</Button>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "queue" | "operators" | "rules";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",  label: "Overview",   icon: LayoutDashboard },
  { id: "queue",     label: "Task Queue", icon: ClipboardList },
  { id: "operators", label: "Operators",  icon: Users },
  { id: "rules",     label: "Rules",      icon: Settings2 },
];

export function PutawayPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const kpis = usePutawayStore((s) => s.kpis)();
  const syncFromInbound = usePutawayStore((s) => s.syncFromInbound);

  const open = (t: PutawayTask) => setOpenTaskId(t.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={PackageOpen}
        title="Putaway"
        subtitle="Directed putaway · task dispatch · bin routing · forklift operations"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => syncFromInbound()}><RefreshCw className="h-3.5 w-3.5" /> Generate from Inbound</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"><Zap className="h-3.5 w-3.5" /> Auto-assign</Button>
          </>
        }
      />

      {/* Sub-tab bar */}
      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "queue" && kpis.open > 0 ? kpis.open : id === "overview" && kpis.blocked > 0 ? kpis.blocked : null;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && (
                <span className={cn("ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums",
                  id === "overview" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview"  && <OverviewView onOpen={open} />}
        {tab === "queue"     && <TaskQueueView onOpen={open} />}
        {tab === "operators" && <OperatorsView />}
        {tab === "rules"     && <RulesView />}
      </div>

      {/* Detail drawer */}
      <Sheet open={!!openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <TaskDetailDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
