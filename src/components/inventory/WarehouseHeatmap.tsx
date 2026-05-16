/**
 * WarehouseHeatmap — Visual warehouse floor showing bins with occupancy heatmap,
 * zone labels, rack utilization bars, and animated bin status indicators.
 */
import { useMemo, useState } from "react";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { useEditorStore } from "@/lib/wms-editor-store";
import type { BinStatus } from "@/lib/wms-data";
import type { BinInventory } from "@/lib/inventory-bin-store";

// Color scale: occupancy → hue
function occupancyColor(pct: number, status: BinStatus): string {
  if (status === "Blocked")  return "#f97316"; // orange
  if (status === "Damaged")  return "#ef4444"; // red
  if (status === "Reserved") return "#3b82f6"; // blue
  if (status === "Empty")    return "#1e2533"; // dark empty
  if (pct >= 90) return "#ef4444";             // critical red
  if (pct >= 70) return "#f59e0b";             // amber
  if (pct >= 40) return "#22c55e";             // green
  return "#16a34a";                             // light green (partial)
}

interface TooltipState {
  bin: BinInventory;
  x: number;
  y: number;
}

interface BinCellProps {
  bin: BinInventory;
  isSelected: boolean;
  onSelect: (bin: BinInventory) => void;
  onHover: (state: TooltipState | null, e?: React.MouseEvent) => void;
}

function BinCell({ bin, isSelected, onSelect, onHover }: BinCellProps) {
  const color = occupancyColor(bin.occupancyPct, bin.status);
  const isPulse = bin.status === "Blocked" || bin.status === "Damaged";

  return (
    <div
      className={`relative rounded-sm cursor-pointer transition-all duration-200 ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-background scale-110 z-10" : "hover:scale-105 hover:z-10"}`}
      style={{
        width: 14,
        height: 14,
        backgroundColor: color,
        boxShadow: isSelected ? `0 0 8px ${color}80` : undefined,
      }}
      onClick={() => onSelect(bin)}
      onMouseEnter={(e) => onHover({ bin, x: e.clientX, y: e.clientY }, e)}
      onMouseLeave={() => onHover(null)}
    >
      {isPulse && (
        <div
          className="absolute inset-0 rounded-sm animate-ping opacity-60"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}

interface BinTooltipProps {
  state: TooltipState;
}

function BinTooltip({ state }: BinTooltipProps) {
  const { bin, x, y } = state;
  const today = new Date();
  const isExpiringSoon = bin.expiryDate && (() => {
    const exp = new Date(bin.expiryDate!);
    return (exp.getTime() - today.getTime()) / (1000 * 86400) <= 30;
  })();

  return (
    <div
      className="fixed z-50 pointer-events-none bg-card border border-border rounded-lg shadow-xl p-3 w-56 text-xs"
      style={{ left: x + 12, top: y - 10, transform: "translateY(-50%)" }}
    >
      <div className="font-mono font-bold text-sm mb-1">{bin.binCode}</div>
      <div className="text-muted-foreground mb-2">{bin.zoneName} · {bin.rackCode}</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">SKU</span>
          <span className="font-mono text-primary">{bin.skuCode ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Qty</span>
          <span className="font-mono">{bin.quantity}/{bin.capacity}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pallets</span>
          <span className="font-mono">{bin.palletCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className={`font-bold ${
            bin.status === "Damaged" ? "text-red-400" :
            bin.status === "Blocked" ? "text-orange-400" :
            bin.status === "Reserved" ? "text-blue-400" :
            bin.status === "Full" ? "text-emerald-400" :
            "text-muted-foreground"
          }`}>{bin.status}</span>
        </div>
        {bin.batchNumber && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Batch</span>
            <span className="font-mono text-[10px]">{bin.batchNumber}</span>
          </div>
        )}
        {isExpiringSoon && bin.expiryDate && (
          <div className="mt-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-[10px] font-bold">
            ⚠ Expiring: {bin.expiryDate}
          </div>
        )}
      </div>
      {/* Occupancy bar */}
      <div className="mt-2">
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${bin.occupancyPct}%`,
              backgroundColor: occupancyColor(bin.occupancyPct, bin.status),
            }}
          />
        </div>
        <div className="text-right text-[10px] text-muted-foreground mt-0.5">{bin.occupancyPct}%</div>
      </div>
    </div>
  );
}

export function WarehouseHeatmap() {
  const { selectedBinId, selectBin, activeWarehouseName, warehouseBins } = useInvBinStore();
  const bins = activeWarehouseName ? (warehouseBins[activeWarehouseName] ?? []) : [];
  const warehouse = useEditorStore((s) => s.warehouses.find((w) => w.name === s.activeId) ?? s.warehouses[0]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const zones = warehouse.zones;

  // Group bins by zone → rack
  const binMap = useMemo(() => {
    const m = new Map<string, BinInventory>();
    for (const b of bins) m.set(b.binId, b);
    return m;
  }, [bins, activeWarehouseName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zone occupancy summary
  const zoneOccupancy = useMemo(() => {
    const map = new Map<string, { total: number; sum: number }>();
    for (const b of bins) {
      const e = map.get(b.zoneId) ?? { total: 0, sum: 0 };
      map.set(b.zoneId, { total: e.total + 1, sum: e.sum + b.occupancyPct });
    }
    return map;
  }, [bins, activeWarehouseName]); // eslint-disable-line react-hooks/exhaustive-deps

  if (zones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
        <div className="text-4xl mb-3">🏭</div>
        <div className="font-bold mb-1">No warehouse zones configured</div>
        <div className="text-sm">Build your warehouse layout in the Warehouse Builder first.</div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto p-4 bg-background">
      {tooltip && <BinTooltip state={tooltip} />}

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Legend:</span>
        {[
          { label: "Empty",    color: "#1e2533" },
          { label: "Low (1–40%)",  color: "#16a34a" },
          { label: "Med (40–70%)", color: "#22c55e" },
          { label: "High (70–90%)", color: "#f59e0b" },
          { label: "Critical (90%+)", color: "#ef4444" },
          { label: "Reserved",  color: "#3b82f6" },
          { label: "Blocked",   color: "#f97316" },
          { label: "Damaged",   color: "#ef4444" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Zones grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {zones.map((zone) => {
          const occ = zoneOccupancy.get(zone.id);
          const avgPct = occ ? Math.round(occ.sum / occ.total) : 0;
          const allRacks = zone.aisles.flatMap((a) => a.racks);
          const totalBins = allRacks.reduce((s, r) => s + r.bins.length, 0);

          return (
            <div
              key={zone.id}
              className="rounded-xl border border-border/60 overflow-hidden"
              style={{ borderLeftColor: zone.color, borderLeftWidth: 3 }}
            >
              {/* Zone header */}
              <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: zone.color }} />
                  <span className="font-bold text-sm">{zone.name}</span>
                  <span className="text-[10px] text-muted-foreground">{zone.type}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-muted-foreground">{totalBins} bins</span>
                  <span className="font-mono font-bold" style={{
                    color: avgPct >= 90 ? "#ef4444" : avgPct >= 70 ? "#f59e0b" : avgPct >= 30 ? "#22c55e" : "#64748b"
                  }}>
                    {avgPct}% avg
                  </span>
                  {/* Mini utilization bar */}
                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${avgPct}%`,
                        backgroundColor: avgPct >= 90 ? "#ef4444" : avgPct >= 70 ? "#f59e0b" : "#22c55e",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Aisles + Racks */}
              {zone.aisles.length === 0 ? (
                <div className="p-4 text-[11px] text-muted-foreground italic text-center">No racks configured in this zone</div>
              ) : (
                <div className="p-3 space-y-2">
                  {zone.aisles.map((aisle) => (
                    <div key={aisle.id}>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{aisle.code}</div>
                      <div className="space-y-1.5">
                        {aisle.racks.map((rack) => {
                          const rackBins = rack.bins.map((b) => binMap.get(b.id)).filter(Boolean) as BinInventory[];
                          const rackAvgPct = rackBins.length > 0
                            ? Math.round(rackBins.reduce((s, b) => s + b.occupancyPct, 0) / rackBins.length)
                            : 0;

                          return (
                            <div key={rack.id} className="flex items-center gap-2">
                              {/* Rack label + util */}
                              <div className="w-24 shrink-0">
                                <div className="text-[9px] font-mono text-muted-foreground truncate">{rack.code}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <div className="flex-1 h-1 bg-secondary/50 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${rackAvgPct}%`,
                                        backgroundColor: rackAvgPct >= 90 ? "#ef4444" : rackAvgPct >= 70 ? "#f59e0b" : "#22c55e",
                                      }}
                                    />
                                  </div>
                                  <span className="text-[8px] font-mono text-muted-foreground">{rackAvgPct}%</span>
                                </div>
                              </div>

                              {/* Bins row */}
                              <div className="flex flex-wrap gap-0.5">
                                {rack.bins.length === 0 ? (
                                  <span className="text-[9px] text-muted-foreground/50 italic">no bins</span>
                                ) : (
                                  rack.bins.map((rawBin) => {
                                    const invBin = binMap.get(rawBin.id);
                                    if (!invBin) return null;
                                    return (
                                      <BinCell
                                        key={rawBin.id}
                                        bin={invBin}
                                        isSelected={selectedBinId === rawBin.id}
                                        onSelect={(b) => selectBin(b.binId)}
                                        onHover={(s) => setTooltip(s)}
                                      />
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
