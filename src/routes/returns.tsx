import { createFileRoute } from "@tanstack/react-router";
import { ReturnsPage } from "@/components/returns/ReturnsPage";

export const Route = createFileRoute("/returns")({
  head: () => ({ meta: [{ title: "Returns & RMA — TriloWMS" }, { name: "description", content: "RMA queue, inspection workflow & credit management" }] }),
  component: ReturnsPage,
});
