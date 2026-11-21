/** Mobile · Home — role greeting, live numbers, and one-tap shortcuts to the user's work. */
import { useAuthStore, ROLE_DEFINITIONS, type UserRole } from "@/lib/auth-store";
import { useInboundStore } from "@/lib/inbound-store";
import { useOutboundStore } from "@/lib/outbound-store";
import { usePickingStore } from "@/lib/picking-store";
import { usePutawayStore } from "@/lib/putaway-store";
import { usePackingStore } from "@/lib/packing-store";
import { useYardStore } from "@/lib/yard-store";
import { useQCStore } from "@/lib/qc-store";
import { useOrdersStore } from "@/lib/orders-store";
import { useStockStore } from "@/lib/stock-store";
import { StatTile, Card, SectionTitle, Chip, type Tone } from "./ui";
import type { ScreenId } from "./nav";
import { SCREEN_META, tabsFor } from "./nav";

type Tile = { label: string; value: React.ReactNode; sub?: string; tone?: Tone };

function useTiles(role: UserRole): { tiles: Tile[]; badge: Partial<Record<ScreenId, number>> } {
  const inb = useInboundStore((s) => s.kpis)();
  const out = useOutboundStore((s) => s.kpis)();
  const pick = usePickingStore((s) => s.kpis)();
  const put = usePutawayStore((s) => s.kpis)();
  const pack = usePackingStore((s) => s.kpis)();
  const yard = useYardStore((s) => s.kpis)();
  const qc = useQCStore((s) => s.kpis)();
  const ord = useOrdersStore((s) => s.kpis)();
  const stock = useStockStore((s) => s.kpis)();

  const badge: Partial<Record<ScreenId, number>> = {
    pick: pick.openPicks, putaway: put.open + put.assigned + put.inProgress, pack: pack.pendingLabel,
    receive: inb.openAsns, dispatch: out.staged + out.loading, yard: yard.inYard, qc: qc.inProgress + qc.pendingReview + qc.openHolds,
    orders: ord.newOrders + ord.allocated,
  };
  const t = (label: string, value: React.ReactNode, sub?: string, tone?: Tone): Tile => ({ label, value, sub, tone });

  const byRole: Partial<Record<UserRole, Tile[]>> = {
    picker: [t("Open picks", pick.openPicks, "lines waiting", "primary"), t("Picked today", pick.pickedToday, "units", "success")],
    forklift_operator: [t("Open tasks", put.open + put.assigned, "putaway waiting", "primary"), t("In progress", put.inProgress, "on the floor"), t("Done today", put.completedToday, "tasks", "success")],
    packing_operator: [t("To pack", pack.pendingLabel, "orders waiting", "primary"), t("Cartons", pack.cartonsPacked, "packed", "success")],
    inbound_supervisor: [t("Open ASNs", inb.openAsns, "awaiting completion", "primary"), t("Docked now", inb.dockedNow, "at the door"), t("Received today", inb.receivedToday, "ASNs", "success"), t("Discrepancies", inb.discrepancies, "open", inb.discrepancies ? "danger" : "neutral")],
    outbound_supervisor: [t("Staged", out.staged, "at dock", "primary"), t("Loading", out.loading, "trucks"), t("Dispatched", out.dispatched, "today", "success"), t("Delayed", out.delayed, "past schedule", out.delayed ? "danger" : "neutral")],
    yard_manager: [t("In yard", yard.inYard, "trucks", "primary"), t("At dock", yard.dockedIn + yard.dockedOut, "trucks"), t("Free docks", yard.availableDocks, "available", "success"), t("Dwell alerts", yard.dwellAlerts, "over limit", yard.dwellAlerts ? "danger" : "neutral")],
    qc_inspector: [t("In progress", qc.inProgress, "inspections", "primary"), t("Open holds", qc.openHolds, "quarantined", qc.openHolds ? "danger" : "neutral"), t("Pass rate", qc.passRate, "completed", "success"), t("Pending review", qc.pendingReview, "awaiting QA")],
    inventory_manager: [t("SKUs in stock", stock.skus, "items", "primary"), t("On hand", stock.totalOnHand.toLocaleString(), "units"), t("Reserved", stock.totalReserved.toLocaleString(), "allocated", "warning"), t("Available", stock.totalAvailable.toLocaleString(), "free", "success")],
    operations_manager: [t("Orders in flight", ord.inFulfillment, `${ord.newOrders} new`, "primary"), t("Open picks", pick.openPicks, "lines"), t("Dispatched", out.dispatched, "today", "success"), t("Exceptions", ord.exceptions, "orders", ord.exceptions ? "danger" : "neutral")],
    auditor: [t("SKUs", stock.skus, "in ledger", "primary"), t("On hand", stock.totalOnHand.toLocaleString(), "units"), t("Open holds", qc.openHolds, "quality", qc.openHolds ? "danger" : "neutral"), t("Discrepancies", inb.discrepancies, "inbound", inb.discrepancies ? "danger" : "neutral")],
  };
  return { tiles: byRole[role] ?? byRole.operations_manager ?? [], badge };
}

export function HomeScreen({ go }: { go: (s: ScreenId) => void }) {
  const session = useAuthStore((s) => s.session);
  const role = session!.user.role;
  const def = ROLE_DEFINITIONS[role];
  const { tiles, badge } = useTiles(role);
  const shortcuts = tabsFor(role).filter((x) => x.id !== "home" && x.id !== "more");
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-3 space-y-3">
      <div className="px-1 pt-1">
        <div className="text-[13px] text-muted-foreground">{greet}</div>
        <div className="text-2xl font-bold leading-tight">{session!.user.name}</div>
        <div className="mt-1.5 flex gap-2 flex-wrap"><Chip tone="primary">{def.label}</Chip><Chip>{session!.user.warehouse}</Chip><Chip>{session!.user.shift}</Chip></div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((x) => <StatTile key={x.label} {...x} />)}
      </div>

      <SectionTitle>Your work</SectionTitle>
      <div className="grid gap-2.5">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          const n = badge[s.id];
          return (
            <Card key={s.id} onClick={() => go(s.id)} className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center"><Icon className="h-6 w-6 text-primary" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold">{s.label}</div>
                <div className="text-xs text-muted-foreground truncate">{SCREEN_META[s.id].hint}</div>
              </div>
              {n !== undefined && n > 0 && <span className="min-w-8 h-8 px-2 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">{n}</span>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
