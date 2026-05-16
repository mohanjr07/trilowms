/**
 * AuthGuard — wraps the whole app, shows LoginScreen if not authenticated,
 * otherwise renders the AppShell. Also handles per-route access control.
 */

import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth-store";
import { LoginScreen } from "@/components/auth/LoginScreen";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, session, canAccess, role } = useAuthStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  return <>{children}</>;
}
