import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { type SKU, useSkuStore } from "@/lib/sku-store";

interface Props {
  open: boolean;
  sku: SKU | null;
  onClose: () => void;
}

export function SkuDeleteModal({ open, sku, onClose }: Props) {
  const { deleteSku } = useSkuStore();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState("");

  if (!open || !sku) return null;

  async function handleDelete() {
    if (confirm.toUpperCase() !== sku!.skuCode) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    deleteSku(sku!.id);
    setLoading(false);
    setConfirm("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-destructive/40 overflow-hidden"
        style={{ background: "var(--card)" }}
      >
        <div className="p-5 border-b border-destructive/30 bg-destructive/10 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center">
            <Trash2 className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <div className="font-bold text-sm text-destructive">Delete SKU</div>
            <div className="text-xs text-muted-foreground">This action cannot be undone</div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded border border-warning/30 bg-warning/5 flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Deleting <strong>{sku.skuCode}</strong> — <em>{sku.itemName}</em> — will permanently
              remove all master data. Existing inventory transactions will remain in the audit log.
            </span>
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase block mb-1">
              Type <span className="text-destructive">{sku.skuCode}</span> to confirm
            </label>
            <input
              className="w-full px-3 py-1.5 text-xs bg-input border border-destructive/40 rounded focus:outline-none focus:ring-1 focus:ring-destructive/60 text-mono"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={sku.skuCode}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-panel">
          <button
            onClick={() => { setConfirm(""); onClose(); }}
            className="px-4 py-1.5 rounded border border-border text-xs hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirm.toUpperCase() !== sku.skuCode || loading}
            className="px-4 py-1.5 rounded bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {loading ? "Deleting..." : "Delete SKU"}
          </button>
        </div>
      </div>
    </div>
  );
}
