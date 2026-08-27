/**
 * TriloWMS — Consolidation Module
 * Staging Lanes + Order Consolidation Check
 * Consumes pick waves from the Picking module; gates items into Packing.
 */

import { useMemo, useState } from "react";
import {
  Combine, Search, X, CheckCircle2, AlertTriangle, LayoutDashboard,
  Layers, ScanLine, ArrowRightCircle, RefreshCw, ChevronRight,
  PackageCheck, Clock, Boxes, TrendingUp, Hash, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  useConsolidationStore, LANE_STATUS_META, LINE_STATUS_META,
  type ConsolidationLane, type ConsolidationLine, type LaneStatus,
} from "@/lib/consolidation-store";
import { usePickingStore } from "@/lib/picking-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function LaneStatusBadge({ status }: { status: LaneStatus }) {
  const m = LANE_STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>
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

// ─── Sync button (shared) ─────────────────────────────────────────────────────

function SyncButton({ compact }: { compact?: boolean }) {
  const syncFromPicking = useConsolidationStore((s) => s.syncFromPicking);
  const lastSyncAt = useConsolidationStore((s) => s.lastSyncAt);
  const [synced, setSynced] = useState<number | null>(null);

  const doSync = () => {
    const n = syncFromPicking();
    setSynced(n);
    setTimeout(() => setSynced(null), 2500);
  };

  return (
    <div className="flex items-center gap-2">
      {synced !== null && (
        <span className="text-[10px] text-emerald-400 font-mono">{synced > 0 ? `+${synced} lanes` : "Up to date"}</span>
      )}
      {lastSyncAt && !compact && (
        <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
          Last sync {fmtTime(lastSyncAt)}
        </span>
      )}
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={doSync}>
        <RefreshCw className="h-3 w-3" /> Sync from Picking
      </Button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ════════════════════════════════════════════════════════════════════════════

function StatusFunnelChart() {
  const lanes = useConsolidationStore((s) => s.lanes);
  const data = useMemo(() => {
    const counts = { STAGING: 0, READY: 0, MOVED_TO_PACKING: 0, CANCELLED: 0 };
    for (const l of lanes) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: LANE_STATUS_META[k as LaneStatus].label, count: v }));
  }, [lanes]);

  return (
    <Section title="Lane Status Funnel" sub="Active lanes by status" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--color-accent)", opacity: 0.08 }}
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }}
            />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Lanes" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function ReadyLanesAlert({ onOpen }: { onOpen: (l: ConsolidationLane) => void }) {
  const readyLanes = useConsolidationStore((s) => s.readyLanes)();
  return (
    <Section title="Ready for Consolidation Check" sub={`${readyLanes.length} orders fully staged`} className="h-[240px]">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[200px]">
        {readyLanes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
            <span className="text-sm">No lanes ready yet.</span>
          </div>
        )}
        {readyLanes.slice(0, 8).map((lane) => (
          <button
            key={lane.id}
            onClick={() => onOpen(lane)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-accent/20"
          >
            <div className={cn("h-2 w-2 rounded-full shrink-0", lane.hasShortage ? "bg-amber-400" : "bg-emerald-400")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-primary">{lane.laneCode}</span>
                <span className="text-xs text-muted-foreground truncate">{lane.orderId}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {lane.totalLines} lines · {lane.hasShortage ? "has shortage" : "all arrived"}
              </div>
            </div>
            <LaneStatusBadge status={lane.status} />
          </button>
        ))}
      </div>
    </Section>
  );
}

function OverviewView({ onOpen }: { onOpen: (l: ConsolidationLane) => void }) {
  const kpis = useConsolidationStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="ACTIVE LANES"    value={kpis.activeLanes}    tone="primary"      sub="currently staging"   />
        <KPICard label="READY"           value={kpis.readyForCheck}  tone="success"      sub="awaiting check"      />
        <KPICard label="MOVED TODAY"     value={kpis.movedToday}     tone="info"         sub="sent to packing"     />
        <KPICard label="WITH EXCEPTIONS" value={kpis.withExceptions} tone="warning"      sub="shortage or missing" />
        <KPICard label="ARRIVAL RATE"    value={kpis.arrivalRate}    tone="primary"      sub="units arrived"       />
        <KPICard label="TOTAL LANES"     value={kpis.totalLanes}     tone="info"         sub="all statuses"        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusFunnelChart />
        <ReadyLanesAlert onOpen={onOpen} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  STAGING LANES TAB
// ════════════════════════════════════════════════════════════════════════════

function LaneCard({ lane, onClick }: { lane: ConsolidationLane; onClick: () => void }) {
  const progress = useConsolidationStore((s) => s.laneProgress)(lane);
  const m = LANE_STATUS_META[lane.status];

  return (
    <button
      onClick={onClick}
      className="w-full text-left panel rounded-md p-4 hover:bg-accent/20 transition-colors border group"
      style={{ borderColor: lane.status === "READY" ? "var(--color-success)" : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-primary">{lane.laneCode}</span>
            <span className="text-xs text-muted-foreground">{lane.orderId}</span>
            {lane.hasShortage && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">Shortage</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
            Wave {lane.waveNumber} · {lane.arrivedLines}/{lane.totalLines} lines
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LaneStatusBadge status={lane.status} />
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{lane.totalArrivedUnits} / {lane.totalExpectedUnits} units arrived</span>
          <span className="font-mono">{progress}%</span>
        </div>
        <Progress
          value={progress}
          className={cn("h-1.5", lane.status === "READY" && "[&>div]:bg-emerald-400")}
        />
      </div>
      {lane.status === "READY" && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" /> Ready for Consolidation Check
        </div>
      )}
    </button>
  );
}

function StagingLanesView({ onOpen }: { onOpen: (l: ConsolidationLane) => void }) {
  const lanes = useConsolidationStore((s) => s.lanes);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LaneStatus | "">("");

  const filtered = useMemo(() => {
    const active = lanes.filter((l) => l.status !== "CANCELLED" && l.status !== "MOVED_TO_PACKING");
    return active.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return l.laneCode.toLowerCase().includes(q) || l.orderId.toLowerCase().includes(q) || l.waveNumber.toLowerCase().includes(q);
      }
      return true;
    });
  }, [lanes, search, statusFilter]);

  const activeStatuses: LaneStatus[] = ["STAGING", "READY"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search lane, order, wave…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {(["", ...activeStatuses] as (LaneStatus | "")[]).map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium border transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground border-border/60 hover:border-border",
              )}
            >
              {s === "" ? "All" : LANE_STATUS_META[s].label}
            </button>
          ))}
        </div>
        {(search || statusFilter) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(""); setStatusFilter(""); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground font-mono ml-auto">{filtered.length} lanes</span>
      </div>

      {filtered.length === 0 ? (
        <div className="panel rounded-md flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Layers className="h-10 w-10 opacity-30" />
          <div className="text-sm font-medium">No active staging lanes</div>
          <p className="text-xs text-center max-w-xs">Use "Sync from Picking" to pull completed or in-progress pick waves into staging.</p>
          <SyncButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((lane) => (
            <LaneCard key={lane.id} lane={lane} onClick={() => onOpen(lane)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  CONSOLIDATION CHECK TAB
// ════════════════════════════════════════════════════════════════════════════

function CheckLineRow({ laneId, line }: { laneId: string; line: ConsolidationLine }) {
  const scanArrival = useConsolidationStore((s) => s.scanArrival);
  const m = LINE_STATUS_META[line.status];
  const canScan = line.status === "PENDING";

  return (
    <div className={cn(
      "rounded-lg border p-3 transition-colors",
      line.status === "ARRIVED" ? "border-emerald-500/30 bg-emerald-500/5" :
      line.status === "SHORT"   ? "border-amber-500/30 bg-amber-500/5" :
      line.status === "MISSING" ? "border-red-500/30 bg-red-500/5" :
      "border-border bg-card/40",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-primary">{line.skuCode}</span>
            <span className="text-xs text-muted-foreground truncate">{line.skuName}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 mt-1 text-[11px] text-muted-foreground font-mono">
            <span>Expected {line.qtyExpected} {line.uom}</span>
            {line.qtyArrived > 0 && <span className="text-emerald-400">Arrived {line.qtyArrived}</span>}
            {line.toteId && <span>Tote {line.toteId}</span>}
            <span>Zone {line.zone}</span>
          </div>
          {line.shortReason && (
            <div className="text-[11px] text-amber-400 mt-1">{line.shortReason}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-[10px] font-semibold", m.color)}>{m.label}</span>
          {canScan && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1"
              onClick={() => scanArrival(laneId, line.id)}
            >
              <ScanLine className="h-3 w-3" /> Scan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsolidationCheckView({ onOpen }: { onOpen: (l: ConsolidationLane) => void }) {
  const readyLanes = useConsolidationStore((s) => s.readyLanes)();
  const stagingLanes = useConsolidationStore((s) => s.stagingLanes)();
  const allActionable = [...readyLanes, ...stagingLanes];
  const [activeId, setActiveId] = useState<string | null>(allActionable[0]?.id ?? null);
  const lane = allActionable.find((l) => l.id === activeId) ?? allActionable[0] ?? null;
  const progress = useConsolidationStore((s) => s.laneProgress)(lane ?? { totalLines: 0, lines: [] } as unknown as ConsolidationLane);
  const moveToPacking = useConsolidationStore((s) => s.moveToPacking);

  const allSettled = lane ? lane.lines.every((l) => l.status !== "PENDING") : false;
  const isComplete = lane ? !lane.hasShortage && allSettled : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
      <Section title="Orders to Check" sub={`${allActionable.length} ready or in progress`} className="h-fit">
        <div className="divide-y divide-border/40 max-h-[70vh] overflow-y-auto">
          {allActionable.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground px-4">
              No lanes ready for check yet. Sync from Picking to pull in pick waves.
            </div>
          )}
          {allActionable.map((l) => {
            const prog = useConsolidationStore.getState().laneProgress(l);
            return (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                className={cn("w-full text-left px-4 py-3 transition-colors", activeId === l.id ? "bg-accent/30" : "hover:bg-accent/15")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-primary">{l.laneCode}</span>
                  <LaneStatusBadge status={l.status} />
                </div>
                <div className="text-sm mt-1 truncate text-muted-foreground">{l.orderId}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={prog} className="h-1 flex-1" />
                  <span className="text-[10px] font-mono tabular-nums w-8 text-right">{prog}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {lane ? (
        <Section
          title={`Order Check · ${lane.laneCode}`}
          sub={`${lane.orderId} · Wave ${lane.waveNumber}`}
          actions={
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded border",
                isComplete
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  : allSettled
                  ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                  : "text-slate-400 bg-slate-500/10 border-slate-500/30",
              )}>
                {isComplete
                  ? <><CheckCircle2 className="h-3.5 w-3.5" /> Complete</>
                  : allSettled
                  ? <><AlertTriangle className="h-3.5 w-3.5" /> Complete — with shortage</>
                  : <><Clock className="h-3.5 w-3.5" /> Incomplete</>}
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={!allSettled}
                onClick={() => moveToPacking(lane.id)}
              >
                <ArrowRightCircle className="h-3.5 w-3.5" />
                {isComplete ? "Move to Packing" : "Move (with shortage)"}
              </Button>
            </div>
          }
        >
          <div className="p-4 space-y-2">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <MiniStat label="Lines"    value={`${lane.totalLines}`} />
              <MiniStat label="Arrived"  value={`${lane.arrivedLines}`}     tone="text-emerald-400" />
              <MiniStat label="Progress" value={`${progress}%`}             tone={progress === 100 ? "text-emerald-400" : "text-amber-400"} />
            </div>
            {lane.lines.map((l) => (
              <CheckLineRow key={l.id} laneId={lane.id} line={l} />
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Consolidation Check" className="h-[400px]">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <ScanLine className="h-10 w-10 opacity-30" />
            <span className="text-sm">Select an order to inspect.</span>
          </div>
        </Section>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MOVED TO PACKING TAB
// ════════════════════════════════════════════════════════════════════════════

function MovedView() {
  const lanes = useConsolidationStore((s) => s.lanes);
  const cancelLane = useConsolidationStore((s) => s.cancelLane);
  const waves = usePickingStore((s) => s.waves);
  const waveIds = useMemo(() => new Set(waves.map((w) => w.id)), [waves]);
  const moved = useMemo(() => lanes.filter((l) => l.status === "MOVED_TO_PACKING"), [lanes]);

  return (
    <Section title="Moved to Packing" sub={`${moved.length} orders dispatched from consolidation`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Lane</th>
              <th className="text-left font-semibold py-2.5 px-3">Order ID</th>
              <th className="text-left font-semibold py-2.5 px-3">Wave</th>
              <th className="text-right font-semibold py-2.5 px-3">Lines</th>
              <th className="text-right font-semibold py-2.5 px-3">Units</th>
              <th className="text-left font-semibold py-2.5 px-3">Exceptions</th>
              <th className="text-left font-semibold py-2.5 px-3">Moved At</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="text-left font-semibold py-2.5 px-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {moved.map((lane) => {
              // A lane whose wave id no longer exists in Picking is orphaned — most
              // likely a leftover from an earlier test whose wave id got reused by a
              // brand-new wave, which then silently fails to sync into Consolidation
              // because this stale lane still "claims" that wave id. Surface a way to
              // clear it instead of it blocking forever with no visible cause.
              const orphaned = !waveIds.has(lane.waveId);
              return (
                <tr key={lane.id} className="hover:bg-accent/15">
                  <td className="py-2.5 px-3 font-mono text-xs text-primary">{lane.laneCode}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{lane.orderId}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">
                    {lane.waveNumber}
                    {orphaned && <span className="ml-1.5 text-[9px] text-amber-400 uppercase">stale</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{lane.totalLines}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{lane.totalArrivedUnits}</td>
                  <td className="py-2.5 px-3 text-xs">
                    {lane.hasShortage
                      ? <span className="text-amber-400">Shortage</span>
                      : <span className="text-muted-foreground">None</span>}
                  </td>
                  <td className="py-2.5 px-3 text-xs font-mono">{lane.movedAt ? fmtDate(lane.movedAt) + " " + fmtTime(lane.movedAt) : "—"}</td>
                  <td className="py-2.5 px-3"><LaneStatusBadge status={lane.status} /></td>
                  <td className="py-2.5 px-3">
                    {orphaned && (
                      <button
                        onClick={() => cancelLane(lane.id)}
                        className="text-[10px] text-muted-foreground underline hover:text-destructive"
                        title="Clear this stale lane so a new wave with the same id can sync"
                      >
                        Clear
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {moved.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                  No orders have been moved to packing yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  LANE DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function LaneDetailDrawer({ laneId, onClose }: { laneId: string | null; onClose: () => void }) {
  const lane = useConsolidationStore((s) => s.lanes.find((l) => l.id === laneId)) ?? null;
  const scanArrival = useConsolidationStore((s) => s.scanArrival);
  const moveToPacking = useConsolidationStore((s) => s.moveToPacking);
  const progress = useConsolidationStore((s) => s.laneProgress)(lane ?? { totalLines: 0, lines: [] } as unknown as ConsolidationLane);

  if (!lane) return null;

  const allSettled = lane.lines.every((l) => l.status !== "PENDING");
  const isComplete = !lane.hasShortage && allSettled;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{lane.laneCode}</span>
            <LaneStatusBadge status={lane.status} />
            {lane.hasShortage && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                <AlertTriangle className="h-3 w-3" /> Shortage
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{lane.orderId} · Wave {lane.waveNumber}</div>
        </div>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Lines"    value={`${lane.arrivedLines}/${lane.totalLines}`} />
          <MiniStat label="Units"    value={`${lane.totalArrivedUnits}/${lane.totalExpectedUnits}`} tone="text-emerald-400" />
          <MiniStat label="Progress" value={`${progress}%`} tone={progress === 100 ? "text-emerald-400" : "text-amber-400"} />
        </div>
        <div>
          <Progress value={progress} className={cn("h-2", lane.status === "READY" && "[&>div]:bg-emerald-400")} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {lane.status === "READY" && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => { moveToPacking(lane.id); onClose(); }}
            >
              <ArrowRightCircle className="h-3.5 w-3.5" />
              {isComplete ? "Move to Packing" : "Move (with shortage)"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        <h3 className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-3">Line Items</h3>
        {lane.lines.map((l) => (
          <CheckLineRow key={l.id} laneId={lane.id} line={l} />
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "staging" | "check" | "moved";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview",       icon: LayoutDashboard },
  { id: "staging",  label: "Staging Lanes",  icon: Layers },
  { id: "check",    label: "Consol. Check",  icon: ScanLine },
  { id: "moved",    label: "Moved",          icon: PackageCheck },
];

export function ConsolidationPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openLaneId, setOpenLaneId] = useState<string | null>(null);
  const kpis = useConsolidationStore((s) => s.kpis)();

  const open = (l: ConsolidationLane) => setOpenLaneId(l.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={Combine}
        title="Consolidation"
        subtitle="Staging lanes · order consolidation check · move to packing"
        actions={
          <>
            <SyncButton />
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge =
            id === "check"   && kpis.readyForCheck > 0 ? kpis.readyForCheck :
            id === "staging" && kpis.activeLanes   > 0 ? kpis.activeLanes   : null;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && (
                <span className={cn(
                  "ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums",
                  id === "check" ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/15 text-primary",
                )}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview" && <OverviewView onOpen={open} />}
        {tab === "staging"  && <StagingLanesView onOpen={open} />}
        {tab === "check"    && <ConsolidationCheckView onOpen={open} />}
        {tab === "moved"    && <MovedView />}
      </div>

      <Sheet open={!!openLaneId} onOpenChange={(o) => !o && setOpenLaneId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <LaneDetailDrawer laneId={openLaneId} onClose={() => setOpenLaneId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
