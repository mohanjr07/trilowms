/**
 * TriloWMS — One-click demo data loader.
 *
 * Every store that already ships a realistic 20-45 record seed generator
 * (Inbound ASNs, Putaway tasks, Picking waves, QC, Returns, Yard, SKU master)
 * is now wired directly into that store's own initial state — see the
 * `*-store.ts` files — so a fresh install shows those screens populated
 * automatically, no button required.
 *
 * What those generators can't do is show one order moving *through* the
 * real pipeline, because Orders → Picking → Consolidation → Packing →
 * Outbound is a chain of live store actions (allocate stock, release a
 * wave, pick it, sync a lane, pack a carton, dispatch a shipment) — there's
 * no static array for that, it only exists by actually driving the flow.
 * This file does exactly that: it calls the same actions a warehouse
 * worker's UI would call, in the same order, so what lands in each store is
 * indistinguishable from genuine activity.
 *
 * Re-running seedDemoData() is safe — it fully resets the order pipeline
 * (Orders/Picking "from-order" waves/Consolidation/Packing/Outbound) and
 * the Stock ledger before rebuilding them, so clicking the button twice
 * doesn't double up data.
 */

import { useSkuStore, SEED_SKUS } from "@/lib/sku-store";
import { useStockStore } from "@/lib/stock-store";
import { useOrdersStore, type CreateOrderInput } from "@/lib/orders-store";
import { usePickingStore } from "@/lib/picking-store";
import { useConsolidationStore } from "@/lib/consolidation-store";
import { usePackingStore } from "@/lib/packing-store";
import { useOutboundStore } from "@/lib/outbound-store";

const CUSTOMERS: { name: string; address: string; carrier: string; shipping: string }[] = [
  { name: "Meridian Auto Parts",      address: "4800 Industrial Pkwy, Detroit, MI 48209",      carrier: "FedEx Freight",   shipping: "Ground" },
  { name: "Pinnacle Electronics",     address: "120 Harbor Blvd, Oakland, CA 94607",             carrier: "UPS",             shipping: "2-Day" },
  { name: "BrightStar Manufacturing", address: "77 Foundry Rd, Pittsburgh, PA 15222",            carrier: "XPO Logistics",   shipping: "LTL" },
  { name: "Northwind Supply Co.",     address: "900 Lakeview Dr, Minneapolis, MN 55401",         carrier: "FedEx Ground",    shipping: "Ground" },
  { name: "Vertex Industrial Group",  address: "15 Commerce Way, Charlotte, NC 28208",           carrier: "UPS Freight",     shipping: "LTL" },
  { name: "Summit Robotics Inc.",     address: "2200 Innovation Dr, Austin, TX 78758",           carrier: "DHL",             shipping: "Express" },
  { name: "Coastal Hardware Ltd.",    address: "55 Pier Ave, Seattle, WA 98134",                 carrier: "FedEx Ground",    shipping: "Ground" },
  { name: "Falcon Aerospace Parts",   address: "310 Runway Rd, Wichita, KS 67209",               carrier: "UPS",             shipping: "2-Day" },
  { name: "Ironclad Fasteners Co.",   address: "88 Steel St, Cleveland, OH 44113",               carrier: "XPO Logistics",   shipping: "LTL" },
  { name: "Orbit Consumer Goods",     address: "410 Market St, Columbus, OH 43215",              carrier: "FedEx Ground",    shipping: "Ground" },
  { name: "Redwood Chemical Supply",  address: "60 Bay Ave, Portland, OR 97209",                 carrier: "DHL",             shipping: "Express" },
  { name: "Atlas Power Solutions",    address: "725 Energy Blvd, Houston, TX 77002",             carrier: "UPS Freight",     shipping: "LTL" },
];

function pickSkus(count: number, offset: number) {
  return Array.from({ length: count }, (_, i) => SEED_SKUS[(offset + i * 5) % SEED_SKUS.length]);
}

/** Resets just the order-pipeline stores (not the static per-module seed data). */
function resetPipeline() {
  useOrdersStore.setState({ orders: [] });
  usePickingStore.setState((s) => ({
    waves: s.waves.filter((w) => !w.sourceOrderId),
    shortages: s.shortages.filter((sh) => !s.waves.find((w) => w.id === sh.waveId)?.sourceOrderId),
  }));
  useConsolidationStore.setState({ lanes: [] });
  usePackingStore.setState((s) => ({ orders: [], stations: s.stations.map((st) => ({ ...st, currentOrderId: null, status: "IDLE" })) }));
  useOutboundStore.setState({ shipments: [] });
}

export function seedDemoData() {
  // SKU master — already wired as the store's own initial state, but make
  // sure it's present even if the user cleared storage after first load.
  if (useSkuStore.getState().skus.length === 0) useSkuStore.setState({ skus: SEED_SKUS });

  resetPipeline();

  // ── Stock ledger — deterministic on-hand for every seeded SKU ──
  useStockStore.setState({ stock: {}, adjustments: useStockStore.getState().adjustments });
  const stock = useStockStore.getState();
  SEED_SKUS.forEach((sku, i) => {
    const bin = `A-0${(i % 3) + 1}-R-0${(i % 4) + 1}-L${(i % 4) + 1}-P${(i % 5) + 1}`;
    stock.addStock(sku.skuCode, sku.itemName, sku.onHand ?? 200, bin);
  });

  // ── Orders — a mixed batch across the customer list ──
  const orders = useOrdersStore.getState();
  const createdIds: string[] = [];
  CUSTOMERS.forEach((cust, i) => {
    const lineSkus = pickSkus(1 + (i % 3), i * 3);
    const input: CreateOrderInput = {
      customer: cust.name,
      channel: ["Web", "EDI", "Phone", "Marketplace"][i % 4],
      shippingMethod: cust.shipping,
      carrier: cust.carrier,
      priority: i % 4 === 0 ? "RUSH" : "NORMAL",
      shipToAddress: cust.address,
      notes: null,
      lines: lineSkus.map((sku) => ({
        skuCode: sku.skuCode,
        skuName: sku.itemName,
        uom: sku.uom,
        requestedQty: 5 + ((i * 7 + lineSkus.indexOf(sku) * 3) % 40),
      })),
    };
    const order = orders.createOrder(input);
    createdIds.push(order.id);
  });

  // Allocate all of them against the stock we just loaded.
  orders.bulkAllocate(createdIds);

  // ── Picking — release a wave for every order that made it to ALLOCATED ──
  const picking = usePickingStore.getState();
  const allocated = useOrdersStore.getState().orders.filter((o) => o.status === "ALLOCATED" || o.status === "EXCEPTION");
  const waveIds: string[] = [];
  allocated.forEach((o) => {
    const wave = picking.createWaveFromOrder({
      sourceOrderId: o.id,
      orderNumber: o.orderNumber,
      priority: o.priority === "RUSH" ? "RUSH" : "STANDARD",
      carrier: o.carrier ?? undefined,
      dueBy: o.dueBy,
      lines: o.lines.filter((l) => l.allocatedQty > 0).map((l) => ({ skuCode: l.skuCode, skuName: l.skuName, uom: l.uom, qty: l.allocatedQty })),
    });
    waveIds.push(wave.id);
    orders.linkPickWave(o.id, wave.waveNumber);
  });

  // Fully pick most waves (so they reach Consolidation/Packing/Outbound);
  // leave a couple partially picked so Picking still shows active work.
  waveIds.forEach((waveId, i) => {
    const wave = usePickingStore.getState().waves.find((w) => w.id === waveId);
    if (!wave) return;
    const fully = i % 5 !== 4; // ~80% go all the way through
    wave.tasks.forEach((t, j) => {
      if (!fully && j === wave.tasks.length - 1) return; // leave the last line open
      usePickingStore.getState().pickTask(waveId, t.id, t.qtyRequired);
    });
  });

  // ── Consolidation — pull the picked waves into lanes, push ready ones on ──
  const consolidation = useConsolidationStore.getState();
  consolidation.syncFromPicking();
  const readyLanes = useConsolidationStore.getState().lanes.filter((l) => l.status === "READY");
  readyLanes.forEach((lane, i) => {
    if (i % 6 !== 5) useConsolidationStore.getState().moveToPacking(lane.id); // hold back a few at READY
  });

  // ── Packing — sync, then carry a subset all the way to dispatch ──
  const packing = usePackingStore.getState();
  packing.syncFromConsolidation();
  const packOrders = usePackingStore.getState().orders;
  packOrders.forEach((po, i) => {
    const stationId = usePackingStore.getState().stations[i % usePackingStore.getState().stations.length].id;
    const pk = usePackingStore.getState();
    pk.assignOrder(po.id, stationId);
    pk.startPacking(po.id);
    pk.createCarton(po.id);
    const carton = usePackingStore.getState().orders.find((o) => o.id === po.id)?.cartons[0];
    if (!carton) return;
    po.lines.forEach((l) => {
      for (let u = 0; u < l.qtyRequired; u++) usePackingStore.getState().scanCartonItem(po.id, carton.id, l.lineId);
    });
    usePackingStore.getState().closeCarton(po.id, carton.id, parseFloat((5 + Math.random() * 40).toFixed(1)));
    // Only progress most of them to labelled/manifested — leave a few at PACKED.
    if (i % 4 !== 3) {
      usePackingStore.getState().labelCarton(po.id, carton.id, `1Z${Math.floor(100000000 + Math.random() * 899999999)}`);
      usePackingStore.getState().manifestOrder(po.id);
      // And dispatch about half of those, so Outbound has both staged and dispatched shipments.
      if (i % 2 === 0) usePackingStore.getState().dispatchOrder(po.id);
    }
  });

  // ── Outbound — pull every manifested/dispatched pack order into a shipment ──
  useOutboundStore.getState().syncFromPacking();
  const outbound = useOutboundStore.getState();
  outbound.shipments.forEach((sh, i) => {
    if (sh.status !== "PLANNED") return;
    if (i % 2 === 0) {
      outbound.recordCartonLoad(sh.id, sh.totalCartons);
      outbound.sealAndConfirmDispatch(sh.id, `SEAL-${9000 + i}`, true);
    }
  });

  return {
    skus: useSkuStore.getState().skus.length,
    stockSkus: Object.keys(useStockStore.getState().stock).length,
    orders: useOrdersStore.getState().orders.length,
    waves: waveIds.length,
    lanes: useConsolidationStore.getState().lanes.length,
    packOrders: usePackingStore.getState().orders.length,
    shipments: useOutboundStore.getState().shipments.length,
  };
}
