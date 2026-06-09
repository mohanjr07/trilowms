import { createFileRoute } from "@tanstack/react-router";
import { OutboundPage } from "@/components/outbound/OutboundPage";

export const Route = createFileRoute("/outbound")({
  head: () => ({ meta: [{ title: "Outbound — TriloWMS" }, { name: "description", content: "Shipment planning, dispatch & SLA tracking" }] }),
  component: OutboundPage,
});
