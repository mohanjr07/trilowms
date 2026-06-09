import { createFileRoute } from "@tanstack/react-router";
import { PackingPage } from "@/components/packing/PackingPage";

export const Route = createFileRoute("/packing")({
  head: () => ({ meta: [{ title: "Packing — TriloWMS" }, { name: "description", content: "Pack stations, carton management & order fulfilment" }] }),
  component: PackingPage,
});
