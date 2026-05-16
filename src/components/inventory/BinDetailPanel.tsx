/**
 * BinDetailPanel — Slide-in panel showing full inventory data for a selected bin
 */
import { X, Package, Hash, Calendar, Weight, Layers, AlertTriangle, CheckCircle2, Clock, Ban, Wrench, Archive } from "lucide-react";
import { useInvBinStore, type BinInventory } from "@/lib/inventory-bin-store";
import type { BinStatus } from "@/lib/wms-data";

const STATUS_CONFIG: Record<BinStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  Empty:    { label: "Empty",    color: "text-slate-400",     bg: "bg-slate-500/10 border-slate-500/20",    icon: Archive },
  Partial:  { label: "Partial",  color: "text-amber-400",     bg: "bg-amber-500/10 border-amber-500/20",    icon: Layers },
  Full:     { label: "Full",     color: "text-emerald-400",   bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  Reserved: { label: "Reserved", color: "text-blue-400",      bg: "bg-blue-500/10 border-blue-500/20",      icon: Clock },
  Blocked:  { label: "Blocked",  color: "text-orange-400",    bg: "bg-orange-500/10 border-orange-500/20",  icon: Ban },
  Damaged:  { label: "Damaged",  color: "text-red-400",       bg: "bg-red-500/10 border-red-500/20",        icon: Wrench },
};

function OccupancyBar({ pct, status }: { pct: number; status: BinStatus }) {
  const color =
    status === "Blocked" || status === "Damaged" ? "bg-red-500" :
    status === "Reserved" ? "bg-blue-500" :
    pct >= 90 ? "bg-red-500" :
    pct >= 70 ? "bg-amber-500" :
    pct >= 30 ? "bg-emerald-500" :
    "bg-slate-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Occupancy</span>
        <span className="font-mono font-bold">{pct}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function Field({ label, value, icon: Icon, accent }: { label: string; value: React.ReactNode; icon?: typeof Package; accent?: string }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/30">
      {Icon && <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`text-xs font-medium mt-0.5 ${accent ?? ""}`}>{value ?? "—"}</div>
      </div>
    </div>
  );
}

function ExpiryBadge({ date }: { date: string }) {
  const today = new Date();
  const exp = new Date(date);
  const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 86400));
  const color = days <= 0 ? "text-red-400 bg-red-500/10" : days <= 15 ? "text-orange-400 bg-orange-500/10" : days <= 30 ? "text-amber-400 bg-amber-500/10" : "text-emerald-400 bg-emerald-500/10";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>
      <AlertTriangle className="h-2.5 w-2.5" />
      {days <= 0 ? "EXPIRED" : `${days}d remaining`}
    </span>
  );
}

interface Props {
  bin: BinInventory;
  onClose: () => void;
}

export function BinDetailPanel({ bin, onClose }: Props) {
  const { updateBinStatus, clearBin } = useInvBinStore();
  const cfg = STATUS_CONFIG[bin.status];
  const StatusIcon = cfg.icon;

  const handleStatusChange = (status: BinStatus) => {
    updateBinStatus(bin.binId, status);
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-mono font-bold text-sm">{bin.binCode}</div>
            <div className="text-[10px] text-muted-foreground">{bin.zoneName} · {bin.rackCode}</div>
          </div>
        </div>
        <button onClick={onClose} className="h-7 w-7 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Status badge */}
      <div className={`mx-4 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-md border ${cfg.bg}`}>
        <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
        <div className="ml-auto" style={{ width: 80 }}>
          <OccupancyBar pct={bin.occupancyPct} status={bin.status} />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0">

        {/* SKU Info */}
        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">SKU Information</div>
        <Field label="SKU Code"    value={<span className="font-mono text-primary">{bin.skuCode}</span>}  icon={Hash} />
        <Field label="Item Name"   value={bin.skuName}     icon={Package} />
        <Field label="Quantity"    value={<span className="font-mono">{bin.quantity.toLocaleString()} / {bin.capacity} units</span>} icon={Layers} />
        <Field label="Pallets"     value={`${bin.palletCount} pallet${bin.palletCount !== 1 ? "s" : ""}`} icon={Archive} />
        <Field label="Weight"      value={`${bin.weight} kg`} icon={Weight} />

        {/* Tracking */}
        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">Batch & Expiry</div>
        <Field label="Batch Number" value={<span className="font-mono text-xs">{bin.batchNumber}</span>} icon={Hash} />
        <Field
          label="Expiry Date"
          value={
            bin.expiryDate ? (
              <div className="space-y-1">
                <div className="font-mono">{bin.expiryDate}</div>
                <ExpiryBadge date={bin.expiryDate} />
              </div>
            ) : "No expiry"
          }
          icon={Calendar}
        />

        {/* Location */}
        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">Location</div>
        <Field label="Zone"      value={<span style={{ color: bin.zoneColor }}>{bin.zoneName}</span>}   icon={Package} />
        <Field label="Rack"      value={<span className="font-mono">{bin.rackCode}</span>}              icon={Layers} />
        <Field label="Bin Code"  value={<span className="font-mono">{bin.binCode}</span>}               icon={Hash} />
        {bin.reservedFor && (
          <Field label="Reserved For" value={<span className="font-mono text-blue-400">{bin.reservedFor}</span>} icon={Clock} />
        )}

        {/* Movement */}
        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">Activity</div>
        <Field
          label="Last Movement"
          value={bin.lastMovement ? new Date(bin.lastMovement).toLocaleString() : "—"}
          icon={Clock}
        />

        {/* Quick Actions */}
        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">Quick Actions</div>
        <div className="grid grid-cols-3 gap-1.5 pb-4">
          {(["Blocked", "Reserved", "Damaged"] as BinStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={bin.status === s}
              className={`px-2 py-1.5 rounded text-[10px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color}`}
            >
              {s}
            </button>
          ))}
        </div>
        {bin.status !== "Empty" && (
          <button
            onClick={() => clearBin(bin.binId)}
            className="w-full py-2 rounded border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors mb-4"
          >
            Clear Bin
          </button>
        )}
      </div>
    </div>
  );
}
