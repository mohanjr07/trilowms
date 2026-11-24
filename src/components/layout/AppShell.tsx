import { useEffect, useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useEditorStore } from "@/lib/wms-editor-store";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { MobileApp } from "@/components/mobile/MobileApp";
import { useMobileMode } from "@/components/mobile/useMobileMode";

export function AppShell() {
  const _loadFromCloud = useEditorStore((s) => s._loadFromCloud);
  const [ready, setReady] = useState(false);
  const mobileApp = useMobileMode();
  const [navOpen, setNavOpen] = useState(false);
  const path = useRouterState({ select: (st) => st.location.pathname });
  useEffect(() => { setNavOpen(false); }, [path]);

  // Save layout changes (e.g. deleting a warehouse from the switcher) from ANY page, not only the Builder.
  const isDirty = useEditorStore((s) => s.isDirty);
  const _saveToCloud = useEditorStore((s) => s._saveToCloud);
  useEffect(() => {
    if (!ready || !isDirty) return;
    const t = setTimeout(() => { void _saveToCloud(); }, 1200);
    return () => clearTimeout(t);
  }, [ready, isDirty, _saveToCloud]);

  useEffect(() => {
    _loadFromCloud().finally(() => setReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs tracking-wider font-medium">LOADING WAREHOUSES…</span>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      {mobileApp ? <MobileApp /> : (
      <div className="flex h-screen max-md:h-[100dvh] w-full overflow-hidden bg-background">
        {navOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setNavOpen(false)} />}
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex flex-1 flex-col min-w-0 overflow-visible">
          <TopBar onMenu={() => setNavOpen(true)} />
          <main className="flex-1 overflow-hidden min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
      )}
    </AuthGuard>
  );
}
