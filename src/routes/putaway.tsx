import { createFileRoute } from "@tanstack/react-router";
import { PutawayPage } from "@/components/putaway/PutawayPage";

export const Route = createFileRoute("/putaway")({
  head: () => ({ meta: [{ title: "Putaway — TriloWMS" }, { name: "description", content: "Task queue, putaway rules & operator workloads" }] }),
  component: PutawayPage,
});
