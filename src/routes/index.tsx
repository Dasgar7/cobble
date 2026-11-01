import { createFileRoute } from "@tanstack/react-router";
import { CobbleApp } from "@/components/cobble-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CobbleApp />;
}
