import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, LogOut, Loader2, CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { toast } from "sonner";

type Stage = "todo" | "in_progress" | "done";
type Task = {
  id: string;
  title: string;
  description: string | null;
  stage: Stage;
  created_at: string;
};

const STAGES: { id: Stage; label: string; icon: typeof Circle; tone: string }[] = [
  { id: "todo", label: "Todo", icon: Circle, tone: "oklch(0.7 0.13 50)" },
  { id: "in_progress", label: "In Progress", icon: CircleDashed, tone: "oklch(0.65 0.16 240)" },
  { id: "done", label: "Done", icon: CheckCircle2, tone: "oklch(0.62 0.16 155)" },
];

export function TaskBoard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const tasksQ = useQuery({
    queryKey: ["tasks", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,stage,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: { id?: string; title: string; description: string; stage: Stage }) => {
      if (input.id) {
        const { error } = await supabase
          .from("tasks")
          .update({ title: input.title, description: input.description, stage: input.stage })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert({ title: input.title, description: input.description, stage: input.stage, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setEditing(null);
      toast.success("Task saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStage = useMutation({
    mutationFn: async (v: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("tasks").update({ stage: v.stage }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const grouped = useMemo(() => {
    const g: Record<Stage, Task[]> = { todo: [], in_progress: [], done: [] };
    (tasksQ.data ?? []).forEach((t) => g[t.stage].push(t));
    return g;
  }, [tasksQ.data]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Flow</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4" /> New task</Button>
              </DialogTrigger>
              <TaskDialog
                key={editing?.id ?? "new"}
                initial={editing}
                onSubmit={(v) => upsert.mutate({ ...v, id: editing?.id })}
                submitting={upsert.isPending}
              />
            </Dialog>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {tasksQ.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tasksQ.isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load tasks. {(tasksQ.error as Error).message}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {STAGES.map((s) => {
              const Icon = s.icon;
              return (
                <section key={s.id} className="rounded-xl border bg-card p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color: s.tone }} />
                      <h2 className="font-medium">{s.label}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {grouped[s.id].length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {grouped[s.id].length === 0 && (
                      <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                        No tasks
                      </p>
                    )}
                    {grouped[s.id].map((t) => (
                      <article key={t.id} className="group rounded-lg border bg-background p-3 transition-shadow hover:shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium leading-snug">{t.title}</h3>
                          <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => { setEditing(t); setOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => del.mutate(t.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {t.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{t.description}</p>
                        )}
                        <div className="mt-3">
                          <Select value={t.stage} onValueChange={(v) => updateStage.mutate({ id: t.id, stage: v as Stage })}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAGES.map((st) => (
                                <SelectItem key={st.id} value={st.id}>{st.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function TaskDialog({
  initial, onSubmit, submitting,
}: {
  initial: Task | null;
  onSubmit: (v: { title: string; description: string; stage: Stage }) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [stage, setStage] = useState<Stage>(initial?.stage ?? "todo");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit task" : "New task"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({ title: title.trim(), description: description.trim(), stage });
        }}
      >
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <Textarea placeholder="Description (optional)" value={description}
          onChange={(e) => setDescription(e.target.value)} rows={4} />
        <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}