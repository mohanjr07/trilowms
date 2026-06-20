import { createFileRoute } from "@tanstack/react-router";
import { ConsolidationPage } from "@/components/consolidation/ConsolidationPage";

export const Route = createFileRoute("/consolidation")({
  head: () => ({ meta: [{ title: "Consolidation — TriloWMS" }, { name: "description", content: "Staging lanes, order consolidation check & move to packing" }] }),
  component: ConsolidationPage,
});
