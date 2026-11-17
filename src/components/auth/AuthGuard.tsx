/**
 * AuthGuard — wraps the whole app, shows LoginScreen if not authenticated,
 * otherwise renders the AppShell. Also handles per-route access control.
 */

import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuthStore, verifyAuthSession } from "@/lib/auth-store";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useCloudReady } from "@/lib/cloud-ready";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, session, canAccess, role } = useAuthStore();
  const cloudReady = useCloudReady();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // If the Supabase sign-in is gone (expired or signed out elsewhere), return to the login screen.
  useEffect(() => { void verifyAuthSession(); }, [pathname]);

  // Session expiry check
  useEffect(() => {
    if (session && Date.now() > session.expiresAt) {
      useAuthStore.getState().logout();
    }
  }, [session, pathname]);

  // Not authenticated → show login
  if (!isAuthenticated || !session) {
    return <LoginScreen />;
  }

  // Authenticated but route not allowed → redirect to default
  if (!canAccess(pathname)) {
    const def = role();
    navigate({ to: def?.defaultRoute ?? "/" });
    return null;
  }

  if (!cloudReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        Loading warehouse data…
      </div>
    );
  }

  return <>{children}</>;
}
