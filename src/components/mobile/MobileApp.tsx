/**
 * TriloWMS Mobile App shell — app bar, role-based bottom tab bar, history-aware navigation
 * (Android back button steps back through tabs instead of leaving the app).
 */
import { useCallback, useEffect, useState } from "react";
import { useAuthStore, ROLE_DEFINITIONS } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { tabsFor, SCREEN_META, type ScreenId } from "./nav";
import { HomeScreen } from "./HomeScreen";
import { ReceiveScreen } from "./ReceiveScreen";
import { DispatchScreen } from "./DispatchScreen";
import { YardScreen } from "./YardScreen";
import { QcScreen } from "./QcScreen";
import { StockScreen } from "./StockScreen";
import { OrdersScreen } from "./OrdersScreen";
import { InsightsScreen } from "./InsightsScreen";
import { MoreScreen } from "./MoreScreen";
import { HandheldPickScreen } from "@/components/handheld/HandheldPickScreen";
import { HandheldPutawayScreen } from "@/components/handheld/HandheldPutawayScreen";
import { HandheldPackScreen } from "@/components/handheld/HandheldPackScreen";
import { useInboundStore } from "@/lib/inbound-store";
import { useOutboundStore } from "@/lib/outbound-store";
import { usePutawayStore } from "@/lib/putaway-store";
import { usePackingStore } from "@/lib/packing-store";
import { useConsolidationSync } from "./useSync";

export function MobileApp() {
  const session = useAuthStore((s) => s.session)!;
  const role = session.user.role;
  const tabs = tabsFor(role);
  const [screen, setScreen] = useState<ScreenId>("home");

  useConsolidationSync();

  const go = useCallback((s: ScreenId) => {
    setScreen((cur) => {
      if (cur !== s) { try { window.history.pushState({ m: s }, ""); } catch { /* ignore */ } }
      return s;
    });
  }, []);

  useEffect(() => {
    try { window.history.replaceState({ m: "home" }, ""); } catch { /* ignore */ }
    const onPop = (e: PopStateEvent) => setScreen(((e.state as { m?: ScreenId } | null)?.m) ?? "home");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const def = ROLE_DEFINITIONS[role];
  const fullBleed = screen === "pick" || screen === "putaway" || screen === "pack"; // scan screens draw their own header

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden">
      {!fullBleed && (
        <header className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-border bg-sidebar pt-[env(safe-area-inset-top)]">
          <div className="min-w-0">
            <div className="text-[17px] font-bold leading-tight">{screen === "home" ? "TriloWMS" : SCREEN_META[screen].label}</div>
            <div className="text-[11px] text-muted-foreground leading-tight">{def.label} · {session.user.warehouse}</div>
          </div>
          <button type="button" onClick={() => go("more")} aria-label="Profile" className="h-10 w-10 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-bold flex items-center justify-center active:scale-95">
            {session.user.avatar}
          </button>
        </header>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {screen === "home" && <HomeScreen go={go} />}
        {screen === "pick" && <HandheldPickScreen />}
        {screen === "putaway" && <HandheldPutawayScreen />}
        {screen === "pack" && <HandheldPackScreen />}
        {screen === "receive" && <ReceiveScreen />}
        {screen === "dispatch" && <DispatchScreen />}
        {screen === "yard" && <YardScreen />}
        {screen === "qc" && <QcScreen />}
        {screen === "stock" && <StockScreen canCount={role !== "auditor"} />}
        {screen === "orders" && <OrdersScreen />}
        {screen === "insights" && <InsightsScreen />}
        {screen === "more" && <MoreScreen />}
      </main>

      <nav className="shrink-0 grid border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = screen === t.id;
          return (
            <button key={t.id} type="button" onClick={() => go(t.id)} className={cn("flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-semibold active:bg-secondary", active ? "text-primary" : "text-muted-foreground")}>
              <span className={cn("h-7 w-12 rounded-full flex items-center justify-center transition", active && "bg-primary/15")}><Icon className="h-5 w-5" /></span>
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
