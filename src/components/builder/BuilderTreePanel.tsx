import { ChevronRight, ChevronDown, Box, Layers, Building2, Filter } from "lucide-react";
import { useState } from "react";
import { warehouse } from "@/lib/wms-data";
import { useWMSStore } from "@/lib/wms-store";
import { cn } from "@/lib/utils";

export function BuilderTreePanel() {
  const { selectedId, select, zoneFilter, setZoneFilter } = useWMSStore();
  const [open, setOpen] = useState<Record<string, boolean>>({ root: true });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="w-[280px] panel border-r flex flex-col">
      <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider">
          <Layers className="h-3.5 w-3.5 text-primary" /> WAREHOUSE TREE
        </div>
        <button
          onClick={() => setZoneFilter(null)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          {zoneFilter ? "Clear filter" : ""}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 text-sm">
        <Row
          icon={<Building2 className="h-3.5 w-3.5 text-primary" />}
          label={warehouse.name}
          sub={`${warehouse.zones.length} zones`}
          chev={open.root}
          onChev={() => toggle("root")}
          active={false}
          depth={0}
        />
        {open.root && warehouse.zones.map((z) => (
          <div key={z.id}>
            <Row
              icon={<span className="h-2.5 w-2.5 rounded-sm" style={{ background: z.color }} />}
              label={z.name}
              sub={`${(z.utilization * 100).toFixed(0)}%`}
              chev={open[z.id]}
              onChev={() => toggle(z.id)}
              active={selectedId === z.id || zoneFilter === z.id}
              depth={1}
              onClick={() => { select(z.id, "zone"); setZoneFilter(z.id); }}
            />
            {open[z.id] && z.aisles.map((a) => (
              <div key={a.id}>
                <Row
                  icon={<Box className="h-3 w-3 text-muted-foreground" />}
                  label={a.code}
                  sub={`${a.racks.length} racks`}
                  chev={open[a.id]}
                  onChev={() => toggle(a.id)}
                  active={false}
                  depth={2}
                />
                {open[a.id] && a.racks.map((r) => (
                  <Row
                    key={r.id}
                    icon={<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                    label={r.code}
                    sub={`${r.bins.length} bins`}
                    active={selectedId === r.id}
                    depth={3}
                    onClick={() => select(r.id, "rack")}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t border-border/60 p-3 space-y-2">
        <div className="text-[10px] font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Filter className="h-3 w-3" /> LAYER FILTERS
        </div>
        {(["Racks", "Docks", "Forklifts", "Labels"] as const).map((l) => (
          <label key={l} className="flex items-center justify-between text-xs">
            <span>{l}</span>
            <input type="checkbox" defaultChecked className="accent-primary" />
          </label>
        ))}
      </div>
    </div>
  );
}

function Row({
  icon, label, sub, chev, onChev, active, depth, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  chev?: boolean;
  onChev?: () => void;
  active?: boolean;
  depth: number;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-secondary/60 cursor-pointer text-xs",
        active && "bg-primary/15 text-primary",
      )}
      style={{ paddingLeft: depth * 12 + 6 }}
      onClick={onClick}
    >
      {chev !== undefined ? (
        <button
          onClick={(e) => { e.stopPropagation(); onChev?.(); }}
          className="h-4 w-4 flex items-center justify-center text-muted-foreground"
        >
          {chev ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      ) : <span className="w-4" />}
      {icon}
      <span className="truncate flex-1">{label}</span>
      {sub && <span className="text-[10px] text-mono text-muted-foreground">{sub}</span>}
    </div>
  );
}
