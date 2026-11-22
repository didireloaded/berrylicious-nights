import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { canEditReview, type ManagedFoodReview } from "@/lib/reviews";

type DynamicMyReviewsDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{
            data: ManagedFoodReview[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
};

export function MyReviewsSection() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ManagedFoodReview[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setReviews([]);
      return;
    }
    let alive = true;
    const db = supabase as unknown as DynamicMyReviewsDb;
    void db
      .from("food_reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && Array.isArray(data)) setReviews(data);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  if (!user || reviews.length === 0) return null;

  return (
    <section aria-labelledby="my-reviews-heading">
      <h2 id="my-reviews-heading" className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
        My Verified Reviews
      </h2>
      <div className="space-y-2.5">
        {reviews.map((rev) => {
          const editable = canEditReview(rev.editable_until);
          return (
            <div
              key={rev.id}
              className="rounded-[20px] border border-white/10 bg-[#242424] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/menu/${rev.menu_item_id}`}
                    className="truncate text-[14px] font-bold text-white hover:text-[#FF5A1F]"
                  >
                    {rev.menu_item_name}
                  </Link>
                  <div className="mt-1 flex items-center gap-1">
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
                      })}
                    </span>
                  </div>
                </div>
                {editable && (
                  <Link
                    to={`/order/${rev.order_id}?rate=1`}
                    className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-white/15 bg-[#303030] px-3 text-[12px] font-semibold text-white hover:bg-[#3A3A3A]"
                  >
                    Edit
                  </Link>
                )}
              </div>
              {rev.comment && (
                <p className="mt-2 text-[13px] leading-relaxed text-[#C4C4C4]">{rev.comment}</p>
              )}
              {rev.staff_response && (
                <p className="mt-2 rounded-xl bg-[#1B1B1B] px-3 py-2 text-[12px] text-[#A3A3A3]">
                  <span className="font-semibold text-[#FF5A1F]">Butcher Block: </span>
                  {rev.staff_response}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
