import { createFileRoute } from "@tanstack/react-router";
import { TaskBoard } from "@/components/TaskBoard";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Flow — Task Manager" },
      { name: "description", content: "Organize your tasks across Todo, In Progress, and Done." },
    ],
  }),
  component: TaskBoard,
});
