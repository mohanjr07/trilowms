/**
 * TriloWMS — top bar notification bell.
 *
 * Previously this was a bare <button><Bell/></button> in TopBar.tsx with a
 * hardcoded red dot and no onClick, no dropdown, and nothing behind it —
 * clicking it did nothing because nothing was ever wired up. This pulls
 * real, already-computed KPIs from the existing per-module stores (the same
 * ones the Dashboard's EXCEPTION CENTER and INVENTORY OVERVIEW panels use)
 * plus the PTL Bridge connection state, and renders them as an actual
 * dropdown. No new backend/store — just surfacing numbers that already
 * exist, in one place, as "notifications."
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell, AlertTriangle, ArrowDownToLine, PackageOpen, ShoppingCart,
  PackageSearch, PackageCheck, Truck, Container, ShieldCheck, Boxes,
  Radio, CheckCircle2,
} from "lucide-react";
import { useInboundStore } from "@/lib/inbound-store";
import { usePutawayStore } from "@/lib/putaway-store";
import { usePickingStore } from "@/lib/picking-store";
import { usePackingStore } from "@/lib/packing-store";
import { useOutboundStore } from "@/lib/outbound-store";
import { useYardStore } from "@/lib/yard-store";
import { useQCStore } from "@/lib/qc-store";
import { useOrdersStore } from "@/lib/orders-store";
import { useSkuStore } from "@/lib/sku-store";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { usePTLStore } from "@/lib/ptl-store";
import { cn } from "@/lib/utils";

interface NotificationItem {
  to: string;
  search?: Record<string, string>;
  label: string;
  count: number;
  icon: typeof Bell;
  group: "Inventory" | "Orders" | "PTL / Picking";
  tone?: "warning" | "destructive";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ---- Inventory alerts ----
  const skuKpis = useSkuStore((s) => s.kpis)();
  const binKpis = useInvBinStore((s) => s.kpis)();

  // ---- Order / module exceptions (same source as the Dashboard's
  // EXCEPTION CENTER panel) ----
  const inbound = useInboundStore((s) => s.kpis)();
  const putaway = usePutawayStore((s) => s.kpis)();
  const picking = usePickingStore((s) => s.kpis)();
  const packing = usePackingStore((s) => s.kpis)();
  const outbound = useOutboundStore((s) => s.kpis)();
  const yard = useYardStore((s) => s.kpis)();
  const qc = useQCStore((s) => s.kpis)();
  const orderKpis = useOrdersStore((s) => s.kpis)();

  // ---- PTL / picking ----
  const ptlConnected = usePTLStore((s) => s.connected);
  const ptlLastError = usePTLStore((s) => s.lastError);
  const ptlOrders = usePTLStore((s) => s.orders);
  const ptlUnassigned = ptlOrders.filter((o) => o.order.status === "WAITING_COLOR").length;

  // NOTE: annotating `const items: NotificationItem[] = [...].filter(...)`
  // does NOT contextually type the array literal here — contextual typing
  // only flows into a bare literal, not through a chained .filter() call,
  // so TS infers each object's own shape independently and widens the
  // `group`/`tone` string-literal fields to plain `string`. Casting the
  // literal itself fixes that.
  const items = ([
    { to: "/inventory", search: { tab: "sku", filter: "lowStock" }, label: "Low stock SKUs",        count: skuKpis.lowStock,     icon: AlertTriangle, group: "Inventory", tone: "warning" },
    { to: "/inventory", search: { tab: "sku", filter: "onHold" }, label: "SKUs on hold",           count: skuKpis.onHold,       icon: ShieldCheck,   group: "Inventory", tone: "warning" },
    { to: "/inventory", search: { tab: "binmap", filter: "criticalBins" }, label: "Critical bins (≥90% full)", count: binKpis.criticalBins, icon: Boxes,      group: "Inventory", tone: "destructive" },

    { to: "/orders",    label: "New orders",             count: orderKpis.newOrders,  icon: ShoppingCart,  group: "Orders" },
    { to: "/orders",    label: "Order exceptions",        count: orderKpis.exceptions, icon: ShoppingCart,  group: "Orders", tone: "destructive" },
    { to: "/inbound",   label: "Inbound discrepancies",   count: inbound.discrepancies, icon: ArrowDownToLine, group: "Orders", tone: "warning" },
    { to: "/putaway",   label: "Putaway blocked tasks",   count: putaway.blocked,      icon: PackageOpen,   group: "Orders", tone: "warning" },
    { to: "/picking",   label: "Pick shortages",          count: picking.shorts,       icon: PackageSearch, group: "Orders", tone: "warning" },
    { to: "/packing",   label: "Carton rework",           count: packing.rework,       icon: PackageCheck,  group: "Orders", tone: "warning" },
    { to: "/outbound",  label: "Outbound exceptions",     count: outbound.exceptionsOpen, icon: Truck,      group: "Orders", tone: "destructive" },
    { to: "/yard",      label: "Yard dwell alerts",       count: yard.dwellAlerts,     icon: Container,     group: "Orders", tone: "warning" },
    { to: "/qc",        label: "QC holds",                count: qc.openHolds,         icon: ShieldCheck,   group: "Orders", tone: "warning" },

    { to: "/ptl",       label: ptlConnected === false ? `Bridge unreachable${ptlLastError ? ` — ${ptlLastError}` : ""}` : "Bridge unreachable",
      count: ptlConnected === false ? 1 : 0, icon: Radio, group: "PTL / Picking", tone: "destructive" },
    { to: "/ptl",       label: "Orders waiting on PTL Map / picker", count: ptlUnassigned, icon: AlertTriangle, group: "PTL / Picking", tone: "warning" },
  ] as NotificationItem[]).filter((i) => i.count > 0);

  const total = items.reduce((n, i) => n + i.count, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md hover:bg-secondary relative"
        aria-label={total > 0 ? `${total} notifications` : "Notifications"}
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-destructive text-[9px] leading-[14px] text-white font-bold text-center">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto panel rounded-md shadow-lg z-50">
          <div className="px-3 py-2.5 border-b border-border/60 flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wider">NOTIFICATIONS</h3>
            {total > 0 && <span className="text-[10px] text-muted-foreground">{total} open</span>}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-emerald-500/40" />
              <span className="text-xs">Nothing needs attention.</span>
            </div>
          ) : (
            (["Inventory", "Orders", "PTL / Picking"] as const).map((group) => {
              const groupItems = items.filter((i) => i.group === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="border-b border-border/40 last:border-b-0">
                  <div className="px-3 pt-2 pb-1 text-[9px] font-bold tracking-wider text-muted-foreground">{group.toUpperCase()}</div>
                  {groupItems.map((i) => {
                    const Icon = i.icon;
                    return (
                      <Link
                        key={i.label}
                        to={i.to}
                        search={i.search as never}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent/20 transition-colors"
                      >
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", i.tone === "destructive" ? "text-destructive" : "text-amber-400")} />
                        <span className="text-xs flex-1 min-w-0 truncate">{i.label}</span>
                        <span className={cn("text-xs font-bold font-mono tabular-nums", i.tone === "destructive" ? "text-destructive" : "text-amber-400")}>
                          {i.count}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
