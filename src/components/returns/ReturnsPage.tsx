/**
 * TriloWMS — Returns (RMA) Module Page
 */

import { useState } from "react";
import { RotateCcw, Search, X, ChevronRight, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useReturnsStore, RMA_STATUS_META, type RMA, type RmaStatus, type DispositionType } from "@/lib/returns-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

function ReturnsKPIs() {
  const kpis = useReturnsStore((s) => s.kpis());
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard label="OPEN RMAs" value={String(kpis.openRmas)} tone="primary" />
      <KPICard label="RECEIVED" value={String(kpis.received)} tone="info" />
      <KPICard label="RESTOCKED" value={String(kpis.restocked)} tone="success" />
      <KPICard label="SCRAPPED" value={String(kpis.scrapped)} tone="warning" />
      <KPICard label="CREDIT PENDING" value={kpis.creditPending} tone="destructive" />
      <KPICard label="AVG PROCESSING" value={kpis.avgProcessingDays} tone="info" />
      <KPICard label="PENDING INSPECT" value={String(kpis.pendingInspection)} tone="warning" />
    </div>
  );
}

const DISPOSITION_COLORS: Record<string, string> = {
  RESTOCK: "text-emerald-400 bg-emerald-500/10",
  REPAIR: "text-blue-400 bg-blue-500/10",
  SCRAP: "text-red-400 bg-red-500/10",
  RETURN_TO_VENDOR: "text-orange-400 bg-orange-500/10",
  DONATE: "text-purple-400 bg-purple-500/10",
  QUARANTINE: "text-amber-400 bg-amber-500/10",
  PENDING_REVIEW: "text-slate-400 bg-slate-500/10",
};

function RmaDetail({ rma, onClose }: { rma: RMA; onClose: () => void }) {
  const { approveRma, receiveRma, inspectLine, completeRma, rejectRma } = useReturnsStore();
  const meta = RMA_STATUS_META[rma.status];
  const receivedProgress = rma.totalReturnQty > 0 ? (rma.totalReceivedQty / rma.totalReturnQty) * 100 : 0;
  const inspectedLines = rma.lines.filter((l) => l.status === "INSPECTED" || l.status === "DISPOSED").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary">{rma.rmaNumber}</span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
            {rma.priority !== "NORMAL" && (
              <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold",
                rma.priority === "URGENT" ? "text-red-400 bg-red-500/10" : "text-orange-400 bg-orange-500/10"
              )}>{rma.priority}</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{rma.customer} · {rma.orderId}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-4 gap-2 p-4 border-b border-border text-center">
        {[["Lines", rma.totalLines], ["Return Qty", rma.totalReturnQty], ["Received", rma.totalReceivedQty], ["Credit", `$${rma.totalCreditAmount.toFixed(0)}`]].map(([l, v]) => (
          <div key={l}>
            <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
            <div className="font-bold text-sm font-mono mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      {rma.status !== "REQUESTED" && (
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Receipt Progress</span>
            <span className="font-mono">{rma.totalReceivedQty}/{rma.totalReturnQty} units</span>
          </div>
          <Progress value={receivedProgress} className="h-1.5" />
        </div>
      )}

      <div className="flex gap-2 px-4 py-2 border-b border-border flex-wrap">
        {rma.status === "REQUESTED" && (
          <>
            <Button size="sm" onClick={() => approveRma(rma.id, "WMS Supervisor")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve RMA</Button>
            <Button size="sm" variant="destructive" onClick={() => rejectRma(rma.id, "Not eligible for return")}>Reject</Button>
          </>
        )}
        {rma.status === "APPROVED" && (
          <Button size="sm" variant="outline" onClick={() => receiveRma(rma.id, "IN-01")}><Package className="h-3.5 w-3.5 mr-1" />Receive at Dock IN-01</Button>
        )}
        {rma.status === "INSPECTED" && (
          <Button size="sm" onClick={() => completeRma(rma.id, "QC Team")}>Complete & Issue Credit</Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="lines">
          <TabsList className="h-8">
            <TabsTrigger value="lines" className="text-xs h-7">Return Lines ({rma.lines.length})</TabsTrigger>
            <TabsTrigger value="info" className="text-xs h-7">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="lines" className="mt-3 space-y-2">
            {rma.lines.map((line) => (
              <div key={line.id} className={cn(
                "rounded-lg border p-3",
                line.status === "INSPECTED" || line.status === "DISPOSED" ? "border-emerald-500/20 bg-emerald-500/5" :
                line.status === "RECEIVED" ? "border-blue-500/20 bg-blue-500/5" :
                "border-border bg-card/30"
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-primary">L{line.lineNo}</span>
                      <span className="font-mono text-xs">{line.skuCode}</span>
                      <span className="text-xs text-muted-foreground truncate">{line.skuName}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Reason: <span className="text-foreground">{line.reason.replace(/_/g, " ")}</span>
                      {" · "}Qty: <span className="font-mono font-bold">{line.returnQty}</span>
                      {line.condition && <> · Condition: <span className={cn("font-semibold",
                        line.condition === "DAMAGED" || line.condition === "DEFECTIVE" ? "text-red-400" : "text-foreground"
                      )}>{line.condition}</span></>}
                    </div>
                    {line.inspectionNotes && <p className="text-[10px] text-amber-400 mt-1">{line.inspectionNotes}</p>}
                    {line.creditAmount > 0 && <p className="text-[10px] text-emerald-400 mt-1">Credit: ${line.creditAmount.toFixed(2)}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {line.disposition && (
                      <span className={cn("text-[10px] px-2 py-0.5 rounded font-semibold", DISPOSITION_COLORS[line.disposition])}>
                        {line.disposition.replace("_", " ")}
                      </span>
                    )}
                    {(rma.status === "RECEIVED" || rma.status === "INSPECTING") && line.status === "RECEIVED" && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(["RESTOCK","SCRAP","REPAIR","RETURN_TO_VENDOR","QUARANTINE"] as DispositionType[]).map((d) => (
                          <Button key={d} size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                            onClick={() => inspectLine(rma.id, line.id,
                              d === "SCRAP" ? "DAMAGED" : d === "RESTOCK" ? "OPENED" : "DEFECTIVE",
                              d
                            )}>
                            {d.replace("_", " ")}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(rma.status === "INSPECTING" || rma.status === "RECEIVED") && (
              <div className="text-xs text-muted-foreground pt-1">{inspectedLines}/{rma.lines.length} lines inspected</div>
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Customer Code", rma.customerCode],
                ["Carrier", rma.carrier],
                ["Tracking #", rma.trackingNumber ?? "—"],
                ["Return Tracking", rma.returnTrackingNumber ?? "—"],
                ["Receipt Dock", rma.receiptDockCode ?? "—"],
                ["Approved By", rma.approvedBy ?? "—"],
                ["Credit Memo", rma.creditMemoNumber ?? "—"],
                ["Requested", new Date(rma.requestedAt).toLocaleDateString()],
                ["Received", rma.receivedAt ? new Date(rma.receivedAt).toLocaleDateString() : "—"],
                ["Completed", rma.completedAt ? new Date(rma.completedAt).toLocaleDateString() : "—"],
              ].map(([l, v]) => (
                <div key={l} className="rounded border border-border bg-card/30 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
                  <div className="text-xs font-mono mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            {rma.notes && (
              <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs">{rma.notes}</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RmaTable({ onSelect }: { onSelect: (r: RMA) => void }) {
  const { filteredRmas, filters, setFilters, page, setPage, pageSize } = useReturnsStore();
  const all = filteredRmas();
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = Math.max(1, Math.ceil(all.length / pageSize));

  return (
    <Panel title={`RMA QUEUE (${all.length})`}>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search RMA, customer, order..." value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as RmaStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(RMA_STATUS_META) as RmaStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{RMA_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v })}>
          <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {["NORMAL","HIGH","URGENT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filters.search || filters.status || filters.priority) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "", priority: "" })} className="h-8"><X className="h-3.5 w-3.5" /></Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["RMA #","Customer","Order","Lines","Ret. Qty","Recv'd","Credit","Carrier","Requested","Priority","Status",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((r) => {
              const meta = RMA_STATUS_META[r.status];
              return (
                <tr key={r.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => onSelect(r)}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{r.rmaNumber}</td>
                  <td className="py-2 px-2 text-xs">{r.customer}</td>
                  <td className="py-2 px-2 font-mono text-xs">{r.orderId}</td>
                  <td className="py-2 px-2 text-center text-xs">{r.totalLines}</td>
                  <td className="py-2 px-2 text-center text-xs">{r.totalReturnQty}</td>
                  <td className="py-2 px-2 text-center text-xs">
                    <span className={r.totalReceivedQty > 0 ? "text-emerald-400" : "text-muted-foreground"}>{r.totalReceivedQty}</span>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs text-right">
                    {r.totalCreditAmount > 0 ? `$${r.totalCreditAmount.toFixed(0)}` : "—"}
                  </td>
                  <td className="py-2 px-2 text-xs">{r.carrier}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">
                    {new Date(r.requestedAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[10px] px-1.5 rounded font-bold",
                      r.priority === "URGENT" ? "text-red-400 bg-red-500/10" :
                      r.priority === "HIGH" ? "text-orange-400 bg-orange-500/10" :
                      "text-slate-400 bg-slate-500/10"
                    )}>{r.priority}</span>
                  </td>
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

function ReturnsAnalytics() {
  const rmas = useReturnsStore((s) => s.rmas);
  const allLines = rmas.flatMap((r) => r.lines);

  const statusData = (Object.keys(RMA_STATUS_META) as RmaStatus[]).map((s) => ({
    name: RMA_STATUS_META[s].label,
    count: rmas.filter((r) => r.status === s).length,
  })).filter((d) => d.count > 0);

  const reasonData = ["DAMAGED_IN_TRANSIT","WRONG_ITEM","QUALITY_DEFECT","CUSTOMER_CHANGE_MIND","WARRANTY_CLAIM","OVERSHIPMENT"].map((r) => ({
    name: r.replace(/_/g, " ").replace(/(\w+)\s(\w+)/g, "$1\n$2"),
    count: allLines.filter((l) => l.reason === r).length,
  })).filter((d) => d.count > 0);

  const dispositionData = ["RESTOCK","SCRAP","REPAIR","RETURN_TO_VENDOR","QUARANTINE"].map((d) => ({
    name: d.replace("_", " "),
    count: allLines.filter((l) => l.disposition === d).length,
  })).filter((d) => d.count > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel title="RMAs BY STATUS">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={statusData} margin={{ top: 5, right: 5, left: -20, bottom: 50 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="RETURN REASONS">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={reasonData} margin={{ top: 5, right: 5, left: -20, bottom: 60 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="DISPOSITION BREAKDOWN">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dispositionData} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="count" fill="hsl(var(--chart-2, 34 197 94))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

export function ReturnsPage() {
  const [selected, setSelected] = useState<RMA | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={RotateCcw} title="Returns & RMA" subtitle="Return merchandise authorizations, inspection workflow & credit management" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <ReturnsKPIs />
        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue">RMA Queue</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="queue" className="mt-4">
            <RmaTable onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="analytics" className="mt-4">
            <ReturnsAnalytics />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
          {selected && <RmaDetail rma={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
