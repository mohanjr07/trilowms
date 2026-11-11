/**
 * TriloWMS — Bulk stock upload from Excel / CSV.
 *
 * Opening balances, a supplier delivery too big to key in line by line, or a
 * full re-count: drop in a spreadsheet, review every row (errors are shown
 * before anything is written), then import. Nothing touches the stock ledger
 * until the user presses Import, and rows with errors are skipped, not guessed.
 *
 * Columns (header names are case-insensitive, extra columns are ignored):
 *   SKU Code*  | Item Name | Quantity* | Bin Code
 */
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useStockStore } from "@/lib/stock-store";
import { useSkuStore } from "@/lib/sku-store";
import { cn } from "@/lib/utils";

type Mode = "add" | "set";

interface ParsedRow {
  line: number; // spreadsheet row number (header = 1)
  skuCode: string;
  skuName: string;
  qty: number;
  binCode: string | null;
  errors: string[];
  warnings: string[];
}

const HEADER_ALIASES: Record<string, "sku" | "name" | "qty" | "bin"> = {
  "sku": "sku", "sku code": "sku", "skucode": "sku", "item code": "sku", "code": "sku",
  "item name": "name", "name": "name", "description": "name", "sku name": "name",
  "quantity": "qty", "qty": "qty", "on hand": "qty", "onhand": "qty", "stock": "qty",
  "bin": "bin", "bin code": "bin", "bincode": "bin", "location": "bin",
};

function downloadTemplate(sampleSkus: { code: string; name: string }[]) {
  const rows = [
    ["SKU Code", "Item Name", "Quantity", "Bin Code"],
    ...(sampleSkus.length
      ? sampleSkus.map((s, i) => [s.code, s.name, 100 + i * 50, `A-01-R-0${i + 1}-L1-P1`])
      : [["SKU-10000", "Aluminum Extrusion Bracket 40x40", 100, "A-01-R-01-L1-P1"]]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 16 }, { wch: 40 }, { wch: 12 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stock");
  XLSX.writeFile(wb, "trilowms-stock-upload-template.xlsx");
}

export function BulkStockUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const skus = useSkuStore((s) => s.skus);
  const addStock = useStockStore((s) => s.addStock);
  const applyCount = useStockStore((s) => s.applyCount);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mode, setMode] = useState<Mode>("add");
  const [parseError, setParseError] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);

  const skuMap = useMemo(() => new Map(skus.map((s) => [s.skuCode.toUpperCase(), s])), [skus]);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setDone(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const close = () => { reset(); onClose(); };

  const parseFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("The file has no sheets.");
      const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
      if (raw.length < 2) throw new Error("No data rows found. Row 1 must be the header, data starts on row 2.");

      const colIdx: Partial<Record<"sku" | "name" | "qty" | "bin", number>> = {};
      (raw[0] as unknown[]).forEach((h, i) => {
        const key = HEADER_ALIASES[String(h).trim().toLowerCase()];
        if (key && colIdx[key] === undefined) colIdx[key] = i;
      });
      if (colIdx.sku === undefined || colIdx.qty === undefined) {
        throw new Error('Could not find the required "SKU Code" and "Quantity" columns in row 1.');
      }

      const seen = new Map<string, number>();
      const parsed: ParsedRow[] = raw.slice(1).map((r, i) => {
        const cells = r as unknown[];
        const skuCode = String(cells[colIdx.sku!] ?? "").trim();
        const qtyRaw = cells[colIdx.qty!];
        const qty = typeof qtyRaw === "number" ? qtyRaw : Number(String(qtyRaw).replace(/,/g, "").trim());
        const sheetName = colIdx.name !== undefined ? String(cells[colIdx.name] ?? "").trim() : "";
        const binCode = colIdx.bin !== undefined ? String(cells[colIdx.bin] ?? "").trim() || null : null;
        const known = skuMap.get(skuCode.toUpperCase());
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!skuCode) errors.push("SKU code is empty");
        if (qtyRaw === "" || Number.isNaN(qty)) errors.push("Quantity is not a number");
        else if (qty < 0) errors.push("Quantity cannot be negative");
        else if (!Number.isInteger(qty)) errors.push("Quantity must be a whole number");
        else if (qty === 0 && mode === "add") warnings.push("Quantity is 0, nothing will be added");
        if (skuCode && !known) warnings.push("SKU not in SKU Master, it will still be stocked");
        if (skuCode && seen.has(skuCode.toUpperCase() + "|" + (binCode ?? ""))) {
          warnings.push(`Same SKU and bin as row ${seen.get(skuCode.toUpperCase() + "|" + (binCode ?? ""))}`);
        } else if (skuCode) {
          seen.set(skuCode.toUpperCase() + "|" + (binCode ?? ""), i + 2);
        }

        return {
          line: i + 2,
          skuCode: known?.skuCode ?? skuCode,
          skuName: known?.itemName ?? (sheetName || skuCode),
          qty: Number.isFinite(qty) ? qty : 0,
          binCode,
          errors,
          warnings,
        };
      });
      setRows(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not read this file.");
    }
  };

  const valid = rows.filter((r) => r.errors.length === 0 && !(mode === "add" && r.qty === 0));
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  const doImport = () => {
    if (mode === "add") {
      valid.forEach((r) => addStock(r.skuCode, r.skuName, r.qty, r.binCode));
    } else {
      // Set mode: the sheet is the count. Several rows for one SKU add up
      // (one per bin), and the SKU total becomes exactly that sum.
      const totals = new Map<string, { name: string; qty: number; bin: string | null }>();
      valid.forEach((r) => {
        const t = totals.get(r.skuCode);
        totals.set(r.skuCode, { name: r.skuName, qty: (t?.qty ?? 0) + r.qty, bin: t?.bin ?? r.binCode });
      });
      totals.forEach((t, code) => {
        const existing = useStockStore.getState().stock[code];
        if (!existing) addStock(code, t.name, t.qty, t.bin);
        if (existing || t.qty === 0) applyCount(code, t.qty, "Bulk upload (set quantity)", t.bin, "Bulk Upload");
      });
    }
    setDone({ imported: valid.length, skipped: rows.length - valid.length });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> Bulk stock upload</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <div className="text-sm font-semibold">{done.imported} rows imported{done.skipped > 0 ? `, ${done.skipped} skipped` : ""}.</div>
            <div className="text-xs text-muted-foreground">Stock Levels, Orders allocation and the Dashboard now reflect the new quantities.</div>
            <Button size="sm" onClick={close}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadTemplate(skus.slice(0, 3).map((s) => ({ code: s.skuCode, name: s.itemName })))}>
                <Download className="h-3.5 w-3.5" /> Download template
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> {fileName ? "Choose another file" : "Choose Excel / CSV file"}
              </Button>
              <input id="bulk-stock-file" ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void parseFile(f); }} />
              {fileName && <span className="text-xs text-muted-foreground font-mono truncate">{fileName}</span>}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">How to apply quantities:</span>
              {(["add", "set"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn("px-2.5 py-1 rounded border", mode === m ? "border-primary text-foreground bg-primary/10" : "border-border text-muted-foreground")}>
                  {m === "add" ? "Add to existing stock" : "Set as new on-hand (replace)"}
                </button>
              ))}
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <X className="h-4 w-4 shrink-0 mt-0.5" /> {parseError}
              </div>
            )}

            {!fileName && !parseError && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Columns: <span className="font-mono text-foreground">SKU Code</span> and <span className="font-mono text-foreground">Quantity</span> are required;
                {" "}<span className="font-mono text-foreground">Item Name</span> and <span className="font-mono text-foreground">Bin Code</span> are optional.
                Row 1 is the header. Nothing is saved until you review and press Import.
              </p>
            )}

            {rows.length > 0 && (
              <>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-emerald-400 font-semibold">{valid.length} ready</span>
                  {errorCount > 0 && <span className="text-red-400 font-semibold">{errorCount} with errors (will be skipped)</span>}
                  <span className="text-muted-foreground">{rows.length} rows read</span>
                </div>
                <div className="max-h-72 overflow-auto rounded-md border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card text-muted-foreground">
                      <tr className="text-left">
                        <th className="px-3 py-2 w-10">Row</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Bin</th><th className="px-3 py-2">Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.line} className={cn("border-t border-border/40", r.errors.length > 0 && "bg-red-500/5")}>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.line}</td>
                          <td className="px-3 py-1.5 font-mono">{r.skuCode || "—"}</td>
                          <td className="px-3 py-1.5 truncate max-w-[200px]">{r.skuName}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">{r.qty}</td>
                          <td className="px-3 py-1.5 font-mono">{r.binCode ?? "—"}</td>
                          <td className="px-3 py-1.5">
                            {r.errors.length > 0
                              ? <span className="text-red-400">{r.errors.join("; ")}</span>
                              : r.warnings.length > 0
                                ? <span className="text-amber-400 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{r.warnings.join("; ")}</span>
                                : <span className="text-emerald-400">OK</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
              <Button size="sm" disabled={valid.length === 0} onClick={doImport}>
                Import {valid.length > 0 ? `${valid.length} rows` : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
