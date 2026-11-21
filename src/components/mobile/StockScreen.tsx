/** Mobile · Stock — look up any SKU or bin: on hand, reserved, where it sits (FIFO order), and a quick cycle count. */
import { useMemo, useState } from "react";
import { useStockStore, fifoBins, type StockRecord } from "@/lib/stock-store";
import { Card, Chip, BigButton, Sheet, Field, Row, Empty, SearchBox } from "./ui";

export function StockScreen({ canCount = true }: { canCount?: boolean }) {
  const stock = useStockStore((s) => s.stock);
  const [q, setQ] = useState("");
  const [openSku, setOpenSku] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.values(stock)
      .filter((r) => !needle || r.skuCode.toLowerCase().includes(needle) || r.skuName.toLowerCase().includes(needle) || Object.keys(r.bins).some((b) => b.toLowerCase().includes(needle)))
      .sort((a, b) => a.skuCode.localeCompare(b.skuCode));
  }, [stock, q]);
  const total = list.reduce((s, r) => s + r.onHand, 0);

  return (
    <div className="p-3 space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search SKU, name or bin" />
      <div className="text-xs text-muted-foreground px-1">{list.length} items · {total.toLocaleString()} units on hand</div>
      {list.length === 0 && <Empty title="No stock found" hint="Try another SKU or bin." />}
      {list.map((r) => {
        const avail = Math.max(0, r.onHand - r.reserved);
        return (
          <Card key={r.skuCode} onClick={() => setOpenSku(r.skuCode)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-sm font-bold text-primary">{r.skuCode}</div>
                <div className="text-sm truncate">{r.skuName}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold font-mono">{r.onHand}</div>
                <div className="text-[11px] text-muted-foreground">on hand</div>
              </div>
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              <Chip tone={avail > 0 ? "success" : "danger"}>{avail} available</Chip>
              {r.reserved > 0 && <Chip tone="warning">{r.reserved} reserved</Chip>}
              <Chip>{Object.values(r.bins).filter((q) => q > 0).length} bins</Chip>
            </div>
          </Card>
        );
      })}
      <SkuSheet sku={openSku} onClose={() => setOpenSku(null)} canCount={canCount} />
    </div>
  );
}

function SkuSheet({ sku, onClose, canCount }: { sku: string | null; onClose: () => void; canCount: boolean }) {
  const rec: StockRecord | undefined = useStockStore((s) => (sku ? s.stock[sku] : undefined));
  const applyCount = useStockStore((s) => s.applyCount);
  const [bin, setBin] = useState<string | null>(null);
  const [counted, setCounted] = useState("");
  const order = fifoBins(rec);

  return (
    <Sheet open={!!rec} onClose={() => { setBin(null); setCounted(""); onClose(); }} title={rec ? rec.skuCode : ""}>
      {rec && (
        <>
          <div className="text-sm">{rec.skuName}</div>
          <div className="rounded-xl border border-border bg-card/40 px-3 py-1">
            <Row label="On hand" value={rec.onHand} />
            <Row label="Reserved" value={rec.reserved} />
            <Row label="Available" value={Math.max(0, rec.onHand - rec.reserved)} />
          </div>
          <div className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">Bins · oldest first (FIFO)</div>
          {order.length === 0 && <Empty title="No bin stock" />}
          {order.map((b, i) => (
            <div key={b} className="rounded-xl border border-border bg-card/40 p-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm font-bold">{b}{i === 0 && <span className="ml-2 text-[11px] text-emerald-400 font-semibold">PICK FIRST</span>}</div>
                <div className="font-mono font-bold">{rec.bins[b]}</div>
              </div>
              {canCount && bin !== b && <button type="button" className="mt-2 text-sm text-primary font-semibold" onClick={() => { setBin(b); setCounted(String(rec.bins[b])); }}>Cycle count</button>}
              {canCount && bin === b && (
                <div className="mt-2 space-y-2">
                  <Field label="Counted quantity" value={counted} onChange={setCounted} inputMode="numeric" />
                  <div className="grid grid-cols-2 gap-2">
                    <BigButton tone="ghost" onClick={() => setBin(null)}>Cancel</BigButton>
                    <BigButton tone="success" disabled={counted === "" || isNaN(parseInt(counted))} onClick={() => { applyCount(rec.skuCode, parseInt(counted), "Mobile cycle count", b); setBin(null); }}>Save count</BigButton>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
