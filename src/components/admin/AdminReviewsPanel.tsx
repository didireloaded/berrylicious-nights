import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, EyeOff, Flag, MessageSquareReply, RefreshCw, RotateCcw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { summarizeRecurringComplaints, type ManagedFoodReview } from "@/lib/reviews";
import { invalidateDishRatingsCache } from "@/hooks/useDishRatings";

type DynamicModerationDb = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{
          data: ManagedFoodReview[] | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function AdminReviewsPanel() {
  const [reviews, setReviews] = useState<ManagedFoodReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dishQuery, setDishQuery] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const db = supabase as unknown as DynamicModerationDb;
    const { data, error } = await db
      .from("food_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && Array.isArray(data)) {
      setReviews(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const recurringComplaints = useMemo(() => summarizeRecurringComplaints(reviews, 2), [reviews]);

  const filtered = useMemo(() => {
    const q = dishQuery.trim().toLowerCase();
    return reviews.filter((r) => {
      if (ratingFilter !== "all" && r.rating !== Number(ratingFilter)) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.menu_item_name.toLowerCase().includes(q) && !r.reviewer_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reviews, ratingFilter, statusFilter, dishQuery]);

  const runModeration = async (
    reviewId: string,
    action: "respond" | "hide" | "flag" | "remove" | "restore",
  ) => {
    const db = supabase as unknown as DynamicModerationDb;
    const staffResponse = action === "respond" ? (replyDrafts[reviewId] ?? "").trim() : null;
    const reason = (reasonDrafts[reviewId] ?? "").trim() || (action === "respond" ? "Management reply" : `Moderation: ${action}`);
    if (action === "respond" && !staffResponse) {
      toast.error("Write a response before sending.");
      return;
    }

    const { error } = await db.rpc("moderate_food_review", {
      p_review_id: reviewId,
      p_action: action,
      p_reason: reason,
      p_staff_response: staffResponse,
    });
    if (error) {
      toast.error(error.message || "Moderation failed (ensure Phase 2 SQL migration is applied).");
      return;
    }
    invalidateDishRatingsCache();
    toast.success(`Review ${action === "respond" ? "replied" : action}`);
    void fetchReviews();
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Verified Dish Reviews</h2>
          <p className="text-xs text-muted-foreground">
            Respond to verified guests and moderate abusive content. Customer numerical star scores are immutable and audited.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchReviews()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {recurringComplaints.length > 0 && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
            <AlertTriangle className="h-4 w-4" /> Recurring Low-Rating Dishes (&le; 2 stars)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recurringComplaints.map((c) => (
              <span
                key={c.menuItemId}
                className="rounded-full border border-amber-500/30 bg-background/60 px-3 py-1 text-xs font-semibold text-amber-200"
              >
                {c.name} ({c.lowRatingCount} low ratings)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={dishQuery}
          onChange={(e) => setDishQuery(e.target.value)}
          placeholder="Filter by dish or guest…"
          className="h-9 rounded-lg border border-border bg-card px-3 text-xs text-foreground"
        />
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          aria-label="Filter by star rating"
          className="h-9 rounded-lg border border-border bg-card px-3 text-xs text-foreground"
        >
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((s) => (
            <option key={s} value={String(s)}>
              {s} stars
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by moderation status"
          className="h-9 rounded-lg border border-border bg-card px-3 text-xs text-foreground"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="flagged">Flagged</option>
          <option value="hidden">Hidden</option>
          <option value="removed">Removed</option>
        </select>
      </div>

      {loading ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Loading verified reviews…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/40 py-10 text-center text-xs text-muted-foreground">
          No verified dish reviews match these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{r.menu_item_name}</span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                      <Star className="h-3 w-3 fill-primary" /> {r.rating}/5
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.reviewer_name} · Order #BB-{r.order_id.slice(0, 6).toUpperCase()} ·{" "}
                    {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Africa/Windhoek" })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {r.status !== "published" ? (
                    <button
                      type="button"
                      onClick={() => void runModeration(r.id, "restore")}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"
                    >
                      <RotateCcw className="h-3 w-3" /> Restore
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void runModeration(r.id, "flag")}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300"
                      >
                        <Flag className="h-3 w-3" /> Flag
                      </button>
                      <button
                        type="button"
                        onClick={() => void runModeration(r.id, "hide")}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        <EyeOff className="h-3 w-3" /> Hide
                      </button>
                      <button
                        type="button"
                        onClick={() => void runModeration(r.id, "remove")}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </>
                  )}
                </div>
              </div>

              {r.comment && <p className="text-xs text-foreground/90">{r.comment}</p>}

              {r.private_issue_note && (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <span className="font-bold text-amber-300">Private Guest Note (not public): </span>
                  {r.private_issue_note}
                </div>
              )}

              {r.staff_response && (
                <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">Published Reply: </span>
                  {r.staff_response}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={replyDrafts[r.id] ?? r.staff_response ?? ""}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Write a public management response…"
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reasonDrafts[r.id] ?? ""}
                    onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Audit reason (optional)"
                    className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => void runModeration(r.id, "respond")}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                  >
                    <MessageSquareReply className="h-3.5 w-3.5" /> Reply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
