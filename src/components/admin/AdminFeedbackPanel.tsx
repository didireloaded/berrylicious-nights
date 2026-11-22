import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PrivateFeedbackRow {
  id: string;
  table_label: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  category: string;
  message: string;
  wants_manager_visit: boolean;
  status: "open" | "acknowledged" | "resolved";
  staff_note: string | null;
  created_at: string;
}

export function AdminFeedbackPanel() {
  const [rows, setRows] = useState<PrivateFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const raw = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (k: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await raw
      .from("private_dining_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    if (!error && Array.isArray(data)) setRows(data as PrivateFeedbackRow[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAll();
    const channel = supabase
      .channel("admin-private-feedback")
      .on("postgres_changes", { event: "*", schema: "public", table: "private_dining_feedback" }, () => void loadAll())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const updateStatus = async (id: string, nextStatus: "acknowledged" | "resolved") => {
    const { error } = await raw.rpc("update_private_feedback_status", {
      p_feedback_id: id,
      p_next_status: nextStatus,
      p_staff_note: (notes[id] ?? "").trim() || null,
    });
    if (error) {
      toast.error(error.message || "Could not update feedback status");
      return;
    }
    toast.success(`Feedback ${nextStatus}`);
    void loadAll();
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Lock className="h-4 w-4 text-primary" /> Private Dining Feedback
          </h2>
          <p className="text-xs text-muted-foreground">
            Confidential guest compliments, service issues, and duty-manager requests. Never displayed publicly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Loading private feedback…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/40 py-10 text-center text-xs text-muted-foreground">
          No private dining feedback notes yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article
              key={r.id}
              className={`rounded-xl border p-4 space-y-2.5 ${
                r.wants_manager_visit && r.status === "open"
                  ? "border-amber-500/45 bg-amber-500/10"
                  : "border-border/60 bg-card/50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold uppercase text-primary">
                    {r.category.replace("_", " ")}
                  </span>
                  {r.wants_manager_visit && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> Manager requested
                    </span>
                  )}
                  {r.table_label && <span className="text-xs font-bold text-foreground">{r.table_label}</span>}
                  {r.guest_name && <span className="text-xs text-muted-foreground">{r.guest_name}</span>}
                  {r.guest_phone && <span className="text-xs text-muted-foreground">· {r.guest_phone}</span>}
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {r.status}
                </span>
              </div>

              <p className="text-sm text-foreground">{r.message}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Africa/Windhoek" })}
              </p>

              {r.staff_note && (
                <p className="rounded-lg bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Staff note: </span>
                  {r.staff_note}
                </p>
              )}

              {r.status !== "resolved" && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Internal resolution note (optional)"
                    className="h-8 flex-1 min-w-[180px] rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                  />
                  {r.status === "open" && (
                    <button
                      type="button"
                      onClick={() => void updateStatus(r.id, "acknowledged")}
                      className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void updateStatus(r.id, "resolved")}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-300"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
