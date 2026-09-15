import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ptlApi, PTLApiError,
  type PTLConnection, type PTLOrderWithLines, type PTLMapEntry,
  type PTLSkuMaster, type PTLStockMove, type PTLReportRow, type PTLLogEntry,
  type PTLController,
} from "@/lib/ptl-api";

interface PTLState {
  conn: PTLConnection;
  setConn: (patch: Partial<PTLConnection>) => void;

  connected: boolean | null; // null = not checked yet
  checking: boolean;
  lastError: string | null;

  orders: PTLOrderWithLines[];
  map: PTLMapEntry[];
  skuMaster: PTLSkuMaster[];
  stockMoves: PTLStockMove[];
  report: PTLReportRow[];
  logs: PTLLogEntry[];
  controllers: PTLController[];
  loading: boolean;
  lastSyncAt: number | null;

  testConnection: () => Promise<boolean>;
  refreshOrders: () => Promise<void>;
  refreshMap: () => Promise<void>;
  refreshStock: () => Promise<void>;
  refreshReports: () => Promise<void>;
  refreshLogs: () => Promise<void>;
  refreshControllers: () => Promise<void>;
  refreshAll: () => Promise<void>;

  createOrders: (data: string) => Promise<{ created: string[] }>;
  releaseOrder: (orderNo: string) => Promise<void>;
  cancelOrder: (orderNo: string) => Promise<void>;
  requeueOrder: (orderNo: string) => Promise<void>;
  deleteOrder: (orderNo: string) => Promise<void>;
  scanBarcode: (barcode: string) => Promise<{ order_no: string }>;
  saveMapEntry: (entry: PTLMapEntry) => Promise<void>;
  deleteMapEntry: (logicalPtl: string) => Promise<void>;
  stockMove: (move: { sku: string; qty: number; move_type: "RECEIPT" | "ADJUSTMENT_OUT"; reference?: string; description?: string; min_stock?: number }) => Promise<void>;
  saveController: (controller: PTLController) => Promise<void>;
  deleteController: (controllerId: string) => Promise<void>;
}

const errMsg = (e: unknown) => (e instanceof PTLApiError || e instanceof Error ? e.message : String(e));

export const usePTLStore = create<PTLState>()(
  persist(
    (set, get) => ({
      conn: { baseUrl: "", username: "wms_api", password: "wms_api" },
      setConn: (patch) => set((s) => ({ conn: { ...s.conn, ...patch } })),

      connected: null,
      checking: false,
      lastError: null,

      orders: [],
      map: [],
      skuMaster: [],
      stockMoves: [],
      report: [],
      logs: [],
      controllers: [],
      loading: false,
      lastSyncAt: null,

      testConnection: async () => {
        set({ checking: true, lastError: null });
        try {
          await ptlApi.health(get().conn);
          set({ connected: true, checking: false });
          return true;
        } catch (e) {
          set({ connected: false, checking: false, lastError: errMsg(e) });
          return false;
        }
      },

      refreshOrders: async () => {
        try {
          const r = await ptlApi.listOrders(get().conn);
          set({ orders: r.orders, connected: true, lastError: null, lastSyncAt: Date.now() });
        } catch (e) {
          set({ connected: false, lastError: errMsg(e) });
        }
      },
      refreshMap: async () => {
        try {
          const r = await ptlApi.listMap(get().conn);
          set({ map: r.map, connected: true, lastError: null });
        } catch (e) {
          set({ connected: false, lastError: errMsg(e) });
        }
      },
      refreshStock: async () => {
        try {
          const r = await ptlApi.listStock(get().conn);
          set({ skuMaster: r.sku_master, stockMoves: r.moves, connected: true, lastError: null });
        } catch (e) {
          set({ connected: false, lastError: errMsg(e) });
        }
      },
      refreshReports: async () => {
        try {
          const r = await ptlApi.reports(get().conn);
          set({ report: r.report, connected: true, lastError: null });
        } catch (e) {
          set({ connected: false, lastError: errMsg(e) });
        }
      },
      refreshLogs: async () => {
        try {
          const r = await ptlApi.logs(get().conn);
          set({ logs: r.logs, connected: true, lastError: null });
        } catch (e) {
          set({ connected: false, lastError: errMsg(e) });
        }
      },
      refreshControllers: async () => {
        try {
          const r = await ptlApi.listControllers(get().conn);
          set({ controllers: r.controllers, connected: true, lastError: null });
        } catch (e) {
          set({ connected: false, lastError: errMsg(e) });
        }
      },
      refreshAll: async () => {
        set({ loading: true });
        await Promise.all([get().refreshOrders(), get().refreshMap(), get().refreshStock(), get().refreshReports(), get().refreshLogs(), get().refreshControllers()]);
        set({ loading: false });
      },

      createOrders: async (data) => {
        const r = await ptlApi.createOrders(get().conn, data);
        await get().refreshOrders();
        return { created: r.created };
      },
      // "Calling" — releasing an order makes it visible to Pick Flow's
      // released-orders poll, which then claims it and dispatches the
      // physical PTL lights.
      releaseOrder: async (orderNo) => {
        await ptlApi.releaseOrder(get().conn, orderNo);
        await get().refreshOrders();
      },
      cancelOrder: async (orderNo) => {
        await ptlApi.cancelOrder(get().conn, orderNo);
        await get().refreshOrders();
      },
      requeueOrder: async (orderNo) => {
        await ptlApi.requeueOrder(get().conn, orderNo);
        await get().refreshOrders();
      },
      deleteOrder: async (orderNo) => {
        await ptlApi.deleteOrder(get().conn, orderNo);
        await get().refreshOrders();
      },
      scanBarcode: async (barcode) => {
        const r = await ptlApi.scanBarcode(get().conn, barcode);
        await get().refreshOrders();
        return { order_no: r.order.order_no };
      },
      saveMapEntry: async (entry) => {
        await ptlApi.saveMapEntry(get().conn, entry);
        await get().refreshMap();
      },
      deleteMapEntry: async (logicalPtl) => {
        await ptlApi.deleteMapEntry(get().conn, logicalPtl);
        await get().refreshMap();
      },
      stockMove: async (move) => {
        await ptlApi.stockMove(get().conn, move);
        await get().refreshStock();
      },
      saveController: async (controller) => {
        await ptlApi.saveController(get().conn, controller);
        await get().refreshControllers();
      },
      deleteController: async (controllerId) => {
        await ptlApi.deleteController(get().conn, controllerId);
        await get().refreshControllers();
      },
    }),
    {
      name: "trilowms-ptl-bridge",
      partialize: (s) => ({ conn: s.conn }),
    },
  ),
);
