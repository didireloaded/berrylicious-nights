import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListOrdered } from "lucide-react";

type Row = {
  id: string;
  party_size: number;
  preferred_date: string;
  guest_name: string | null;
  guest_phone: string | null;
  status: string;
  created_at: string;
};

export function AdminWaitlistPanel() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("waitlist_entries")
      .select("id, party_size, preferred_date, guest_name, guest_phone, status, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-waitlist")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist_entries" }, () => load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("waitlist_entries").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Waitlist updated");
      void load();
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 max-w-lg">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2 mb-1">
        <ListOrdered className="w-5 h-5 text-primary" />
        Waitlist
      </h2>
      <p className="text-xs text-muted-foreground mb-4">Oldest first. Notified when a booking cancels (same night).</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries.</p>
      ) : (
        <ul className="space-y-2 max-h-[280px] overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{r.id.slice(0, 8)}</span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    r.status === "waiting"
                      ? "bg-primary/20 text-primary"
                      : r.status === "notified"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="text-foreground font-medium mt-1">
                {r.preferred_date} · {r.party_size} guests
              </p>
              <p className="text-xs text-muted-foreground">
                {[r.guest_name, r.guest_phone].filter(Boolean).join(" · ") || "Signed-in user"}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {r.status === "waiting" && (
                  <button
                    type="button"
                    onClick={() => void setStatus(r.id, "notified")}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    Mark notified
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void setStatus(r.id, "seated")}
                  className="text-[10px] font-semibold text-emerald-500 hover:underline"
                >
                  Seated
                </button>
                <button
                  type="button"
                  onClick={() => void setStatus(r.id, "cancelled")}
                  className="text-[10px] font-semibold text-destructive hover:underline"
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
