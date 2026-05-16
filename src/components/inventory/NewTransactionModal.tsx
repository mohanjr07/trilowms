/**
 * NewTransactionModal — Enterprise transaction creation workflow
 * Handles all 8 transaction types with smart form switching.
 */

import { useState, useCallback } from "react";
import {
  X, ArrowRight, Package, MoveRight, RotateCcw, AlertTriangle,
  Wrench, Ban, Truck, Plus, ChevronDown, CheckCircle2, Loader2,
} from "lucide-react";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { useAuthStore } from "@/lib/auth-store";
import { useTransactionStore, TXN_TYPE_META, type TransactionType } from "@/lib/transaction-store";
import type { BinStatus } from "@/lib/wms-data";

// ─── Type selector ────────────────────────────────────────────────────────────

const TRANSACTION_TYPES: { type: TransactionType; icon: typeof Plus; description: string }[] = [
  { type: "RECEIVED",      icon: Plus,          description: "New stock into a bin" },
  { type: "MOVED",         icon: MoveRight,     description: "Bin-to-bin movement" },
  { type: "RACK_TRANSFER", icon: Truck,         description: "Rack-to-rack transfer" },
  { type: "WH_TRANSFER",   icon: ArrowRight,    description: "Cross-warehouse transfer" },
  { type: "ADJUSTMENT",    icon: RotateCcw,     description: "Stock count correction" },
  { type: "BLOCKED",       icon: Ban,           description: "Flag bin as blocked" },
  { type: "DAMAGED",       icon: Wrench,        description: "Mark stock as damaged" },
  { type: "RETURNED",      icon: RotateCcw,     description: "Returns processing" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
      {children}
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = "text", ...rest
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  [k: string]: unknown;
}) {
  return (
    <input
      {...rest}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-secondary border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60 transition-colors"
    />
  );
}

function Select({
  value, onChange, children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-secondary border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60 transition-colors pr-8"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function BinSelect({
  label, value, onChange, bins, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  bins: import("@/lib/inventory-bin-store").BinInventory[];
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-secondary border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60 transition-colors pr-8"
        >
          <option value="">{placeholder ?? "Select bin…"}</option>
          {bins.map((b) => (
            <option key={b.binId} value={b.binId}>
              {b.binCode} — {b.zoneName} ({b.status}, {b.occupancyPct}%)
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewTransactionModal({ open, onClose }: Props) {
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName) ?? "TRILO-DC-01";
  const warehouseBins = useInvBinStore((s) => s.warehouseBins);
  const bins = warehouseBins[activeWarehouseName] ?? [];
  const assignSkuToBin = useInvBinStore((s) => s.assignSkuToBin);
  const updateBinQuantity = useInvBinStore((s) => s.updateBinQuantity);
  const updateBinStatus = useInvBinStore((s) => s.updateBinStatus);
  const clearBin = useInvBinStore((s) => s.clearBin);
  const getBinById = useInvBinStore((s) => s.getBinById);

  const { session } = useAuthStore();
  const createTransaction = useTransactionStore((s) => s.createTransaction);

  const [step, setStep] = useState<"type" | "form" | "confirm" | "done">("type");
  const [selectedType, setSelectedType] = useState<TransactionType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [skuCode, setSkuCode] = useState("");
  const [skuName, setSkuName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [uom, setUom] = useState("EA");
  const [sourceBinId, setSourceBinId] = useState("");
  const [destBinId, setDestBinId] = useState("");
  const [destWarehouse, setDestWarehouse] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [referenceDoc, setReferenceDoc] = useState("");
  const [notes, setNotes] = useState("");
  const [adjustDir, setAdjustDir] = useState<"add" | "remove">("add");

  const reset = useCallback(() => {
    setStep("type");
    setSelectedType(null);
    setSkuCode(""); setSkuName(""); setQuantity(""); setUom("EA");
    setSourceBinId(""); setDestBinId(""); setDestWarehouse("");
    setBatchNumber(""); setReferenceDoc(""); setNotes("");
    setAdjustDir("add");
    setIsSubmitting(false);
  }, []);

  const handleClose = () => { reset(); onClose(); };

  const handleTypeSelect = (type: TransactionType) => {
    setSelectedType(type);
    setStep("form");
  };

  // Auto-fill SKU from source bin
  const handleSourceBinChange = (binId: string) => {
    setSourceBinId(binId);
    const bin = bins.find((b) => b.binId === binId);
    if (bin && bin.skuCode) {
      setSkuCode(bin.skuCode);
      setSkuName(bin.skuName ?? "");
      setBatchNumber(bin.batchNumber ?? "");
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !session) return;
    setIsSubmitting(true);
    setStep("confirm");

    await new Promise((r) => setTimeout(r, 1200)); // simulate processing

    const qty = parseInt(quantity) || 0;
    const srcBin = getBinById(sourceBinId);
    const dstBin = getBinById(destBinId);

    // Apply changes to inventory store
    if (selectedType === "RECEIVED" && destBinId) {
      assignSkuToBin(destBinId, skuCode, skuName, qty, batchNumber || undefined);
    } else if ((selectedType === "MOVED" || selectedType === "RACK_TRANSFER") && sourceBinId && destBinId) {
      const srcQty = (srcBin?.quantity ?? qty) - qty;
      updateBinQuantity(sourceBinId, Math.max(0, srcQty));
      const dstQty = (dstBin?.quantity ?? 0) + qty;
      assignSkuToBin(destBinId, skuCode, skuName, dstQty, batchNumber || undefined);
    } else if (selectedType === "ADJUSTMENT" && sourceBinId) {
      const cur = srcBin?.quantity ?? 0;
      updateBinQuantity(sourceBinId, adjustDir === "add" ? cur + qty : Math.max(0, cur - qty));
    } else if (selectedType === "BLOCKED" && sourceBinId) {
      updateBinStatus(sourceBinId, "Blocked" as BinStatus);
    } else if (selectedType === "DAMAGED" && sourceBinId) {
      updateBinStatus(sourceBinId, "Damaged" as BinStatus);
    } else if (selectedType === "RETURNED" && destBinId) {
      assignSkuToBin(destBinId, skuCode, skuName, qty, batchNumber || undefined);
    } else if (selectedType === "WH_TRANSFER" && sourceBinId) {
      clearBin(sourceBinId);
    }

    // Log transaction
    createTransaction({
      type: selectedType,
      status: "COMPLETED",
      skuCode,
      skuName,
      quantity: qty,
      uom,
      sourceWarehouse: activeWarehouseName,
      sourceBinId: sourceBinId || null,
      sourceBinCode: srcBin?.binCode ?? null,
      sourceZone: srcBin?.zoneName ?? null,
      destWarehouse: selectedType === "WH_TRANSFER" ? destWarehouse : activeWarehouseName,
      destBinId: destBinId || null,
      destBinCode: dstBin?.binCode ?? null,
      destZone: dstBin?.zoneName ?? null,
      userId: session.user.id,
      userName: session.user.name,
      referenceDoc: referenceDoc || null,
      batchNumber: batchNumber || null,
      lotNumber: null,
      notes: notes || null,
      prevQuantitySource: srcBin?.quantity ?? null,
      newQuantitySource: selectedType === "WH_TRANSFER" ? 0 : null,
      prevQuantityDest: dstBin?.quantity ?? null,
      newQuantityDest: selectedType !== "WH_TRANSFER" && dstBin ? (dstBin.quantity + qty) : null,
      prevStatusSource: srcBin?.status ?? null,
      newStatusSource: selectedType === "BLOCKED" ? "Blocked" : selectedType === "DAMAGED" ? "Damaged" : srcBin?.status ?? null,
    });

    setIsSubmitting(false);
    setStep("done");
  };

  if (!open) return null;

  const typeMeta = selectedType ? TXN_TYPE_META[selectedType] : null;
  const needsSrcBin = selectedType && ["MOVED", "RACK_TRANSFER", "ADJUSTMENT", "BLOCKED", "DAMAGED", "WH_TRANSFER"].includes(selectedType);
  const needsDstBin = selectedType && ["RECEIVED", "MOVED", "RACK_TRANSFER", "RETURNED"].includes(selectedType);
  const needsSku = selectedType && ["RECEIVED", "MOVED", "RACK_TRANSFER", "WH_TRANSFER", "RETURNED"].includes(selectedType);
  const isValid = (() => {
    if (!selectedType || !quantity || parseInt(quantity) <= 0) return false;
    if (needsSrcBin && !sourceBinId) return false;
    if (needsDstBin && !destBinId) return false;
    if (needsSku && !skuCode) return false;
    if (selectedType === "WH_TRANSFER" && !destWarehouse) return false;
    return true;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-sidebar">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide">New Transaction</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {step === "type" ? "SELECT TYPE" : step === "form" ? (typeMeta?.label.toUpperCase() ?? "") : step === "confirm" ? "PROCESSING…" : "COMPLETE"}
              </div>
            </div>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">

          {/* Step 1: Type Selection */}
          {step === "type" && (
            <div className="grid grid-cols-2 gap-2">
              {TRANSACTION_TYPES.map(({ type, icon: Icon, description }) => {
                const meta = TXN_TYPE_META[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleTypeSelect(type)}
                    className={`text-left p-3.5 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${meta.bg} ${meta.border} hover:border-opacity-60`}
                  >
                    <div className={`flex items-center gap-2 mb-1.5 ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">{meta.label}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{description}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Form */}
          {step === "form" && selectedType && (
            <div className="space-y-4">
              {/* Type badge */}
              {typeMeta && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${typeMeta.color} ${typeMeta.bg} ${typeMeta.border}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${typeMeta.dot}`} />
                  {typeMeta.label}
                </div>
              )}

              {/* Source bin */}
              {needsSrcBin && (
                <BinSelect
                  label="Source Bin"
                  value={sourceBinId}
                  onChange={handleSourceBinChange}
                  bins={bins}
                  placeholder="Select source bin…"
                />
              )}

              {/* Destination bin */}
              {needsDstBin && (
                <BinSelect
                  label={selectedType === "RECEIVED" ? "Destination Bin" : "Destination Bin"}
                  value={destBinId}
                  onChange={setDestBinId}
                  bins={bins.filter((b) => b.binId !== sourceBinId)}
                  placeholder="Select destination bin…"
                />
              )}

              {/* Dest warehouse (for WH transfer) */}
              {selectedType === "WH_TRANSFER" && (
                <div>
                  <FieldLabel>Destination Warehouse</FieldLabel>
                  <Input
                    value={destWarehouse}
                    onChange={setDestWarehouse}
                    placeholder="e.g. TRILO-DC-02"
                  />
                </div>
              )}

              {/* SKU fields */}
              {needsSku && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>SKU Code</FieldLabel>
                    <Input value={skuCode} onChange={setSkuCode} placeholder="SKU-10000" />
                  </div>
                  <div>
                    <FieldLabel>SKU Name</FieldLabel>
                    <Input value={skuName} onChange={setSkuName} placeholder="Item description" />
                  </div>
                </div>
              )}

              {/* For adjustment: source bin already selected, show qty direction */}
              {selectedType === "ADJUSTMENT" && sourceBinId && (
                <div>
                  <FieldLabel>Adjustment Direction</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {(["add", "remove"] as const).map((dir) => (
                      <button
                        key={dir}
                        onClick={() => setAdjustDir(dir)}
                        className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                          adjustDir === dir
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary border-border/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {dir === "add" ? "+ Add Stock" : "− Remove Stock"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity + UOM */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FieldLabel>Quantity</FieldLabel>
                  <Input value={quantity} onChange={setQuantity} type="number" placeholder="0" />
                </div>
                <div>
                  <FieldLabel>UOM</FieldLabel>
                  <Select value={uom} onChange={setUom}>
                    <option value="EA">EA</option>
                    <option value="KG">KG</option>
                    <option value="PLT">PLT</option>
                    <option value="BOX">BOX</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                  </Select>
                </div>
              </div>

              {/* Batch + Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Batch Number</FieldLabel>
                  <Input value={batchNumber} onChange={setBatchNumber} placeholder="BATCH-202501-0001" />
                </div>
                <div>
                  <FieldLabel>Reference Doc</FieldLabel>
                  <Input value={referenceDoc} onChange={setReferenceDoc} placeholder="PO-12345" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    selectedType === "DAMAGED" ? "Describe damage…" :
                    selectedType === "BLOCKED" ? "Reason for blocking…" :
                    selectedType === "ADJUSTMENT" ? "Reason for adjustment…" :
                    "Optional notes…"
                  }
                  rows={2}
                  className="w-full bg-secondary border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60 transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === "confirm" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold">Processing Transaction</div>
                <div className="text-xs text-muted-foreground mt-1">Updating inventory & writing to log…</div>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-emerald-400">Transaction Complete</div>
                <div className="text-xs text-muted-foreground mt-1">Inventory updated. Log entry written.</div>
              </div>
              <button
                onClick={() => { reset(); }}
                className="mt-2 px-4 py-2 text-xs font-bold bg-primary/10 border border-primary/30 text-primary rounded-lg hover:bg-primary/20 transition-colors"
              >
                New Transaction
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === "type" || step === "form") && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-sidebar">
            <button
              onClick={step === "type" ? handleClose : () => setStep("type")}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              {step === "type" ? "Cancel" : "← Back"}
            </button>
            {step === "form" && (
              <button
                onClick={handleSubmit}
                disabled={!isValid}
                className="px-5 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-md"
              >
                Execute Transaction →
              </button>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="flex justify-end px-6 py-4 border-t border-border/50 bg-sidebar">
            <button
              onClick={handleClose}
              className="px-5 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
