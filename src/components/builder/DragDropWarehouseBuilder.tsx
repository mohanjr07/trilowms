/**
 * DragDropWarehouseBuilder — Option B
 * ─────────────────────────────────────────────────────────────────────────────
 * Rules enforced:
 *   • Zones are created EMPTY (no auto-generated racks/bins)
 *   • Racks can ONLY be dropped inside an existing Zone
 *   • Bins can ONLY be dropped inside an existing Rack
 *   • When a Bin is dropped on a Rack, a popup asks how many bins to generate
 *   • Docks can be placed anywhere on the floor
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
  X, Layers, Anchor, Box, LayoutGrid, Trash2, Check, GripVertical,
  ZoomIn, ZoomOut, RotateCcw, Info, AlertCircle,
} from "lucide-react";
import { ZONE_COLORS, type ZoneType } from "@/lib/wms-data";
import { useEditorStore } from "@/lib/wms-editor-store";
import { cn } from "@/lib/utils";

type ElementKind = "zone" | "dock" | "rack" | "bin";

export interface PlacedElement {
  id: string;
  kind: ElementKind;
  x: number;
  z: number;
  w: number;
  d: number;
  label: string;
  zoneType?: ZoneType;
  dockKind?: "Inbound" | "Outbound";
  parentZoneId?: string;
  parentRackId?: string;
  binCount?: number;
}

const PALETTE: { kind: ElementKind; label: string; sub?: string; defaultW: number; defaultD: number; color: string }[] = [
  { kind: "zone", label: "Inbound Staging",  sub: "Raw Material",   defaultW: 14, defaultD: 10, color: ZONE_COLORS["Raw Material"] },
  { kind: "zone", label: "Fast Pick Zone",   sub: "Fast Moving",    defaultW: 14, defaultD: 14, color: ZONE_COLORS["Fast Moving"] },
  { kind: "zone", label: "Bulk Storage",     sub: "Finished Goods", defaultW: 14, defaultD: 16, color: ZONE_COLORS["Finished Goods"] },
  { kind: "zone", label: "Cold Chain",       sub: "Cold Storage",   defaultW: 8,  defaultD: 10, color: ZONE_COLORS["Cold Storage"] },
  { kind: "zone", label: "Hazmat",           sub: "Hazardous",      defaultW: 8,  defaultD: 6,  color: ZONE_COLORS["Hazardous"] },
  { kind: "zone", label: "Returns / QC",     sub: "Returns",        defaultW: 14, defaultD: 8,  color: ZONE_COLORS["Returns"] },
  { kind: "zone", label: "Slow Movers",      sub: "Slow Moving",    defaultW: 12, defaultD: 10, color: ZONE_COLORS["Slow Moving"] },
  { kind: "zone", label: "Outbound Staging", sub: "Finished Goods", defaultW: 14, defaultD: 10, color: ZONE_COLORS["Finished Goods"] },
  { kind: "dock", label: "Inbound Dock",     sub: "Inbound",        defaultW: 4,  defaultD: 2,  color: "#0891b2" },
  { kind: "dock", label: "Outbound Dock",    sub: "Outbound",       defaultW: 4,  defaultD: 2,  color: "#f97316" },
  { kind: "rack", label: "Storage Rack",     sub: "Rack",           defaultW: 2,  defaultD: 1,  color: "#6366f1" },
  { kind: "rack", label: "Heavy Duty Rack",  sub: "Rack",           defaultW: 3,  defaultD: 1,  color: "#818cf8" },
  { kind: "rack", label: "Flow Rack",        sub: "Rack",           defaultW: 2,  defaultD: 2,  color: "#4f46e5" },
  { kind: "bin",  label: "Pick Bin",         sub: "Bin",            defaultW: 1,  defaultD: 1,  color: "#16a34a" },
  { kind: "bin",  label: "Reserve Bin",      sub: "Bin",            defaultW: 1,  defaultD: 1,  color: "#0ea5e9" },
];

function kindIcon(kind: ElementKind) {
  if (kind === "zone") return <LayoutGrid className="h-3 w-3" />;
  if (kind === "dock") return <Anchor className="h-3 w-3" />;
  if (kind === "rack") return <Layers className="h-3 w-3" />;
  return <Box className="h-3 w-3" />;
}

function elementColor(el: PlacedElement) {
  if (el.kind === "zone" && el.zoneType) return ZONE_COLORS[el.zoneType];
  if (el.kind === "dock") return el.dockKind === "Inbound" ? "#0891b2" : "#f97316";
  if (el.kind === "rack") return "#6366f1";
  return "#16a34a";
}

function findZoneAt(placed: PlacedElement[], gx: number, gz: number): PlacedElement | null {
  return placed.find(
    (el) => el.kind === "zone" && gx >= el.x && gx < el.x + el.w && gz >= el.z && gz < el.z + el.d,
  ) ?? null;
}

function findRackAt(placed: PlacedElement[], gx: number, gz: number): PlacedElement | null {
  return placed.find(
    (el) => el.kind === "rack" && gx >= el.x && gx < el.x + el.w && gz >= el.z && gz < el.z + el.d,
  ) ?? null;
}

function BinCountModal({ rackLabel, onConfirm, onCancel }: { rackLabel: string; onConfirm: (n: number) => void; onCancel: () => void }) {
  const [count, setCount] = useState(4);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      <div className="bg-[#131b27] border border-border rounded-xl shadow-2xl w-[320px] p-5 space-y-4">
        <div className="text-sm font-bold">Add Bins to Rack</div>
        <div className="text-xs text-muted-foreground">
          How many bins to generate for <span className="text-foreground font-medium">{rackLabel}</span>?
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-bold tracking-wider">NUMBER OF BINS</label>
          <input
            type="number" min={1} max={64}
            className="w-full bg-background/60 border border-border/60 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(64, +e.target.value)))}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onConfirm(count); if (e.key === "Escape") onCancel(); }}
          />
          <div className="text-[10px] text-muted-foreground">{count} Empty bins will be created.</div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => onConfirm(count)} className="flex-1 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">Generate Bins</button>
        </div>
      </div>
    </div>
  );
}

function DropError({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 bg-destructive/90 text-white text-xs px-4 py-2.5 rounded-lg shadow-2xl">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{message}
    </div>
  );
}

interface DragDropWarehouseBuilderProps {
  warehouseName: string;
  warehouseW: number;
  warehouseD: number;
  onClose: () => void;
  initialPlaced?: PlacedElement[];
  isEdit?: boolean;
}

export function DragDropWarehouseBuilder({ warehouseName, warehouseW, warehouseD, onClose, initialPlaced, isEdit }: DragDropWarehouseBuilderProps) {
  const { addRackToZone, addBinsToRack, commitEmptyLayout, deleteZone, deleteDock, _saveToCloud } = useEditorStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [placed, setPlaced] = useState<PlacedElement[]>(initialPlaced ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pendingBinDrop, setPendingBinDrop] = useState<{ rackEl: PlacedElement } | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const dragging = useRef<{ id: string; startMouse: { x: number; y: number }; startPos: { x: number; z: number } } | null>(null);
  const resizing = useRef<{ id: string; startMouse: { x: number; y: number }; startSize: { w: number; d: number } } | null>(null);
  const panning = useRef<{ startMouse: { x: number; y: number }; startPan: { x: number; y: number } } | null>(null);

  const CELL = 10 * zoom;

  useEffect(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPan({ x: (rect.width - warehouseW * CELL) / 2, y: (rect.height - warehouseD * CELL) / 2 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mouseToGrid = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { gx: Math.round((clientX - rect.left - pan.x) / CELL), gz: Math.round((clientY - rect.top - pan.y) / CELL) };
  }, [pan, CELL]);

  const [ghostEl, setGhostEl] = useState<{ x: number; y: number; w: number; d: number; color: string; label: string } | null>(null);
  const dragPaletteItem = useRef<(typeof PALETTE)[0] | null>(null);

  const onPaletteMouseDown = (item: (typeof PALETTE)[0]) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragPaletteItem.current = item;
    setGhostEl({ x: e.clientX, y: e.clientY, w: item.defaultW, d: item.defaultD, color: item.color, label: item.label });
  };

  const removeEl = useCallback((id: string, p: PlacedElement[]) => {
    const el = p.find((x) => x.id === id);
    if (!el) return p;
    if (el.kind === "zone") {
      const rackIds = p.filter((x) => x.kind === "rack" && x.parentZoneId === id).map((x) => x.id);
      return p.filter((x) => x.id !== id && !rackIds.includes(x.id) && !(x.kind === "bin" && x.parentRackId && rackIds.includes(x.parentRackId)));
    }
    if (el.kind === "rack") {
      return p.filter((x) => x.id !== id && !(x.kind === "bin" && x.parentRackId === id));
    }
    return p.filter((x) => x.id !== id);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragPaletteItem.current && ghostEl) setGhostEl((g) => g && { ...g, x: e.clientX, y: e.clientY });
      if (dragging.current) {
        const dx = Math.round((e.clientX - dragging.current.startMouse.x) / CELL);
        const dy = Math.round((e.clientY - dragging.current.startMouse.y) / CELL);
        setPlaced((prev) => prev.map((el) => el.id === dragging.current!.id ? { ...el, x: dragging.current!.startPos.x + dx, z: dragging.current!.startPos.z + dy } : el));
      }
      if (resizing.current) {
        const dw = Math.round((e.clientX - resizing.current.startMouse.x) / CELL);
        const dd = Math.round((e.clientY - resizing.current.startMouse.y) / CELL);
        setPlaced((prev) => prev.map((el) => el.id === resizing.current!.id ? { ...el, w: Math.max(4, resizing.current!.startSize.w + dw), d: Math.max(3, resizing.current!.startSize.d + dd) } : el));
      }
      if (panning.current) {
        setPan({ x: panning.current.startPan.x + e.clientX - panning.current.startMouse.x, y: panning.current.startPan.y + e.clientY - panning.current.startMouse.y });
      }
    };

    const onUp = (e: MouseEvent) => {
      if (dragPaletteItem.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const onCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (onCanvas) {
          const { gx, gz } = mouseToGrid(e.clientX, e.clientY);
          const item = dragPaletteItem.current;

          if (item.kind === "zone" || item.kind === "dock") {
            const newEl: PlacedElement = {
              id: `${item.kind}-${Date.now()}`,
              kind: item.kind,
              x: gx - Math.floor(item.defaultW / 2),
              z: gz - Math.floor(item.defaultD / 2),
              w: item.defaultW, d: item.defaultD,
              label: item.label,
              zoneType: item.kind === "zone" ? (item.sub as ZoneType) : undefined,
              dockKind: item.kind === "dock" ? (item.sub as "Inbound" | "Outbound") : undefined,
            };
            setPlaced((p) => [...p, newEl]);
            setSelected(newEl.id);

          } else if (item.kind === "rack") {
            const zoneEl = findZoneAt(placed, gx, gz);
            if (!zoneEl) {
              setDropError("Racks can only be placed inside a Zone.");
            } else {
              const newEl: PlacedElement = {
                id: `rack-${Date.now()}`,
                kind: "rack",
                x: gx - Math.floor(item.defaultW / 2),
                z: gz - Math.floor(item.defaultD / 2),
                w: item.defaultW, d: item.defaultD,
                label: item.label,
                parentZoneId: zoneEl.id,
              };
              setPlaced((p) => [...p, newEl]);
              setSelected(newEl.id);
            }

          } else if (item.kind === "bin") {
            const rackEl = findRackAt(placed, gx, gz);
            if (!rackEl) {
              setDropError(findZoneAt(placed, gx, gz) ? "Bins can only be placed inside a Rack." : "Bins must be dropped onto a Rack inside a Zone.");
            } else {
              setPendingBinDrop({ rackEl });
            }
          }
        }
        dragPaletteItem.current = null;
        setGhostEl(null);
      }
      dragging.current = null;
      resizing.current = null;
      panning.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [mouseToGrid, ghostEl, CELL, placed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        setPlaced((p) => removeEl(selected, p));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, removeEl]);

  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); setZoom((z) => Math.min(3, Math.max(0.4, z - e.deltaY * 0.001))); };

  const handleBinConfirm = (count: number) => {
    if (!pendingBinDrop) return;
    const { rackEl } = pendingBinDrop;
    const binEl: PlacedElement = {
      id: `bin-${Date.now()}`,
      kind: "bin",
      x: rackEl.x, z: rackEl.z, w: rackEl.w, d: rackEl.d,
      label: `${count} bins`,
      parentRackId: rackEl.id,
      parentZoneId: rackEl.parentZoneId,
      binCount: count,
    };
    setPlaced((p) => [...p, binEl]);
    setSelected(binEl.id);
    setPendingBinDrop(null);
  };

  const handleSave = async () => {
    const halfW = warehouseW / 2;
    const halfD = warehouseD / 2;
    const zones = placed.filter((e) => e.kind === "zone");
    const docks = placed.filter((e) => e.kind === "dock");
    const racks = placed.filter((e) => e.kind === "rack");
    const bins = placed.filter((e) => e.kind === "bin");

    // Build zone + dock definitions
    const zoneDefs = zones
      .filter((el) => el.zoneType)
      .map((el) => ({
        name: el.label,
        type: el.zoneType!,
        bounds: { x: el.x - halfW, z: el.z - halfD, w: el.w, d: el.d },
      }));

    const dockDefs = docks
      .filter((el) => el.dockKind)
      .map((el) => ({
        code: el.label.replace(" Dock", "").toUpperCase().slice(0, 6) + `-${Date.now() % 100}`,
        kind: el.dockKind!,
        position: [(el.x - halfW) + el.w / 2, (el.z - halfD) + el.d / 2] as [number, number],
      }));

    // Single atomic write — switches warehouse AND saves zones+docks in one set() call
    commitEmptyLayout(warehouseName, zoneDefs, dockDefs);

    // Racks and bins are added after (they depend on zone IDs existing first)
    for (const el of racks) {
      if (el.parentZoneId) {
        const zoneEl = zones.find((z) => z.id === el.parentZoneId);
        const storeZoneId = zoneEl ? zoneEl.label.toLowerCase().replace(/\s+/g, "-") : el.parentZoneId;
        addRackToZone(storeZoneId, [(el.x - halfW) + el.w / 2, (el.z - halfD) + el.d / 2]);
      }
    }
    for (const el of bins) {
      if (el.parentRackId && el.parentZoneId && el.binCount) {
        const zoneEl = zones.find((z) => z.id === el.parentZoneId);
        const rackEl = racks.find((r) => r.id === el.parentRackId);
        if (zoneEl && rackEl) {
          const storeZoneId = zoneEl.label.toLowerCase().replace(/\s+/g, "-");
          const rackIdx = racks.filter((r) => r.parentZoneId === el.parentZoneId).findIndex((r) => r.id === el.parentRackId) + 1;
          const storeRackId = `${storeZoneId.slice(0, 4).toUpperCase()}-R${rackIdx}`;
          addBinsToRack(storeZoneId, storeRackId, el.binCount);
        }
      }
    }

    setSaved(true);
    await _saveToCloud();
    setTimeout(() => onClose(), 600);
  };

  const sel = placed.find((e) => e.id === selected);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/80">
      {pendingBinDrop && <BinCountModal rackLabel={pendingBinDrop.rackEl.label} onConfirm={handleBinConfirm} onCancel={() => setPendingBinDrop(null)} />}
      {dropError && <DropError message={dropError} onDone={() => setDropError(null)} />}

      {/* LEFT: Palette */}
      <div className="w-[220px] flex-shrink-0 flex flex-col border-r border-border bg-[#0f1520]">
        <div className="px-3 py-3 border-b border-border/60">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-0.5">BUILDING</div>
          <div className="text-sm font-bold text-foreground truncate">{warehouseName}</div>
          <div className="text-[10px] text-muted-foreground">{warehouseW}×{warehouseD} grid units</div>
        </div>
        <div className="px-3 py-2 border-b border-border/40 flex-1 overflow-y-auto">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2">DRAG TO PLACE</div>
          {(["zone","dock","rack","bin"] as ElementKind[]).map((sectionKind) => {
            const items = PALETTE.filter((p) => p.kind === sectionKind);
            const labels: Record<ElementKind, string> = { zone:"ZONES", dock:"DOCKS", rack:"RACKS", bin:"BINS" };
            const hints: Partial<Record<ElementKind, string>> = { rack:"drop inside a Zone", bin:"drop inside a Rack" };
            return (
              <div key={sectionKind} className="mb-3">
                <div className="text-[9px] font-bold tracking-wider text-muted-foreground/60 mb-0.5 mt-1">{labels[sectionKind]}</div>
                {hints[sectionKind] && <div className="text-[9px] text-primary/60 mb-1">⚠ {hints[sectionKind]}</div>}
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <div key={i}
                      className="flex items-center gap-2 px-2.5 py-2 rounded border border-border/40 cursor-grab active:cursor-grabbing hover:border-primary/50 hover:bg-primary/5 select-none text-xs"
                      style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
                      onMouseDown={onPaletteMouseDown(item)}
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.label}</div>
                        {item.sub && <div className="text-[10px] text-muted-foreground truncate">{item.sub}</div>}
                      </div>
                      <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: item.color }} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 mt-auto border-t border-border/60 text-[10px] text-muted-foreground space-y-0.5 flex-shrink-0">
          <div className="flex items-start gap-1"><Info className="h-3 w-3 mt-0.5 shrink-0" /><span>Zones → anywhere · Racks → inside Zone · Bins → inside Rack</span></div>
          <div>• Delete / Backspace to remove selected</div>
          <div>• Alt+drag to pan</div>
        </div>
      </div>

      {/* CENTER: Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-11 border-b border-border/60 bg-[#0f1520] flex items-center gap-2 px-3">
          <span className="text-xs font-bold tracking-wider text-muted-foreground">{isEdit ? "EDIT WAREHOUSE LAYOUT" : "WAREHOUSE FLOOR PLAN"}</span>
          <div className="flex items-center gap-1 ml-4 border-l border-border/60 pl-4">
            <button onClick={() => setZoom((z) => Math.min(3, z+0.2))} className="h-6 w-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button onClick={() => setZoom((z) => Math.max(0.4, z-0.2))} className="h-6 w-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"><ZoomOut className="h-3.5 w-3.5" /></button>
            <span className="text-[10px] text-mono text-muted-foreground w-8 text-center">{Math.round(zoom*100)}%</span>
            <button onClick={() => { setZoom(1); if (canvasRef.current) { const r=canvasRef.current.getBoundingClientRect(); setPan({x:(r.width-warehouseW*CELL)/2,y:(r.height-warehouseD*CELL)/2}); } }} className="h-6 w-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>
          <span className="text-[10px] text-muted-foreground ml-2">
            {placed.filter(e=>e.kind==="zone").length}z · {placed.filter(e=>e.kind==="rack").length}r · {placed.filter(e=>e.kind==="bin").length}b placed
          </span>
          <div className="ml-auto flex items-center gap-2">
            {selected && (
              <button onClick={() => { setPlaced((p) => removeEl(selected, p)); setSelected(null); }}
                className="px-2.5 py-1.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 text-xs flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
            <button onClick={onClose} className="px-2.5 py-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saved}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5">
              {saved ? <><Check className="h-3.5 w-3.5" /> Saved!</> : <><Check className="h-3.5 w-3.5" /> {isEdit ? "Save Changes" : "Save Layout"}</>}
            </button>
          </div>
        </div>

        <div ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[#0b1018] select-none"
          style={{ cursor: panning.current ? "grabbing" : "default" }}
          onWheel={onWheel}
          onClick={(e) => { if ((e.target as HTMLElement) === canvasRef.current) setSelected(null); }}
          onMouseDown={(e) => { if (e.button === 1 || e.altKey) { e.preventDefault(); panning.current = { startMouse:{x:e.clientX,y:e.clientY}, startPan:{...pan} }; } }}
        >
          <div className="absolute border border-border/40"
            style={{
              left:pan.x, top:pan.y, width:warehouseW*CELL, height:warehouseD*CELL,
              background:"#111827",
              backgroundImage:`linear-gradient(rgba(55,65,81,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(55,65,81,0.3) 1px,transparent 1px),linear-gradient(rgba(55,65,81,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(55,65,81,0.15) 1px,transparent 1px)`,
              backgroundSize:`${CELL*5}px ${CELL*5}px,${CELL*5}px ${CELL*5}px,${CELL}px ${CELL}px,${CELL}px ${CELL}px`,
            }}
            onClick={() => setSelected(null)}
          >
            <span className="absolute top-0 left-0 text-[9px] text-muted-foreground/40 px-1">0,0</span>
            <span className="absolute bottom-0 right-0 text-[9px] text-muted-foreground/40 px-1">{warehouseW},{warehouseD}</span>

            {[...placed].sort((a,b) => ({zone:0,dock:1,rack:2,bin:3}[a.kind]) - ({zone:0,dock:1,rack:2,bin:3}[b.kind])).map((el) => {
              const color = elementColor(el);
              const isSelected = el.id === selected;
              return (
                <div key={el.id}
                  className={cn("absolute border-2 rounded flex items-start justify-between p-1 transition-shadow",
                    isSelected ? "ring-2 ring-white/60" : "hover:ring-1 hover:ring-white/30")}
                  style={{
                    left:el.x*CELL, top:el.z*CELL, width:el.w*CELL, height:el.d*CELL,
                    background: color+(el.kind==="zone"?"18":el.kind==="rack"?"33":"44"),
                    borderColor: color+(isSelected?"ff":"88"),
                    cursor:"grab",
                    zIndex: isSelected?20:el.kind==="zone"?1:el.kind==="rack"?5:10,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelected(el.id);
                    dragging.current = { id:el.id, startMouse:{x:e.clientX,y:e.clientY}, startPos:{x:el.x,z:el.z} };
                  }}
                >
                  <div className="text-[9px] font-bold leading-tight pointer-events-none" style={{color}}>
                    <div className="flex items-center gap-1">{kindIcon(el.kind)}<span className="truncate max-w-[80px]">{el.label}</span></div>
                    <div className="text-[8px] opacity-60">{el.kind==="bin"?`${el.binCount??0} bins`:`${el.w}×${el.d}`}</div>
                  </div>
                  {isSelected && el.kind==="zone" && (
                    <div className="absolute bottom-0 right-0 h-4 w-4 flex items-center justify-center" style={{cursor:"se-resize"}}
                      onMouseDown={(e) => { e.stopPropagation(); resizing.current={id:el.id,startMouse:{x:e.clientX,y:e.clientY},startSize:{w:el.w,d:el.d}}; }}>
                      <svg width="8" height="8" viewBox="0 0 8 8"><path d="M 8 0 L 8 8 L 0 8" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6"/></svg>
                    </div>
                  )}
                </div>
              );
            })}

            {dragPaletteItem.current && (
              <div className="absolute inset-0 border-2 border-dashed border-primary/40 rounded pointer-events-none animate-pulse" />
            )}
          </div>

          {ghostEl && (
            <div className="fixed pointer-events-none rounded border-2 z-50 flex items-center justify-center text-[9px] font-bold"
              style={{ left:ghostEl.x-(ghostEl.w*CELL)/2, top:ghostEl.y-(ghostEl.d*CELL)/2, width:ghostEl.w*CELL, height:ghostEl.d*CELL,
                background:ghostEl.color+"30", borderColor:ghostEl.color, color:ghostEl.color, opacity:0.8 }}>
              {ghostEl.label}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Properties */}
      <div className="w-[220px] flex-shrink-0 border-l border-border bg-[#0f1520] flex flex-col">
        <div className="px-3 py-3 border-b border-border/60">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground">PROPERTIES</div>
        </div>
        {sel ? (
          <div className="p-3 space-y-3 text-xs">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">LABEL</div>
              <input className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                value={sel.label}
                onChange={(e) => setPlaced((p) => p.map((el) => el.id===sel.id ? {...el, label:e.target.value} : el))} />
            </div>
            {sel.kind==="zone" && (
              <>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">ZONE TYPE</div>
                  <select className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                    value={sel.zoneType??""}
                    onChange={(e) => setPlaced((p) => p.map((el) => el.id===sel.id ? {...el, zoneType:e.target.value as ZoneType} : el))}>
                    {(Object.keys(ZONE_COLORS) as ZoneType[]).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["x","z","w","d"] as const).map((k) => (
                    <div key={k}>
                      <div className="text-[10px] text-muted-foreground mb-1">{k.toUpperCase()}</div>
                      <input type="number" className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                        value={sel[k]}
                        onChange={(e) => setPlaced((p) => p.map((el) => el.id===sel.id ? {...el,[k]:+e.target.value} : el))} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {sel.kind==="dock" && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">DOCK KIND</div>
                <select className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                  value={sel.dockKind??"Inbound"}
                  onChange={(e) => setPlaced((p) => p.map((el) => el.id===sel.id ? {...el, dockKind:e.target.value as "Inbound"|"Outbound"} : el))}>
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                </select>
              </div>
            )}
            {sel.kind==="rack" && (
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 space-y-1">
                <div>Inside zone: <span className="text-foreground">{placed.find((z)=>z.id===sel.parentZoneId)?.label??"—"}</span></div>
                <div className="text-[9px] text-primary/60">Drop a Bin on this rack to add bins.</div>
              </div>
            )}
            {sel.kind==="bin" && (
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 space-y-1">
                <div>Bins: <span className="text-foreground font-bold">{sel.binCount}</span></div>
                <div>On rack: <span className="text-foreground">{placed.find((r)=>r.id===sel.parentRackId)?.label??"—"}</span></div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <div className="text-xs text-muted-foreground">Select an element to inspect</div>
          </div>
        )}
        <div className="border-t border-border/60 p-3 space-y-1.5">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2">LAYOUT SUMMARY</div>
          {[
            { color: ZONE_COLORS["Fast Moving"], label:`Zones: ${placed.filter(e=>e.kind==="zone").length}` },
            { color: "#0891b2",                   label:`Docks: ${placed.filter(e=>e.kind==="dock").length}` },
            { color: "#6366f1",                   label:`Racks: ${placed.filter(e=>e.kind==="rack").length}` },
            { color: "#16a34a",                   label:`Bin sets: ${placed.filter(e=>e.kind==="bin").length}` },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-[10px]">
              <span className="h-2 w-2 rounded-sm flex-shrink-0" style={{background:l.color}} />
              <span className="text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
