import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ShieldCheck, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  canEditReview,
  extractReviewableDishesFromOrder,
  validateReviewDraft,
  type ManagedFoodReview,
} from "@/lib/reviews";
import { isBackendMissingError } from "@/lib/featureAvailability";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import { invalidateDishRatingsCache } from "@/hooks/useDishRatings";
import { cn } from "@/lib/utils";

type OrderReviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderStatus: string;
  orderItems: unknown;
  guestAccessToken?: string | null;
};

type DynamicReviewDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: string) => Promise<{
          data: ManagedFoodReview[] | null;
          error: { code?: string; message?: string; status?: number } | null;
        }>;
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string; status?: number } | null }>;
};

export function OrderReviewSheet({
  open,
  onOpenChange,
  orderId,
  orderStatus,
  orderItems,
  guestAccessToken,
}: OrderReviewSheetProps) {
  const { user } = useAuth();
  const dishes = extractReviewableDishesFromOrder(orderStatus, orderItems);
  const [selectedDishId, setSelectedDishId] = useState<string>("");
  const [existingReviews, setExistingReviews] = useState<Map<string, ManagedFoodReview>>(new Map());
  const [backendAvailable, setBackendAvailable] = useState<boolean>(false);
  const [checkingBackend, setCheckingBackend] = useState<boolean>(true);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const activeDishId = selectedDishId || dishes[0]?.menuItemId || "";
  const existing = activeDishId ? existingReviews.get(activeDishId) ?? null : null;
  const editable = backendAvailable && (existing ? canEditReview(existing.editable_until) : true);

  useEffect(() => {
    if (!open || !orderId) return;
    let alive = true;
    setCheckingBackend(true);
    const db = supabase as unknown as DynamicReviewDb;

    void (async () => {
      if (!user?.id) {
        if (alive) {
          setBackendAvailable(false);
          setCheckingBackend(false);
        }
        return;
      }

      if (guestAccessToken) {
        try {
          await db.rpc("claim_guest_order", {
            p_order_id: orderId,
            p_access_token: guestAccessToken,
          });
        } catch {
          /* ignore if unavailable */
        }
      }

      const { data, error } = await db
        .from("food_reviews")
        .select("*")
        .eq("order_id", orderId)
        .eq("user_id", user.id);

      if (!alive) return;
      if (error) {
        setBackendAvailable(!isBackendMissingError(error));
        setCheckingBackend(false);
        return;
      }

      setBackendAvailable(true);
      const map = new Map<string, ManagedFoodReview>();
      if (Array.isArray(data)) {
        for (const r of data) map.set(r.menu_item_id, r);
      }
      setExistingReviews(map);
      setCheckingBackend(false);
    })();

    return () => {
      alive = false;
    };
  }, [open, user?.id, orderId, guestAccessToken]);

  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setComment(existing.comment ?? "");
    } else {
      setRating(0);
      setComment("");
    }
  }, [activeDishId, existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !activeDishId || !backendAvailable || submitting) return;

    const check = validateReviewDraft({ rating, comment, privateIssueNote: "" });
    if ("error" in check) {
      toast.error(check.error);
      return;
    }

    setSubmitting(true);
    try {
      const db = supabase as unknown as DynamicReviewDb;
      const rpcName = existing ? "update_own_food_review" : "submit_verified_food_review";
      const args = existing
        ? {
            p_review_id: existing.id,
            p_rating: rating,
            p_comment: comment.trim() || null,
            p_photo_url: existing.photo_url ?? null,
            p_private_issue_note: null,
          }
        : {
            p_order_id: orderId,
            p_menu_item_id: activeDishId,
            p_rating: rating,
            p_comment: comment.trim() || null,
            p_photo_url: null,
            p_private_issue_note: null,
          };

      const { data, error } = await db.rpc(rpcName, args);
      if (error) {
        if (isBackendMissingError(error)) {
          setBackendAvailable(false);
          return;
        }
        toast.error(error.message || "Could not submit your verified rating.");
        return;
      }

      if (data && typeof data === "object") {
        const saved = data as ManagedFoodReview;
        setExistingReviews((prev) => new Map(prev).set(activeDishId, saved));
      }
      invalidateDishRatingsCache();
      toast.success(existing ? "Rating updated" : "Thank you — your verified rating has been saved");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => onOpenChange(false)}
        className={cn(
          "flex max-h-[min(90dvh,740px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Rate Your Meal</SheetTitle>
        <SheetDescription className="sr-only">
          Submit a verified 1 to 5 star rating for dishes from your completed Butcher Block order.
        </SheetDescription>

        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-3.5 pt-1">
          <div>
            <h2 className="font-display text-[18px] font-bold text-white">Rate your dishes</h2>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-[#A3A3A3]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
              Order #BB-{orderId.slice(0, 6).toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close rating sheet"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          {!user ? (
            <div className="rounded-[22px] border border-white/10 bg-[#242424] p-5 text-center">
              <p className="text-[16px] font-bold text-white">Sign in to verify your rating</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[#A3A3A3]">
                Verified dish ratings are tied to signed-in completed orders so only real diners can rate dishes.
              </p>
              <Link
                to="/auth"
                state={{ from: `/order/${orderId}?rate=1` }}
                onClick={() => onOpenChange(false)}
                className="mt-4 inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[14px] font-bold text-white hover:bg-[#E84D15]"
              >
                Sign in
              </Link>
            </div>
          ) : checkingBackend ? (
            <FeatureAvailabilityState
              status="loading"
              title="Checking rating availability"
              description="Verifying your completed order details."
            />
          ) : dishes.length === 0 ? (
            <FeatureAvailabilityState
              status="empty"
              title="Available after order completion"
              description="Dishes become eligible for verified ratings once the kitchen marks your order completed."
            />
          ) : (
            <form id="order-review-form" onSubmit={handleSubmit} className="space-y-5">
              {!backendAvailable && (
                <FeatureAvailabilityState
                  compact
                  status="coming_soon"
                  title="Verified reviews aren't available yet"
                  description="Review submission is ready on the frontend and will unlock once verified order ratings are connected on the backend."
                />
              )}

              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                  Select dish ({dishes.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {dishes.map((d) => {
                    const active = d.menuItemId === activeDishId;
                    const alreadyRated = existingReviews.has(d.menuItemId);
                    return (
                      <button
                        key={d.menuItemId}
                        type="button"
                        onClick={() => setSelectedDishId(d.menuItemId)}
                        className={cn(
                          "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors",
                          active
                            ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                            : "border-white/10 bg-[#242424] text-white hover:bg-[#303030]",
                        )}
                      >
                        {alreadyRated && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        {d.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-[#242424] p-4">
                <p className="text-[14px] font-bold text-white">Your rating</p>
                <div className="mt-3 flex items-center gap-2" role="radiogroup" aria-label="Dish star rating">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const selected = star <= rating;
                    return (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={rating === star}
                        aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                        disabled={!editable}
                        onClick={() => setRating(star)}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#181818] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Star
                          className={cn(
                            "h-6 w-6 transition-colors",
                            selected ? "fill-[#FF5A1F] text-[#FF5A1F]" : "text-[#737373]",
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="review-comment" className="mb-1.5 block text-[14px] font-semibold text-white">
                  Written feedback <span className="font-normal text-[#A3A3A3]">(optional)</span>
                </label>
                <textarea
                  id="review-comment"
                  rows={3}
                  maxLength={1200}
                  disabled={!editable}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was the cook, seasoning, or presentation?"
                  className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45 sm:text-[14px]"
                />
              </div>
            </form>
          )}
        </div>

        {user && !checkingBackend && dishes.length > 0 && (
          <div className="shrink-0 border-t border-white/10 bg-[#121212] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            <button
              type="submit"
              form="order-review-form"
              disabled={!editable || rating < 1 || submitting}
              className="flex min-h-[50px] w-full items-center justify-center rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!backendAvailable
                ? "Verified Reviews Coming Soon"
                : submitting
                  ? "Saving…"
                  : existing
                    ? "Update Verified Rating"
                    : "Submit Verified Rating"}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
