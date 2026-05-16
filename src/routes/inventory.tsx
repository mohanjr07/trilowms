import { createFileRoute } from "@tanstack/react-router";
import { SkuMasterPage } from "@/components/sku/SkuMasterPage";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "SKU Master — TriloWMS" },
      { name: "description", content: "Enterprise SKU master management." },
    ],
  }),
  component: SkuMasterPage,
});
