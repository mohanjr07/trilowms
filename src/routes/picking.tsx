import { createFileRoute } from "@tanstack/react-router";
import { PickingPage } from "@/components/picking/PickingPage";

export const Route = createFileRoute("/picking")({
  head: () => ({ meta: [{ title: "Picking — TriloWMS" }, { name: "description", content: "Wave management, pick tasks & shortage resolution" }] }),
  component: PickingPage,
});
