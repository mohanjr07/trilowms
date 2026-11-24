/** Mobile navigation map: which tabs each role sees. */
import { Home, ScanLine, PackageOpen, PackageCheck, ArrowDownToLine, Truck, Container, ShieldCheck, Boxes, ClipboardList, BarChart3, MoreHorizontal, PackageSearch, Undo2, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/auth-store";

export type ScreenId = "home" | "pick" | "putaway" | "pack" | "receive" | "dispatch" | "yard" | "qc" | "stock" | "orders" | "insights" | "returns" | "more";

export const SCREEN_META: Record<ScreenId, { label: string; icon: LucideIcon; hint: string }> = {
  home: { label: "Home", icon: Home, hint: "Your day at a glance" },
  pick: { label: "Pick", icon: PackageSearch, hint: "Scan-to-pick your waves" },
  putaway: { label: "Putaway", icon: PackageOpen, hint: "Move received pallets to bins" },
  pack: { label: "Pack", icon: PackageCheck, hint: "Pack and label orders" },
  receive: { label: "Receive", icon: ArrowDownToLine, hint: "Arrive, dock and receive ASNs" },
  dispatch: { label: "Dispatch", icon: Truck, hint: "Load cartons, seal and dispatch" },
  yard: { label: "Yard", icon: Container, hint: "Gate in/out and dock doors" },
  qc: { label: "QC", icon: ShieldCheck, hint: "Inspections and quality holds" },
  stock: { label: "Stock", icon: Boxes, hint: "Find stock, bins and count" },
  orders: { label: "Orders", icon: ClipboardList, hint: "Track orders by stage" },
  insights: { label: "Insights", icon: BarChart3, hint: "Live numbers and exceptions" },
  returns: { label: "Returns", icon: Undo2, hint: "Approve, receive and inspect returns" },
  more: { label: "More", icon: MoreHorizontal, hint: "Profile and settings" },
};

const T = (...ids: ScreenId[]) => ids.map((id) => ({ id, label: SCREEN_META[id].label, icon: SCREEN_META[id].icon }));

export const ROLE_TABS: Partial<Record<UserRole, ScreenId[]>> = {
  picker: ["home", "pick", "more"],
  forklift_operator: ["home", "putaway", "more"],
  packing_operator: ["home", "pack", "more"],
  inbound_supervisor: ["home", "receive", "putaway", "qc", "more"],
  outbound_supervisor: ["home", "pick", "pack", "dispatch", "more"],
  yard_manager: ["home", "yard", "receive", "dispatch", "more"],
  qc_inspector: ["home", "qc", "stock", "more"],
  inventory_manager: ["home", "stock", "putaway", "more"],
  operations_manager: ["home", "orders", "dispatch", "yard", "more"],
  auditor: ["home", "insights", "stock", "more"],
};

export function tabsFor(role: UserRole) {
  return T(...(ROLE_TABS[role] ?? (DESKTOP_ROLES.includes(role) ? ["home", "orders", "stock", "insights", "more"] : ["home", "more"])));
}

/** Roles that keep the desktop UI (admin + warehouse admin). */
export const DESKTOP_ROLES: UserRole[] = ["super_admin", "warehouse_admin"];

/** Screens reachable from More for roles whose bottom bar can't hold everything. */
const ALL_OPS: ScreenId[] = ["orders", "receive", "putaway", "pick", "pack", "dispatch", "yard", "qc", "stock", "returns", "insights"];
export function extraScreensFor(role: UserRole): ScreenId[] {
  const inBar = new Set<ScreenId>(tabsFor(role).map((t) => t.id));
  let extra: ScreenId[] = [];
  if (role === "super_admin" || role === "warehouse_admin" || role === "operations_manager") extra = ALL_OPS;
  else if (role === "qc_inspector" || role === "inventory_manager" || role === "inbound_supervisor") extra = ["returns"];
  return extra.filter((s) => !inBar.has(s));
}
