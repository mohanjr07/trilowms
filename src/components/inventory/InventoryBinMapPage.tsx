/**
 * InventoryBinMapPage — Live Inventory Bin Mapping
 * All hooks called at top level only — no conditional/inline hook calls
 */
import { useEffect, useMemo } from "react";
import {
  Map, Search, List, Package, AlertTriangle,
  TrendingUp, Layers, Weight, Calendar, BarChart3, Archive, Filter,
} from "lucide-react";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { useEditorStore } from "@/lib/wms-editor-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { WarehouseHeatmap } from "./WarehouseHeatmap";
import { BinDetailPanel } from "./BinDetailPanel";
import { BinSearchPanel } from "./BinSearchPanel";
import type { BinStatus } from "@/lib/wms-data";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";

// ─── KPI Strip ────────────────────────────────────────────────────────────────
function KPIStrip() {
  const bins = useInvBinStore((s) => s.bins);
  const kpisFn = useInvBinStore((s) => s.kpis);
  const kpis = useMemo(() => kpisFn(), [bins]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 px-5 pt-4 pb-2">
      <KPICard label="TOTAL BINS"     value={kpis.totalBins.toLocaleString()}                             delta={`${kpis.occupiedBins} occupied`}                                   tone="primary"     icon={Package}        sub={`${kpis.emptyBins} empty`} />
      <KPICard label="AVG OCCUPANCY"  value={`${kpis.avgOccupancyPct}%`}                                 delta={kpis.avgOccupancyPct >= 85 ? "⚠ High utilization" : "Normal range"} tone={kpis.avgOccupancyPct >= 85 ? "destructive" : "success"} icon={TrendingUp} />
      <KPICard label="TOTAL PALLETS"  value={kpis.totalPallets.toLocaleString()}                         delta="Across all zones"                                                   tone="info"        icon={Layers} />
      <KPICard label="TOTAL WEIGHT"   value={`${(kpis.totalWeight / 1000).toFixed(1)}t`}                 delta="Warehouse load"                                                     tone="primary"     icon={Weight} />
      <KPICard label="EXPIRING SOON"  value={kpis.expiringWithin30Days}                                  delta="Within 30 days"                                                     tone={kpis.expiringWithin30Days > 0 ? "warning" : "success"}  icon={Calendar}   sub={kpis.expiringWithin30Days > 0 ? "Needs attention" : "All clear"} />
      <KPICard label="CRITICAL BINS"  value={kpis.criticalBins}                                          delta="≥90% full"                                                          tone={kpis.criticalBins > 10 ? "destructive" : "warning"}     icon={AlertTriangle} />
    </div>
  );
}

// ─── Zone Occupancy Chart ─────────────────────────────────────────────────────
function ZoneOccupancyChart() {
  const bins = useInvBinStore((s) => s.bins);
  const zoneOccupancyFn = useInvBinStore((s) => s.zoneOccupancy);
  const zoneOccupancy = useMemo(() => zoneOccupancyFn(), [bins]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = zoneOccupancy.map((z) => ({
    name: z.zoneName.split(" ")[0],
    fullName: z.zoneName,
    pct: z.occupancyPct,
    bins: z.binCount,
    occupied: z.occupiedCount,
    color: z.color,
  }));
  if (data.length === 0) return null;
  return (
    <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider">Zone Utilization</span>
      </div>
      <div className="p-3 h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }}
              formatter={(v: number, _name: string, props: { payload: { fullName: string; occupied: number; bins: number } }) => [
                `${v}% (${props.payload.occupied}/${props.payload.bins} bins)`,
                props.payload.fullName,
              ]}
            />
            <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Bin Status Summary ───────────────────────────────────────────────────────
function StatusSummary() {
  // All hook calls at top level — no hooks inside arrays or conditionals
  const bins    = useInvBinStore((s) => s.bins);
  const kpisFn  = useInvBinStore((s) => s.kpis);
  const kpis    = useMemo(() => kpisFn(), [bins]); // eslint-disable-line react-hooks/exhaustive-deps
  const fullCnt = useMemo(() => bins.filter((b) => b.status === "Full").length, [bins]);
  const partCnt = useMemo(() => bins.filter((b) => b.status === "Partial").length, [bins]);

  const entries: { label: BinStatus; count: number; color: string }[] = [
    { label: "Full",     count: fullCnt,           color: "#22c55e" },
    { label: "Partial",  count: partCnt,           color: "#f59e0b" },
    { label: "Empty",    count: kpis.emptyBins,    color: "#334155" },
    { label: "Reserved", count: kpis.reservedBins, color: "#3b82f6" },
    { label: "Blocked",  count: kpis.blockedBins,  color: "#f97316" },
    { label: "Damaged",  count: kpis.damagedBins,  color: "#ef4444" },
  ];
  const total = kpis.totalBins || 1;

  return (
    <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
        <Archive className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider">Bin Status Breakdown</span>
      </div>
      <div className="p-3 space-y-2">
        {entries.map(({ label, count, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground w-16">{label}</span>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-mono w-8 text-right">{count}</span>
            <span className="text-[10px] text-muted-foreground w-8">{Math.round((count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bin List View ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<BinStatus, string> = {
  Empty: "text-slate-400", Partial: "text-amber-400", Full: "text-emerald-400",
  Reserved: "text-blue-400", Blocked: "text-orange-400", Damaged: "text-red-400",
};
const STATUS_OPTS: BinStatus[] = ["Empty", "Partial", "Full", "Reserved", "Blocked", "Damaged"];

function BinListView() {
  const bins = useInvBinStore((s) => s.bins);
  const filters = useInvBinStore((s) => s.filters);
  const filteredBinsFn = useInvBinStore((s) => s.filteredBins);
  const filteredBins = useMemo(() => filteredBinsFn(), [bins, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedBinId = useInvBinStore((s) => s.selectedBinId);
  const selectBin = useInvBinStore((s) => s.selectBin);
  const setFilters = useInvBinStore((s) => s.setFilters);
  const zones = useEditorStore((s) => s.warehouse.zones);

  const today = new Date();

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 p-3 border-b border-border/40 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          className="px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 w-36"
          placeholder="Filter SKU..."
          value={filters.skuSearch}
          onChange={(e) => setFilters({ skuSearch: e.target.value })}
        />
        <input
          className="px-2 py-1 text-xs bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 w-28"
          placeholder="Filter bin..."
          value={filters.binSearch}
          onChange={(e) => setFilters({ binSearch: e.target.value })}
        />
        <select
          className="px-2 py-1 text-xs bg-background border border-border/60 rounded"
          value={filters.zoneId}
          onChange={(e) => setFilters({ zoneId: e.target.value })}
        >
          <option value="">All Zones</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select
          className="px-2 py-1 text-xs bg-background border border-border/60 rounded"
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value as BinStatus | "" })}
        >
          <option value="">All Status</option>
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input type="checkbox" checked={filters.expiringOnly} onChange={(e) => setFilters({ expiringOnly: e.target.checked })} className="h-3 w-3" />
          <span className="text-muted-foreground">Expiring</span>
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input type="checkbox" checked={filters.criticalOnly} onChange={(e) => setFilters({ criticalOnly: e.target.checked })} className="h-3 w-3" />
          <span className="text-muted-foreground">Critical</span>
        </label>
        <span className="ml-auto text-[10px] text-muted-foreground">{filteredBins.length} bins</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm">
            <tr>
              {["Bin Code","Zone","Rack","SKU","Item","Qty","Occ%","Pallets","Status","Batch","Expiry","Last Move"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap border-b border-border/40">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredBins.map((b) => {
              const isExpiring = b.expiryDate
                ? (new Date(b.expiryDate).getTime() - today.getTime()) / (1000 * 86400) <= 30
                : false;
              return (
                <tr
                  key={b.binId}
                  onClick={() => selectBin(b.binId === selectedBinId ? null : b.binId)}
                  className={`border-b border-border/20 cursor-pointer transition-colors hover:bg-secondary/30 ${selectedBinId === b.binId ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-2 font-mono font-bold">{b.binCode}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b.zoneColor }} />
                      <span className="truncate max-w-[80px]">{b.zoneName}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{b.rackCode}</td>
                  <td className="px-3 py-2 font-mono text-primary">{b.skuCode ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{b.skuName ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{b.quantity}/{b.capacity}</td>
                  <td className="px-3 py-2">
                    <span className={`font-mono font-bold ${b.occupancyPct >= 90 ? "text-red-400" : b.occupancyPct >= 70 ? "text-amber-400" : "text-emerald-400"}`}>
                      {b.occupancyPct}%
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-center">{b.palletCount}</td>
                  <td className="px-3 py-2">
                    <span className={`font-bold ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[9px] text-muted-foreground">{b.batchNumber ?? "—"}</td>
                  <td className="px-3 py-2">
                    {b.expiryDate
                      ? <span className={isExpiring ? "text-amber-400 font-bold" : "text-muted-foreground"}>{b.expiryDate}</span>
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                    {b.lastMovement
                      ? new Date(b.lastMovement).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredBins.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No bins match current filters</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function InventoryBinMapPage() {
  const init       = useInvBinStore((s) => s.init);
  const viewMode   = useInvBinStore((s) => s.viewMode);
  const setViewMode= useInvBinStore((s) => s.setViewMode);
  const selectedBinId = useInvBinStore((s) => s.selectedBinId);
  const selectBin  = useInvBinStore((s) => s.selectBin);
  const getBinById = useInvBinStore((s) => s.getBinById);
  const warehouse  = useEditorStore((s) => s.warehouse);

  useEffect(() => {
    init(warehouse);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBin = selectedBinId ? getBinById(selectedBinId) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={Map}
        title="Live Inventory Bin Map"
        subtitle={`${warehouse.name} · Real-time occupancy & bin tracking`}
        actions={
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
            {([
              { mode: "heatmap" as const, icon: Map,    label: "Heatmap" },
              { mode: "list"    as const, icon: List,   label: "List"    },
              { mode: "rack"    as const, icon: Search, label: "Search"  },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        }
      />

      <KPIStrip />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left sidebar charts */}
        {viewMode !== "rack" && (
          <div className="w-64 shrink-0 border-r border-border/60 overflow-y-auto p-3 space-y-3 bg-card/30">
            <ZoneOccupancyChart />
            <StatusSummary />
          </div>
        )}

        {/* Center view */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "heatmap" && <WarehouseHeatmap />}
          {viewMode === "list"    && <BinListView />}
          {viewMode === "rack"    && (
            <div className="flex h-full">
              <div className="w-80 border-r border-border/60 overflow-hidden flex flex-col">
                <BinSearchPanel />
              </div>
              <div className="flex-1 overflow-hidden">
                <WarehouseHeatmap />
              </div>
            </div>
          )}
        </div>

        {/* Right: bin detail panel */}
        {selectedBin && (
          <div className="w-72 shrink-0 overflow-hidden">
            <BinDetailPanel bin={selectedBin} onClose={() => selectBin(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
