import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Copy, Trash2, Warehouse, Check } from "lucide-react";
import { useEditorStore } from "@/lib/wms-editor-store";
import { useWMSStore } from "@/lib/wms-store";
import { NewWarehouseModal } from "./WarehouseEditorModals";
import { cn } from "@/lib/utils";

export function WarehouseSwitcher() {
  const { warehouses, activeId, switchWarehouse, deleteWarehouse, duplicateWarehouse } = useEditorStore();
  const { onWarehouseSwitch } = useWMSStore();
  const active = warehouses.find((w) => w.name === activeId) ?? warehouses[0];
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <div ref={ref} className="relative">
        {/* Trigger */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sm transition-colors"
        >
          <Warehouse className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 text-left truncate font-medium text-sm">{active.name}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 panel border border-border rounded-lg shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border/60">
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground">WAREHOUSES</div>
            </div>

            <div className="max-h-[240px] overflow-y-auto">
              {warehouses.map((w) => {
                const isActive = w.name === activeId;
                return (
                  <div
                    key={w.name}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 hover:bg-secondary/60 cursor-pointer text-xs",
                      isActive && "bg-primary/10",
                    )}
                    onClick={() => { switchWarehouse(w.name); onWarehouseSwitch(w.name); setOpen(false); }}
                  >
                    {isActive
                      ? <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      : <span className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span className={cn("flex-1 truncate", isActive && "text-primary font-medium")}>{w.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{w.zones.length}z · {w.docks.length}d</span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1">
                      <button
                        title="Duplicate"
                        onClick={(e) => { e.stopPropagation(); duplicateWarehouse(w.name); onWarehouseSwitch(w.name + " (Copy)"); setOpen(false); }}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {warehouses.length > 1 && (
                        <button
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${w.name}"? This cannot be undone.`)) {
                              deleteWarehouse(w.name);
                              setOpen(false);
                            }
                          }}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border/60 p-2">
              <button
                onClick={() => { setShowNew(true); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> New Warehouse
              </button>
            </div>
          </div>
        )}
      </div>

      {showNew && <NewWarehouseModal onClose={() => setShowNew(false)} />}
    </>
  );
}
