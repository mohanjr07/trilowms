/**
 * TriloWMS — PTL Calling (Pick Flow Bridge integration)
 *
 * PTL calling (releasing a bulk order + barcode so the headless engine
 * dispatches it to physical pick-to-light hardware) and receiving (pick
 * feedback, stock movement, reports the engine wrote after a real
 * controller interrupt) all happen here, inside TriloWMS. There's no
 * separate Pick Flow desktop app to open — the TCP engine that talks to the
 * TW2273 controllers runs invisibly inside the Bridge process; TriloWMS is
 * the only screen. TriloWMS has no backend of its own, so every action
 * below is a direct browser call to the Bridge's JSON API — see
 * src/lib/ptl-api.ts.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Radio, RefreshCw, Plug, PlugZap, Send, Ban, RotateCcw, Trash2, ScanLine,
  MapPin, Boxes, BarChart3, ScrollText, Settings2, AlertTriangle, CheckCircle2, Loader2, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { usePTLStore } from "@/lib/ptl-store";
import { ptlApi } from "@/lib/ptl-api";
import { cn } from "@/lib/utils";

const STATUS_CLS: Record<string, string> = {
  WAITING_COLOR: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  WAITING: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  READY: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  ACTIVE: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  COMPLETE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  CANCELLED: "text-red-400 bg-red-500/10 border-red-500/30",
};
function StatusPill({ s }: { s: string }) {
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide border", STATUS_CLS[s] || "text-slate-400 bg-slate-500/10 border-slate-500/30")}>{s}</span>;
}

function ConnectionBar() {
  const { conn, setConn, connected, checking, lastError, testConnection, refreshAll, loading } = usePTLStore();
  const [showSettings, setShowSettings] = useState(!conn.baseUrl);

  return (
    <div className="px-6 py-3 border-b panel space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {connected === null ? (
            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
          ) : connected ? (
            <PlugZap className="h-3.5 w-3.5 text-success" />
          ) : (
            <Plug className="h-3.5 w-3.5 text-destructive" />
          )}
          {connected === null ? "Not connected" : connected ? "Bridge connected" : "Bridge unreachable"}
        </div>
        {conn.baseUrl && <span className="text-[11px] text-muted-foreground text-mono">{conn.baseUrl}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Bridge Settings
          </Button>
          <Button size="sm" variant="outline" onClick={testConnection} disabled={checking}>
            {checking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Test
          </Button>
          <Button size="sm" onClick={refreshAll} disabled={loading || !conn.baseUrl}>
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Sync now
          </Button>
        </div>
      </div>
      {showSettings && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-border/50">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold tracking-wider text-muted-foreground">BRIDGE URL</label>
            <Input placeholder="https://192.168.1.50:8443" value={conn.baseUrl} onChange={(e) => setConn({ baseUrl: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-bold tracking-wider text-muted-foreground">USERNAME</label>
            <Input value={conn.username} onChange={(e) => setConn({ username: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-bold tracking-wider text-muted-foreground">PASSWORD</label>
            <Input type="password" value={conn.password} onChange={(e) => setConn({ password: e.target.value })} />
          </div>
        </div>
      )}
      {lastError && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3" /> {lastError}
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const { orders, releaseOrder, cancelOrder, requeueOrder, deleteOrder, createOrders, conn } = usePTLStore();
  const [bulkText, setBulkText] = useState("ORD-1001,SKU001,A001,5\nORD-1001,SKU002,A002,3\nORD-1002,SKU005,A005,10");
  const [busy, setBusy] = useState<string | null>(null);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of orders) c[o.order.status] = (c[o.order.status] || 0) + 1;
    return c;
  }, [orders]);

  const act = async (fn: () => Promise<void>, key: string) => {
    setBusy(key);
    try { await fn(); } catch (e) { alert((e as Error).message); }
    setBusy(null);
  };

  const handleCreate = async () => {
    setCreateMsg(null);
    try {
      const r = await createOrders(bulkText);
      setCreateMsg(`Created: ${r.created.join(", ")}`);
    } catch (e) {
      setCreateMsg((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(["WAITING_COLOR", "READY", "ACTIVE", "COMPLETE", "CANCELLED"] as const).map((s) => (
          <KPICard key={s} label={s.replace("_", " ")} value={counts[s] || 0} tone={s === "COMPLETE" ? "success" : s === "CANCELLED" ? "destructive" : s === "ACTIVE" ? "warning" : "primary"} />
        ))}
      </div>

      <div className="panel rounded-md p-4 space-y-2">
        <div className="text-xs font-bold tracking-wider text-muted-foreground">BULK ORDER ENTRY — 2 to 30 PTLs per order</div>
        <Textarea rows={5} className="font-mono text-xs" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleCreate}><Send className="h-3.5 w-3.5 mr-1.5" /> Create Orders</Button>
          <span className="text-[11px] text-muted-foreground">Format: ORDER_NO,SKU,PTL,QTY — no PTL selection, one short barcode releases the whole order.</span>
        </div>
        {createMsg && <div className="text-[11px] text-info">{createMsg}</div>}
      </div>

      <div className="panel rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Order</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Picker</th>
              <th className="text-left px-3 py-2">Barcode</th>
              <th className="text-left px-3 py-2">Lines</th>
              <th className="text-left px-3 py-2">Released</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(({ order: o, lines }) => (
              <tr key={o.id} className="border-t border-border/40">
                <td className="px-3 py-2 font-semibold">{o.order_no}</td>
                <td className="px-3 py-2"><StatusPill s={o.status} /></td>
                <td className="px-3 py-2">{o.picker ? `${o.picker} / ${o.color}` : "—"}</td>
                <td className="px-3 py-2">
                  {o.barcode ? (
                    <div className="flex items-center gap-2">
                      <img src={ptlApi.barcodeImageUrl(conn, o.barcode)} alt={o.barcode} className="h-8 bg-white rounded px-1" />
                      <span className="text-mono">{o.barcode}</span>
                    </div>
                  ) : "waiting color"}
                </td>
                <td className="px-3 py-2">{lines.length} ({lines.reduce((s, l) => s + l.picked_qty, 0)}/{lines.reduce((s, l) => s + l.requested_qty, 0)} picked)</td>
                <td className="px-3 py-2">{o.released_at || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1.5">
                    {(o.status === "READY" || o.status === "WAITING") && (
                      <Button size="sm" variant="outline" disabled={busy === o.order_no} onClick={() => act(() => releaseOrder(o.order_no), o.order_no)}>
                        <Send className="h-3 w-3 mr-1" /> Release
                      </Button>
                    )}
                    {o.status === "ACTIVE" && (
                      <Button size="sm" variant="outline" disabled={busy === o.order_no} onClick={() => act(() => requeueOrder(o.order_no), o.order_no)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Requeue
                      </Button>
                    )}
                    {o.status !== "COMPLETE" && o.status !== "CANCELLED" && (
                      <Button size="sm" variant="outline" className="text-destructive" disabled={busy === o.order_no} onClick={() => act(() => cancelOrder(o.order_no), o.order_no)}>
                        <Ban className="h-3 w-3 mr-1" /> Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive" disabled={busy === o.order_no} onClick={() => { if (confirm(`Delete ${o.order_no}?`)) act(() => deleteOrder(o.order_no), o.order_no); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No orders yet. Create some above, or Sync now if the Bridge already has data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScannerTab() {
  const { scanBarcode } = usePTLStore();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const go = async () => {
    setResult(null);
    try {
      const r = await scanBarcode(code.trim());
      setResult(`Released ${r.order_no}`);
      setCode("");
    } catch (e) {
      setResult((e as Error).message);
    }
  };

  return (
    <div className="panel rounded-md p-6 max-w-md space-y-3">
      <div className="text-xs font-bold tracking-wider text-muted-foreground">MANUAL / SCANNER RELEASE</div>
      <p className="text-[11px] text-muted-foreground">
        Scan or type the order's short barcode (PF + 6 characters) to release the complete order to Pick Flow in one action —
        this is the same call a phone camera scan makes.
      </p>
      <Input placeholder="PFXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && go()} autoFocus />
      <Button onClick={go} disabled={!code.trim()}><ScanLine className="h-3.5 w-3.5 mr-1.5" /> Scan / Release</Button>
      {result && <div className="text-xs">{result}</div>}
      <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
        A camera-based scanner needs HTTPS + camera permission on the device; use the Bridge's own /mobile page on a phone
        for that, or type/paste the code here from any device.
      </p>
    </div>
  );
}

function MapTab() {
  const { map, saveMapEntry, deleteMapEntry } = usePTLStore();
  const [form, setForm] = useState({ logical_ptl: "", controller: "CTRL-01", physical_address: "", model: "", active: 1 });
  const save = async () => {
    if (!form.logical_ptl || !form.controller || !form.physical_address) return;
    await saveMapEntry(form);
    setForm({ logical_ptl: "", controller: "CTRL-01", physical_address: "", model: "", active: 1 });
  };
  return (
    <div className="space-y-4">
      <div className="panel rounded-md p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <div><label className="text-[10px] font-bold text-muted-foreground">LOGICAL PTL</label><Input value={form.logical_ptl} onChange={(e) => setForm({ ...form, logical_ptl: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-muted-foreground">CONTROLLER</label><Input value={form.controller} onChange={(e) => setForm({ ...form, controller: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-muted-foreground">PHYSICAL ADDR</label><Input value={form.physical_address} onChange={(e) => setForm({ ...form, physical_address: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-muted-foreground">MODEL</label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
        <Button onClick={save}><MapPin className="h-3.5 w-3.5 mr-1.5" /> Save Mapping</Button>
      </div>
      <div className="panel rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-3 py-2">Logical</th><th className="text-left px-3 py-2">Controller</th><th className="text-left px-3 py-2">Physical</th><th className="text-left px-3 py-2">Model</th><th className="text-left px-3 py-2">Active</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {map.map((m) => (
              <tr key={m.logical_ptl} className="border-t border-border/40">
                <td className="px-3 py-2 font-semibold">{m.logical_ptl}</td>
                <td className="px-3 py-2">{m.controller}</td>
                <td className="px-3 py-2 text-mono">{m.physical_address}</td>
                <td className="px-3 py-2">{m.model}</td>
                <td className="px-3 py-2">{m.active ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteMapEntry(m.logical_ptl)}><Trash2 className="h-3 w-3" /></Button></td>
              </tr>
            ))}
            {map.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No PTL mappings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ControllersTab() {
  const { controllers, saveController, deleteController } = usePTLStore();
  const [form, setForm] = useState({ controller_id: "CTRL-01", ip: "", port: "5003", active: 1 });
  const save = async () => {
    if (!form.controller_id || !form.ip) return;
    await saveController({ controller_id: form.controller_id, ip: form.ip, port: parseInt(form.port, 10) || 5003, active: form.active });
    setForm({ controller_id: "CTRL-01", ip: "", port: "5003", active: 1 });
  };
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground max-w-2xl">
        The IP:port of each physical TW2273 controller. The engine inside the Bridge opens a TCP connection to each one
        below and dispatches PTL calls there directly — this replaces Pick Flow's old Communication tab.
      </p>
      <div className="panel rounded-md p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div><label className="text-[10px] font-bold text-muted-foreground">CONTROLLER ID</label><Input value={form.controller_id} onChange={(e) => setForm({ ...form, controller_id: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-muted-foreground">IP ADDRESS</label><Input placeholder="192.168.1.100" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-muted-foreground">TCP PORT</label><Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /></div>
        <Button onClick={save}><Cpu className="h-3.5 w-3.5 mr-1.5" /> Save Controller</Button>
      </div>
      <div className="panel rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-3 py-2">Controller</th><th className="text-left px-3 py-2">IP</th><th className="text-left px-3 py-2">Port</th><th className="text-left px-3 py-2">Active</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {controllers.map((c) => (
              <tr key={c.controller_id} className="border-t border-border/40">
                <td className="px-3 py-2 font-semibold">{c.controller_id}</td>
                <td className="px-3 py-2 text-mono">{c.ip}</td>
                <td className="px-3 py-2">{c.port}</td>
                <td className="px-3 py-2">{c.active ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteController(c.controller_id)}><Trash2 className="h-3 w-3" /></Button></td>
              </tr>
            ))}
            {controllers.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No controllers configured yet — PTL calls have nowhere to dispatch until one is added.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockTab() {
  const { skuMaster, stockMoves, stockMove } = usePTLStore();
  const [form, setForm] = useState({ sku: "", description: "", qty: "1", move_type: "RECEIPT" as "RECEIPT" | "ADJUSTMENT_OUT", reference: "", min_stock: "0" });
  const save = async () => {
    const qty = parseInt(form.qty, 10);
    if (!form.sku || !qty) return;
    await stockMove({ sku: form.sku, qty, move_type: form.move_type, reference: form.reference, description: form.description, min_stock: parseInt(form.min_stock, 10) || 0 });
    setForm({ sku: "", description: "", qty: "1", move_type: "RECEIPT", reference: "", min_stock: "0" });
  };
  return (
    <div className="space-y-4">
      <div className="panel rounded-md p-4 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
        <div><label className="text-[10px] font-bold text-muted-foreground">SKU</label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-muted-foreground">DESCRIPTION</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-muted-foreground">QTY</label><Input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground">TYPE</label>
          <select className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm" value={form.move_type} onChange={(e) => setForm({ ...form, move_type: e.target.value as "RECEIPT" | "ADJUSTMENT_OUT" })}>
            <option value="RECEIPT">RECEIPT</option>
            <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT</option>
          </select>
        </div>
        <div><label className="text-[10px] font-bold text-muted-foreground">REFERENCE</label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
        <Button onClick={save}><Boxes className="h-3.5 w-3.5 mr-1.5" /> Save Stock</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel rounded-md overflow-hidden">
          <div className="px-3 py-2 text-xs font-bold tracking-wider text-muted-foreground border-b border-border/40">SKU MASTER</div>
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left px-3 py-2">SKU</th><th className="text-left px-3 py-2">Stock</th><th className="text-left px-3 py-2">Min</th><th className="text-left px-3 py-2">Status</th></tr></thead>
            <tbody>
              {skuMaster.map((s) => (
                <tr key={s.sku} className="border-t border-border/40">
                  <td className="px-3 py-2 font-semibold">{s.sku}</td>
                  <td className="px-3 py-2">{s.stock_qty}</td>
                  <td className="px-3 py-2">{s.min_stock}</td>
                  <td className="px-3 py-2">{s.stock_qty <= s.min_stock ? <span className="text-destructive">LOW</span> : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel rounded-md overflow-hidden">
          <div className="px-3 py-2 text-xs font-bold tracking-wider text-muted-foreground border-b border-border/40">STOCK MOVEMENT</div>
          <table className="w-full text-xs">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left px-3 py-2">Time</th><th className="text-left px-3 py-2">SKU</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Qty</th></tr></thead>
            <tbody>
              {stockMoves.map((m, i) => (
                <tr key={i} className="border-t border-border/40">
                  <td className="px-3 py-2 text-muted-foreground">{m.time}</td>
                  <td className="px-3 py-2 font-semibold">{m.sku}</td>
                  <td className="px-3 py-2">{m.move_type}</td>
                  <td className="px-3 py-2">{m.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  const { report } = usePTLStore();
  return (
    <div className="panel rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr><th className="text-left px-3 py-2">Order</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Sent</th><th className="text-left px-3 py-2">Picked</th><th className="text-left px-3 py-2">Picker</th><th className="text-left px-3 py-2">Duration</th></tr>
        </thead>
        <tbody>
          {report.map((r) => (
            <tr key={r.order_no} className="border-t border-border/40">
              <td className="px-3 py-2 font-semibold">{r.order_no}</td>
              <td className="px-3 py-2"><StatusPill s={r.status} /></td>
              <td className="px-3 py-2">{r.sent}</td>
              <td className="px-3 py-2">{r.picked}</td>
              <td className="px-3 py-2">{r.picker || "—"}</td>
              <td className="px-3 py-2">{r.total_seconds ? `${Math.round(r.total_seconds / 60)}m` : "—"}</td>
            </tr>
          ))}
          {report.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No report data yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function LogsTab() {
  const { logs } = usePTLStore();
  return (
    <div className="panel rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left px-3 py-2">Time</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Detail</th></tr></thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i} className="border-t border-border/40">
              <td className="px-3 py-2 text-muted-foreground">{l.time}</td>
              <td className="px-3 py-2 font-semibold">{l.type}</td>
              <td className="px-3 py-2">{l.detail}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">No events logged yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function PTLPage() {
  const { conn, testConnection, refreshAll, connected } = usePTLStore();

  useEffect(() => {
    if (conn.baseUrl) {
      testConnection().then((ok) => { if (ok) refreshAll(); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Light polling for "receiving" — pick-feedback Pick Flow posts to the
  // Bridge shows up here without the user manually hitting Sync every time.
  useEffect(() => {
    if (!conn.baseUrl || !connected) return;
    const id = setInterval(() => refreshAll(), 15000);
    return () => clearInterval(id);
  }, [conn.baseUrl, connected]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="PTL Calling"
        subtitle="Pick Flow Bridge integration — order release, PTL mapping, stock feedback, reports and logs, all inside TriloWMS"
        icon={Radio}
        actions={connected ? <span className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Live</span> : undefined}
      />
      <ConnectionBar />
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="scanner">Scanner</TabsTrigger>
            <TabsTrigger value="map">PTL Map</TabsTrigger>
            <TabsTrigger value="controllers">Controllers</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-4"><OrdersTab /></TabsContent>
          <TabsContent value="scanner" className="mt-4"><ScannerTab /></TabsContent>
          <TabsContent value="map" className="mt-4"><MapTab /></TabsContent>
          <TabsContent value="controllers" className="mt-4"><ControllersTab /></TabsContent>
          <TabsContent value="stock" className="mt-4"><StockTab /></TabsContent>
          <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
          <TabsContent value="logs" className="mt-4"><LogsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
