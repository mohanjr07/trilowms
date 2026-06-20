import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/components/orders/OrdersPage";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders — TriloWMS" }, { name: "description", content: "Order intake, allocation & fulfillment tracking" }] }),
  component: OrdersPage,
});
