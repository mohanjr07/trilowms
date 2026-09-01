import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Warehouse3D } from "@/components/builder/Warehouse3D";
import { BuilderTreePanel } from "@/components/builder/BuilderTreePanel";
import { PropertiesPanel } from "@/components/builder/PropertiesPanel";
import { BuilderToolbar } from "@/components/builder/BuilderToolbar";
import { useEditorStore } from "@/lib/wms-editor-store";
import { useWMSStore } from "@/lib/wms-store";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Warehouse Builder — TriloWMS" },
      { name: "description", content: "Interactive 3D warehouse digital twin: zones, racks, bins, docks, forklifts, heatmaps." },
    ],
  }),
  component: Builder,
});

function Builder() {
  const viewMode = useWMSStore((s) => s.viewMode);
  const warehouseName = useEditorStore((s) => (s.warehouses.find((w) => w.name === s.activeId) ?? s.warehouses[0]).name);
  const onWarehouseSwitch = useWMSStore((s) => s.onWarehouseSwitch);
  const activeId = useEditorStore((s) => s.activeId);

  // Keep wms-store in sync when editor store changes active warehouse
  // (covers programmatic switches e.g. from DragDropBuilder)
  const prevActiveId = useRef(activeId);
  useEffect(() => {
    if (activeId !== prevActiveId.current) {
      prevActiveId.current = activeId;
      onWarehouseSwitch(activeId);
    }
  }, [activeId, onWarehouseSwitch]);
  const [showProperties, setShowProperties] = useState(true);
  return (
    <div className="flex h-full">
      <BuilderTreePanel />
      <div className="flex-1 flex flex-col min-w-0">
        <BuilderToolbar />
        <div className="flex-1 relative grid-bg">
          <Warehouse3D />
          {/* Overlay HUD */}
          <div className="absolute top-3 left-3 panel rounded px-3 py-2 text-xs flex items-center gap-3 pointer-events-none">
            <span className="h-2 w-2 rounded-full bg-success pulse-dot text-success" />
            <span className="text-mono font-bold">{warehouseName}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground uppercase tracking-wider">Mode: {viewMode}</span>
          </div>
          <div className="absolute bottom-3 left-3 panel rounded px-3 py-2 text-[10px] text-mono text-muted-foreground space-y-0.5">
            <div>LMB · Rotate</div>
            <div>RMB · Pan</div>
            <div>Wheel · Zoom</div>
            <div>Click · Inspect</div>
          </div>
          <Legend />
          {/* Toggle for the Properties panel — sits on the seam between the
              3D view and the panel, flips side depending on whether the
              panel is open so it's always reachable */}
          <button
            type="button"
            onClick={() => setShowProperties((v) => !v)}
            title={showProperties ? "Hide properties panel" : "Show properties panel"}
            className="absolute top-3 right-3 panel rounded p-1.5 hover:bg-accent/20 transition-colors z-10"
          >
            {showProperties ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {showProperties && <PropertiesPanel />}
    </div>
  );
}

function Legend() {
  const items = [
    { c: "#16a34a", l: "Full" },
    { c: "#eab308", l: "Partial" },
    { c: "#0ea5e9", l: "Reserved" },
    { c: "#dc2626", l: "Blocked" },
    { c: "#3a4452", l: "Empty" },
  ];
  return (
    <div className="absolute bottom-3 right-3 panel rounded px-3 py-2 space-y-1">
      <div className="text-[10px] font-bold tracking-wider text-muted-foreground">BIN STATUS</div>
      <div className="flex flex-col gap-1">
        {items.map((i) => (
          <div key={i.l} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.c }} />
            <span>{i.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
