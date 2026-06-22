/**
 * TriloWMS Authentication & RBAC Store
 * Full enterprise role-based access control system
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Role definitions ─────────────────────────────────────────────────────────

export type UserRole =
  | "super_admin"
  | "warehouse_admin"
  | "operations_manager"
  | "inventory_manager"
  | "inbound_supervisor"
  | "outbound_supervisor"
  | "picker"
  | "forklift_operator"
  | "qc_inspector"
  | "packing_operator"
  | "yard_manager"
  | "auditor";

export interface RoleDefinition {
  id: UserRole;
  label: string;
  color: string;           // tailwind color token
  bgColor: string;
  allowedRoutes: string[]; // route paths allowed
  defaultRoute: string;    // where to land after login
  dashboardType: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  super_admin: {
    id: "super_admin",
    label: "Super Admin",
    color: "text-amber-400",
    bgColor: "bg-amber-400/15 border-amber-400/30",
    allowedRoutes: ["/", "/orders", "/builder", "/inventory", "/inbound", "/putaway", "/scan-putaway", "/picking", "/scan-pick", "/consolidation", "/packing", "/scan-pack", "/outbound", "/yard", "/qc", "/returns", "/labor", "/reports", "/admin"],
    defaultRoute: "/",
    dashboardType: "enterprise",
  },
  warehouse_admin: {
    id: "warehouse_admin",
    label: "Warehouse Admin",
    color: "text-orange-400",
    bgColor: "bg-orange-400/15 border-orange-400/30",
    allowedRoutes: ["/", "/orders", "/builder", "/inventory", "/inbound", "/outbound", "/labor", "/reports"],
    defaultRoute: "/",
    dashboardType: "warehouse",
  },
  operations_manager: {
    id: "operations_manager",
    label: "Operations Manager",
    color: "text-blue-400",
    bgColor: "bg-blue-400/15 border-blue-400/30",
    allowedRoutes: ["/", "/orders", "/inbound", "/outbound", "/picking", "/scan-pick", "/labor", "/yard"],
    defaultRoute: "/",
    dashboardType: "operations",
  },
  inventory_manager: {
    id: "inventory_manager",
    label: "Inventory Manager",
    color: "text-green-400",
    bgColor: "bg-green-400/15 border-green-400/30",
    allowedRoutes: ["/", "/inventory", "/putaway", "/scan-putaway", "/returns"],
    defaultRoute: "/inventory",
    dashboardType: "inventory",
  },
  inbound_supervisor: {
    id: "inbound_supervisor",
    label: "Inbound Supervisor",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/15 border-cyan-400/30",
    allowedRoutes: ["/", "/inbound", "/putaway", "/scan-putaway", "/yard"],
    defaultRoute: "/inbound",
    dashboardType: "inbound",
  },
  outbound_supervisor: {
    id: "outbound_supervisor",
    label: "Outbound Supervisor",
    color: "text-violet-400",
    bgColor: "bg-violet-400/15 border-violet-400/30",
    allowedRoutes: ["/", "/orders", "/picking", "/scan-pick", "/consolidation", "/packing", "/scan-pack", "/outbound", "/yard"],
    defaultRoute: "/outbound",
    dashboardType: "outbound",
  },
  picker: {
    id: "picker",
    label: "Picker",
    color: "text-lime-400",
    bgColor: "bg-lime-400/15 border-lime-400/30",
    allowedRoutes: ["/", "/picking", "/scan-pick", "/consolidation"],
    defaultRoute: "/picking",
    dashboardType: "picker",
  },
  forklift_operator: {
    id: "forklift_operator",
    label: "Forklift Operator",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/15 border-yellow-400/30",
    allowedRoutes: ["/", "/putaway", "/scan-putaway"],
    defaultRoute: "/putaway",
    dashboardType: "forklift",
  },
  qc_inspector: {
    id: "qc_inspector",
    label: "QC Inspector",
    color: "text-rose-400",
    bgColor: "bg-rose-400/15 border-rose-400/30",
    allowedRoutes: ["/", "/qc", "/returns", "/inventory"],
    defaultRoute: "/qc",
    dashboardType: "qc",
  },
  packing_operator: {
    id: "packing_operator",
    label: "Packing Operator",
    color: "text-pink-400",
    bgColor: "bg-pink-400/15 border-pink-400/30",
    allowedRoutes: ["/", "/consolidation", "/packing", "/scan-pack"],
    defaultRoute: "/packing",
    dashboardType: "packing",
  },
  yard_manager: {
    id: "yard_manager",
    label: "Yard Manager",
    color: "text-teal-400",
    bgColor: "bg-teal-400/15 border-teal-400/30",
    allowedRoutes: ["/", "/orders", "/yard", "/inbound", "/outbound"],
    defaultRoute: "/yard",
    dashboardType: "yard",
  },
  auditor: {
    id: "auditor",
    label: "Auditor",
    color: "text-slate-400",
    bgColor: "bg-slate-400/15 border-slate-400/30",
    allowedRoutes: ["/", "/reports", "/inventory"],
    defaultRoute: "/reports",
    dashboardType: "auditor",
  },
};

// ─── Demo users ───────────────────────────────────────────────────────────────

export interface DemoUser {
  id: string;
  email: string;
  password: string;
  name: string;
  avatar: string; // initials
  role: UserRole;
  warehouse: string;
  shift: string;
  employeeId: string;
  lastLogin?: string;
}

export const DEMO_USERS: DemoUser[] = [
  { id: "u1",  email: "admin@trilowms.com",     password: "Admin@123",     name: "Alex Rodriguez",   avatar: "AR", role: "super_admin",        warehouse: "All Warehouses",  shift: "All Shifts",  employeeId: "EMP-0001" },
  { id: "u2",  email: "whadmin@trilowms.com",   password: "Warehouse@123", name: "Maria Chen",       avatar: "MC", role: "warehouse_admin",    warehouse: "TRILO-DC-01",     shift: "Shift A",     employeeId: "EMP-0042" },
  { id: "u3",  email: "ops@trilowms.com",       password: "Ops@123",       name: "James Okafor",     avatar: "JO", role: "operations_manager", warehouse: "TRILO-DC-01",     shift: "Shift B",     employeeId: "EMP-0078" },
  { id: "u4",  email: "inventory@trilowms.com", password: "Inventory@123", name: "Priya Nair",       avatar: "PN", role: "inventory_manager",  warehouse: "TRILO-DC-01",     shift: "Shift A",     employeeId: "EMP-0091" },
  { id: "u5",  email: "inbound@trilowms.com",   password: "Inbound@123",   name: "Diego Vasquez",    avatar: "DV", role: "inbound_supervisor", warehouse: "TRILO-DC-01",     shift: "Shift A",     employeeId: "EMP-0103" },
  { id: "u6",  email: "outbound@trilowms.com",  password: "Outbound@123",  name: "Sarah Kim",        avatar: "SK", role: "outbound_supervisor",warehouse: "TRILO-DC-01",     shift: "Shift B",     employeeId: "EMP-0117" },
  { id: "u7",  email: "picker1@trilowms.com",   password: "Picker@123",    name: "Marcus Johnson",   avatar: "MJ", role: "picker",             warehouse: "TRILO-DC-01",     shift: "Shift B",     employeeId: "EMP-0204" },
  { id: "u8",  email: "forklift@trilowms.com",  password: "Forklift@123",  name: "Tommy Wu",         avatar: "TW", role: "forklift_operator",  warehouse: "TRILO-DC-01",     shift: "Shift A",     employeeId: "EMP-0231" },
  { id: "u9",  email: "qc@trilowms.com",        password: "QC@123",        name: "Aisha Patel",      avatar: "AP", role: "qc_inspector",       warehouse: "TRILO-DC-01",     shift: "Shift B",     employeeId: "EMP-0289" },
  { id: "u10", email: "packing@trilowms.com",   password: "Packing@123",   name: "Carlos Mendez",    avatar: "CM", role: "packing_operator",   warehouse: "TRILO-DC-01",     shift: "Shift A",     employeeId: "EMP-0312" },
  { id: "u11", email: "yard@trilowms.com",      password: "Yard@123",      name: "Fatima Al-Hassan", avatar: "FH", role: "yard_manager",       warehouse: "TRILO-DC-01",     shift: "Shift B",     employeeId: "EMP-0345" },
  { id: "u12", email: "audit@trilowms.com",     password: "Audit@123",     name: "Robert Steele",    avatar: "RS", role: "auditor",            warehouse: "TRILO-DC-01",     shift: "All Shifts",  employeeId: "EMP-0401" },
];

// ─── Auth store ───────────────────────────────────────────────────────────────

export interface AuthSession {
  user: DemoUser;
  loginTime: number;
  expiresAt: number;
}

interface AuthState {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  canAccess: (route: string) => boolean;
  role: () => RoleDefinition | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 900));

        const user = DEMO_USERS.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
        );

        if (!user) {
          set({ isLoading: false, error: "Invalid email or password. Please check your credentials." });
          return false;
        }

        const now = Date.now();
        const session: AuthSession = {
          user: { ...user, lastLogin: new Date(now).toISOString() },
          loginTime: now,
          expiresAt: now + 8 * 60 * 60 * 1000, // 8-hour session
        };

        set({ session, isAuthenticated: true, isLoading: false, error: null });
        return true;
      },

      logout: () => {
        set({ session: null, isAuthenticated: false, error: null });
      },

      clearError: () => set({ error: null }),

      canAccess: (route) => {
        const { session } = get();
        if (!session) return false;
        const def = ROLE_DEFINITIONS[session.user.role];
        return def.allowedRoutes.some((r) => route === r || (r !== "/" && route.startsWith(r)));
      },

      role: () => {
        const { session } = get();
        if (!session) return null;
        return ROLE_DEFINITIONS[session.user.role];
      },
    }),
    {
      name: "trilowms-auth",
      partialize: (state) => ({ session: state.session, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
