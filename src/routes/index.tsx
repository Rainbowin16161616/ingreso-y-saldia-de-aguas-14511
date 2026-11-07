import { createFileRoute } from "@tanstack/react-router";
import { CardexApp } from "@/components/cardex-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CardexApp />;
}
