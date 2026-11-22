import { useEffect, useState } from "react";
import { ShieldCheck, Star, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import type { FeatureAvailabilityStatus } from "@/lib/featureAvailability";
import { cn } from "@/lib/utils";

export interface RatingSubmissionPayload {
  rating: number;
  comment: string;
}

export interface RatingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dishName: string;
  availability: FeatureAvailabilityStatus;
  orderNumber?: string;
  initialRating?: number;
  initialComment?: string;
  submitting?: boolean;
  unavailableReason?: string;
  onSubmit?: (payload: RatingSubmissionPayload) => Promise<void> | void;
}

/**
 * Compact, accessible food rating bottom sheet.
 * When verified completed-order review submission is unavailable, the form stays
 * frontend-ready with submission disabled and an honest explanation — never storing
 * a fake review or showing a false confirmation.
 */
export function RatingSheet({
  open,
  onOpenChange,
  dishName,
  availability,
  orderNumber,
  initialRating = 0,
  initialComment = "",
  submitting = false,
  unavailableReason,
  onSubmit,
}: RatingSheetProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);

  useEffect(() => {
    if (open) {
      setRating(initialRating);
      setComment(initialComment);
    }
  }, [open, initialRating, initialComment]);

  const canSubmit = availability === "available" && Boolean(onSubmit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || rating < 1 || submitting || !onSubmit) return;
    await onSubmit({ rating, comment: comment.trim() });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => onOpenChange(false)}
        className={cn(
          "flex max-h-[min(88dvh,680px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Rate {dishName}</SheetTitle>
        <SheetDescription className="sr-only">
          Verified 1 to 5 star dish rating for {dishName} at Butcher Block Steakhouse.
        </SheetDescription>

        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-3.5 pt-1">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[18px] font-bold text-white">{dishName}</h2>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-[#A3A3A3]">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
              {orderNumber ? `Verified Order #${orderNumber}` : "Verified Butcher Block Rating"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close rating sheet"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          id="dish-rating-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5"
        >
          {!canSubmit && (
            <FeatureAvailabilityState
              compact
              status={availability === "available" ? "coming_soon" : availability}
              title="Verified reviews aren't available yet"
              description={
                unavailableReason ||
                "Verified ratings only accept feedback tied to completed Butcher Block orders. Review submission will open once backend verification is connected."
              }
            />
          )}

          {/* 5-Star Selector */}
          <div className="rounded-[22px] border border-white/10 bg-[#242424] p-4">
            <p className="text-[14px] font-bold text-white">Your rating</p>
            <div className="mt-3 flex items-center gap-2" role="radiogroup" aria-label={`Star rating for ${dishName}`}>
              {[1, 2, 3, 4, 5].map((star) => {
                const selected = star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                    disabled={!canSubmit}
                    onClick={() => setRating(star)}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#181818] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
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

          {/* Optional Written Feedback */}
          <div>
            <label htmlFor="rating-sheet-comment" className="mb-1.5 block text-[14px] font-semibold text-white">
              Written feedback <span className="font-normal text-[#A3A3A3]">(optional)</span>
            </label>
            <textarea
              id="rating-sheet-comment"
              rows={3}
              maxLength={800}
              disabled={!canSubmit}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share a note on the cook, seasoning, or presentation…"
              className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[14px]"
            />
          </div>
        </form>

        <div className="shrink-0 border-t border-white/10 bg-[#121212] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="submit"
            form="dish-rating-form"
            disabled={!canSubmit || rating < 1 || submitting}
            className="flex min-h-[50px] w-full items-center justify-center rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!canSubmit
              ? "Verified Reviews Coming Soon"
              : submitting
                ? "Submitting…"
                : "Submit Verified Rating"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
