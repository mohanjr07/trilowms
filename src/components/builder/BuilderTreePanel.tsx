import { ChevronRight, ChevronDown, Box, Layers, Building2, Filter, Plus, Trash2, Pencil, Truck, Warehouse } from "lucide-react";
import { useState, useEffect } from "react";
import { useEditorStore } from "@/lib/wms-editor-store";
import { useWMSStore } from "@/lib/wms-store";
import { cn } from "@/lib/utils";
import { ZoneModal, DockModal, RenameWarehouseModal } from "./WarehouseEditorModals";
import type { ZoneType } from "@/lib/wms-data";

export function BuilderTreePanel() {
  const { warehouse, warehouses, activeId, switchWarehouse, deleteZone, deleteDock } = useEditorStore();
  const { selectedId, select, zoneFilter, setZoneFilter, onWarehouseSwitch } = useWMSStore();
  const [open, setOpen] = useState<Record<string, boolean>>({ root: true });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // Reset tree expansion + selection whenever the active warehouse changes
  useEffect(() => {
    setOpen({ root: true });
    select(null, null);
    setZoneFilter(null);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddDock, setShowAddDock] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [editZone, setEditZone] = useState<{ id: string; data: { name: string; type: ZoneType; x: number; z: number; w: number; d: number } } | null>(null);

  const handleDeleteZone = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this zone?")) {
      deleteZone(id);
      if (selectedId === id) select(null, null);
      if (zoneFilter === id) setZoneFilter(null);
    }
  };

  const handleDeleteDock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this dock?")) {
      deleteDock(id);
      if (selectedId === id) select(null, null);
    }
  };

  const handleEditZone = (z: typeof warehouse.zones[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setEditZone({
      id: z.id,
      data: { name: z.name, type: z.type, x: z.bounds.x, z: z.bounds.z, w: z.bounds.w, d: z.bounds.d },
    });
  };

  return (
    <>
      <div className="w-[280px] panel border-r flex flex-col">
        <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider">
            <Layers className="h-3.5 w-3.5 text-primary" /> WAREHOUSE TREE
          </div>
          <button onClick={() => setZoneFilter(null)} className="text-[10px] text-muted-foreground hover:text-foreground">
            {zoneFilter ? "Clear filter" : ""}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 text-sm">
          {/* Warehouse list — all warehouses, click to switch */}
          <div className="mb-2 pb-2 border-b border-border/40">
            <div className="text-[9px] font-bold tracking-wider text-muted-foreground/60 px-1.5 mb-1">WAREHOUSES</div>
            {warehouses.map((w) => (
              <div
                key={w.name}
                className={cn(
                  "flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-secondary/60 cursor-pointer text-xs",
                  w.name === activeId && "bg-primary/15 text-primary",
                )}
                onClick={() => { switchWarehouse(w.name); onWarehouseSwitch(w.name); }}
              >
                <Warehouse className="h-3 w-3 flex-shrink-0" />
                <span className="truncate flex-1">{w.name}</span>
                <span className="text-[10px] text-mono text-muted-foreground">{w.zones.length}z</span>
              </div>
            ))}
          </div>
          {/* Root */}
          <div className="flex items-center group">
            <div
              className="flex-1 flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-secondary/60 cursor-pointer text-xs"
              onClick={() => { select(null, null); setZoneFilter(null); }}
            >
              <button onClick={(e) => { e.stopPropagation(); toggle("root"); }} className="h-4 w-4 flex items-center justify-center text-muted-foreground">
                {open.root ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span className="truncate flex-1 font-medium">{warehouse.name}</span>
              <span className="text-[10px] text-mono text-muted-foreground">{warehouse.zones.length} zones</span>
            </div>
            <button title="Rename warehouse" onClick={() => setShowRename(true)}
              className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground ml-0.5">
              <Pencil className="h-3 w-3" />
            </button>
          </div>

          {open.root && (
            <>
              {warehouse.zones.map((z) => (
                <div key={z.id}>
                  <div className="flex items-center group">
                    <div
                      className={cn(
                        "flex-1 flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-secondary/60 cursor-pointer text-xs",
                        (selectedId === z.id || zoneFilter === z.id) && "bg-primary/15 text-primary",
                      )}
                      style={{ paddingLeft: 18 }}
                      onClick={() => { select(z.id, "zone"); setZoneFilter(z.id); }}
                    >
                      <button onClick={(e) => { e.stopPropagation(); toggle(z.id); }} className="h-4 w-4 flex items-center justify-center text-muted-foreground">
                        {open[z.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: z.color }} />
                      <span className="truncate flex-1">{z.name}</span>
                      <span className="text-[10px] text-mono text-muted-foreground">{(z.utilization * 100).toFixed(0)}%</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-0.5">
                      <button title="Edit zone" onClick={(e) => handleEditZone(z, e)}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button title="Delete zone" onClick={(e) => handleDeleteZone(z.id, e)}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {open[z.id] && z.aisles.map((a) => (
                    <div key={a.id}>
                      <div className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs" style={{ paddingLeft: 30 }}>
                        <button onClick={(e) => { e.stopPropagation(); toggle(a.id); }} className="h-4 w-4 flex items-center justify-center text-muted-foreground">
                          {open[a.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                        <Box className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate flex-1">{a.code}</span>
                        <span className="text-[10px] text-mono text-muted-foreground">{a.racks.length} racks</span>
                      </div>
                      {open[a.id] && a.racks.map((r) => (
                        <div key={r.id}
                          className={cn("flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-secondary/60 cursor-pointer text-xs", selectedId === r.id && "bg-primary/15 text-primary")}
                          style={{ paddingLeft: 44 }}
                          onClick={() => select(r.id, "rack")}
                        >
                          <span className="w-4" />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                          <span className="truncate flex-1">{r.code}</span>
                          <span className="text-[10px] text-mono text-muted-foreground">{r.bins.length} bins</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              <button onClick={() => setShowAddZone(true)}
                className="w-full mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-colors"
                style={{ paddingLeft: 18 }}>
                <Plus className="h-3 w-3" /> Add Zone
              </button>

              {/* Docks */}
              <div className="mt-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs" style={{ paddingLeft: 18 }}>
                  <button onClick={() => toggle("docks")} className="h-4 w-4 flex items-center justify-center text-muted-foreground">
                    {open.docks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Docks</span>
                  <span className="text-[10px] text-mono text-muted-foreground ml-auto">{warehouse.docks.length}</span>
                </div>
                {open.docks && (
                  <>
                    {warehouse.docks.map((d) => (
                      <div key={d.id} className="flex items-center group">
                        <div
                          className={cn("flex-1 flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-secondary/60 cursor-pointer text-xs", selectedId === d.id && "bg-primary/15 text-primary")}
                          style={{ paddingLeft: 30 }}
                          onClick={() => select(d.id, "dock")}
                        >
                          <span className="w-4" />
                          <span className="h-2 w-2 rounded-sm flex-shrink-0" style={{ background: d.kind === "Inbound" ? "#0891b2" : "#f97316" }} />
                          <span className="truncate flex-1">{d.code}</span>
                          <span className="text-[10px] text-mono text-muted-foreground">{d.kind}</span>
                        </div>
                        <button title="Delete dock" onClick={(e) => handleDeleteDock(d.id, e)}
                          className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-destructive ml-0.5">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setShowAddDock(true)}
                      className="w-full mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-colors"
                      style={{ paddingLeft: 30 }}>
                      <Plus className="h-3 w-3" /> Add Dock
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border/60 p-3 space-y-2">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3 w-3" /> LAYER FILTERS
          </div>
          {(["Racks", "Docks", "Forklifts", "Labels"] as const).map((l) => (
            <label key={l} className="flex items-center justify-between text-xs cursor-pointer">
              <span>{l}</span>
              <input type="checkbox" defaultChecked className="accent-primary" />
            </label>
          ))}
        </div>
      </div>

      {showAddZone && <ZoneModal onClose={() => setShowAddZone(false)} />}
      {showAddDock && <DockModal onClose={() => setShowAddDock(false)} />}
      {showRename && <RenameWarehouseModal onClose={() => setShowRename(false)} currentName={warehouse.name} />}
      {editZone && (
        <ZoneModal onClose={() => setEditZone(null)} editZoneId={editZone.id} initialData={editZone.data} />
      )}
    </>
  );
}
