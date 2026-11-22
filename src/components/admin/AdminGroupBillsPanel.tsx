import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCentsNAD } from "@/lib/billSplit";

interface StaffGroupRow {
  id: string;
  table_display_name: string;
  invite_code: string;
  status: string;
  submitted_order_id: string | null;
  created_at: string;
}

interface StaffAllocRow {
  id: string;
  group_order_id: string;
  participant_id: string;
  split_method: string;
  amount_cents: number;
  bill_total_cents: number;
  payment_status: "unpaid" | "settled" | "void";
  settlement_reference: string | null;
}

interface StaffParticipantRow {
  id: string;
  display_name: string;
}

export function AdminGroupBillsPanel() {
  const [groups, setGroups] = useState<StaffGroupRow[]>([]);
  const [allocs, setAllocs] = useState<StaffAllocRow[]>([]);
  const [participants, setParticipants] = useState<StaffParticipantRow[]>([]);
  const [refDrafts, setRefDrafts] = useState<Record<string, string>>({});

  const raw = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (k: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const loadAll = useCallback(async () => {
    const [gRes, aRes, pRes] = await Promise.all([
      raw.from("group_orders").select("*").order("created_at", { ascending: false }).limit(30),
      raw.from("bill_allocations").select("*").order("created_at", { ascending: false }).limit(120),
      raw.from("group_participants").select("id, display_name").order("joined_at", { ascending: false }).limit(150),
    ]);
    if (!gRes.error && Array.isArray(gRes.data)) setGroups(gRes.data as StaffGroupRow[]);
    if (!aRes.error && Array.isArray(aRes.data)) setAllocs(aRes.data as StaffAllocRow[]);
    if (!pRes.error && Array.isArray(pRes.data)) setParticipants(pRes.data as StaffParticipantRow[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAll();
    const channel = supabase
      .channel("admin-group-bills")
      .on("postgres_changes", { event: "*", schema: "public", table: "bill_allocations" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_orders" }, () => void loadAll())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const nameByPid = new Map(participants.map((p) => [p.id, p.display_name]));

  const markSettled = async (allocationId: string) => {
    const { error } = await raw.rpc("mark_bill_allocation_settled", {
      p_allocation_id: allocationId,
      p_reference: (refDrafts[allocationId] ?? "").trim() || null,
      p_method: "pos_table",
    });
    if (error) {
      toast.error(error.message || "Could not settle share (ensure Phase 6 SQL migration is applied).");
      return;
    }
    toast.success("Participant share marked settled");
    void loadAll();
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Group Orders &amp; Split Bill Settlement</h2>
          <p className="text-xs text-muted-foreground">
            Verify participant bill shares and record real table/POS settlement. When all shares settle, the linked kitchen order marks paid automatically.
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

      {groups.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/40 py-10 text-center text-xs text-muted-foreground">
          No active or recent group orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const gAllocs = allocs.filter((a) => a.group_order_id === g.id);
            const totalCents = gAllocs[0]?.bill_total_cents ?? gAllocs.reduce((s, a) => s + a.amount_cents, 0);
            const settledCents = gAllocs
              .filter((a) => a.payment_status === "settled")
              .reduce((s, a) => s + a.amount_cents, 0);
            return (
              <section key={g.id} className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">{g.table_display_name}</span>
                    <span className="font-mono text-xs text-primary">{g.invite_code}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {g.status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold tabular-nums">
                    <span className="text-emerald-400">{formatCentsNAD(settledCents)}</span>
                    <span className="text-muted-foreground"> / {formatCentsNAD(totalCents)}</span>
                  </div>
                </div>

                {gAllocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No bill split configured yet.</p>
                ) : (
                  <div className="space-y-2">
                    {gAllocs.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
                        <div>
                          <span className="font-semibold text-foreground">
                            {nameByPid.get(a.participant_id) ?? "Guest"}
                          </span>
                          <span className="ml-2 font-bold text-primary tabular-nums">
                            {formatCentsNAD(a.amount_cents)}
                          </span>
                          <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                            ({a.split_method})
                          </span>
                        </div>
                        {a.payment_status === "settled" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Settled {a.settlement_reference ? `· ${a.settlement_reference}` : ""}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={refDrafts[a.id] ?? ""}
                              onChange={(e) => setRefDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                              placeholder="POS / receipt ref"
                              className="h-7 w-32 rounded-md border border-border bg-background px-2 text-[11px] text-foreground"
                            />
                            <button
                              type="button"
                              onClick={() => void markSettled(a.id)}
                              className="h-7 rounded-md bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                            >
                              Mark Settled
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
