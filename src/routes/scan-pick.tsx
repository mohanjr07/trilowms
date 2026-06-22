import { createFileRoute } from "@tanstack/react-router";
import { HandheldPickScreen } from "@/components/handheld/HandheldPickScreen";

export const Route = createFileRoute("/scan-pick")({
  head: () => ({ meta: [{ title: "Scan Pick — TriloWMS" }, { name: "description", content: "Handheld scan-to-pick" }] }),
  component: HandheldPickScreen,
});
