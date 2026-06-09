import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin/AdminPage";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — TriloWMS" }, { name: "description", content: "User management, roles, warehouse config & system health" }] }),
  component: AdminPage,
});
