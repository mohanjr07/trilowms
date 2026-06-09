/**
 * TriloWMS — Quality Control Module Page
 */

import { useState } from "react";
import { ShieldCheck, Search, X, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useQCStore, QC_STATUS_META, type QCInspection, type InspectionStatus, type QCHold } from "@/lib/qc-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

function QCKPIs() {
  const kpis = useQCStore((s) => s.kpis)();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard label="OPEN HOLDS" value={String(kpis.openHolds)} tone="destructive" />
      <KPICard label="PASS RATE" value={kpis.passRate} tone="success" />
      <KPICard label="FAILED" value={String(kpis.failed)} tone="destructive" />
      <KPICard label="IN PROGRESS" value={String(kpis.inProgress)} tone="warning" />
      <KPICard label="AVG DEFECT RATE" value={kpis.avgDefectRate} tone="warning" />
      <KPICard label="INSPECTORS ACTIVE" value={String(kpis.inspectorsActive)} tone="info" />
      <KPICard label="PENDING REVIEW" value={String(kpis.pendingReview)} tone="primary" />
    </div>
  );
}

function CheckpointRow({ cp, onUpdate }: {
  cp: QCInspection["checkpoints"][0];
  onUpdate?: (result: "PASS" | "FAIL" | "N/A") => void;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      cp.result === "PASS" ? "border-emerald-500/30 bg-emerald-500/5" :
      cp.result === "FAIL" ? "border-red-500/30 bg-red-500/5" :
      "border-border bg-card/30"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{cp.name}</span>
            {cp.mandatory && <span className="text-[10px] text-red-400 font-semibold">MANDATORY</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{cp.description}</p>
          {cp.tolerance && <span className="text-[10px] text-muted-foreground">Tolerance: {cp.tolerance}</span>}
          {cp.value && <span className="text-[10px] text-blue-400 ml-2">Measured: {cp.value}</span>}
          {cp.notes && <p className="text-[10px] text-amber-400 mt-1">{cp.notes}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onUpdate ? (
            <>
              <Button size="sm" variant={cp.result === "PASS" ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => onUpdate("PASS")}>
                <CheckCircle2 className="h-3 w-3 mr-1" />Pass
              </Button>
              <Button size="sm" variant={cp.result === "FAIL" ? "destructive" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => onUpdate("FAIL")}>
                <XCircle className="h-3 w-3 mr-1" />Fail
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                onClick={() => onUpdate("N/A")}>N/A</Button>
            </>
          ) : (
            cp.result && (
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
                cp.result === "PASS" ? "text-emerald-400 bg-emerald-500/10" :
                cp.result === "FAIL" ? "text-red-400 bg-red-500/10" :
                "text-slate-400 bg-slate-500/10"
              )}>{cp.result}</span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function InspectionDetail({ inspection, onClose }: { inspection: QCInspection; onClose: () => void }) {
  const { startInspection, updateCheckpoint, completeInspection } = useQCStore();
  const meta = QC_STATUS_META[inspection.status];
  const canStart = inspection.status === "QUEUED";
  const canComplete = inspection.status === "IN_PROGRESS" && inspection.checkpoints.every((cp) => cp.result !== null);
  const passCount = inspection.checkpoints.filter((cp) => cp.result === "PASS").length;
  const failCount = inspection.checkpoints.filter((cp) => cp.result === "FAIL").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary">{inspection.inspectionNumber}</span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{inspection.type}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{inspection.skuCode} — {inspection.skuName}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-4 gap-2 p-4 border-b border-border text-center">
        {[["Sample", inspection.sampleSize], ["Inspected", inspection.inspectedQty], ["Passed", inspection.passedQty], ["Failed", inspection.failedQty]].map(([l, v]) => (
          <div key={l}>
            <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
            <div className={cn("font-bold text-sm font-mono mt-0.5", l === "Failed" && inspection.failedQty > 0 ? "text-red-400" : "")}>{v}</div>
          </div>
        ))}
      </div>

      {inspection.defectRate > 0 && (
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Defect Rate</span>
            <span className={cn("font-mono font-bold", inspection.defectRate > 5 ? "text-red-400" : "text-amber-400")}>{inspection.defectRate}%</span>
          </div>
          <Progress value={Math.min(100, inspection.defectRate * 5)} className="h-1.5" />
        </div>
      )}

      <div className="flex gap-2 px-4 py-2 border-b border-border flex-wrap">
        {canStart && <Button size="sm" onClick={() => startInspection(inspection.id)}>Start Inspection</Button>}
        {canComplete && (
          <Button size="sm" onClick={() => {
            const disp = failCount === 0 ? "ACCEPT" : failCount <= 1 ? "CONDITIONAL_RELEASE" : "REJECT";
            completeInspection(inspection.id, disp, failCount > 0 ? "Defects found during inspection." : "All checkpoints passed.");
          }}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Complete Inspection
          </Button>
        )}
        {inspection.status === "IN_PROGRESS" && <span className="text-xs text-muted-foreground self-center">{passCount} passed · {failCount} failed of {inspection.checkpoints.length}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <Tabs defaultValue="checkpoints">
          <TabsList className="h-8">
            <TabsTrigger value="checkpoints" className="text-xs h-7">Checkpoints ({inspection.checkpoints.length})</TabsTrigger>
            <TabsTrigger value="details" className="text-xs h-7">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="checkpoints" className="space-y-2 mt-3">
            {inspection.checkpoints.map((cp) => (
              <CheckpointRow
                key={cp.id}
                cp={cp}
                onUpdate={inspection.status === "IN_PROGRESS" ? (result) => updateCheckpoint(inspection.id, cp.id, result) : undefined}
              />
            ))}
          </TabsContent>

          <TabsContent value="details" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Inspector", inspection.inspectorName],
                ["AQL Level", inspection.aqlLevel],
                ["Lot Number", inspection.lotNumber ?? "—"],
                ["Batch", inspection.batchNumber ?? "—"],
                ["Bin Code", inspection.binCode ?? "—"],
                ["Source Ref", inspection.sourceRef ?? "—"],
                ["Expiry Date", inspection.expiryDate ?? "—"],
                ["Disposition", inspection.disposition ?? "Pending"],
                ["Created", new Date(inspection.createdAt).toLocaleString()],
                ["Completed", inspection.completedAt ? new Date(inspection.completedAt).toLocaleString() : "—"],
              ].map(([l, v]) => (
                <div key={l} className="rounded border border-border bg-card/30 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
                  <div className="text-xs font-mono mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            {inspection.findings && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="text-xs font-semibold text-amber-400 mb-1">Findings</div>
                <p className="text-xs text-muted-foreground">{inspection.findings}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InspectionTable({ onSelect }: { onSelect: (i: QCInspection) => void }) {
  const { filteredInspections, filters, setFilters, page, setPage, pageSize } = useQCStore();
  const all = filteredInspections();
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = Math.max(1, Math.ceil(all.length / pageSize));

  return (
    <Panel title={`INSPECTIONS (${all.length})`}>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search inspection, SKU..." value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as InspectionStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(["QUEUED","IN_PROGRESS","PASSED","FAILED","CONDITIONAL_PASS","PENDING_REVIEW","HOLD"] as InspectionStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{QC_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.type || "all"} onValueChange={(v) => setFilters({ type: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {["INBOUND","PUTAWAY","CYCLE_COUNT","RETURNS","OUTBOUND","AD_HOC"].map((t) => (
              <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filters.search || filters.status || filters.type) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "", type: "" })} className="h-8"><X className="h-3.5 w-3.5" /></Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["Inspection","Type","SKU","Inspector","Sample","Passed","Failed","Defect%","AQL","Status",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((i) => {
              const meta = QC_STATUS_META[i.status];
              return (
                <tr key={i.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => onSelect(i)}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{i.inspectionNumber}</td>
                  <td className="py-2 px-2 text-xs">{i.type.replace("_", " ")}</td>
                  <td className="py-2 px-2">
                    <div className="text-xs font-mono">{i.skuCode}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-32">{i.skuName}</div>
                  </td>
                  <td className="py-2 px-2 text-xs">{i.inspectorName}</td>
                  <td className="py-2 px-2 text-center text-xs">{i.sampleSize}</td>
                  <td className="py-2 px-2 text-center text-emerald-400 text-xs">{i.passedQty}</td>
                  <td className="py-2 px-2 text-center text-xs">
                    <span className={cn(i.failedQty > 0 ? "text-red-400" : "text-muted-foreground")}>{i.failedQty}</span>
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-xs">
                    <span className={cn(i.defectRate > 5 ? "text-red-400" : i.defectRate > 0 ? "text-amber-400" : "text-muted-foreground")}>
                      {i.defectRate}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-[10px] text-muted-foreground">{i.aqlLevel.replace("_", " ")}</td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
                  </td>
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

function HoldDetail({ hold, onClose }: { hold: QCHold; onClose: () => void }) {
  const { resolveHold } = useQCStore();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary">{hold.holdNumber}</span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold",
              hold.status === "ACTIVE" ? "text-red-400 bg-red-500/10" :
              hold.status === "ESCALATED" ? "text-orange-400 bg-orange-500/10" :
              "text-emerald-400 bg-emerald-500/10"
            )}>{hold.status}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{hold.type.replace("_", " ")} · {hold.skuCode}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="text-xs font-semibold text-red-400 mb-1">Hold Reason</div>
          <p className="text-sm">{hold.reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            ["SKU", hold.skuCode],
            ["Quantity", String(hold.quantity)],
            ["Bin Code", hold.binCode ?? "—"],
            ["Lot Number", hold.lotNumber ?? "—"],
            ["Raised By", hold.raisedBy],
            ["Raised At", new Date(hold.raisedAt).toLocaleString()],
            ["Resolved By", hold.resolvedBy ?? "—"],
            ["Resolution", hold.resolution ?? "Pending"],
          ].map(([l, v]) => (
            <div key={l} className="rounded border border-border bg-card/30 p-2">
              <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
              <div className="text-xs font-mono mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        {hold.notes && (
          <div className="rounded border border-border p-3 text-xs text-muted-foreground">{hold.notes}</div>
        )}

        {hold.status === "ACTIVE" && (
          <div className="flex flex-wrap gap-2 pt-2">
            {(["ACCEPT","REJECT","SCRAP","RETURN_TO_VENDOR","QUARANTINE"] as const).map((disp) => (
              <Button key={disp} size="sm" variant="outline" className="text-xs"
                onClick={() => resolveHold(hold.id, "QC Supervisor", disp)}>
                {disp.replace("_", " ")}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HoldsPanel() {
  const holds = useQCStore((s) => s.holds);
  const [selected, setSelected] = useState<QCHold | null>(null);

  return (
    <>
      <Panel title={`QC HOLDS (${holds.filter((h) => h.status === "ACTIVE").length} ACTIVE)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
                {["Hold #","Type","SKU","Bin","Lot","Qty","Raised By","Raised At","Status",""].map((h) => (
                  <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {holds.map((h) => (
                <tr key={h.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => setSelected(h)}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{h.holdNumber}</td>
                  <td className="py-2 px-2 text-xs">{h.type.replace("_", " ")}</td>
                  <td className="py-2 px-2">
                    <div className="text-xs font-mono">{h.skuCode}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-28">{h.skuName}</div>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{h.binCode ?? "—"}</td>
                  <td className="py-2 px-2 font-mono text-xs">{h.lotNumber ?? "—"}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{h.quantity}</td>
                  <td className="py-2 px-2 text-xs">{h.raisedBy}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">
                    {new Date(h.raisedAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold",
                      h.status === "ACTIVE" ? "text-red-400 bg-red-500/10" :
                      h.status === "ESCALATED" ? "text-orange-400 bg-orange-500/10" :
                      "text-emerald-400 bg-emerald-500/10"
                    )}>{h.status}</span>
                  </td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl h-[80vh] flex flex-col p-0 gap-0">
          {selected && <HoldDetail hold={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QCAnalytics() {
  const inspections = useQCStore((s) => s.inspections);

  const statusCounts = (["QUEUED","IN_PROGRESS","PASSED","FAILED","CONDITIONAL_PASS","PENDING_REVIEW"] as InspectionStatus[]).map((s) => ({
    name: QC_STATUS_META[s].label,
    count: inspections.filter((i) => i.status === s).length,
  }));

  const typeCounts = ["INBOUND","PUTAWAY","RETURNS","OUTBOUND","AD_HOC"].map((t) => ({
    name: t.replace("_", " "),
    count: inspections.filter((i) => i.type === t).length,
    failed: inspections.filter((i) => i.type === t && i.status === "FAILED").length,
  }));

  const defectTrend = inspections
    .filter((i) => i.completedAt)
    .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime())
    .slice(-12)
    .map((i, idx) => ({ idx: `#${idx + 1}`, rate: i.defectRate }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      <Panel title="INSPECTIONS BY STATUS">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={statusCounts} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="INSPECTIONS BY TYPE">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={typeCounts} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="count" name="Total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="failed" name="Failed" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="DEFECT RATE TREND">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={defectTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="idx" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} unit="%" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Line type="monotone" dataKey="rate" stroke="hsl(var(--destructive))" dot={{ r: 3 }} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

export function QCPage() {
  const [selected, setSelected] = useState<QCInspection | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={ShieldCheck} title="Quality Control" subtitle="Incoming inspection, AQL sampling, holds management & disposition" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <QCKPIs />
        <Tabs defaultValue="inspections">
          <TabsList>
            <TabsTrigger value="inspections">Inspections</TabsTrigger>
            <TabsTrigger value="holds">QC Holds</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="inspections" className="mt-4">
            <InspectionTable onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="holds" className="mt-4">
            <HoldsPanel />
          </TabsContent>
          <TabsContent value="analytics" className="mt-4">
            <QCAnalytics />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
          {selected && <InspectionDetail inspection={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
