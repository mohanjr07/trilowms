/**
 * TriloWMS — Labor Management Module
 * Workforce roster, time & attendance, live task allocation, UPH productivity,
 * shift planning and performance leaderboards.
 */

import { useMemo, useState } from "react";
import {
  Users, Search, X, ChevronRight, LogIn, LogOut, Coffee, Play, LayoutDashboard,
  UserCog, Activity, Trophy, Hash, Clock, MapPin, Gauge, Target, FileDown, Award,
  Forklift, ShieldCheck, Mail, Building2, Timer, TrendingUp, Zap, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  useLaborStore, EMPLOYEE_STATUS_META,
  type LaborEmployee, type EmployeeStatus, type ShiftType, type TaskType,
} from "@/lib/labor-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers & meta ───────────────────────────────────────────────────────────

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const initials = (name: string) => name.split(/[\s.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const SHIFT_META: Record<ShiftType, { label: string; color: string }> = {
  A:    { label: "Shift A (Day)",   color: "var(--color-primary)" },
  B:    { label: "Shift B (Swing)", color: "var(--color-info)" },
  C:    { label: "Shift C (Night)", color: "#a78bfa" },
  FLEX: { label: "Flex",            color: "var(--color-warning)" },
};

const TASK_META: Record<TaskType, { label: string; color: string }> = {
  PICKING:  { label: "Picking",  color: "var(--color-primary)" },
  PACKING:  { label: "Packing",  color: "var(--color-info)" },
  PUTAWAY:  { label: "Putaway",  color: "var(--color-success)" },
  INBOUND:  { label: "Inbound",  color: "#a78bfa" },
  OUTBOUND: { label: "Outbound", color: "var(--color-warning)" },
  FORKLIFT: { label: "Forklift", color: "#fb923c" },
  QC:       { label: "QC",       color: "#f472b6" },
  GENERAL:  { label: "General",  color: "var(--color-muted-foreground)" },
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const m = EMPLOYEE_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}
function ShiftTag({ s }: { s: ShiftType }) {
  const m = SHIFT_META[s];
  return <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide border" style={{ color: m.color, borderColor: m.color + "55", background: m.color + "15" }}>{s}</span>;
}
function TaskTag({ t }: { t: TaskType }) {
  const m = TASK_META[t];
  return <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide border" style={{ color: m.color, borderColor: m.color + "55", background: m.color + "15" }}>{m.label}</span>;
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

function uphTone(uph: number, target: number) {
  const pct = target > 0 ? (uph / target) * 100 : 100;
  return pct >= 100 ? "text-emerald-400" : pct >= 85 ? "text-amber-400" : "text-red-400";
}

// ════════════════════════════════════════════════════════════════════════════
//  OVERVIEW
// ════════════════════════════════════════════════════════════════════════════

function UphTrendChart() {
  const data = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      hour: `${String((6 + i) % 24).padStart(2, "0")}:00`,
      uph: Math.floor(130 + Math.abs(Math.sin(i + 1)) * 70),
    })),
    [],
  );
  return (
    <Section title="Productivity Trend" sub="Average units-per-hour vs target — last 12 hours" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} interval={1} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={32} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <ReferenceLine y={160} stroke="var(--color-warning)" strokeDasharray="4 4" label={{ value: "Target", fontSize: 9, fill: "var(--color-warning)", position: "insideTopRight" }} />
            <Bar dataKey="uph" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="UPH" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function ShiftBreakdownCard() {
  const shifts = useLaborStore((s) => s.shiftBreakdown)();
  const maxCount = Math.max(1, ...shifts.map((s) => s.count));
  return (
    <Section title="Shift Headcount" sub="Clocked-in staff & avg UPH by shift" className="h-[240px]">
      <div className="p-4 space-y-3">
        {shifts.map((s) => {
          const meta = SHIFT_META[s.shift];
          return (
            <div key={s.shift}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: meta.color }} /> {meta.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{s.count} · {s.avgUph} uph</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(s.count / maxCount) * 100}%`, background: meta.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function TaskMixChart() {
  const mix = useLaborStore((s) => s.taskTypeMix)();
  const data = mix.map((m) => ({ name: TASK_META[m.type].label, count: m.count }));
  return (
    <Section title="Task Allocation" sub="Active workers by task type" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={64} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 3, 3, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function DepartmentCard() {
  const depts = useLaborStore((s) => s.departmentStats)();
  return (
    <Section title="Department Performance" sub="Headcount, UPH and accuracy by department" className="h-full">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
        {depts.map((d) => (
          <div key={d.department} className="flex items-center gap-3 px-4 py-3">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{d.department}</div><div className="text-[11px] text-muted-foreground">{d.count} on shift</div></div>
            <div className="text-right shrink-0"><div className="text-sm font-bold font-mono tabular-nums">{d.avgUph}</div><div className="text-[10px] text-muted-foreground">uph</div></div>
            <div className="text-right shrink-0 w-14"><div className="text-sm font-bold font-mono tabular-nums text-emerald-400">{d.avgAccuracy}%</div><div className="text-[10px] text-muted-foreground">acc</div></div>
          </div>
        ))}
        {depts.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No active departments.</div>}
      </div>
    </Section>
  );
}

function OverviewView() {
  const kpis = useLaborStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="ON SHIFT" value={kpis.onShift} tone="primary" sub="clocked in + break" />
        <KPICard label="ACTIVE ON TASK" value={kpis.activeOnTask} tone="success" sub="working now" />
        <KPICard label="ON BREAK" value={kpis.onBreak} tone="warning" sub="paused" />
        <KPICard label="AVG UPH" value={kpis.avgUph} tone="info" sub="units / hour" />
        <KPICard label="VS TARGET" value={kpis.targetVsActual} tone="success" sub="attainment" />
        <KPICard label="IDLE RATE" value={kpis.idleRate} tone="destructive" sub="lost time" />
        <KPICard label="OVERTIME" value={`${kpis.overtimeHours}h`} tone="warning" sub="accrued today" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <UphTrendChart />
        <ShiftBreakdownCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TaskMixChart />
        <DepartmentCard />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  WORKFORCE
// ════════════════════════════════════════════════════════════════════════════

function WorkforceView({ onOpen }: { onOpen: (e: LaborEmployee) => void }) {
  const { filters, setFilters, resetFilters, page, setPage, pageSize } = useLaborStore();
  const all = useLaborStore((s) => s.filteredEmployees)();
  const roles = useLaborStore((s) => s.roleList)();
  const depts = useLaborStore((s) => s.departmentList)();

  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.shift || filters.role || filters.department;

  return (
    <Section title="Workforce Roster" sub={`${all.length} employees matched`} actions={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search name, ID or role…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as EmployeeStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(EMPLOYEE_STATUS_META) as EmployeeStatus[]).map((s) => <SelectItem key={s} value={s}>{EMPLOYEE_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.shift || "all"} onValueChange={(v) => setFilters({ shift: v === "all" ? "" : v as ShiftType })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Shift" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All shifts</SelectItem>
            {(Object.keys(SHIFT_META) as ShiftType[]).map((s) => <SelectItem key={s} value={s}>Shift {s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.role || "all"} onValueChange={(v) => setFilters({ role: v === "all" ? "" : v })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.department || "all"} onValueChange={(v) => setFilters({ department: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Dept" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All depts</SelectItem>
            {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Employee</th>
              <th className="text-left font-semibold py-2.5 px-3">Role</th>
              <th className="text-left font-semibold py-2.5 px-3">Dept</th>
              <th className="text-center font-semibold py-2.5 px-3">Shift</th>
              <th className="text-left font-semibold py-2.5 px-3">Task</th>
              <th className="text-left font-semibold py-2.5 px-3">Zone</th>
              <th className="text-right font-semibold py-2.5 px-3 w-32">UPH</th>
              <th className="text-right font-semibold py-2.5 px-3">Acc</th>
              <th className="text-right font-semibold py-2.5 px-3">Hrs</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((e) => {
              const uphPct = e.targetUph > 0 ? Math.min(100, Math.round((e.unitsPerHour / e.targetUph) * 100)) : 0;
              return (
                <tr key={e.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpen(e)}>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">{initials(e.name)}</div>
                      <div className="min-w-0"><div className="text-xs font-medium truncate">{e.name}</div><div className="text-[10px] text-muted-foreground font-mono">{e.employeeId}</div></div>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-xs whitespace-nowrap">{e.role}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{e.department}</td>
                  <td className="py-2 px-3 text-center"><ShiftTag s={e.shift} /></td>
                  <td className="py-2 px-3">{e.currentTaskType ? <TaskTag t={e.currentTaskType} /> : <span className="text-muted-foreground text-xs">—</span>}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{e.currentZone ?? "—"}</td>
                  <td className="py-2 px-3">
                    {e.status === "CLOCKED_IN" ? (
                      <div className="flex items-center gap-2 justify-end">
                        <Progress value={uphPct} className="h-1.5 w-12 shrink-0" />
                        <span className={cn("text-xs font-mono tabular-nums w-8 text-right", uphTone(e.unitsPerHour, e.targetUph))}>{e.unitsPerHour}</span>
                      </div>
                    ) : <span className="text-muted-foreground text-xs block text-right">—</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-emerald-400">{e.accuracyPct}%</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{e.hoursToday}{e.overtimeHours > 0 && <span className="text-amber-400"> +{e.overtimeHours}</span>}</td>
                  <td className="py-2 px-3"><StatusBadge status={e.status} /></td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
            {paged.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-sm text-muted-foreground">No employees match the current filters.</td></tr>}
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
//  LIVE FLOOR
// ════════════════════════════════════════════════════════════════════════════

function LiveFloorView({ onOpen }: { onOpen: (e: LaborEmployee) => void }) {
  const employees = useLaborStore((s) => s.employees);
  const active = employees.filter((e) => e.status === "CLOCKED_IN" && e.currentTaskType);
  const onBreak = employees.filter((e) => e.status === "ON_BREAK");
  const idle = employees.filter((e) => e.status === "CLOCKED_IN" && !e.currentTaskType);

  const zones = useMemo(() => {
    const map = new Map<string, LaborEmployee[]>();
    for (const e of active) { const z = e.currentZone ?? "Unassigned"; map.set(z, [...(map.get(z) ?? []), e]); }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [active]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="ON TASK" value={active.length} tone="success" sub="actively working" />
        <KPICard label="IDLE" value={idle.length} tone="warning" sub="awaiting task" />
        <KPICard label="ON BREAK" value={onBreak.length} tone="info" sub="paused" />
        <KPICard label="ZONES ACTIVE" value={zones.length} tone="primary" sub="staffed areas" />
      </div>

      {zones.map(([zone, emps]) => (
        <Section key={zone} title={zone} sub={`${emps.length} workers · ${Math.round(emps.reduce((s, e) => s + e.unitsPerHour, 0) / emps.length)} avg uph`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {emps.map((e) => (
              <button key={e.id} onClick={() => onOpen(e)} className="rounded-lg border border-border bg-card/40 p-3 text-left hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">{initials(e.name)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">{e.currentTaskType && <TaskTag t={e.currentTaskType} />}<span className="text-[10px] text-muted-foreground font-mono">{e.currentTaskId}</span></div>
                  </div>
                  <div className="text-right shrink-0"><div className={cn("text-sm font-bold font-mono tabular-nums", uphTone(e.unitsPerHour, e.targetUph))}>{e.unitsPerHour}</div><div className="text-[9px] text-muted-foreground">uph</div></div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      ))}

      {(idle.length > 0 || onBreak.length > 0) && (
        <Section title="Idle & On Break" sub={`${idle.length} idle · ${onBreak.length} on break`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {[...idle, ...onBreak].map((e) => (
              <button key={e.id} onClick={() => onOpen(e)} className="rounded-lg border border-border bg-card/40 p-3 text-left hover:bg-accent/20 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-xs font-bold shrink-0">{initials(e.name)}</div>
                <div className="min-w-0 flex-1"><div className="text-sm truncate">{e.name}</div><div className="text-[11px] text-muted-foreground">{e.role}</div></div>
                <StatusBadge status={e.status} />
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  PERFORMANCE
// ════════════════════════════════════════════════════════════════════════════

function PerformanceView({ onOpen }: { onOpen: (e: LaborEmployee) => void }) {
  const top = useLaborStore((s) => s.topPerformers)();
  const maxUph = Math.max(1, ...top.map((e) => e.unitsPerHour));
  const avgUph = top.length > 0 ? Math.round(top.reduce((s, e) => s + e.unitsPerHour, 0) / top.length) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="RANKED WORKERS" value={top.length} tone="primary" sub="active producers" />
        <KPICard label="TOP UPH" value={top[0]?.unitsPerHour ?? 0} tone="success" sub={top[0]?.name ?? "—"} />
        <KPICard label="TEAM AVG UPH" value={avgUph} tone="info" sub="across floor" />
        <KPICard label="AVG ACCURACY" value={`${(top.reduce((s, e) => s + e.accuracyPct, 0) / (top.length || 1)).toFixed(1)}%`} tone="success" sub="quality" />
      </div>

      <Section title="Productivity Leaderboard" sub="Active workers ranked by units-per-hour vs target">
        <div className="divide-y divide-border/40">
          {top.map((e, i) => {
            const attainment = e.targetUph > 0 ? Math.round((e.unitsPerHour / e.targetUph) * 100) : 0;
            return (
              <button key={e.id} onClick={() => onOpen(e)} className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-accent/20 transition-colors">
                <div className={cn("w-7 text-center font-bold font-mono text-sm shrink-0", i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-muted-foreground")}>
                  {i < 3 ? <Award className="h-4 w-4 mx-auto" /> : i + 1}
                </div>
                <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">{initials(e.name)}</div>
                <div className="w-40 shrink-0 min-w-0"><div className="text-sm font-medium truncate">{e.name}</div><div className="text-[11px] text-muted-foreground truncate">{e.role} · {e.currentZone ?? "—"}</div></div>
                <div className="flex-1 min-w-0">
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden"><div className={cn("h-full rounded-full", attainment >= 100 ? "bg-emerald-500" : attainment >= 85 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${(e.unitsPerHour / maxUph) * 100}%` }} /></div>
                  <div className="text-[11px] text-muted-foreground mt-1 font-mono">{e.unitsPerHour} / {e.targetUph} target · {attainment}% attainment</div>
                </div>
                <div className="text-right shrink-0 w-14"><div className="text-sm font-bold font-mono tabular-nums text-emerald-400">{e.accuracyPct}%</div><div className="text-[10px] text-muted-foreground">acc</div></div>
              </button>
            );
          })}
          {top.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">No active workers to rank.</div>}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  EMPLOYEE DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium mt-1 font-mono tabular-nums break-words">{value}</div>
    </div>
  );
}

function EmployeeDrawer({ empId, onClose }: { empId: string | null; onClose: () => void }) {
  const emp = useLaborStore((s) => s.employees.find((e) => e.id === empId)) ?? null;
  const { clockIn, clockOut, startBreak, endBreak } = useLaborStore();
  if (!emp) return null;

  const attainment = emp.targetUph > 0 ? Math.round((emp.unitsPerHour / emp.targetUph) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold shrink-0">{initials(emp.name)}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">{emp.name}</span><StatusBadge status={emp.status} /></div>
              <div className="text-sm text-muted-foreground mt-0.5">{emp.role} · {emp.department} · <span className="font-mono">{emp.employeeId}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="UPH" value={`${emp.unitsPerHour}`} tone={uphTone(emp.unitsPerHour, emp.targetUph)} />
          <MiniStat label="Target" value={`${emp.targetUph}`} />
          <MiniStat label="Accuracy" value={`${emp.accuracyPct}%`} tone="text-emerald-400" />
          <MiniStat label="Hours" value={`${emp.hoursToday}h`} />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Target attainment</span><span className="font-mono">{attainment}%</span></div>
          <Progress value={Math.min(100, attainment)} className="h-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          {emp.status === "CLOCKED_OUT" || emp.status === "INACTIVE" ? <Button size="sm" className="h-8 text-xs gap-1" onClick={() => clockIn(emp.id)}><LogIn className="h-3.5 w-3.5" /> Clock in</Button> : null}
          {emp.status === "CLOCKED_IN" && <><Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => startBreak(emp.id)}><Coffee className="h-3.5 w-3.5" /> Break</Button><Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => clockOut(emp.id)}><LogOut className="h-3.5 w-3.5" /> Clock out</Button></>}
          {emp.status === "ON_BREAK" && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => endBreak(emp.id)}><Play className="h-3.5 w-3.5" /> Resume</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {emp.currentTaskType && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Current assignment</div>
            <div className="flex items-center gap-2"><TaskTag t={emp.currentTaskType} /><span className="font-mono text-sm">{emp.currentTaskId}</span><span className="text-muted-foreground text-xs ml-auto">{emp.currentZone}</span></div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <DetailRow icon={Mail} label="Email" value={emp.email} />
          <DetailRow icon={UserCog} label="Shift" value={SHIFT_META[emp.shift].label} />
          <DetailRow icon={LogIn} label="Clock in" value={emp.clockInTime ? fmtTime(emp.clockInTime) : "—"} />
          <DetailRow icon={LogOut} label="Clock out" value={emp.clockOutTime ? fmtTime(emp.clockOutTime) : "—"} />
          <DetailRow icon={Coffee} label="Break since" value={emp.breakStart ? fmtTime(emp.breakStart) : "—"} />
          <DetailRow icon={Timer} label="Idle minutes" value={`${emp.idleMinutes}m`} />
          <DetailRow icon={Clock} label="Hours today" value={`${emp.hoursToday}h`} />
          <DetailRow icon={TrendingUp} label="Overtime" value={`${emp.overtimeHours}h`} />
        </div>

        <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><ShieldCheck className="h-3 w-3" /> Certifications</div>
          <div className="text-sm mt-1 flex flex-wrap gap-2">{emp.certifications.length ? emp.certifications.map((c) => <span key={c} className="px-1.5 py-0.5 rounded bg-secondary text-xs">{c}</span>) : <span className="text-muted-foreground text-xs">None on file</span>}</div>
        </div>

        <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Forklift className="h-3 w-3" /> Equipment</div>
          <div className="text-sm mt-1 flex flex-wrap gap-2">{emp.equipment.map((c) => <span key={c} className="px-1.5 py-0.5 rounded bg-secondary text-xs">{c}</span>)}</div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "workforce" | "floor" | "performance";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",    label: "Overview",    icon: LayoutDashboard },
  { id: "workforce",   label: "Workforce",   icon: UserCog },
  { id: "floor",       label: "Live Floor",  icon: Activity },
  { id: "performance", label: "Performance", icon: Trophy },
];

export function LaborPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const kpis = useLaborStore((s) => s.kpis)();

  const open = (e: LaborEmployee) => setOpenId(e.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={Users}
        title="Labor Management"
        subtitle="Workforce roster · time & attendance · task allocation · productivity & UPH"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><Target className="h-3.5 w-3.5" /> Plan shift</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"><Zap className="h-3.5 w-3.5" /> Auto-balance</Button>
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "overview" && kpis.onBreak > 0 ? kpis.onBreak : id === "floor" && kpis.activeOnTask > 0 ? kpis.activeOnTask : null;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums bg-primary/15 text-primary">{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview"    && <OverviewView />}
        {tab === "workforce"   && <WorkforceView onOpen={open} />}
        {tab === "floor"       && <LiveFloorView onOpen={open} />}
        {tab === "performance" && <PerformanceView onOpen={open} />}
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <EmployeeDrawer empId={openId} onClose={() => setOpenId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
