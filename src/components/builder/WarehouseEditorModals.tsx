import { useState } from "react";
import { X, Plus, Warehouse } from "lucide-react";
import { ZONE_COLORS, type ZoneType, type Warehouse as WarehouseType } from "@/lib/wms-data";
import { useEditorStore, type ZoneFormData, type DockFormData } from "@/lib/wms-editor-store";
import { DragDropWarehouseBuilder } from "./DragDropWarehouseBuilder";
import { cn } from "@/lib/utils";

const ZONE_TYPES: ZoneType[] = [
  "Raw Material", "Finished Goods", "Fast Moving", "Slow Moving",
  "Hazardous", "Cold Storage", "Returns", "QC Hold",
];

// ─── Shared modal shell ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-[480px] panel rounded-lg border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="text-sm font-bold tracking-wider">{title}</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Field helpers ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", min, max, step }: {
  value: string | number; onChange: (v: string) => void;
  type?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min} max={max} step={step}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background/60 border border-border/60 rounded px-2.5 py-1.5 text-xs text-mono focus:outline-none focus:border-primary/50"
    />
  );
}

function NumField({ label, value, onChange, min = -100, max = 200, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <Field label={label}>
      <Input type="number" value={value} min={min} max={max} step={step}
        onChange={(v) => onChange(Number(v))} />
    </Field>
  );
}

// ─── Add / Edit Zone Modal ────────────────────────────────────────────────────
interface ZoneModalProps {
  onClose: () => void;
  editZoneId?: string | null;
  initialData?: Partial<ZoneFormData>;
}

export function ZoneModal({ onClose, editZoneId, initialData }: ZoneModalProps) {
  const { addZone, updateZone } = useEditorStore();
  const isEdit = !!editZoneId;

  const [form, setForm] = useState<ZoneFormData>({
    name: initialData?.name ?? "New Zone",
    type: initialData?.type ?? "Finished Goods",
    x: initialData?.x ?? 0,
    z: initialData?.z ?? 0,
    w: initialData?.w ?? 12,
    d: initialData?.d ?? 10,
    aisleCount: initialData?.aisleCount ?? 2,
    racksPerAisle: initialData?.racksPerAisle ?? 4,
  });

  const set = <K extends keyof ZoneFormData>(k: K, v: ZoneFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (isEdit) updateZone(editZoneId!, form);
    else addZone(form);
    onClose();
  };

  const color = ZONE_COLORS[form.type];

  return (
    <Modal title={isEdit ? "Edit Zone" : "Add New Zone"} onClose={onClose}>
      <div className="space-y-4">
        {/* Name + Type */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Zone Name">
            <Input value={form.name} onChange={(v) => set("name", v)} />
          </Field>
          <Field label="Zone Type">
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as ZoneType)}
              className="w-full bg-background/60 border border-border/60 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50"
            >
              {ZONE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Color preview */}
        <div className="flex items-center gap-2 p-2 rounded border border-border/40"
          style={{ background: color + "15", borderColor: color + "40" }}>
          <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
          <span className="text-xs" style={{ color }}>{form.type}</span>
          <span className="text-xs text-muted-foreground ml-auto">{color}</span>
        </div>

        {/* Position */}
        <div>
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2">POSITION (grid units)</div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="X Origin" value={form.x} onChange={(v) => set("x", v)} min={-60} max={60} />
            <NumField label="Z Origin" value={form.z} onChange={(v) => set("z", v)} min={-40} max={40} />
          </div>
        </div>

        {/* Size */}
        <div>
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2">SIZE (grid units)</div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Width (W)" value={form.w} onChange={(v) => set("w", v)} min={4} max={60} />
            <NumField label="Depth (D)" value={form.d} onChange={(v) => set("d", v)} min={4} max={40} />
          </div>
        </div>

        {/* Rack config */}
        <div>
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2">RACK CONFIGURATION</div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Aisles" value={form.aisleCount} onChange={(v) => set("aisleCount", Math.max(1, v))} min={1} max={10} />
            <NumField label="Racks per Aisle" value={form.racksPerAisle} onChange={(v) => set("racksPerAisle", Math.max(1, v))} min={1} max={12} />
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            ≈ {form.aisleCount * form.racksPerAisle * 2} racks · {form.aisleCount * form.racksPerAisle * 2 * 4 * 4} bins
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border/40">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded border border-border text-xs hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
          >
            {isEdit ? "Save Changes" : "Add Zone"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Dock Modal ───────────────────────────────────────────────────────────
export function DockModal({ onClose }: { onClose: () => void }) {
  const { addDock } = useEditorStore();
  const [form, setForm] = useState<DockFormData>({
    code: "DOCK-01",
    kind: "Inbound",
    x: 0,
    z: -20,
  });
  const set = <K extends keyof DockFormData>(k: K, v: DockFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.code.trim()) return;
    addDock(form);
    onClose();
  };

  return (
    <Modal title="Add New Dock" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dock Code">
            <Input value={form.code} onChange={(v) => set("code", v)} />
          </Field>
          <Field label="Kind">
            <select
              value={form.kind}
              onChange={(e) => set("kind", e.target.value as "Inbound" | "Outbound")}
              className="w-full bg-background/60 border border-border/60 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50"
            >
              <option value="Inbound">Inbound</option>
              <option value="Outbound">Outbound</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="X Position" value={form.x} onChange={(v) => set("x", v)} min={-60} max={60} />
          <NumField label="Z Position" value={form.z} onChange={(v) => set("z", v)} min={-40} max={40} />
        </div>
        <div className="flex gap-2 pt-2 border-t border-border/40">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded border border-border text-xs hover:bg-secondary">
            Cancel
          </button>
          <button onClick={handleSubmit} className="flex-1 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
            Add Dock
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Rename Warehouse Modal ───────────────────────────────────────────────────
export function RenameWarehouseModal({ onClose, currentName }: { onClose: () => void; currentName: string }) {
  const { renameWarehouse } = useEditorStore();
  const [name, setName] = useState(currentName);

  return (
    <Modal title="Rename Warehouse" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Warehouse Name">
          <Input value={name} onChange={setName} />
        </Field>
        <div className="flex gap-2 pt-2 border-t border-border/40">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded border border-border text-xs hover:bg-secondary">Cancel</button>
          <button onClick={() => { renameWarehouse(name); onClose(); }}
            className="flex-1 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
            Rename
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── New Warehouse Modal ──────────────────────────────────────────────────────
export function NewWarehouseModal({ onClose }: { onClose: () => void }) {
  const { createWarehouse, warehouses } = useEditorStore();
  const [form, setForm] = useState({ name: "", w: 60, d: 40 });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const [showBuilder, setShowBuilder] = useState(false);

  const nameExists = warehouses.some((w) => w.name === form.name.trim());

  const handleNext = () => {
    if (!form.name.trim() || nameExists) return;
    createWarehouse({ name: form.name.trim(), w: form.w, d: form.d });
    setShowBuilder(true);
  };

  if (showBuilder) {
    return (
      <DragDropWarehouseBuilder
        warehouseName={form.name.trim()}
        warehouseW={form.w}
        warehouseD={form.d}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal title="Create New Warehouse" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Warehouse Name">
          <Input value={form.name} onChange={(v) => set("name", v)} />
          {nameExists && (
            <div className="text-[10px] text-destructive mt-1">A warehouse with this name already exists.</div>
          )}
        </Field>
        <div>
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground mb-2">FLOOR SIZE (grid units)</div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Width (W)" value={form.w} onChange={(v) => set("w", Math.max(20, v))} min={20} max={200} />
            <NumField label="Depth (D)" value={form.d} onChange={(v) => set("d", Math.max(20, v))} min={20} max={200} />
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Floor area: {form.w} × {form.d} = {form.w * form.d} sq units
          </div>
          <div className="mt-1 text-[10px] text-primary/80">
            → Next step: drag &amp; drop zones, docks, and racks onto the floor plan
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border/40">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded border border-border text-xs hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={handleNext}
            disabled={!form.name.trim() || nameExists}
            className="flex-1 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next → Design Layout
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Layout Modal ────────────────────────────────────────────────────────
// Opens the drag-drop builder pre-populated with the current warehouse's zones and docks

export type { PlacedElement } from "./DragDropWarehouseBuilder";

export function EditLayoutModal({ onClose, warehouse }: { onClose: () => void; warehouse: WarehouseType }) {
  // Convert existing Warehouse zones + docks + racks + bins → PlacedElement[]
  const halfW = warehouse.size.w / 2;
  const halfD = warehouse.size.d / 2;

  const initialPlaced = [
    // Zones
    ...warehouse.zones.map((z) => ({
      id: z.id,
      kind: "zone" as const,
      x: z.bounds.x + halfW,
      z: z.bounds.z + halfD,
      w: z.bounds.w,
      d: z.bounds.d,
      label: z.name,
      zoneType: z.type,
    })),
    // Docks
    ...warehouse.docks.map((d) => ({
      id: d.id,
      kind: "dock" as const,
      x: d.position[0] + halfW - 2,
      z: d.position[1] + halfD - 1,
      w: 4,
      d: 2,
      label: d.code,
      dockKind: d.kind,
    })),
    // Racks (from all aisles in all zones)
    ...warehouse.zones.flatMap((z) =>
      z.aisles.flatMap((a) =>
        a.racks.map((r) => ({
          id: r.id,
          kind: "rack" as const,
          x: r.position[0] + halfW - 1,
          z: r.position[1] + halfD - 0.5,
          w: 2,
          d: 1,
          label: r.id,
          parentZoneId: z.id,
        }))
      )
    ),
    // Bins (one PlacedElement per rack that has bins, representing the bin set)
    ...warehouse.zones.flatMap((z) =>
      z.aisles.flatMap((a) =>
        a.racks
          .filter((r) => r.bins.length > 0)
          .map((r) => ({
            id: `bin-set-${r.id}`,
            kind: "bin" as const,
            x: r.position[0] + halfW - 1,
            z: r.position[1] + halfD - 0.5,
            w: 2,
            d: 1,
            label: `${r.bins.length} bins`,
            parentRackId: r.id,
            parentZoneId: z.id,
            binCount: r.bins.length,
          }))
      )
    ),
  ];

  return (
    <DragDropWarehouseBuilder
      warehouseName={warehouse.name}
      warehouseW={warehouse.size.w}
      warehouseD={warehouse.size.d}
      onClose={onClose}
      initialPlaced={initialPlaced}
      isEdit
      existingWarehouse={warehouse}
    />
  );
}
