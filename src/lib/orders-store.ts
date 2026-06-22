/**
 * TriloWMS — Orders Store
 * Outward operations begin here: order intake (manual + import), stock
 * allocation/reservation, and lifecycle tracking through fulfillment.
 * Allocation is the hook the Picking module consumes downstream.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useStockStore } from "@/lib/stock-store";

export type OrderStatus =
  | "NEW" | "ALLOCATED" | "PICKING" | "PACKED" | "SHIPPED" | "DELIVERED" | "EXCEPTION" | "CANCELLED";
export type AllocStatus = "UNALLOCATED" | "PARTIAL" | "ALLOCATED";
export type OrderPriority = "RUSH" | "NORMAL";

export interface OrderLine {
  id: string;
  lineNo: number;
  skuCode: string;
  skuName: string;
  uom: string;
  requestedQty: number;
  availableQty: number;   // real on-hand stock available for this SKU (live snapshot, not allocation-adjusted)
  allocatedQty: number;
  binCode: string | null;
  allocStatus: AllocStatus;
  backordered?: boolean;  // true if some/all of allocatedQty was committed without real on-hand stock
}

export interface OrderStage {
  status: OrderStatus;
  ts: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  customerCode: string;
  channel: string;           // Web / EDI / Phone / Marketplace
  shippingMethod: string;
  carrier: string | null;
  priority: OrderPriority;
  status: OrderStatus;
  lines: OrderLine[];
  totalLines: number;
  totalUnits: number;
  allocatedUnits: number;
  shipToAddress: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  dueBy: string;
  slaHours: number;
  stages: OrderStage[];
  pickWaveNumber: string | null;
}

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; border: string }> = {
  NEW:       { label: "New",       color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
  ALLOCATED: { label: "Allocated", color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  PICKING:   { label: "Picking",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  PACKED:    { label: "Packed",    color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  SHIPPED:   { label: "Shipped",   color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30"  },
  DELIVERED: { label: "Delivered", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  EXCEPTION: { label: "Exception", color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
  CANCELLED: { label: "Cancelled", color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30"   },
};

export interface OrderLineInput { skuCode: string; skuName: string; uom: string; requestedQty: number; availableQty?: number; }
export interface CreateOrderInput {
  customer: string; channel: string; shippingMethod: string; carrier?: string | null;
  priority: OrderPriority; shipToAddress: string; notes?: string | null; slaHours?: number;
  lines: OrderLineInput[];
}

export interface OrderFilters { search: string; status: OrderStatus | ""; customer: string; priority: OrderPriority | ""; }
const DEFAULT_FILTERS: OrderFilters = { search: "", status: "", customer: "", priority: "" };

let _seq = 1000;
const nextOrderNo = () => `ORD-${(++_seq).toString().padStart(5, "0")}`;

interface OrdersState {
  orders: Order[];
  filters: OrderFilters;
  page: number;
  pageSize: number;
  selectedOrderId: string | null;

  createOrder: (data: CreateOrderInput) => Order;
  importOrders: (rows: { customer: string; skuCode: string; skuName: string; qty: number }[]) => number;
  autoAllocate: (orderId: string) => { fully: boolean; shortLines: number };
  setLineAllocation: (orderId: string, lineId: string, allocatedQty: number, binCode?: string) => void;
  bulkAllocate: (ids: string[]) => void;
  updateStatus: (orderId: string, status: OrderStatus) => void;
  syncStatusFromFulfillment: (orderId: string, status: OrderStatus) => void;
  linkPickWave: (orderId: string, waveNumber: string) => void;
  cancelOrder: (orderId: string) => void;
  selectOrder: (id: string | null) => void;
  setFilters: (f: Partial<OrderFilters>) => void;
  resetFilters: () => void;
  setPage: (p: number) => void;

  filteredOrders: () => Order[];
  kpis: () => { newOrders: number; allocated: number; inFulfillment: number; shipped: number; exceptions: number; fulfillmentRate: string; avgCycleHrs: string; backordered: number };
  statusFunnel: () => { status: OrderStatus; count: number }[];
  customerList: () => string[];
  allocatableOrders: () => Order[];
}

function recalc(o: Order): Order {
  const totalUnits = o.lines.reduce((s, l) => s + l.requestedQty, 0);
  const allocatedUnits = o.lines.reduce((s, l) => s + l.allocatedQty, 0);
  return { ...o, totalLines: o.lines.length, totalUnits, allocatedUnits };
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      filters: DEFAULT_FILTERS,
      page: 1,
      pageSize: 14,
      selectedOrderId: null,

      createOrder: (data) => {
        const now = new Date().toISOString();
        const lines: OrderLine[] = data.lines.map((l, i) => ({
          id: `ol-${Date.now()}-${i}`,
          lineNo: i + 1,
          skuCode: l.skuCode,
          skuName: l.skuName,
          uom: l.uom || "EA",
          requestedQty: l.requestedQty,
          availableQty: l.availableQty ?? useStockStore.getState().available(l.skuCode),
          allocatedQty: 0,
          binCode: null,
          allocStatus: "UNALLOCATED",
        }));
        const slaHours = data.slaHours ?? (data.priority === "RUSH" ? 4 : 24);
        const order: Order = recalc({
          id: `ord-${Date.now()}`,
          orderNumber: nextOrderNo(),
          customer: data.customer,
          customerCode: data.customer.slice(0, 3).toUpperCase() + "-" + Math.floor(100 + Math.random() * 899),
          channel: data.channel,
          shippingMethod: data.shippingMethod,
          carrier: data.carrier ?? null,
          priority: data.priority,
          status: "NEW",
          lines,
          totalLines: lines.length,
          totalUnits: 0,
          allocatedUnits: 0,
          shipToAddress: data.shipToAddress,
          notes: data.notes ?? null,
          createdBy: "Current User",
          createdAt: now,
          dueBy: new Date(Date.now() + slaHours * 3600000).toISOString(),
          slaHours,
          stages: [{ status: "NEW", ts: now }],
          pickWaveNumber: null,
        });
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },

      importOrders: (rows) => {
        // group rows by customer into one order each
        const byCustomer = new Map<string, { skuCode: string; skuName: string; qty: number }[]>();
        for (const r of rows) byCustomer.set(r.customer, [...(byCustomer.get(r.customer) ?? []), r]);
        let count = 0;
        for (const [customer, items] of byCustomer) {
          get().createOrder({
            customer, channel: "EDI", shippingMethod: "Standard Ground", priority: "NORMAL",
            shipToAddress: "Imported — address pending", notes: "Imported via CSV",
            lines: items.map((it) => ({ skuCode: it.skuCode, skuName: it.skuName || it.skuCode, uom: "EA", requestedQty: it.qty })),
          });
          count++;
        }
        return count;
      },

      autoAllocate: (orderId) => {
        let shortLines = 0;
        let backorderedLines = 0;
        const stock = useStockStore.getState();
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const lines = o.lines.map((l) => {
              const already = l.allocatedQty;
              const need = l.requestedQty - already;
              // 1. Try to reserve against real on-hand stock first.
              const reserved = need > 0 ? stock.reserve(l.skuCode, need) : 0;
              let alloc = already + reserved;
              let backordered = l.backordered ?? false;
              // 2. If on-hand stock can't cover the rest, commit the shortfall as a
              //    backorder allocation — standard WMS behaviour: the order can still
              //    move to ALLOCATED so it isn't stuck on NEW forever, but the shortfall
              //    is explicitly flagged (not pretending it's real stock).
              const stillShort = l.requestedQty - alloc;
              if (stillShort > 0) {
                alloc += stillShort;
                backordered = true;
              }
              const avail = stock.available(l.skuCode); // real on-hand snapshot for display
              if (backordered) backorderedLines++;
              if (alloc < l.requestedQty) shortLines++;
              const allocStatus: AllocStatus = alloc === 0 ? "UNALLOCATED" : alloc < l.requestedQty ? "PARTIAL" : "ALLOCATED";
              const binCode = l.binCode ?? (stock.stock[l.skuCode] ? Object.keys(stock.stock[l.skuCode].bins)[0] ?? "PICK-FACE" : "PICK-FACE");
              return { ...l, allocatedQty: alloc, availableQty: avail, allocStatus, binCode, backordered };
            });
            const allDone = lines.every((l) => l.allocStatus === "ALLOCATED");
            const now = new Date().toISOString();
            // Backordered-but-fully-allocated orders still move forward as ALLOCATED;
            // only a genuine PARTIAL (couldn't even commit a backorder qty) is an EXCEPTION.
            const anyPartial = lines.some((l) => l.allocStatus === "PARTIAL");
            const status: OrderStatus = allDone ? "ALLOCATED" : anyPartial ? "EXCEPTION" : o.status;
            const stages = status !== o.status ? [...o.stages, { status, ts: now }] : o.stages;
            return recalc({ ...o, lines, status, stages });
          }),
        }));
        return { fully: shortLines === 0, shortLines, backordered: backorderedLines };
      },

      setLineAllocation: (orderId, lineId, allocatedQty, binCode) => {
        const stock = useStockStore.getState();
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const lines = o.lines.map((l) => {
              if (l.id !== lineId) return l;
              const target = Math.max(0, Math.min(allocatedQty, l.requestedQty));
              const delta = target - l.allocatedQty;
              let alloc = l.allocatedQty;
              let backordered = l.backordered ?? false;
              if (delta > 0) {
                // Reserve as much as real stock allows; commit the rest as backorder.
                const reserved = stock.reserve(l.skuCode, delta);
                alloc += reserved;
                const stillShort = target - alloc;
                if (stillShort > 0) {
                  alloc += stillShort;
                  backordered = true;
                }
              } else if (delta < 0) {
                stock.release(l.skuCode, Math.min(-delta, l.allocatedQty));
                alloc = target;
                if (alloc === 0) backordered = false;
              }
              const allocStatus: AllocStatus = alloc === 0 ? "UNALLOCATED" : alloc < l.requestedQty ? "PARTIAL" : "ALLOCATED";
              return { ...l, allocatedQty: alloc, availableQty: stock.available(l.skuCode), allocStatus, binCode: binCode ?? l.binCode, backordered };
            });
            return recalc({ ...o, lines });
          }),
        }));
      },

      bulkAllocate: (ids) => { ids.forEach((id) => get().autoAllocate(id)); },

      updateStatus: (orderId, status) => set((s) => ({
        orders: s.orders.map((o) => {
          if (o.id !== orderId) return o;
          const now = new Date().toISOString();
          return { ...o, status, stages: [...o.stages, { status, ts: now }] };
        }),
      })),

      linkPickWave: (orderId, waveNumber) => set((s) => ({
        orders: s.orders.map((o) => {
          if (o.id !== orderId) return o;
          const now = new Date().toISOString();
          return { ...o, status: "PICKING" as OrderStatus, pickWaveNumber: waveNumber, stages: [...o.stages, { status: "PICKING" as OrderStatus, ts: now }] };
        }),
      })),

      // Called by downstream modules (Picking, Packing, Outbound) when real fulfillment
      // progress happens, so the order record reflects what actually happened on the
      // floor instead of only moving when someone clicks "Advance to..." by hand.
      // Forward-only: never rewinds an order, never touches terminal/cancelled/exception
      // states, and is a no-op if the order is already at or past the target stage.
      syncStatusFromFulfillment: (orderId, status) => set((s) => {
        const FORWARD_ORDER: OrderStatus[] = ["NEW", "ALLOCATED", "PICKING", "PACKED", "SHIPPED", "DELIVERED"];
        return {
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            if (["CANCELLED", "EXCEPTION"].includes(o.status)) return o;
            const curIdx = FORWARD_ORDER.indexOf(o.status);
            const nextIdx = FORWARD_ORDER.indexOf(status);
            if (curIdx === -1 || nextIdx === -1 || nextIdx <= curIdx) return o;
            const now = new Date().toISOString();
            return { ...o, status, stages: [...o.stages, { status, ts: now }] };
          }),
        };
      }),

      cancelOrder: (orderId) => {
        const o = get().orders.find((x) => x.id === orderId);
        if (o && !["SHIPPED", "DELIVERED"].includes(o.status)) {
          const stock = useStockStore.getState();
          o.lines.forEach((l) => {
            if (l.allocatedQty <= 0) return;
            // Only release what's actually held in the stock ledger's reserved count —
            // a fully backordered line never touched the ledger, so there's nothing to release.
            const heldReserved = stock.stock[l.skuCode]?.reserved ?? 0;
            stock.release(l.skuCode, Math.min(l.allocatedQty, heldReserved));
          });
        }
        get().updateStatus(orderId, "CANCELLED");
      },
      selectOrder: (id) => set({ selectedOrderId: id }),
      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS, page: 1 }),
      setPage: (p) => set({ page: p }),

      filteredOrders: () => {
        const { orders, filters } = get();
        const q = filters.search.toLowerCase();
        return orders.filter((o) => {
          if (filters.status && o.status !== filters.status) return false;
          if (filters.customer && o.customer !== filters.customer) return false;
          if (filters.priority && o.priority !== filters.priority) return false;
          if (q && !(o.orderNumber.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q))) return false;
          return true;
        });
      },

      kpis: () => {
        const o = get().orders;
        const today = new Date().toISOString().slice(0, 10);
        const shippedToday = o.filter((x) => x.status === "SHIPPED" && x.stages.some((s) => s.status === "SHIPPED" && s.ts.startsWith(today)));
        const completed = o.filter((x) => ["SHIPPED", "DELIVERED"].includes(x.status));
        const clean = completed.filter((x) => x.status !== "EXCEPTION");
        const cycles = completed.map((x) => {
          const start = new Date(x.createdAt).getTime();
          const end = new Date(x.stages.find((s) => s.status === "SHIPPED")?.ts ?? x.createdAt).getTime();
          return (end - start) / 3600000;
        });
        const avg = cycles.length ? (cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;
        const backordered = o.filter((x) => x.lines.some((l) => l.allocStatus === "PARTIAL")).length;
        return {
          newOrders: o.filter((x) => x.status === "NEW").length,
          allocated: o.filter((x) => x.status === "ALLOCATED").length,
          inFulfillment: o.filter((x) => ["PICKING", "PACKED"].includes(x.status)).length,
          shipped: shippedToday.length,
          exceptions: o.filter((x) => x.status === "EXCEPTION").length,
          fulfillmentRate: completed.length ? `${Math.round((clean.length / completed.length) * 100)}%` : "—",
          avgCycleHrs: completed.length ? `${avg.toFixed(1)}h` : "—",
          backordered,
        };
      },

      statusFunnel: () => {
        const order: OrderStatus[] = ["NEW","ALLOCATED","PICKING","PACKED","SHIPPED","DELIVERED","EXCEPTION"];
        const map = new Map<OrderStatus, number>();
        for (const o of get().orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
        return order.map((status) => ({ status, count: map.get(status) ?? 0 })).filter((x) => x.count > 0);
      },

      customerList: () => Array.from(new Set(get().orders.map((o) => o.customer))).sort(),
      allocatableOrders: () => get().orders.filter((o) => o.status === "NEW"),
    }),
    { name: "trilowms-orders-v2" },
  ),
);
