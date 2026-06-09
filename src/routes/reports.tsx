import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/reports/ReportsPage";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — TriloWMS" }, { name: "description", content: "Warehouse analytics, throughput trends & carrier scorecards" }] }),
  component: ReportsPage,
});
