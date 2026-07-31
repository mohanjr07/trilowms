/**
 * SKU Master — Create / Edit Modal
 * Full enterprise form with all SKU fields
 */

import { useState, useEffect } from "react";
import {
  X, Package, Barcode, Tag, Layers, Weight, Grid3X3,
  ToggleLeft, AlertTriangle, Save, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type SKU, type SkuStatus, type StorageType, type UnitOfMeasure,
  SKU_CATEGORIES, useSkuStore,
} from "@/lib/sku-store";
import { useAuthStore } from "@/lib/auth-store";
import { useStockStore } from "@/lib/stock-store";

interface Props {
  open: boolean;
  mode: "create" | "edit" | "view";
  sku?: SKU | null;
  onClose: () => void;
}

const STATUSES: SkuStatus[] = ["Active", "Inactive", "Hold", "Discontinued", "Pending"];
const STORAGE_TYPES: StorageType[] = ["Ambient", "Cold", "Frozen", "Hazmat", "Secure", "Bulk"];
const UOMS: UnitOfMeasure[] = ["EA", "CS", "PLT", "KG", "LB", "L", "MT", "FT", "M", "PK"];

function Field({
  label, required, children, className,
}: {
  label: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-1.5 text-xs bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/60 text-mono disabled:opacity-50 disabled:cursor-not-allowed";

const selectCls =
  "w-full px-3 py-1.5 text-xs bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/60 text-mono disabled:opacity-50 disabled:cursor-not-allowed appearance-none";

function Toggle({
  label, value, onChange, disabled,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-all",
        value
          ? "bg-success/10 border-success/40 text-success"
          : "bg-secondary border-border text-muted-foreground",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      disabled={disabled}
    >
      <div
        className={cn(
          "w-8 h-4 rounded-full transition-all relative flex-shrink-0",
          value ? "bg-success" : "bg-muted"
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform shadow-sm",
            value ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </div>
      {label}
    </button>
  );
}

type Section = "basic" | "dimensions" | "tracking" | "storage" | "pricing";

export function SkuFormModal({ open, mode, sku, onClose }: Props) {
  const { addSku, updateSku } = useSkuStore();
  const { session } = useAuthStore();
  const isReadOnly = mode === "view";

  // Live stock position from the real ledger (single source of truth — same
  // numbers shown on Stock Levels, Putaway, and Picking) rather than the
  // static seed values on the SKU record.
  const liveStock = useStockStore((s) => (sku ? s.stock[sku.skuCode] : undefined));
  const liveOnHand = liveStock?.onHand ?? 0;
  const liveReserved = liveStock?.reserved ?? 0;
  const liveAvailable = Math.max(0, liveOnHand - liveReserved);

  const blank: Omit<SKU, "id" | "createdAt" | "updatedAt"> = {
    skuCode: "", barcode: "", itemName: "", description: "",
    category: "Electronics", subcategory: "PCBs & Modules",
    uom: "EA",
    dimensions: { length: 0, width: 0, height: 0, unit: "mm" },
    weight: 0, weightUnit: "kg",
    palletConfig: { unitsPerLayer: 10, layersPerPallet: 5, totalUnitsPerPallet: 50 },
    batchTracking: false, serialTracking: false, expiryTracking: false,
    reorderLevel: 100, storageType: "Ambient", status: "Active",
    createdBy: session?.user.name ?? "System",
    lastModifiedBy: session?.user.name ?? "System",
    onHand: 0, allocated: 0, available: 0,
  };

  const [form, setForm] = useState<Omit<SKU, "id" | "createdAt" | "updatedAt">>(
    sku ? { ...sku } : blank
  );
  const [errors, setErrors] = useState<Partial<Record<keyof SKU, string>>>({});
  const [activeSection, setActiveSection] = useState<Section>("basic");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(sku ? { ...sku } : blank);
      setErrors({});
      setActiveSection("basic");
    }
  }, [open, sku]);

  const subcats = SKU_CATEGORIES[form.category] ?? [];

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key as keyof SKU]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate() {
    const e: Partial<Record<keyof SKU, string>> = {};
    if (!form.skuCode.trim()) e.skuCode = "SKU Code is required";
    if (!form.barcode.trim()) e.barcode = "Barcode is required";
    if (!form.itemName.trim()) e.itemName = "Item name is required";
    if (!form.category) e.category = "Category is required";
    if (form.weight < 0) e.weight = "Weight must be ≥ 0";
    if (form.reorderLevel < 0) e.reorderLevel = "Reorder level must be ≥ 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) { setActiveSection("basic"); return; }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    if (mode === "create") {
      addSku({ ...form, lastModifiedBy: session?.user.name ?? "System" });
    } else if (sku) {
      updateSku(sku.id, { ...form, lastModifiedBy: session?.user.name ?? "System" });
    }
    setSaving(false);
    onClose();
  }

  if (!open) return null;

  const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "basic", label: "Basic Info", icon: <Package className="h-3 w-3" /> },
    { id: "dimensions", label: "Dimensions & Weight", icon: <Weight className="h-3 w-3" /> },
    { id: "tracking", label: "Tracking & Config", icon: <ToggleLeft className="h-3 w-3" /> },
    { id: "storage", label: "Storage & Reorder", icon: <Grid3X3 className="h-3 w-3" /> },
    { id: "pricing", label: "Pricing & Compliance", icon: <Tag className="h-3 w-3" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-lg border border-border overflow-hidden"
        style={{ background: "var(--card)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-panel">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">
                {mode === "create" ? "Create New SKU" : mode === "edit" ? "Edit SKU" : "SKU Details"}
              </div>
              {sku && (
                <div className="text-[10px] text-mono text-muted-foreground">{sku.skuCode} · {sku.itemName}</div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-border bg-background/30 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold tracking-wider whitespace-nowrap transition-colors border-b-2",
                activeSection === s.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {s.icon}
              {s.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* BASIC INFO */}
          {activeSection === "basic" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="SKU Code" required className="col-span-1">
                <input
                  className={cn(inputCls, errors.skuCode && "border-destructive")}
                  value={form.skuCode}
                  onChange={(e) => set("skuCode", e.target.value.toUpperCase())}
                  placeholder="SKU-10000"
                  disabled={isReadOnly}
                />
                {errors.skuCode && <span className="text-[10px] text-destructive">{errors.skuCode}</span>}
              </Field>

              <Field label="Barcode / EAN / UPC" required>
                <input
                  className={cn(inputCls, errors.barcode && "border-destructive")}
                  value={form.barcode}
                  onChange={(e) => set("barcode", e.target.value)}
                  placeholder="8901234567890"
                  disabled={isReadOnly}
                />
                {errors.barcode && <span className="text-[10px] text-destructive">{errors.barcode}</span>}
              </Field>

              <Field label="Item Name" required className="col-span-2">
                <input
                  className={cn(inputCls, errors.itemName && "border-destructive")}
                  value={form.itemName}
                  onChange={(e) => set("itemName", e.target.value)}
                  placeholder="Full item name"
                  disabled={isReadOnly}
                />
                {errors.itemName && <span className="text-[10px] text-destructive">{errors.itemName}</span>}
              </Field>

              <Field label="Description" className="col-span-2">
                <textarea
                  className={cn(inputCls, "resize-none")}
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Detailed item description..."
                  disabled={isReadOnly}
                />
              </Field>

              <Field label="Category" required>
                <select
                  className={selectCls}
                  value={form.category}
                  onChange={(e) => {
                    set("category", e.target.value);
                    set("subcategory", SKU_CATEGORIES[e.target.value]?.[0] ?? "");
                  }}
                  disabled={isReadOnly}
                >
                  {Object.keys(SKU_CATEGORIES).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Subcategory">
                <select
                  className={selectCls}
                  value={form.subcategory}
                  onChange={(e) => set("subcategory", e.target.value)}
                  disabled={isReadOnly}
                >
                  {subcats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Unit of Measure" required>
                <select
                  className={selectCls}
                  value={form.uom}
                  onChange={(e) => set("uom", e.target.value as UnitOfMeasure)}
                  disabled={isReadOnly}
                >
                  {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>

              <Field label="Status">
                <select
                  className={selectCls}
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as SkuStatus)}
                  disabled={isReadOnly}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Supplier">
                <input
                  className={inputCls}
                  value={form.supplier ?? ""}
                  onChange={(e) => set("supplier", e.target.value)}
                  placeholder="Supplier name"
                  disabled={isReadOnly}
                />
              </Field>

              <Field label="Country of Origin">
                <input
                  className={inputCls}
                  value={form.countryOfOrigin ?? ""}
                  onChange={(e) => set("countryOfOrigin", e.target.value)}
                  placeholder="USA"
                  disabled={isReadOnly}
                />
              </Field>

              <Field label="Notes" className="col-span-2">
                <textarea
                  className={cn(inputCls, "resize-none")}
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Special handling instructions, remarks..."
                  disabled={isReadOnly}
                />
              </Field>
            </div>
          )}

          {/* DIMENSIONS & WEIGHT */}
          {activeSection === "dimensions" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 text-xs font-bold tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" /> PHYSICAL DIMENSIONS
              </div>

              <div className="col-span-2 grid grid-cols-4 gap-3">
                <Field label="Length">
                  <input
                    type="number" min={0} className={inputCls}
                    value={form.dimensions.length}
                    onChange={(e) => set("dimensions", { ...form.dimensions, length: +e.target.value })}
                    disabled={isReadOnly}
                  />
                </Field>
                <Field label="Width">
                  <input
                    type="number" min={0} className={inputCls}
                    value={form.dimensions.width}
                    onChange={(e) => set("dimensions", { ...form.dimensions, width: +e.target.value })}
                    disabled={isReadOnly}
                  />
                </Field>
                <Field label="Height">
                  <input
                    type="number" min={0} className={inputCls}
                    value={form.dimensions.height}
                    onChange={(e) => set("dimensions", { ...form.dimensions, height: +e.target.value })}
                    disabled={isReadOnly}
                  />
                </Field>
                <Field label="Unit">
                  <select
                    className={selectCls}
                    value={form.dimensions.unit}
                    onChange={(e) => set("dimensions", { ...form.dimensions, unit: e.target.value as "mm" | "cm" | "in" })}
                    disabled={isReadOnly}
                  >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                </Field>
              </div>

              <div className="col-span-2 border-t border-border/40 pt-4 text-xs font-bold tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                <Weight className="h-3.5 w-3.5" /> WEIGHT
              </div>

              <Field label="Weight" required>
                <input
                  type="number" min={0} step={0.01} className={inputCls}
                  value={form.weight}
                  onChange={(e) => set("weight", +e.target.value)}
                  disabled={isReadOnly}
                />
              </Field>
              <Field label="Unit">
                <select className={selectCls} value={form.weightUnit}
                  onChange={(e) => set("weightUnit", e.target.value as "kg" | "lb")}
                  disabled={isReadOnly}>
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </Field>

              <div className="col-span-2 border-t border-border/40 pt-4 text-xs font-bold tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                <Grid3X3 className="h-3.5 w-3.5" /> PALLET CONFIGURATION
              </div>

              <Field label="Units per Layer">
                <input
                  type="number" min={1} className={inputCls}
                  value={form.palletConfig.unitsPerLayer}
                  onChange={(e) => {
                    const upl = +e.target.value;
                    set("palletConfig", {
                      ...form.palletConfig,
                      unitsPerLayer: upl,
                      totalUnitsPerPallet: upl * form.palletConfig.layersPerPallet,
                    });
                  }}
                  disabled={isReadOnly}
                />
              </Field>
              <Field label="Layers per Pallet">
                <input
                  type="number" min={1} className={inputCls}
                  value={form.palletConfig.layersPerPallet}
                  onChange={(e) => {
                    const lpp = +e.target.value;
                    set("palletConfig", {
                      ...form.palletConfig,
                      layersPerPallet: lpp,
                      totalUnitsPerPallet: form.palletConfig.unitsPerLayer * lpp,
                    });
                  }}
                  disabled={isReadOnly}
                />
              </Field>
              <Field label="Total Units / Pallet" className="col-span-2">
                <div className={cn(inputCls, "bg-secondary/50 text-primary font-bold")}>
                  {form.palletConfig.totalUnitsPerPallet} units per pallet
                </div>
              </Field>
            </div>
          )}

          {/* TRACKING */}
          {activeSection === "tracking" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 text-xs font-bold tracking-wider text-muted-foreground mb-1">
                TRACKING CONFIGURATION
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-3">
                <Toggle
                  label="Batch Tracking"
                  value={form.batchTracking}
                  onChange={(v) => set("batchTracking", v)}
                  disabled={isReadOnly}
                />
                <Toggle
                  label="Serial Tracking"
                  value={form.serialTracking}
                  onChange={(v) => set("serialTracking", v)}
                  disabled={isReadOnly}
                />
                <Toggle
                  label="Expiry Tracking"
                  value={form.expiryTracking}
                  onChange={(v) => set("expiryTracking", v)}
                  disabled={isReadOnly}
                />
              </div>

              {(form.batchTracking || form.serialTracking || form.expiryTracking) && (
                <div className="col-span-2 p-3 rounded border border-info/30 bg-info/5 text-xs text-info flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    {form.serialTracking && "Serial tracking requires unique serial number per unit. "}
                    {form.batchTracking && "Batch tracking enables lot management and batch recall. "}
                    {form.expiryTracking && "Expiry tracking enforces FEFO picking strategies. "}
                  </span>
                </div>
              )}

              {sku && (
                <>
                  <div className="col-span-2 border-t border-border/40 pt-4 text-xs font-bold tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                    <span>CURRENT STOCK LEVELS (READ-ONLY)</span>
                    <span className="text-[9px] normal-case tracking-normal text-muted-foreground/70">Live from stock ledger</span>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    {[
                      { label: "On Hand", value: liveOnHand, cls: "text-foreground" },
                      { label: "Allocated", value: liveReserved, cls: "text-warning" },
                      { label: "Available", value: liveAvailable, cls: liveAvailable < (form.reorderLevel ?? 0) ? "text-destructive" : "text-success" },
                    ].map((kpi) => (
                      <div key={kpi.label} className="p-3 rounded border border-border bg-secondary/30 text-center">
                        <div className="text-[10px] text-muted-foreground tracking-wider">{kpi.label}</div>
                        <div className={cn("text-xl font-bold text-mono mt-1", kpi.cls)}>
                          {kpi.value.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!liveStock && (
                    <div className="col-span-2 text-[10px] text-muted-foreground/70 -mt-1">
                      No stock has been received against this SKU yet — levels will populate once it moves through Putaway.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STORAGE */}
          {activeSection === "storage" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Storage Type" required className="col-span-2">
                <div className="grid grid-cols-3 gap-2">
                  {STORAGE_TYPES.map((t) => {
                    const colors: Record<StorageType, string> = {
                      Ambient: "border-foreground/20 hover:border-foreground/40",
                      Cold: "border-info/40 hover:border-info/60",
                      Frozen: "border-accent/40 hover:border-accent/60",
                      Hazmat: "border-destructive/40 hover:border-destructive/60",
                      Secure: "border-warning/40 hover:border-warning/60",
                      Bulk: "border-muted-foreground/30 hover:border-muted-foreground/50",
                    };
                    const active: Record<StorageType, string> = {
                      Ambient: "bg-foreground/10 border-foreground/40 text-foreground",
                      Cold: "bg-info/15 border-info/50 text-info",
                      Frozen: "bg-accent/15 border-accent/50 text-accent",
                      Hazmat: "bg-destructive/15 border-destructive/50 text-destructive",
                      Secure: "bg-warning/15 border-warning/50 text-warning",
                      Bulk: "bg-muted/15 border-muted-foreground/40 text-muted-foreground",
                    };
                    const isActive = form.storageType === t;
                    return (
                      <button
                        key={t} type="button"
                        onClick={() => !isReadOnly && set("storageType", t)}
                        className={cn(
                          "px-3 py-2.5 rounded border text-xs font-bold tracking-wider transition-all",
                          isActive ? active[t] : cn("text-muted-foreground", colors[t]),
                          isReadOnly && "cursor-not-allowed"
                        )}
                      >
                        {t.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Reorder Level" required>
                <input
                  type="number" min={0} className={cn(inputCls, errors.reorderLevel && "border-destructive")}
                  value={form.reorderLevel}
                  onChange={(e) => set("reorderLevel", +e.target.value)}
                  disabled={isReadOnly}
                />
                {errors.reorderLevel && <span className="text-[10px] text-destructive">{errors.reorderLevel}</span>}
              </Field>

              <Field label="Tax Code">
                <input
                  className={inputCls}
                  value={form.taxCode ?? ""}
                  onChange={(e) => set("taxCode", e.target.value)}
                  placeholder="GST18"
                  disabled={isReadOnly}
                />
              </Field>

              <Field label="HS Code">
                <input
                  className={inputCls}
                  value={form.hsCode ?? ""}
                  onChange={(e) => set("hsCode", e.target.value)}
                  placeholder="8400.10"
                  disabled={isReadOnly}
                />
              </Field>
            </div>
          )}

          {/* PRICING */}
          {activeSection === "pricing" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cost Price (USD)">
                <input
                  type="number" min={0} step={0.01} className={inputCls}
                  value={form.costPrice ?? ""}
                  onChange={(e) => set("costPrice", +e.target.value)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </Field>
              <Field label="Selling Price (USD)">
                <input
                  type="number" min={0} step={0.01} className={inputCls}
                  value={form.sellingPrice ?? ""}
                  onChange={(e) => set("sellingPrice", +e.target.value)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
              </Field>

              {form.costPrice && form.sellingPrice && form.sellingPrice > form.costPrice && (
                <div className="col-span-2 p-3 rounded border border-success/30 bg-success/5 text-xs">
                  <span className="text-muted-foreground">Margin: </span>
                  <span className="text-success font-bold text-mono">
                    {(((form.sellingPrice - form.costPrice) / form.sellingPrice) * 100).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground ml-3">Markup: </span>
                  <span className="text-success font-bold text-mono">
                    {(((form.sellingPrice - form.costPrice) / form.costPrice) * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {sku && (
                <div className="col-span-2 border-t border-border/40 pt-4">
                  <div className="text-xs font-bold tracking-wider text-muted-foreground mb-3">AUDIT TRAIL</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: "Created By", value: sku.createdBy },
                      { label: "Created At", value: new Date(sku.createdAt).toLocaleString() },
                      { label: "Last Modified By", value: sku.lastModifiedBy },
                      { label: "Last Modified At", value: new Date(sku.updatedAt).toLocaleString() },
                    ].map((r) => (
                      <div key={r.label} className="p-2.5 rounded bg-secondary/40 border border-border/60">
                        <div className="text-[10px] text-muted-foreground tracking-wider">{r.label}</div>
                        <div className="text-mono mt-0.5">{r.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-panel">
          <div className="text-[11px] text-muted-foreground">
            {mode === "view"
              ? "Read-only view"
              : "Fields marked with * are required"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded border border-border text-xs hover:bg-secondary transition-colors"
            >
              {isReadOnly ? "Close" : "Cancel"}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 glow-amber"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : mode === "create" ? "Create SKU" : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
