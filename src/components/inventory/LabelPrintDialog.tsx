/**
 * TriloWMS — barcode label printing.
 *
 * Prints the labels the floor needs for scanning: one per bin (the bin code,
 * so a scan at putaway / picking matches exactly) and one per SKU (SKU code
 * or the EAN from the SKU Master). Barcodes are Code 128, which every scanner
 * reads. The sheet opens in its own window so print layout is not affected by
 * the app, and can be sent to a normal printer or a label printer.
 */
import { useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { useSkuStore } from "@/lib/sku-store";
import { cn } from "@/lib/utils";

type Kind = "bins" | "skus";
type SkuEncode = "sku" | "ean";

interface LabelItem { value: string; title: string; sub: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function barcodeSvg(value: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, { format: "CODE128", width: 2, height: 54, displayValue: false, margin: 0 });
  return svg.outerHTML;
}

function printLabels(items: LabelItem[], heading: string) {
  const w = window.open("", "_blank");
  if (!w) { window.alert("Allow pop-ups for this site to print labels."); return; }
  const labels = items.map((i) => `
    <div class="label">
      <div class="title">${esc(i.title)}</div>
      <div class="bc">${barcodeSvg(i.value)}</div>
      <div class="val">${esc(i.value)}</div>
      <div class="sub">${esc(i.sub)}</div>
    </div>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(heading)}</title>
    <style>
      @page { margin: 8mm; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #000; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
      .label { border: 1px dashed #999; padding: 3mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
      .title { font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bc svg { width: 100%; height: 16mm; margin: 2mm 0 1mm; }
      .val { font-family: "Courier New", monospace; font-size: 14px; font-weight: 700; letter-spacing: .5px; }
      .sub { font-size: 9px; color: #444; margin-top: 1mm; }
    </style></head><body><div class="grid">${labels}</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
}

export function LabelPrintDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("bins");
  const [skuEncode, setSkuEncode] = useState<SkuEncode>("sku");
  const [zone, setZone] = useState("");

  const warehouse = useInvBinStore((s) => s.activeWarehouseName);
  const warehouseBins = useInvBinStore((s) => s.warehouseBins);
  const skus = useSkuStore((s) => s.skus);

  const bins = useMemo(() => (warehouse ? warehouseBins[warehouse] ?? [] : []), [warehouse, warehouseBins]);
  const zones = useMemo(() => Array.from(new Set(bins.map((b) => b.zoneName))), [bins]);

  const items: LabelItem[] = useMemo(() => {
    if (kind === "bins") {
      return bins
        .filter((b) => !zone || b.zoneName === zone)
        .map((b) => ({ value: b.binCode, title: b.zoneName, sub: `Bin location${warehouse ? ` · ${warehouse}` : ""}` }));
    }
    return skus
      .filter((s) => skuEncode === "sku" || !!s.barcode)
      .map((s) => ({ value: skuEncode === "sku" ? s.skuCode : s.barcode, title: s.itemName, sub: skuEncode === "sku" ? "SKU code" : `EAN · ${s.skuCode}` }));
  }, [kind, bins, zone, skus, skuEncode, warehouse]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Tags className="h-4 w-4 text-primary" /> Print barcode labels</DialogTitle></DialogHeader>

        <div className="flex gap-2 text-sm">
          {(["bins", "skus"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={cn("px-3 py-1.5 rounded border", kind === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
              {k === "bins" ? "Bin labels" : "Goods (SKU) labels"}
            </button>
          ))}
        </div>

        {kind === "bins" ? (
          <div className="space-y-2 text-sm">
            {bins.length === 0 ? (
              <p className="text-muted-foreground">No bins yet. Build and save a warehouse layout in Warehouse Builder first, then the bin codes appear here.</p>
            ) : (
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Zone</span>
                <select id="label-zone" value={zone} onChange={(e) => setZone(e.target.value)} className="h-8 rounded border border-border bg-background px-2 text-sm">
                  <option value="">All zones ({bins.length} bins)</option>
                  {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Barcode contains</span>
              {(["sku", "ean"] as const).map((m) => (
                <button key={m} onClick={() => setSkuEncode(m)}
                  className={cn("px-2.5 py-1 rounded border text-xs", skuEncode === m ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}>
                  {m === "sku" ? "SKU code" : "EAN / Barcode field"}
                </button>
              ))}
            </div>
            {skus.length === 0 && <p className="text-muted-foreground">No SKUs yet. Create SKUs in SKU Master first.</p>}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {items.length} label{items.length === 1 ? "" : "s"} will print, 3 across, Code 128. Print once and stick each label on its bin or on the goods.
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" className="gap-1.5" disabled={items.length === 0}
            onClick={() => printLabels(items, kind === "bins" ? "Bin labels" : "SKU labels")}>
            <Printer className="h-3.5 w-3.5" /> Print {items.length} labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
