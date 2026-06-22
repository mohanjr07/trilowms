import { createFileRoute } from "@tanstack/react-router";
import { HandheldPutawayScreen } from "@/components/handheld/HandheldPutawayScreen";

export const Route = createFileRoute("/scan-putaway")({
  head: () => ({ meta: [{ title: "Scan Putaway — TriloWMS" }, { name: "description", content: "Handheld scan-to-putaway" }] }),
  component: HandheldPutawayScreen,
});
