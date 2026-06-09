/**
 * TriloWMS — Putaway Module Page
 */

import { useState } from "react";
import { PackageOpen, Search, X, ChevronRight, MapPin, User, Clock, AlertTriangle, CheckCircle2, Settings2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { usePutawayStore, PUTAWAY_STATUS_META, type PutawayTask, type PutawayStatus } from "@/lib/putaway-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

// ─── KPIs ─────────────────────────────────────────────────────────────────────

function PutawayKPIs() {
  const kpis = usePutawayStore((s) => s.kpis());
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard label="OPEN TASKS" value={String(kpis.open)} tone="primary" />
      <KPICard label="ASSIGNED" value={String(kpis.assigned)} tone="info" />
      <KPICard label="IN PROGRESS" value={String(kpis.inProgress)} tone="warning" />
      <KPICard label="COMPLETED TODAY" value={String(kpis.completedToday)} tone="success" />
      <KPICard label="BLOCKED" value={String(kpis.blocked)} tone="destructive" />
      <KPICard label="AVG CYCLE TIME" value={kpis.avgCycleTime} tone="info" />
      <KPICard label="THROUGHPUT/HR" value={String(kpis.throughputPerHour)} tone="success" />
    </div>
  );
}

// ─── Operator Workload Board ──────────────────────────────────────────────────

function OperatorBoard() {
  const workloads = usePutawayStore((s) => s.operatorWorkloads());
  return (
    <Panel title="OPERATOR WORKLOAD">
      <div className="space-y-2">
        {workloads.map((op) => {
          const total = op.assigned + op.inProgress + op.completed;
          const activeLoad = op.assigned + op.inProgress;
          return (
            <div key={op.operatorId} className="flex items-center gap-3 p-2 rounded-lg bg-card/40 border border-border">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                {op.operatorName.split(".")[0][0]}{op.operatorName.split(".")[1]?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{op.operatorName}</span>
                  <span className={cn("text-xs font-mono", activeLoad > 3 ? "text-amber-400" : "text-emerald-400")}>
                    {activeLoad} active
                  </span>
                </div>
                <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span className="text-blue-400">Assigned: {op.assigned}</span>
                  <span className="text-amber-400">In Progress: {op.inProgress}</span>
                  <span className="text-emerald-400">Done: {op.completed}</span>
                </div>
              </div>
            </div>
          );
        })}
        {workloads.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">No active operators</div>
        )}
      </div>
    </Panel>
  );
}

// ─── Rules Panel ─────────────────────────────────────────────────────────────

function RulesPanel() {
  const rules = usePutawayStore((s) => s.rules);
  return (
    <Panel title="PUTAWAY RULES">
      <div className="space-y-2">
        {rules.filter((r) => r.active).map((rule) => (
          <div key={rule.id} className="flex items-start gap-2 p-2 rounded border border-border bg-card/30">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">
              {rule.priority}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{rule.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{rule.description}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{rule.strategy}</span>
                <span className="text-[10px] text-muted-foreground">→ {rule.targetZone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Task Detail ──────────────────────────────────────────────────────────────

function TaskDetail({ task, onClose }: { task: PutawayTask; onClose: () => void }) {
  const { assignOperator, startTask, completeTask, blockTask, cancelTask } = usePutawayStore();
  const [completeBin, setCompleteBin] = useState(task.suggestedBinCode ?? "");
  const [blockReason, setBlockReason] = useState("");
  const [showComplete, setShowComplete] = useState(false);
  const [showBlock, setShowBlock] = useState(false);

  const meta = PUTAWAY_STATUS_META[task.status];

  return (
    <div className="p-6 space-y-5 overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary">{task.id}</span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded border font-semibold", meta.color, meta.bg, meta.border)}>
              {meta.label}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">{task.skuName}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ["SKU Code", task.skuCode],
          ["Quantity", `${task.quantity} ${task.uom}`],
          ["Pallet ID", task.palletId ?? "—"],
          ["Source Dock", task.sourceDock ?? "—"],
          ["Staging Area", task.sourceLocation],
          ["Strategy", task.strategy],
          ["Suggested Bin", task.suggestedBinCode ?? "—"],
          ["Actual Bin", task.actualBinCode ?? "—"],
          ["Zone", task.zone],
          ["Equipment", task.equipment ?? "—"],
          ["Weight", `${task.weight} kg`],
          ["Travel Dist.", task.travelDistance ? `${task.travelDistance}m` : "—"],
          ["Cycle Time", task.cycleTime ? `${task.cycleTime}m` : "—"],
          ["Assigned To", task.assignedOperator ?? "Unassigned"],
          ["Batch", task.batchNumber ?? "—"],
          ["Expiry", task.expiryDate ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-border bg-card/30 p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-sm font-medium mt-0.5 font-mono">{value}</div>
          </div>
        ))}
      </div>

      {task.blockedReason && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-red-400">Blocked</div>
            <div className="text-xs text-muted-foreground mt-0.5">{task.blockedReason}</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {task.status === "PENDING" && (
          <Button size="sm" onClick={() => assignOperator(task.id, "op1", "Tommy Wu")}>
            <User className="h-3.5 w-3.5 mr-1" /> Assign Operator
          </Button>
        )}
        {task.status === "ASSIGNED" && (
          <Button size="sm" onClick={() => startTask(task.id)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Start Task
          </Button>
        )}
        {task.status === "IN_PROGRESS" && !showComplete && (
          <Button size="sm" variant="default" onClick={() => setShowComplete(true)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete
          </Button>
        )}
        {task.status === "IN_PROGRESS" && !showBlock && (
          <Button size="sm" variant="outline" className="text-red-400 border-red-500/30" onClick={() => setShowBlock(true)}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Block
          </Button>
        )}
        {task.status === "BLOCKED" && (
          <Button size="sm" variant="outline" onClick={() => startTask(task.id)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Unblock & Resume
          </Button>
        )}
        {!["COMPLETED", "CANCELLED"].includes(task.status) && (
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => cancelTask(task.id)}>
            Cancel Task
          </Button>
        )}
      </div>

      {showComplete && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          <div className="text-sm font-semibold text-emerald-400">Confirm Putaway Completion</div>
          <Input
            placeholder="Actual bin code (e.g. A-01-R-02-L2-P1)"
            value={completeBin}
            onChange={(e) => setCompleteBin(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { completeTask(task.id, `bin-actual`, completeBin, 2.3); setShowComplete(false); }}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowComplete(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {showBlock && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
          <div className="text-sm font-semibold text-red-400">Block Task</div>
          <Input
            placeholder="Reason for blocking..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => { blockTask(task.id, blockReason); setShowBlock(false); }}>
              Block Task
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowBlock(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Task Table ───────────────────────────────────────────────────────────────

function TaskTable({ onSelect }: { onSelect: (t: PutawayTask) => void }) {
  const { filteredTasks, filters, setFilters, page, setPage, pageSize } = usePutawayStore();
  const all = filteredTasks();
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = Math.max(1, Math.ceil(all.length / pageSize));

  return (
    <Panel title={`PUTAWAY TASKS (${all.length})`}>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search task, SKU, pallet..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as PutawayStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(["PENDING","ASSIGNED","IN_PROGRESS","COMPLETED","BLOCKED"] as PutawayStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{PUTAWAY_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {["URGENT","HIGH","NORMAL","LOW"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filters.search || filters.status || filters.priority) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "", priority: "" })} className="h-8">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["Task ID","SKU","Pallet","From","→ Bin","Zone","Operator","Equipment","Priority","Status",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((t) => {
              const meta = PUTAWAY_STATUS_META[t.status];
              return (
                <tr key={t.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => onSelect(t)}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{t.id}</td>
                  <td className="py-2 px-2">
                    <div className="text-xs font-mono text-primary">{t.skuCode}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-32">{t.skuName}</div>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{t.palletId ?? "—"}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">{t.sourceDock ?? t.sourceLocation}</td>
                  <td className="py-2 px-2 font-mono text-xs">
                    {t.actualBinCode ?? t.suggestedBinCode ?? "—"}
                    {t.actualBinCode && <span className="ml-1 text-emerald-400 text-[10px]">✓</span>}
                  </td>
                  <td className="py-2 px-2 text-xs text-muted-foreground max-w-28 truncate">{t.zone.split(" — ")[1] ?? t.zone}</td>
                  <td className="py-2 px-2 text-xs">{t.assignedOperator ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">{t.equipment ?? "—"}</td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold",
                      t.priority === "URGENT" ? "text-red-400 bg-red-500/10" :
                      t.priority === "HIGH" ? "text-orange-400 bg-orange-500/10" :
                      t.priority === "LOW" ? "text-slate-400 bg-slate-500/10" :
                      "text-slate-300 bg-slate-600/10"
                    )}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap", meta.color, meta.bg, meta.border)}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Showing {paged.length} of {all.length} tasks</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
          <span className="px-2 py-1">{page} / {total}</span>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= total} onClick={() => setPage(page + 1)}>›</Button>
        </div>
      </div>
    </Panel>
  );
}

// ─── Throughput Chart ─────────────────────────────────────────────────────────

function ThroughputChart() {
  const data = Array.from({ length: 12 }, (_, i) => ({
    hour: `${(6 + i) % 24}:00`,
    completed: Math.floor(20 + Math.random() * 60),
    blocked: Math.floor(Math.random() * 5),
  }));
  return (
    <Panel title="PUTAWAY THROUGHPUT — LAST 12H" className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
          <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
          <Bar dataKey="completed" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Completed" />
          <Bar dataKey="blocked" fill="hsl(0 70% 50%)" radius={[3, 3, 0, 0]} name="Blocked" />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PutawayPage() {
  const [selectedTask, setSelectedTask] = useState<PutawayTask | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [tab, setTab] = useState("tasks");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={PackageOpen}
        title="Putaway"
        subtitle="Directed putaway, task assignment, bin routing & forklift management"
      />
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 pt-4 border-b border-border">
          <TabsList>
            <TabsTrigger value="tasks">Task Queue</TabsTrigger>
            <TabsTrigger value="rules">Putaway Rules</TabsTrigger>
            <TabsTrigger value="operators">Operators</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <PutawayKPIs />
          <TabsContent value="tasks" className="mt-0 space-y-5">
            <ThroughputChart />
            <TaskTable onSelect={(t) => { setSelectedTask(t); setShowDetail(true); }} />
          </TabsContent>
          <TabsContent value="rules" className="mt-0">
            <RulesPanel />
          </TabsContent>
          <TabsContent value="operators" className="mt-0">
            <OperatorBoard />
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Putaway Task Detail</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="overflow-y-auto flex-1">
              <TaskDetail task={selectedTask} onClose={() => setShowDetail(false)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
