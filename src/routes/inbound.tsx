import { createFileRoute } from "@tanstack/react-router";
import { InboundPage } from "@/components/inbound/InboundPage";

export const Route = createFileRoute("/inbound")({
  head: () => ({ meta: [{ title: "Inbound — TriloWMS" }, { name: "description", content: "ASN management, dock scheduling & receiving" }] }),
  component: InboundPage,
});
