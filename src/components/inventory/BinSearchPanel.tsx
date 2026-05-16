/**
 * BinSearchPanel — Search for SKU locations across the entire warehouse
 * Shows bin path, occupancy, status, and quick-select navigation
 */
import { useState, useMemo } from "react";
import { Search, MapPin, Package, Layers, ChevronRight, AlertTriangle, Calendar } from "lucide-react";
import { useInvBinStore, type BinInventory } from "@/lib/inventory-bin-store";
import type { BinStatus } from "@/lib/wms-data";

const STATUS_COLORS: Record<BinStatus, string> = {
  Empty:    "text-slate-400",
  Partial:  "text-amber-400",
  Full:     "text-emerald-400",
  Reserved: "text-blue-400",
  Blocked:  "text-orange-400",
  Damaged:  "text-red-400",
};

function OccupancyMini({ pct, status }: { pct: number; status: BinStatus }) {
  const color =
    status === "Blocked" ? "#f97316" :
    status === "Damaged" ? "#ef4444" :
    status === "Reserved" ? "#3b82f6" :
    pct >= 90 ? "#ef4444" :
    pct >= 70 ? "#f59e0b" : "#22c55e";

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
    </div>
  );
}

function BinRow({ bin, onSelect, isSelected }: { bin: BinInventory; onSelect: () => void; isSelected: boolean }) {
  const today = new Date();
  const isExpiringSoon = bin.expiryDate && (() => {
    const exp = new Date(bin.expiryDate!);
    return (exp.getTime() - today.getTime()) / (1000 * 86400) <= 30;
  })();

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 border-b border-border/30 hover:bg-secondary/40 transition-colors group ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-xs">{bin.binCode}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground truncate">{bin.zoneName}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">{bin.rackCode}</span>
            </div>
            {bin.skuCode && (
              <div className="flex items-center gap-1 mt-0.5">
                <Package className="h-2.5 w-2.5 text-primary" />
                <span className="text-[10px] font-mono text-primary">{bin.skuCode}</span>
                {bin.skuName && <span className="text-[10px] text-muted-foreground truncate">· {bin.skuName}</span>}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <OccupancyMini pct={bin.occupancyPct} status={bin.status} />
              <span className={`text-[10px] font-bold ${STATUS_COLORS[bin.status]}`}>{bin.status}</span>
              {bin.palletCount > 0 && (
                <span className="text-[10px] text-muted-foreground">{bin.palletCount} plt</span>
              )}
              {isExpiringSoon && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Exp: {bin.expiryDate}
                </span>
              )}
            </div>
          </div>
        </div>
        {bin.batchNumber && (
          <div className="shrink-0 text-[9px] font-mono text-muted-foreground/60 text-right">
            {bin.batchNumber}
          </div>
        )}
      </div>
    </button>
  );
}

export function BinSearchPanel() {
  const { bins, selectedBinId, selectBin, filters, setFilters } = useInvBinStore();
  const [localSearch, setLocalSearch] = useState("");
  const [searchType, setSearchType] = useState<"sku" | "bin">("sku");

  const results = useMemo(() => {
    if (!localSearch.trim()) return [];
    const q = localSearch.toLowerCase();
    return bins
      .filter((b) => {
        if (searchType === "sku") {
          return b.skuCode?.toLowerCase().includes(q) || b.skuName?.toLowerCase().includes(q);
        } else {
          return b.binCode.toLowerCase().includes(q) || b.rackCode.toLowerCase().includes(q);
        }
      })
      .slice(0, 50); // cap at 50
  }, [bins, localSearch, searchType]);

  // Quick stats for searched SKU
  const skuStats = useMemo(() => {
    if (searchType !== "sku" || !localSearch) return null;
    const q = localSearch.toLowerCase();
    const matching = bins.filter((b) => b.skuCode?.toLowerCase().includes(q));
    if (matching.length === 0) return null;
    return {
      locations: matching.length,
      totalQty: matching.reduce((s, b) => s + b.quantity, 0),
      totalPallets: matching.reduce((s, b) => s + b.palletCount, 0),
      zones: [...new Set(matching.map((b) => b.zoneName))],
    };
  }, [bins, localSearch, searchType]);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-border space-y-2">
        {/* Type toggle */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
          {(["sku", "bin"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setSearchType(t); setLocalSearch(""); }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${searchType === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "sku" ? "Search by SKU" : "Search by Bin/Rack"}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border/60 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
            placeholder={searchType === "sku" ? "SKU code or item name..." : "Bin code or rack code..."}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
      </div>

      {/* SKU summary card */}
      {skuStats && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1.5">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest">SKU Found In Warehouse</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-mono text-foreground">{skuStats.locations}</div>
              <div className="text-[9px] text-muted-foreground">Locations</div>
            </div>
            <div>
              <div className="text-lg font-bold text-mono text-foreground">{skuStats.totalQty.toLocaleString()}</div>
              <div className="text-[9px] text-muted-foreground">Total Units</div>
            </div>
            <div>
              <div className="text-lg font-bold text-mono text-foreground">{skuStats.totalPallets}</div>
              <div className="text-[9px] text-muted-foreground">Pallets</div>
            </div>
          </div>
          <div className="text-[9px] text-muted-foreground">
            Zones: {skuStats.zones.join(", ")}
          </div>
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {!localSearch && (
          <div className="p-4 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <div className="text-sm font-medium">Search Bin Inventory</div>
            <div className="text-xs mt-1">Find any SKU location or look up a specific bin or rack</div>
          </div>
        )}

        {localSearch && results.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            <div className="text-sm">No results found</div>
            <div className="text-xs mt-1">Try a different search term</div>
          </div>
        )}

        {results.map((bin) => (
          <BinRow
            key={bin.binId}
            bin={bin}
            isSelected={selectedBinId === bin.binId}
            onSelect={() => selectBin(bin.binId)}
          />
        ))}
      </div>

      {results.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
          {results.length} result{results.length !== 1 ? "s" : ""}
          {results.length === 50 ? " (showing first 50)" : ""}
        </div>
      )}
    </div>
  );
}
