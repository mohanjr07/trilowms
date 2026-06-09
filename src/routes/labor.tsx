import { createFileRoute } from "@tanstack/react-router";
import { LaborPage } from "@/components/labor/LaborPage";

export const Route = createFileRoute("/labor")({
  head: () => ({ meta: [{ title: "Labor Management — TriloWMS" }, { name: "description", content: "Workforce tracking, productivity & shift management" }] }),
  component: LaborPage,
});
