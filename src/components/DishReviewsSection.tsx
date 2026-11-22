import { useEffect, useState } from "react";
import { Flag, MessageSquareReply, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useDishRatings } from "@/hooks/useDishRatings";
import type { PublicFoodReview } from "@/lib/reviews";

type DynamicPublicReviewDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{
            data: PublicFoodReview[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
  };
};

export function DishReviewsSection({ menuItemId }: { menuItemId: string }) {
  const { user } = useAuth();
  const summaries = useDishRatings();
  const summary = summaries.get(menuItemId);
  const [reviews, setReviews] = useState<PublicFoodReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const db = supabase as unknown as DynamicPublicReviewDb;

    void db
      .from("public_food_reviews")
      .select("*")
      .eq("menu_item_id", menuItemId)
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && Array.isArray(data)) {
          setReviews(data);
        } else {
          setReviews([]);
        }
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [menuItemId]);

  const submitReport = async (reviewId: string) => {
    if (!user?.id) {
      toast.error("Sign in to report a review.");
      return;
    }
    if (reportReason.trim().length < 3) {
      toast.error("Please add a brief reason for reporting.");
      return;
    }
    const db = supabase as unknown as DynamicPublicReviewDb;
    const { error } = await db.from("review_reports").insert({
      review_id: reviewId,
      reporter_id: user.id,
      reason: reportReason.trim(),
    });
    if (error) {
      toast.error("Could not submit report (you may have already reported this review).");
      return;
    }
    toast.success("Reported for Butcher Block management review.");
    setReportingId(null);
    setReportReason("");
  };

  return (
    <section
      className="mt-10 border-t border-white/10 px-5 pt-8 sm:px-6 lg:px-0"
      aria-labelledby="dish-reviews-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="dish-reviews-heading" className="text-[20px] font-bold tracking-[-0.03em] text-white">
            Verified Diner Reviews
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#A3A3A3]">
            <ShieldCheck className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Only guests with completed orders can rate this dish
          </p>
        </div>

        {summary && summary.review_count > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#242424] px-3.5 py-1.5">
            <Star className="h-4 w-4 fill-[#FF5A1F] text-[#FF5A1F]" aria-hidden="true" />
            <span className="text-[15px] font-extrabold tabular-nums text-white">
              {summary.avg_rating.toFixed(1)}
            </span>
            <span className="text-[13px] text-[#A3A3A3]">
              ({summary.review_count} {summary.review_count === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-[14px] text-[#A3A3A3]">Loading verified reviews…</p>
      ) : reviews.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-white/10 bg-[#242424] p-5">
          <p className="text-[14px] font-semibold text-white">No verified reviews yet</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#A3A3A3]">
            After your Butcher Block order is completed, you can rate this dish directly from your order receipt.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {reviews.map((rev) => (
            <article
              key={rev.id}
              className="rounded-[20px] border border-white/10 bg-[#242424] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-bold text-white">{rev.reviewer_name}</p>
                    <span className="rounded-full bg-[#FF5A1F]/15 px-2 py-0.5 text-[11px] font-semibold text-[#FF5A1F]">
                      Verified order
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1" aria-label={`Rated ${rev.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={
                          "h-3.5 w-3.5 " +
                          (s <= rev.rating ? "fill-[#FF5A1F] text-[#FF5A1F]" : "text-[#525252]")
                        }
                        aria-hidden="true"
                      />
                    ))}
                    <span className="ml-1.5 text-[12px] text-[#A3A3A3]">
                      {new Date(rev.created_at).toLocaleDateString("en-GB", {
                        timeZone: "Africa/Windhoek",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {user && (
                  <button
                    type="button"
                    onClick={() => setReportingId((curr) => (curr === rev.id ? null : rev.id))}
                    aria-label="Report review"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#A3A3A3] hover:bg-[#303030] hover:text-white"
                  >
                    <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {rev.comment && (
                <p className="mt-2.5 text-[14px] leading-relaxed text-[#E5E5E5]">{rev.comment}</p>
              )}

              {rev.photo_url && (
                <img
                  src={rev.photo_url}
                  alt={`Guest photo of ${rev.menu_item_name}`}
                  loading="lazy"
                  className="mt-3 max-h-56 w-auto rounded-2xl border border-white/10 object-cover"
                />
              )}

              {rev.staff_response && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-[#1B1B1B] p-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold text-[#FF5A1F]">
                    <MessageSquareReply className="h-3.5 w-3.5" aria-hidden="true" />
                    Butcher Block Response
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#C4C4C4]">{rev.staff_response}</p>
                </div>
              )}

              {reportingId === rev.id && (
                <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                  <input
                    type="text"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Reason for reporting…"
                    className="min-h-[40px] flex-1 rounded-xl border border-white/10 bg-[#181818] px-3 text-[13px] text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void submitReport(rev.id)}
                    className="min-h-[40px] rounded-full bg-[#FF5A1F] px-4 text-[12px] font-bold text-white"
                  >
                    Send
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
