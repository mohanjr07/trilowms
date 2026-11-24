/**
 * TriloWMS Mobile App shell — app bar, role-based bottom tab bar, history-aware navigation
 * (Android back button steps back through tabs instead of leaving the app).
 */
import { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
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
        <header className="shrink-0 flex items-center justify-between gap-2 px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => go("more")} aria-label="Profile" className="h-11 w-11 shrink-0 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-bold flex items-center justify-center active:scale-95">
              {session.user.avatar}
            </button>
            <div className="min-w-0">
              <div className="text-[17px] font-bold leading-tight truncate">{screen === "home" ? `Hello, ${session.user.name.split(" ")[0]}` : SCREEN_META[screen].label}</div>
              <div className="text-[11px] text-muted-foreground leading-tight truncate">{def.label} · {session.user.warehouse}</div>
            </div>
          </div>
          {screen !== "more" && <button type="button" onClick={() => void useAuthStore.getState().logout?.()} aria-label="Sign out" className="h-11 px-3 shrink-0 rounded-full bg-secondary border border-border text-[13px] font-semibold flex items-center gap-1.5 active:scale-95">
            <LogOut className="h-4 w-4" /> Sign out
          </button>}
        </header>
      )}

      <main className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain", !fullBleed && "px-2 pt-1 pb-6")}>
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

      <nav className="shrink-0 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="grid rounded-full bg-sidebar border border-border p-1.5 shadow-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = screen === t.id;
            return (
              <button key={t.id} type="button" onClick={() => go(t.id)} className={cn("flex flex-col items-center justify-center gap-0.5 h-14 rounded-full text-[10px] font-semibold transition active:scale-95", active ? "bg-primary !text-primary-foreground" : "text-muted-foreground")}>
                <Icon className="h-5 w-5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
