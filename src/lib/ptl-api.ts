/**
 * Client for the Pick Flow Bridge WMS — the local Windows service that
 * actually talks to the physical PTL controllers/hardware. The old separate
 * Pick Flow desktop app is gone; a headless engine (ptl_engine.py) now runs
 * inside this same Bridge process and owns the TCP connection to each
 * TW2273 controller, so TriloWMS's UI is the only screen anyone opens.
 * TriloWMS itself has no backend of its own, so all PTL "calling" (releasing
 * an order so the engine dispatches it to hardware) and "receiving" (reading
 * back pick-feedback, stock and report data the engine wrote after a real
 * controller interrupt) happens by calling this Bridge's JSON API directly
 * from the browser.
 *
 * The Bridge runs on the user's own PC/LAN (e.g. https://<PC-IP>:8443), so
 * the base URL and credentials are user-configurable (see ptl-store.ts)
 * rather than hardcoded — there's no fixed public address for it.
 */

export type PTLOrderStatus =
  | "WAITING_COLOR" | "WAITING" | "READY" | "ACTIVE" | "COMPLETE" | "CANCELLED";

export interface PTLOrderLine {
  sku: string;
  logical_ptl: string;
  address: string;
  qty: number;
  requested_qty: number;
  picked_qty: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  controller: string;
  physical_address: string;
  model: string;
  map_active: boolean;
}

export interface PTLOrder {
  id: number;
  order_no: string;
  status: PTLOrderStatus;
  picker: string | null;
  color: string | null;
  barcode: string | null;
  created: string;
  updated: string;
  released_at: string | null;
  pickflow_claimed: number;
  pickflow_claimed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  total_seconds: number;
}

export interface PTLOrderWithLines {
  order: PTLOrder;
  lines: PTLOrderLine[];
}

export interface PTLMapEntry {
  logical_ptl: string;
  controller: string;
  physical_address: string;
  model: string;
  active: number;
}

export interface PTLSkuMaster {
  sku: string;
  description: string;
  unit: string;
  stock_qty: number;
  min_stock: number;
  active: number;
  updated: string;
}

export interface PTLStockMove {
  time: string;
  sku: string;
  move_type: string;
  qty: number;
  reference: string;
  before_qty: number;
  after_qty: number;
  operator: string;
}

export interface PTLReportRow {
  order_no: string;
  status: string;
  picker: string | null;
  color: string | null;
  created: string;
  released_at: string | null;
  completed_at: string | null;
  total_seconds: number;
  sent: number;
  picked: number;
}

export interface PTLLogEntry {
  time: string;
  type: string;
  detail: string;
}

export interface PTLConnection {
  baseUrl: string;
  username: string;
  password: string;
}

export interface PTLController {
  controller_id: string;
  ip: string;
  port: number;
  active: number;
}

class PTLApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(conn: PTLConnection, path: string, init?: RequestInit): Promise<T> {
  if (!conn.baseUrl) throw new PTLApiError("Pick Flow Bridge URL is not configured");
  const url = conn.baseUrl.replace(/\/+$/, "") + path;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        Authorization: "Basic " + btoa(`${conn.username}:${conn.password}`),
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    throw new PTLApiError(
      `Could not reach the Pick Flow Bridge at ${conn.baseUrl}. Make sure it's running and reachable on your network. (${(e as Error).message})`,
    );
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new PTLApiError(body?.error || `Bridge request failed (HTTP ${res.status})`, res.status);
  }
  return body as T;
}

export const ptlApi = {
  health: (conn: PTLConnection) => call<{ ok: true; service: string; version: string }>(conn, "/api/v1/health"),

  listOrders: (conn: PTLConnection) => call<{ ok: true; orders: PTLOrderWithLines[] }>(conn, "/api/v1/orders"),

  createOrders: (conn: PTLConnection, data: string) =>
    call<{ ok: true; created: string[] }>(conn, "/api/v1/orders", { method: "POST", body: JSON.stringify({ data }) }),

  releaseOrder: (conn: PTLConnection, orderNo: string) =>
    call<{ ok: true } & PTLOrderWithLines>(conn, `/api/v1/orders/${encodeURIComponent(orderNo)}/release`, { method: "POST" }),

  cancelOrder: (conn: PTLConnection, orderNo: string) =>
    call<{ ok: true }>(conn, `/api/v1/orders/${encodeURIComponent(orderNo)}/cancel`, { method: "POST" }),

  requeueOrder: (conn: PTLConnection, orderNo: string) =>
    call<{ ok: true }>(conn, `/api/v1/orders/${encodeURIComponent(orderNo)}/requeue`, { method: "POST" }),

  deleteOrder: (conn: PTLConnection, orderNo: string) =>
    call<{ ok: true; deleted: boolean }>(conn, `/api/v1/orders/${encodeURIComponent(orderNo)}`, { method: "DELETE" }),

  scanBarcode: (conn: PTLConnection, barcode: string) =>
    call<{ ok: true; order: PTLOrder; lines: PTLOrderLine[] }>(conn, "/api/scan", { method: "POST", body: JSON.stringify({ barcode }) }),

  listMap: (conn: PTLConnection) => call<{ ok: true; map: PTLMapEntry[] }>(conn, "/api/v1/ptl-map"),

  saveMapEntry: (conn: PTLConnection, entry: PTLMapEntry) =>
    call<{ ok: true }>(conn, "/api/v1/ptl-map", { method: "POST", body: JSON.stringify(entry) }),

  deleteMapEntry: (conn: PTLConnection, logicalPtl: string) =>
    call<{ ok: true }>(conn, `/api/v1/ptl-map/${encodeURIComponent(logicalPtl)}`, { method: "DELETE" }),

  listStock: (conn: PTLConnection) => call<{ ok: true; sku_master: PTLSkuMaster[]; moves: PTLStockMove[] }>(conn, "/api/v1/stock"),

  stockMove: (conn: PTLConnection, move: { sku: string; qty: number; move_type: "RECEIPT" | "ADJUSTMENT_OUT"; reference?: string; description?: string; min_stock?: number }) =>
    call<{ ok: true; before_qty: number; after_qty: number }>(conn, "/api/v1/stock", { method: "POST", body: JSON.stringify(move) }),

  reports: (conn: PTLConnection) => call<{ ok: true; report: PTLReportRow[] }>(conn, "/api/v1/reports"),

  logs: (conn: PTLConnection) => call<{ ok: true; logs: PTLLogEntry[] }>(conn, "/api/v1/logs"),

  // The headless engine (ptl_engine.py) inside the Bridge reads this table
  // every dispatch cycle to know which IP:port to open a TCP socket to for
  // each controller_id used in the PTL Map — configured here instead of
  // Pick Flow's old Communication tab.
  listControllers: (conn: PTLConnection) => call<{ ok: true; controllers: PTLController[] }>(conn, "/api/v1/controllers"),

  saveController: (conn: PTLConnection, controller: PTLController) =>
    call<{ ok: true }>(conn, "/api/v1/controllers", { method: "POST", body: JSON.stringify(controller) }),

  deleteController: (conn: PTLConnection, controllerId: string) =>
    call<{ ok: true }>(conn, `/api/v1/controllers/${encodeURIComponent(controllerId)}`, { method: "DELETE" }),

  barcodeImageUrl: (conn: PTLConnection, code: string) => conn.baseUrl.replace(/\/+$/, "") + `/barcode/${encodeURIComponent(code)}`,
};

export { PTLApiError };
