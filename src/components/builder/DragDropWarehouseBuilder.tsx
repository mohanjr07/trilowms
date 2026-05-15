/**
 * DragDropWarehouseBuilder
 * ─────────────────────────────────────────────────────────────────────────────
 * A 2D top-down canvas that lets users:
 *   • Drag element chips from the palette onto the floor grid
 *   • Move already-placed elements by dragging them
 *   • Resize zones by dragging their bottom-right handle
 *   • Delete elements with Delete/Backspace or a toolbar button
 *   • Confirm the layout → writes to editorStore → 3D updates instantly
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
  X, Layers, Anchor, Box, LayoutGrid, Trash2, Check, GripVertical,
  ZoomIn, ZoomOut, RotateCcw, Info,
} from "lucide-react";
import { ZONE_COLORS, type ZoneType } from "@/lib/wms-data";
import { useEditorStore } from "@/lib/wms-editor-store";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ElementKind = "zone" | "dock" | "rack";

interface PlacedElement {
  id: string;
  kind: ElementKind;
  x: number; // grid units (same as wms-data)
  z: number;
  w: number;
  d: number;
  label: string;
  zoneType?: ZoneType;
  dockKind?: "Inbound" | "Outbound";
  aisleCount?: number;
  racksPerAisle?: number;
}

// Palette chips definition
const PALETTE: { kind: ElementKind; label: string; sub?: string; defaultW: number; defaultD: number; color: string }[] = [
  { kind: "zone", label: "Inbound Staging", sub: "Raw Material", defaultW: 14, defaultD: 10, color: ZONE_COLORS["Raw Material"] },
  { kind: "zone", label: "Fast Pick Zone", sub: "Fast Moving", defaultW: 14, defaultD: 14, color: ZONE_COLORS["Fast Moving"] },
  { kind: "zone", label: "Bulk Storage", sub: "Finished Goods", defaultW: 14, defaultD: 16, color: ZONE_COLORS["Finished Goods"] },
  { kind: "zone", label: "Cold Chain", sub: "Cold Storage", defaultW: 8, defaultD: 10, color: ZONE_COLORS["Cold Storage"] },
  { kind: "zone", label: "Hazmat", sub: "Hazardous", defaultW: 8, defaultD: 6, color: ZONE_COLORS["Hazardous"] },
  { kind: "zone", label: "Returns / QC", sub: "Returns", defaultW: 14, defaultD: 8, color: ZONE_COLORS["Returns"] },
  { kind: "zone", label: "Slow Movers", sub: "Slow Moving", defaultW: 12, defaultD: 10, color: ZONE_COLORS["Slow Moving"] },
  { kind: "zone", label: "Outbound Staging", sub: "Finished Goods", defaultW: 14, defaultD: 10, color: ZONE_COLORS["Finished Goods"] },
  { kind: "dock", label: "Inbound Dock", sub: "Inbound", defaultW: 4, defaultD: 2, color: "#0891b2" },
  { kind: "dock", label: "Outbound Dock", sub: "Outbound", defaultW: 4, defaultD: 2, color: "#f97316" },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function kindIcon(kind: ElementKind) {
  if (kind === "zone") return <LayoutGrid className="h-3 w-3" />;
  if (kind === "dock") return <Anchor className="h-3 w-3" />;
  return <Box className="h-3 w-3" />;
}

function elementColor(el: PlacedElement) {
  if (el.kind === "zone" && el.zoneType) return ZONE_COLORS[el.zoneType];
  if (el.kind === "dock") return el.dockKind === "Inbound" ? "#0891b2" : "#f97316";
  return "#6366f1";
}

// ── Main component ────────────────────────────────────────────────────────────

interface DragDropWarehouseBuilderProps {
  warehouseName: string;
  warehouseW: number;
  warehouseD: number;
  onClose: () => void;
}

export function DragDropWarehouseBuilder({
  warehouseName,
  warehouseW,
  warehouseD,
  onClose,
}: DragDropWarehouseBuilderProps) {
  const { addZone, addDock, switchWarehouse } = useEditorStore();

  // ── Canvas state ──────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1); // pixel per grid unit
  const [pan, setPan] = useState({ x: 0, y: 0 }); // canvas offset in px
  const [placed, setPlaced] = useState<PlacedElement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // drag state for moving placed elements
  const dragging = useRef<{
    id: string;
    startMouse: { x: number; y: number };
    startPos: { x: number; z: number };
  } | null>(null);

  // resize state
  const resizing = useRef<{
    id: string;
    startMouse: { x: number; y: number };
    startSize: { w: number; d: number };
  } | null>(null);

  // pan state
  const panning = useRef<{ startMouse: { x: number; y: number }; startPan: { x: number; y: number } } | null>(null);

  // Compute pixel-per-unit based on zoom level
  const CELL = 10 * zoom; // 10px per grid unit at zoom=1

  // Center floor initially
  useEffect(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPan({
        x: (rect.width - warehouseW * CELL) / 2,
        y: (rect.height - warehouseD * CELL) / 2,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Coordinate helpers ───────────────────────────────────────────────────
  /** Convert mouse event (relative to canvas div) → grid coords */
  const mouseToGrid = useCallback(
    (clientX: number, clientY: number): { gx: number; gz: number } => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const px = clientX - rect.left - pan.x;
      const py = clientY - rect.top - pan.y;
      return { gx: Math.round(px / CELL), gz: Math.round(py / CELL) };
    },
    [pan, CELL],
  );

  // ── Palette drag-from ────────────────────────────────────────────────────
  const [ghostEl, setGhostEl] = useState<{
    x: number; y: number; w: number; d: number; color: string; label: string;
  } | null>(null);
  const dragPaletteItem = useRef<(typeof PALETTE)[0] | null>(null);

  const onPaletteMouseDown = (item: (typeof PALETTE)[0]) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragPaletteItem.current = item;
    setGhostEl({ x: e.clientX, y: e.clientY, w: item.defaultW, d: item.defaultD, color: item.color, label: item.label });
  };

  // ── Global mouse events ──────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Ghost element following cursor from palette
      if (dragPaletteItem.current && ghostEl) {
        setGhostEl((g) => g && { ...g, x: e.clientX, y: e.clientY });
      }

      // Moving a placed element
      if (dragging.current && canvasRef.current) {
        const dx = e.clientX - dragging.current.startMouse.x;
        const dy = e.clientY - dragging.current.startMouse.y;
        const dgx = Math.round(dx / CELL);
        const dgz = Math.round(dy / CELL);
        setPlaced((prev) =>
          prev.map((el) =>
            el.id === dragging.current!.id
              ? { ...el, x: dragging.current!.startPos.x + dgx, z: dragging.current!.startPos.z + dgz }
              : el,
          ),
        );
      }

      // Resizing
      if (resizing.current) {
        const dx = e.clientX - resizing.current.startMouse.x;
        const dy = e.clientY - resizing.current.startMouse.y;
        const dw = Math.round(dx / CELL);
        const dd = Math.round(dy / CELL);
        setPlaced((prev) =>
          prev.map((el) =>
            el.id === resizing.current!.id
              ? {
                  ...el,
                  w: Math.max(4, resizing.current!.startSize.w + dw),
                  d: Math.max(3, resizing.current!.startSize.d + dd),
                }
              : el,
          ),
        );
      }

      // Panning
      if (panning.current) {
        const dx = e.clientX - panning.current.startMouse.x;
        const dy = e.clientY - panning.current.startMouse.y;
        setPan({ x: panning.current.startPan.x + dx, y: panning.current.startPan.y + dy });
      }
    };

    const onUp = (e: MouseEvent) => {
      // Drop palette item onto canvas
      if (dragPaletteItem.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        ) {
          const { gx, gz } = mouseToGrid(e.clientX, e.clientY);
          const item = dragPaletteItem.current;
          const newEl: PlacedElement = {
            id: `${item.kind}-${Date.now()}`,
            kind: item.kind,
            x: gx - Math.floor(item.defaultW / 2),
            z: gz - Math.floor(item.defaultD / 2),
            w: item.defaultW,
            d: item.defaultD,
            label: item.label,
            zoneType: item.sub as ZoneType | undefined,
            dockKind: item.kind === "dock" ? (item.sub as "Inbound" | "Outbound") : undefined,
            aisleCount: item.kind === "zone" ? 2 : undefined,
            racksPerAisle: item.kind === "zone" ? 4 : undefined,
          };
          setPlaced((p) => [...p, newEl]);
          setSelected(newEl.id);
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
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [mouseToGrid, ghostEl, CELL]);

  // Keyboard delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        setPlaced((p) => p.filter((el) => el.id !== selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Zoom with wheel on canvas
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.4, z - e.deltaY * 0.001)));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const halfW = warehouseW / 2;
    const halfD = warehouseD / 2;
    for (const el of placed) {
      // Convert canvas grid (0-based from top-left of floor) to centered coords
      const cx = el.x - halfW;
      const cz = el.z - halfD;
      if (el.kind === "zone" && el.zoneType) {
        addZone({
          name: el.label,
          type: el.zoneType,
          x: cx,
          z: cz,
          w: el.w,
          d: el.d,
          aisleCount: el.aisleCount ?? 2,
          racksPerAisle: el.racksPerAisle ?? 4,
        });
      } else if (el.kind === "dock" && el.dockKind) {
        addDock({
          code: el.label.replace(" Dock", "").toUpperCase().slice(0, 6) + `-${Date.now() % 100}`,
          kind: el.dockKind,
          x: cx + el.w / 2,
          z: cz + el.d / 2,
        });
      }
    }
    setSaved(true);
    setTimeout(() => {
      switchWarehouse(warehouseName);
      onClose();
    }, 600);
  };

  // ── Selected element details ──────────────────────────────────────────────
  const sel = placed.find((el) => el.id === selected);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex bg-black/80">
      {/* LEFT: Palette */}
      <div className="w-[220px] flex-shrink-0 flex flex-col border-r border-border bg-[#0f1520]">
        <div className="px-3 py-3 border-b border-border/60">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-0.5">BUILDING</div>
          <div className="text-sm font-bold text-foreground truncate">{warehouseName}</div>
          <div className="text-[10px] text-muted-foreground">{warehouseW}×{warehouseD} grid units</div>
        </div>

        <div className="px-3 py-2 border-b border-border/40">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2">DRAG TO PLACE</div>
          <div className="space-y-1.5">
            {PALETTE.map((item, i) => (
              <div
                key={i}
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

        <div className="px-3 py-2 mt-auto border-t border-border/60 text-[10px] text-muted-foreground space-y-1">
          <div className="flex items-start gap-1"><Info className="h-3 w-3 mt-0.5 shrink-0" /><span>Drag items from the list above onto the floor grid</span></div>
          <div>• Click placed item to select</div>
          <div>• Drag to move, resize from corner</div>
          <div>• Delete / Backspace to remove</div>
          <div>• Middle-click drag or space+drag to pan</div>
        </div>
      </div>

      {/* CENTER: Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-11 border-b border-border/60 bg-[#0f1520] flex items-center gap-2 px-3">
          <span className="text-xs font-bold tracking-wider text-muted-foreground">WAREHOUSE FLOOR PLAN</span>
          <div className="flex items-center gap-1 ml-4 border-l border-border/60 pl-4">
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="h-6 w-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground" title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="h-6 w-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground" title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
            <span className="text-[10px] text-mono text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => { setZoom(1); if (canvasRef.current) { const r = canvasRef.current.getBoundingClientRect(); setPan({ x: (r.width - warehouseW * CELL) / 2, y: (r.height - warehouseD * CELL) / 2 }); } }} className="h-6 w-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground" title="Reset view"><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>
          <span className="text-[10px] text-muted-foreground ml-2">{placed.length} element{placed.length !== 1 ? "s" : ""} placed</span>
          <div className="ml-auto flex items-center gap-2">
            {selected && (
              <button
                onClick={() => { setPlaced((p) => p.filter((e) => e.id !== selected)); setSelected(null); }}
                className="px-2.5 py-1.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 text-xs flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
            <button onClick={onClose} className="px-2.5 py-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saved}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
            >
              {saved ? <><Check className="h-3.5 w-3.5" /> Saved!</> : <><Check className="h-3.5 w-3.5" /> Save Layout</>}
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[#0b1018] select-none"
          style={{ cursor: panning.current ? "grabbing" : "default" }}
          onWheel={onWheel}
          onClick={(e) => {
            // Deselect if click on canvas background
            if ((e.target as HTMLElement) === canvasRef.current) setSelected(null);
          }}
          onMouseDown={(e) => {
            // Middle click or space+click to pan
            if (e.button === 1 || e.altKey) {
              e.preventDefault();
              panning.current = { startMouse: { x: e.clientX, y: e.clientY }, startPan: { ...pan } };
            }
          }}
        >
          {/* Floor */}
          <div
            className="absolute border border-border/40"
            style={{
              left: pan.x,
              top: pan.y,
              width: warehouseW * CELL,
              height: warehouseD * CELL,
              background: "#111827",
              backgroundImage: `
                linear-gradient(rgba(55,65,81,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(55,65,81,0.3) 1px, transparent 1px),
                linear-gradient(rgba(55,65,81,0.15) 1px, transparent 1px),
                linear-gradient(90deg, rgba(55,65,81,0.15) 1px, transparent 1px)
              `,
              backgroundSize: `${CELL * 5}px ${CELL * 5}px, ${CELL * 5}px ${CELL * 5}px, ${CELL}px ${CELL}px, ${CELL}px ${CELL}px`,
            }}
            onClick={() => setSelected(null)}
          >
            {/* Corner labels */}
            <span className="absolute top-0 left-0 text-[9px] text-muted-foreground/40 px-1">0,0</span>
            <span className="absolute bottom-0 right-0 text-[9px] text-muted-foreground/40 px-1">{warehouseW},{warehouseD}</span>

            {/* Placed elements */}
            {placed.map((el) => {
              const color = elementColor(el);
              const isSelected = el.id === selected;
              return (
                <div
                  key={el.id}
                  className={cn(
                    "absolute border-2 rounded flex items-start justify-between p-1 transition-shadow",
                    isSelected ? "ring-2 ring-white/60" : "hover:ring-1 hover:ring-white/30",
                  )}
                  style={{
                    left: el.x * CELL,
                    top: el.z * CELL,
                    width: el.w * CELL,
                    height: el.d * CELL,
                    background: color + "22",
                    borderColor: color + (isSelected ? "ff" : "88"),
                    cursor: "grab",
                    zIndex: isSelected ? 10 : 1,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelected(el.id);
                    dragging.current = { id: el.id, startMouse: { x: e.clientX, y: e.clientY }, startPos: { x: el.x, z: el.z } };
                  }}
                >
                  <div className="text-[9px] font-bold leading-tight pointer-events-none" style={{ color }}>
                    <div className="flex items-center gap-1">
                      {kindIcon(el.kind)}
                      <span className="truncate max-w-[80px]">{el.label}</span>
                    </div>
                    <div className="text-[8px] opacity-60">{el.w}×{el.d}</div>
                  </div>

                  {/* Resize handle */}
                  {isSelected && (
                    <div
                      className="absolute bottom-0 right-0 h-4 w-4 flex items-center justify-center"
                      style={{ cursor: "se-resize" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        resizing.current = {
                          id: el.id,
                          startMouse: { x: e.clientX, y: e.clientY },
                          startSize: { w: el.w, d: el.d },
                        };
                      }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8">
                        <path d="M 8 0 L 8 8 L 0 8" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Drop zone hint when dragging palette */}
            {dragPaletteItem.current && (
              <div className="absolute inset-0 border-2 border-dashed border-primary/40 rounded pointer-events-none animate-pulse" />
            )}
          </div>

          {/* Ghost element following cursor */}
          {ghostEl && (
            <div
              className="fixed pointer-events-none rounded border-2 border-primary z-50 flex items-center justify-center text-[9px] font-bold text-primary"
              style={{
                left: ghostEl.x - (ghostEl.w * CELL) / 2,
                top: ghostEl.y - (ghostEl.d * CELL) / 2,
                width: ghostEl.w * CELL,
                height: ghostEl.d * CELL,
                background: ghostEl.color + "30",
                borderColor: ghostEl.color,
                opacity: 0.8,
              }}
            >
              {ghostEl.label}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Properties of selected element */}
      <div className="w-[220px] flex-shrink-0 border-l border-border bg-[#0f1520] flex flex-col">
        <div className="px-3 py-3 border-b border-border/60">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground">PROPERTIES</div>
        </div>
        {sel ? (
          <div className="p-3 space-y-3 text-xs">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">LABEL</div>
              <input
                className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                value={sel.label}
                onChange={(e) => setPlaced((p) => p.map((el) => el.id === sel.id ? { ...el, label: e.target.value } : el))}
              />
            </div>
            {sel.kind === "zone" && (
              <>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">ZONE TYPE</div>
                  <select
                    className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                    value={sel.zoneType ?? ""}
                    onChange={(e) => setPlaced((p) => p.map((el) => el.id === sel.id ? { ...el, zoneType: e.target.value as ZoneType } : el))}
                  >
                    {(Object.keys(ZONE_COLORS) as ZoneType[]).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">AISLES</div>
                  <input type="number" min={1} max={8}
                    className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                    value={sel.aisleCount ?? 2}
                    onChange={(e) => setPlaced((p) => p.map((el) => el.id === sel.id ? { ...el, aisleCount: Math.max(1, +e.target.value) } : el))}
                  />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">RACKS PER AISLE</div>
                  <input type="number" min={1} max={10}
                    className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                    value={sel.racksPerAisle ?? 4}
                    onChange={(e) => setPlaced((p) => p.map((el) => el.id === sel.id ? { ...el, racksPerAisle: Math.max(1, +e.target.value) } : el))}
                  />
                </div>
              </>
            )}
            {sel.kind === "dock" && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">DOCK KIND</div>
                <select
                  className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                  value={sel.dockKind ?? "Inbound"}
                  onChange={(e) => setPlaced((p) => p.map((el) => el.id === sel.id ? { ...el, dockKind: e.target.value as "Inbound" | "Outbound" } : el))}
                >
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(["x", "z", "w", "d"] as const).map((k) => (
                <div key={k}>
                  <div className="text-[10px] text-muted-foreground mb-1">{k.toUpperCase()}</div>
                  <input type="number"
                    className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                    value={sel[k]}
                    onChange={(e) => setPlaced((p) => p.map((el) => el.id === sel.id ? { ...el, [k]: +e.target.value } : el))}
                  />
                </div>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
              Size: {sel.w}×{sel.d} · Pos: ({sel.x},{sel.z})
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <div className="text-xs text-muted-foreground">Select a placed element to edit its properties</div>
          </div>
        )}

        {/* Legend */}
        <div className="border-t border-border/60 p-3 space-y-1.5">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2">ELEMENT TYPES</div>
          {[
            { color: "#16a34a", label: "Zone (Fast Moving)" },
            { color: "#0891b2", label: "Dock (Inbound)" },
            { color: "#f97316", label: "Dock (Outbound)" },
            { color: "#dc2626", label: "Zone (Hazardous)" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-[10px]">
              <span className="h-2 w-2 rounded-sm flex-shrink-0" style={{ background: l.color }} />
              <span className="text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
