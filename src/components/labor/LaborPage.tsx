/**
 * TriloWMS — Labor Management Module Page
 */

import { useState } from "react";
import { Users, Search, X, ChevronRight, Clock, Coffee, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useLaborStore, EMPLOYEE_STATUS_META, type LaborEmployee, type EmployeeStatus, type ShiftType } from "@/lib/labor-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { cn } from "@/lib/utils";

function LaborKPIs() {
  const kpis = useLaborStore((s) => s.kpis());
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard label="ON SHIFT" value={String(kpis.onShift)} tone="success" />
      <KPICard label="ACTIVE ON TASK" value={String(kpis.activeOnTask)} tone="primary" />
      <KPICard label="ON BREAK" value={String(kpis.onBreak)} tone="warning" />
      <KPICard label="AVG UPH" value={String(kpis.avgUph)} tone="info" />
      <KPICard label="TARGET VS ACTUAL" value={kpis.targetVsActual} tone="success" />
      <KPICard label="IDLE RATE" value={kpis.idleRate} tone="warning" />
      <KPICard label="OVERTIME HRS" value={String(kpis.overtimeHours)} tone="destructive" />
    </div>
  );
}

function EmployeeDetail({ employee, onClose }: { employee: LaborEmployee; onClose: () => void }) {
  const { clockIn, clockOut, startBreak, endBreak } = useLaborStore();
  const meta = EMPLOYEE_STATUS_META[employee.status];
  const uphPct = employee.targetUph > 0 ? Math.min(100, Math.round((employee.unitsPerHour / employee.targetUph) * 100)) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{employee.name}</span>
                <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
              </div>
              <div className="text-xs text-muted-foreground">{employee.employeeId} · {employee.role} · {employee.department}</div>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-4 gap-2 p-4 border-b border-border text-center">
        {[
          ["UPH", employee.unitsPerHour],
          ["Target", employee.targetUph],
          ["Accuracy", `${employee.accuracyPct}%`],
          ["Hrs Today", `${employee.hoursToday}h`],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
            <div className={cn("font-bold text-sm font-mono mt-0.5",
              l === "UPH" && employee.unitsPerHour < employee.targetUph ? "text-amber-400" : ""
            )}>{v}</div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">UPH vs Target</span>
          <span className={cn("font-mono font-bold", uphPct >= 100 ? "text-emerald-400" : uphPct >= 80 ? "text-amber-400" : "text-red-400")}>{uphPct}%</span>
        </div>
        <Progress value={uphPct} className="h-1.5" />
      </div>

      <div className="flex gap-2 px-4 py-2 border-b border-border flex-wrap">
        {employee.status === "CLOCKED_OUT" && (
          <Button size="sm" onClick={() => clockIn(employee.id)}><LogIn className="h-3.5 w-3.5 mr-1" />Clock In</Button>
        )}
        {employee.status === "CLOCKED_IN" && (
          <>
            <Button size="sm" variant="outline" onClick={() => startBreak(employee.id)}><Coffee className="h-3.5 w-3.5 mr-1" />Start Break</Button>
            <Button size="sm" variant="destructive" onClick={() => clockOut(employee.id)}><LogOut className="h-3.5 w-3.5 mr-1" />Clock Out</Button>
          </>
        )}
        {employee.status === "ON_BREAK" && (
          <Button size="sm" onClick={() => endBreak(employee.id)}><Clock className="h-3.5 w-3.5 mr-1" />End Break</Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {employee.currentTaskType && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="text-xs font-semibold text-primary mb-1">Current Task</div>
            <div className="text-sm font-medium">{employee.currentTaskType}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Task: {employee.currentTaskId ?? "—"} · Zone: {employee.currentZone ?? "—"}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[
            ["Shift", employee.shift],
            ["Warehouse", employee.warehouseId],
            ["Clock In", employee.clockInTime ? new Date(employee.clockInTime).toLocaleTimeString() : "—"],
            ["Idle Mins", `${employee.idleMinutes}m`],
            ["Overtime", `${employee.overtimeHours}h`],
            ["Email", employee.email],
          ].map(([l, v]) => (
            <div key={l} className="rounded border border-border bg-card/30 p-2">
              <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
              <div className="text-xs font-mono mt-0.5 truncate">{v}</div>
            </div>
          ))}
        </div>

        {employee.certifications.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Certifications</div>
            <div className="flex flex-wrap gap-1.5">
              {employee.certifications.map((c) => (
                <span key={c} className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">{c}</span>
              ))}
            </div>
          </div>
        )}

        {employee.equipment.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Equipment</div>
            <div className="flex flex-wrap gap-1.5">
              {employee.equipment.map((e) => (
                <span key={e} className="text-[11px] px-2 py-0.5 rounded bg-slate-500/10 text-slate-300 font-medium">{e}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeTable({ onSelect }: { onSelect: (e: LaborEmployee) => void }) {
  const { filteredEmployees, filters, setFilters, page, setPage, pageSize, totalPages } = useLaborStore();
  const all = filteredEmployees();
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = totalPages();

  return (
    <Panel title={`WORKFORCE (${all.length})`}>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search name, ID, role..." value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as EmployeeStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(EMPLOYEE_STATUS_META) as EmployeeStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{EMPLOYEE_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.shift || "all"} onValueChange={(v) => setFilters({ shift: v === "all" ? "" : v as ShiftType })}>
          <SelectTrigger className="w-24 h-8 text-sm"><SelectValue placeholder="Shift" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shifts</SelectItem>
            {(["A","B","C","FLEX"] as ShiftType[]).map((s) => <SelectItem key={s} value={s}>Shift {s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.department || "all"} onValueChange={(v) => setFilters({ department: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Dept." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Depts</SelectItem>
            {["Inbound","Outbound","Inventory","QC","Yard","General"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filters.search || filters.status || filters.shift || filters.department) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "", shift: "", department: "" })} className="h-8"><X className="h-3.5 w-3.5" /></Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["Employee","Role","Dept","Shift","Status","UPH","Target","Accuracy","Task","Zone","Hours",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((e) => {
              const meta = EMPLOYEE_STATUS_META[e.status];
              const uphPct = e.targetUph > 0 ? Math.round((e.unitsPerHour / e.targetUph) * 100) : 0;
              return (
                <tr key={e.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => onSelect(e)}>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                        {e.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-medium">{e.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{e.employeeId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-xs">{e.role}</td>
                  <td className="py-2 px-2 text-xs">{e.department}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono font-semibold">{e.shift}</span>
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs text-right">
                    <span className={cn(uphPct < 80 ? "text-red-400" : uphPct < 100 ? "text-amber-400" : "text-emerald-400")}>
                      {e.unitsPerHour}
                    </span>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs text-right text-muted-foreground">{e.targetUph}</td>
                  <td className="py-2 px-2 font-mono text-xs text-right">
                    <span className={e.accuracyPct >= 99 ? "text-emerald-400" : e.accuracyPct >= 97 ? "" : "text-amber-400"}>
                      {e.accuracyPct}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">{e.currentTaskType ?? "—"}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">{e.currentZone ?? "—"}</td>
                  <td className="py-2 px-2 font-mono text-xs text-right">{e.hoursToday}h</td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Showing {paged.length} of {all.length}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
          <span className="px-2 py-1">{page} / {total}</span>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= total} onClick={() => setPage(page + 1)}>›</Button>
        </div>
      </div>
    </Panel>
  );
}

function ShiftBoard() {
  const shiftData = useLaborStore((s) => s.shiftBreakdown());
  const employees = useLaborStore((s) => s.employees);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {shiftData.map(({ shift, count, avgUph }) => {
        const allInShift = employees.filter((e) => e.shift === shift);
        const onBreak = allInShift.filter((e) => e.status === "ON_BREAK").length;
        return (
          <Panel key={shift} title={`SHIFT ${shift}`}>
            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <div>
                  <div className="text-3xl font-bold font-mono text-primary">{count}</div>
                  <div className="text-xs text-muted-foreground">Active ({onBreak} on break)</div>
                </div>
                <div className="text-right ml-auto">
                  <div className="text-lg font-bold font-mono">{avgUph}</div>
                  <div className="text-xs text-muted-foreground">Avg UPH</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {allInShift.slice(0, 12).map((e) => (
                  <div key={e.id} className={cn(
                    "h-2 w-2 rounded-full",
                    e.status === "CLOCKED_IN" ? "bg-emerald-500" :
                    e.status === "ON_BREAK" ? "bg-amber-500" :
                    "bg-slate-600"
                  )} title={e.name} />
                ))}
                {allInShift.length > 12 && <span className="text-[10px] text-muted-foreground">+{allInShift.length - 12}</span>}
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function ProductivityPanel() {
  const { departmentStats, shiftBreakdown } = useLaborStore();
  const deptStats = departmentStats();
  const shiftData = shiftBreakdown();

  const radarData = deptStats.map((d) => ({
    department: d.department,
    uph: d.avgUph,
    accuracy: d.avgAccuracy,
    headcount: d.count,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="DEPARTMENT PRODUCTIVITY">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={deptStats} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis dataKey="department" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="avgUph" name="Avg UPH" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="SHIFT UPH COMPARISON">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={shiftData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis dataKey="shift" tickFormatter={(v) => `Shift ${v}`} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="count" name="Headcount" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="avgUph" name="Avg UPH" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="DEPARTMENT ACCURACY">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground uppercase">
                {["Department","Headcount","Avg UPH","Avg Accuracy"].map((h) => (
                  <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {deptStats.map((d) => (
                <tr key={d.department}>
                  <td className="py-2 px-2 text-xs font-medium">{d.department}</td>
                  <td className="py-2 px-2 text-center text-xs">{d.count}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{d.avgUph}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">
                    <span className={cn(d.avgAccuracy >= 99 ? "text-emerald-400" : d.avgAccuracy >= 97 ? "" : "text-amber-400")}>
                      {d.avgAccuracy}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="UPH RADAR BY DEPARTMENT">
        {radarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="department" tick={{ fontSize: 10 }} />
              <Radar name="Avg UPH" dataKey="uph" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">No active data</div>
        )}
      </Panel>
    </div>
  );
}

export function LaborPage() {
  const [selected, setSelected] = useState<LaborEmployee | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={Users} title="Labor Management" subtitle="Workforce tracking, productivity monitoring, shift management & UPH analytics" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <LaborKPIs />
        <Tabs defaultValue="workforce">
          <TabsList>
            <TabsTrigger value="workforce">Workforce</TabsTrigger>
            <TabsTrigger value="shifts">Shift Board</TabsTrigger>
            <TabsTrigger value="productivity">Productivity</TabsTrigger>
          </TabsList>
          <TabsContent value="workforce" className="mt-4">
            <EmployeeTable onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="shifts" className="mt-4">
            <ShiftBoard />
          </TabsContent>
          <TabsContent value="productivity" className="mt-4">
            <ProductivityPanel />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl h-[90vh] flex flex-col p-0 gap-0">
          {selected && <EmployeeDetail employee={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
