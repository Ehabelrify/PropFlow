import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/leads")({
  component: LeadsLayout,
});

function LeadsLayout() {
  return <Outlet />;
}
