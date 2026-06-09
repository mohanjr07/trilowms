/**
 * TriloWMS — Picking Module Page
 */

import { useState } from "react";
import { PackageSearch, Search, X, ChevronRight, Play, CheckCircle2, AlertTriangle, Zap, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { usePickingStore, WAVE_STATUS_META, type Wave, type WaveStatus, type PickingMethod } from "@/lib/picking-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";

// ─── KPIs ─────────────────────────────────────────────────────────────────────

function PickingKPIs() {
  const kpis = usePickingStore((s) => s.kpis)();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard label="ACTIVE WAVES" value={String(kpis.activeWaves)} tone="primary" />
      <KPICard label="OPEN PICKS" value={String(kpis.openPicks)} tone="info" />
      <KPICard label="PICKED TODAY" value={kpis.pickedToday.toLocaleString()} tone="success" delta="↑ 6%" />
      <KPICard label="PICK ACCURACY" value={kpis.pickAccuracy} tone="info" />
      <KPICard label="OPEN SHORTS" value={String(kpis.shorts)} tone="destructive" />
      <KPICard label="UNITS/HOUR" value={String(kpis.avgPicksPerHour)} tone="success" />
      <KPICard label="PENDING RELEASE" value={String(kpis.pendingRelease)} tone="warning" />
    </div>
  );
}

// ─── Wave Detail Panel ────────────────────────────────────────────────────────

function WaveDetail({ wave, onClose }: { wave: Wave; onClose: () => void }) {
  const { releaseWave, startWave, completeWave, cancelWave, pickTask, reportShort } = usePickingStore();
  const [tab, setTab] = useState("tasks");
  const [pickingTask, setPickingTask] = useState<string | null>(null);
  const [pickQty, setPickQty] = useState("");

  const meta = WAVE_STATUS_META[wave.status];
  const progress = wave.totalUnits > 0 ? Math.round((wave.pickedUnits / wave.totalUnits) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-primary">{wave.waveNumber}</span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded border font-semibold", meta.color, meta.bg, meta.border)}>
              {meta.label}
            </span>
            <span className={cn("text-[10px] px-1.5 rounded font-semibold",
              wave.priority === "SAME_DAY" || wave.priority === "RUSH" ? "text-red-400 bg-red-500/10" : "text-slate-400 bg-slate-500/10"
            )}>
              {wave.priority}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{wave.pickMethod} · {wave.carrier} · Due {new Date(wave.dueBy).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-2 p-3 border-b border-border">
        {[
          { label: "Orders", value: wave.totalOrders },
          { label: "Lines", value: wave.totalLines },
          { label: "Total Units", value: wave.totalUnits.toLocaleString() },
          { label: "Picked", value: wave.pickedUnits.toLocaleString() },
          { label: "Shorted", value: wave.shortUnits },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className="font-bold text-sm font-mono mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>Wave Progress</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-2 border-b border-border flex-wrap">
        {wave.status === "DRAFT" && <Button size="sm" onClick={() => releaseWave(wave.id)}><Zap className="h-3.5 w-3.5 mr-1" /> Release Wave</Button>}
        {wave.status === "RELEASED" && <Button size="sm" onClick={() => startWave(wave.id)}><Play className="h-3.5 w-3.5 mr-1" /> Start Wave</Button>}
        {wave.status === "IN_PROGRESS" && <Button size="sm" variant="outline" onClick={() => completeWave(wave.id)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete Wave</Button>}
        {!["COMPLETED","CANCELLED"].includes(wave.status) && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => cancelWave(wave.id)}>Cancel</Button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="tasks">Pick Lines ({wave.totalLines})</TabsTrigger>
          <TabsTrigger value="pickers">Pickers ({wave.assignedPickers.length})</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <TabsContent value="tasks" className="mt-3 space-y-2">
            {wave.tasks.map((task) => (
              <div key={task.id} className={cn("rounded-lg border p-3",
                task.status === "PICKED" ? "border-emerald-500/20 bg-emerald-500/5" :
                task.status === "SHORT" ? "border-red-500/20 bg-red-500/5" :
                task.status === "IN_PROGRESS" ? "border-amber-500/20 bg-amber-500/5" :
                "border-border bg-card/30"
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-primary">{task.skuCode}</span>
                      <span className="text-xs text-muted-foreground truncate">{task.skuName}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span>Bin: <strong className="text-foreground font-mono">{task.binCode}</strong></span>
                      <span>Required: <strong className="text-foreground">{task.qtyRequired} {task.uom}</strong></span>
                      <span>Picked: <strong className="text-emerald-400">{task.qtyPicked}</strong></span>
                      {task.qtyShort > 0 && <span className="text-red-400">Short: {task.qtyShort}</span>}
                      <span>Tote: {task.toteId ?? "—"}</span>
                    </div>
                    {task.shortReason && <div className="text-[10px] text-red-400 mt-0.5">{task.shortReason}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold",
                      task.status === "PICKED" ? "text-emerald-400 bg-emerald-500/10" :
                      task.status === "SHORT" ? "text-red-400 bg-red-500/10" :
                      task.status === "IN_PROGRESS" ? "text-amber-400 bg-amber-500/10" :
                      "text-slate-400 bg-slate-500/10"
                    )}>
                      {task.status}
                    </span>
                    {wave.status === "IN_PROGRESS" && task.status !== "PICKED" && task.status !== "SHORT" && (
                      pickingTask === task.id ? (
                        <div className="flex gap-1">
                          <Input type="number" value={pickQty} onChange={(e) => setPickQty(e.target.value)} placeholder="Qty" className="w-20 h-7 text-xs" />
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => {
                            const q = parseInt(pickQty);
                            if (!isNaN(q) && q > 0) { pickTask(wave.id, task.id, q); setPickingTask(null); setPickQty(""); }
                          }}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setPickingTask(null)}>×</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPickingTask(task.id)}>Pick</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => reportShort(wave.id, task.id, 0, "BIN_EMPTY")}>Short</Button>
                        </div>
                      )
                    )}
                  </div>
                </div>
                <Progress
                  value={task.qtyRequired > 0 ? Math.min(100, Math.round((task.qtyPicked / task.qtyRequired) * 100)) : 0}
                  className="h-1 mt-2"
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="pickers" className="mt-3 space-y-2">
            {wave.assignedPickers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No pickers assigned</div>
            ) : (
              wave.assignedPickers.map((picker) => {
                const tasks = wave.tasks.filter((t) => t.assignedPickerName === picker);
                const picked = tasks.filter((t) => t.status === "PICKED").length;
                return (
                  <div key={picker} className="rounded-lg border border-border bg-card/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {picker[0]}
                        </div>
                        <span className="font-medium text-sm">{picker}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{picked}/{tasks.length} lines picked</span>
                    </div>
                    <Progress value={tasks.length > 0 ? Math.round((picked / tasks.length) * 100) : 0} className="h-1.5 mt-2" />
                  </div>
                );
              })
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Shortage Panel ───────────────────────────────────────────────────────────

function ShortagePanel() {
  const { shortages, resolveShortage } = usePickingStore();
  const open = shortages.filter((s) => s.status === "OPEN");
  return (
    <Panel title={`OPEN SHORTAGES (${open.length})`}>
      {open.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
          No open shortages
        </div>
      ) : (
        <div className="space-y-2">
          {open.slice(0, 10).map((s) => (
            <div key={s.id} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <span className="font-mono text-xs text-primary">{s.skuCode}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-40">{s.skuName}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>Wave: {s.waveId}</span>
                    <span>Order: {s.orderId}</span>
                    <span>Short: <strong className="text-red-400">{s.qtyShort}</strong></span>
                    <span className="text-amber-400">{s.reason.replace(/_/g, " ")}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => resolveShortage(s.id, "Backordered — will ship when available")}>
                  Backorder
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Picker Productivity ──────────────────────────────────────────────────────

function PickerProductivity() {
  const data = usePickingStore((s) => s.pickerProductivity)();
  return (
    <Panel title="PICKER PRODUCTIVITY">
      <div className="space-y-2">
        {data.map((p) => (
          <div key={p.name} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {p.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{p.name}</span>
                <span className="text-xs font-mono text-emerald-400">{p.accuracy}%</span>
              </div>
              <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span className="text-emerald-400">Picked: {p.picked}</span>
                {p.short > 0 && <span className="text-red-400">Short: {p.short}</span>}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground w-20 shrink-0">
              Acc: {p.accuracy}%
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Wave Table ───────────────────────────────────────────────────────────────

function WaveTable({ onSelect }: { onSelect: (w: Wave) => void }) {
  const { filteredWaves, filters, setFilters, page, setPage, pageSize } = usePickingStore();
  const all = filteredWaves();
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = Math.max(1, Math.ceil(all.length / pageSize));

  return (
    <Panel title={`WAVE QUEUE (${all.length})`}>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search wave, carrier..." value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as WaveStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {(["DRAFT","RELEASED","IN_PROGRESS","COMPLETED","SHORTED","CANCELLED"] as WaveStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{WAVE_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.method || "all"} onValueChange={(v) => setFilters({ method: v === "all" ? "" : v as PickingMethod })}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {(["SINGLE","BATCH","ZONE","CLUSTER","WAVE_PICK"] as PickingMethod[]).map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filters.search || filters.status || filters.method) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "", method: "" })} className="h-8">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["Wave","Method","Priority","Orders","Lines","Units","Picked%","Shorts","Carrier","Due By","Status",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((w) => {
              const meta = WAVE_STATUS_META[w.status];
              const pct = w.totalUnits > 0 ? Math.round((w.pickedUnits / w.totalUnits) * 100) : 0;
              const overdue = new Date(w.dueBy) < new Date() && !["COMPLETED","CANCELLED"].includes(w.status);
              return (
                <tr key={w.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => onSelect(w)}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{w.waveNumber}</td>
                  <td className="py-2 px-2 text-xs">{w.pickMethod}</td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold",
                      w.priority === "SAME_DAY" ? "text-red-400 bg-red-500/10" :
                      w.priority === "RUSH" ? "text-orange-400 bg-orange-500/10" :
                      "text-slate-400 bg-slate-500/10"
                    )}>{w.priority}</span>
                  </td>
                  <td className="py-2 px-2 text-center">{w.totalOrders}</td>
                  <td className="py-2 px-2 text-center">{w.totalLines}</td>
                  <td className="py-2 px-2 font-mono text-xs text-right">{w.totalUnits.toLocaleString()}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <Progress value={pct} className="h-1.5 w-14 shrink-0" />
                      <span className="text-[11px] font-mono">{pct}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    {w.shortUnits > 0 ? <span className="text-red-400 font-mono text-xs">{w.shortUnits}</span> : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-2 px-2 text-xs">{w.carrier}</td>
                  <td className={cn("py-2 px-2 text-xs whitespace-nowrap", overdue ? "text-red-400" : "")}>
                    {new Date(w.dueBy).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {overdue && " ⚠"}
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
        <span>Showing {paged.length} of {all.length} waves</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
          <span className="px-2 py-1">{page} / {total}</span>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= total} onClick={() => setPage(page + 1)}>›</Button>
        </div>
      </div>
    </Panel>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PickingPage() {
  const [selectedWave, setSelectedWave] = useState<Wave | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [tab, setTab] = useState("waves");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={PackageSearch} title="Picking" subtitle="Wave management, batch/zone/cluster picking, shortage handling" />
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 pt-4 border-b border-border">
          <TabsList>
            <TabsTrigger value="waves">Wave Queue</TabsTrigger>
            <TabsTrigger value="shorts">Shortages</TabsTrigger>
            <TabsTrigger value="productivity">Productivity</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <PickingKPIs />
          <TabsContent value="waves" className="mt-0">
            <WaveTable onSelect={(w) => { setSelectedWave(w); setShowDetail(true); }} />
          </TabsContent>
          <TabsContent value="shorts" className="mt-0">
            <ShortagePanel />
          </TabsContent>
          <TabsContent value="productivity" className="mt-0">
            <PickerProductivity />
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0">
          {selectedWave && (
            <WaveDetail wave={selectedWave} onClose={() => setShowDetail(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
