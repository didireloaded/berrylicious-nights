import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Camera, Check, ShieldCheck, Star, X } from "lucide-react";
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
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [privateIssue, setPrivateIssue] = useState<string>("");
  const [showPrivateBox, setShowPrivateBox] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeDishId = selectedDishId || dishes[0]?.menuItemId || "";
  const existing = activeDishId ? existingReviews.get(activeDishId) ?? null : null;
  const editable = existing ? canEditReview(existing.editable_until) : true;

  useEffect(() => {
    if (!open || !user?.id || !orderId) return;
    let alive = true;
    const db = supabase as unknown as DynamicReviewDb;

    void (async () => {
      // If this device placed the order as a guest and then signed in, claim it securely first
      if (guestAccessToken) {
        try {
          await db.rpc("claim_guest_order", {
            p_order_id: orderId,
            p_access_token: guestAccessToken,
          });
        } catch {
          /* already owned or migration pending */
        }
      }

      const { data } = await db
        .from("food_reviews")
        .select("*")
        .eq("order_id", orderId)
        .eq("user_id", user.id);

      if (!alive || !Array.isArray(data)) return;
      const map = new Map<string, ManagedFoodReview>();
      for (const r of data) map.set(r.menu_item_id, r);
      setExistingReviews(map);
    })();

    return () => {
      alive = false;
    };
  }, [open, user?.id, orderId, guestAccessToken]);

  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setComment(existing.comment ?? "");
      setPrivateIssue(existing.private_issue_note ?? "");
      setShowPrivateBox(Boolean(existing.private_issue_note));
    } else {
      setRating(0);
      setComment("");
      setPrivateIssue("");
      setShowPrivateBox(false);
    }
    setPhotoFile(null);
  }, [activeDishId, existing]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG, PNG, or WebP).");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Photo must be 4 MB or smaller.");
      return;
    }
    setPhotoFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !activeDishId || submitting) return;

    const check = validateReviewDraft({
      rating,
      comment,
      privateIssueNote: privateIssue,
    });
    if ("error" in check) {
      toast.error(check.error);
      return;
    }

    setSubmitting(true);
    try {
      let uploadedPhotoUrl: string | null = existing?.photo_url ?? null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${orderId}-${activeDishId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("review-photos")
          .upload(path, photoFile, { upsert: false, contentType: photoFile.type });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("review-photos").getPublicUrl(path);
          uploadedPhotoUrl = pub?.publicUrl ?? null;
        } else {
          toast.info("Photo upload bucket is not enabled yet — saving your verified rating without the photo.");
        }
      }

      const db = supabase as unknown as DynamicReviewDb;
      const rpcName = existing ? "update_own_food_review" : "submit_verified_food_review";
      const args = existing
        ? {
            p_review_id: existing.id,
            p_rating: rating,
            p_comment: comment.trim() || null,
            p_photo_url: uploadedPhotoUrl,
            p_private_issue_note: privateIssue.trim() || null,
          }
        : {
            p_order_id: orderId,
            p_menu_item_id: activeDishId,
            p_rating: rating,
            p_comment: comment.trim() || null,
            p_photo_url: uploadedPhotoUrl,
            p_private_issue_note: privateIssue.trim() || null,
          };

      const { data, error } = await db.rpc(rpcName, args);
      if (error) {
        toast.error(error.message || "Could not submit your verified review.");
        return;
      }

      if (data && typeof data === "object") {
        const saved = data as ManagedFoodReview;
        setExistingReviews((prev) => new Map(prev).set(activeDishId, saved));
      }
      invalidateDishRatingsCache();
      toast.success(existing ? "Review updated" : "Thank you — your verified rating has been saved");
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
          "flex max-h-[min(90dvh,760px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
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
            <h2 className="font-display text-[18px] font-bold text-white">How was your meal?</h2>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[#A3A3A3]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
              Verified Order #BB-{orderId.slice(0, 6).toUpperCase()}
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          {!user ? (
            <div className="rounded-[22px] border border-white/10 bg-[#242424] p-5 text-center">
              <p className="text-[15px] font-bold text-white">Sign in to verify your rating</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[#A3A3A3]">
                Butcher Block only publishes reviews verified against real completed orders. Sign in on this device to claim this receipt and rate your dishes.
              </p>
              <Link
                to="/auth"
                state={{ from: `/order/${orderId}?rate=1` }}
                onClick={() => onOpenChange(false)}
                className="mt-4 inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[14px] font-bold text-white hover:bg-[#E84D15]"
              >
                Sign in &amp; rate
              </Link>
            </div>
          ) : dishes.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-[#A3A3A3]">
              Dishes become eligible for verified rating once the kitchen marks your order completed.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Dish selector */}
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
                          "inline-flex min-h-[42px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
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

              {/* 1–5 Star Selector */}
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
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#181818] transition-transform active:scale-95 disabled:opacity-50"
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
                {existing && !editable && (
                  <p className="mt-2 text-[12px] text-[#A3A3A3]">
                    The 7-day edit window for this review has closed.
                  </p>
                )}
              </div>

              {/* Optional written review */}
              <div>
                <label htmlFor="review-comment" className="mb-1.5 block text-[13px] font-semibold text-white">
                  Written review <span className="font-normal text-[#A3A3A3]">(optional)</span>
                </label>
                <textarea
                  id="review-comment"
                  rows={3}
                  maxLength={1200}
                  disabled={!editable}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was the cook, seasoning, or presentation?"
                  className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                />
              </div>

              {/* Optional dish photo */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#242424] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white">Food photo (optional)</p>
                  <p className="truncate text-[12px] text-[#A3A3A3]">
                    {photoFile ? photoFile.name : "Share a photo of your dish (max 4 MB)"}
                  </p>
                </div>
                <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-[#303030] px-3.5 text-[12px] font-semibold text-white hover:bg-[#3A3A3A]">
                  <Camera className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                  <span>{photoFile ? "Change" : "Upload"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!editable}
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Private issue reporting (never published) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPrivateBox((v) => !v)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-[#A3A3A3] hover:text-white"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  {showPrivateBox ? "Hide private issue note" : "Report an issue privately to management"}
                </button>
                {showPrivateBox && (
                  <textarea
                    rows={2}
                    maxLength={1000}
                    disabled={!editable}
                    value={privateIssue}
                    onChange={(e) => setPrivateIssue(e.target.value)}
                    placeholder="Shared privately with Butcher Block management — never published publicly."
                    className="mt-2 w-full rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[16px] text-white placeholder:text-[#A3A3A3] focus:border-amber-400 focus:outline-none sm:text-[14px]"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={!editable || rating < 1 || submitting}
                className="flex min-h-[50px] w-full items-center justify-center rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] disabled:opacity-45"
              >
                {submitting
                  ? "Saving…"
                  : existing
                    ? "Update verified rating"
                    : "Submit verified rating"}
              </button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
