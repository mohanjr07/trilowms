import { useEffect, useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useEditorStore } from "@/lib/wms-editor-store";
import { AuthGuard } from "@/components/auth/AuthGuard";

export function AppShell() {
  const _loadFromCloud = useEditorStore((s) => s._loadFromCloud);
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const path = useRouterState({ select: (st) => st.location.pathname });
  useEffect(() => { setNavOpen(false); }, [path]);

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
    </AuthGuard>
  );
}
