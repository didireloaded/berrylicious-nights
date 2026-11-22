import { useEffect, useState } from "react";
import { Lock, MessageSquareHeart, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useTableSession } from "@/context/TableSessionContext";
import {
  isBackendMissingError,
  PRIVATE_FEEDBACK_CATEGORIES,
  type PrivateFeedbackCategory,
} from "@/lib/featureAvailability";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import { cn } from "@/lib/utils";

export type ContactPreference = "none" | "phone" | "message";

export type PrivateFeedbackSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string | null;
  orderReference?: string | null;
};

/**
 * Confidential Private Dining Feedback bottom sheet.
 * Never published publicly and never mixed with public dish ratings.
 * Probes backend availability safely on open; when no secure backend endpoint
 * exists yet, disables submission cleanly and never simulates delivery.
 */
export function PrivateFeedbackSheet({
  open,
  onOpenChange,
  orderId = null,
  orderReference = null,
}: PrivateFeedbackSheetProps) {
  const { user, profile } = useAuth();
  const { session: tableSession } = useTableSession();
  const [category, setCategory] = useState<PrivateFeedbackCategory>("food_quality");
  const [message, setMessage] = useState("");
  const [contactPreference, setContactPreference] = useState<ContactPreference>("none");
  const [guestName, setGuestName] = useState(
    () =>
      profile?.display_name ||
      user?.user_metadata?.full_name ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("butcher-block-guest-name") || "" : ""),
  );
  const [guestPhone, setGuestPhone] = useState(
    () =>
      profile?.phone ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("butcher-block-guest-phone") || "" : ""),
  );
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCheckingBackend(true);
    type ProbeDb = {
      from: (t: string) => {
        select: (cols: string) => {
          limit: (n: number) => Promise<{
            error: { code?: string; message?: string; status?: number } | null;
            status?: number;
          }>;
        };
      };
    };
    void (supabase as unknown as ProbeDb)
      .from("private_dining_feedback")
      .select("id")
      .limit(1)
      .then(({ error, status }) => {
        if (!alive) return;
        const missing = status === 404 || (error ? isBackendMissingError(error) : false);
        setBackendAvailable(!error && !missing);
        setCheckingBackend(false);
      })
      .catch(() => {
        if (!alive) return;
        setBackendAvailable(false);
        setCheckingBackend(false);
      });

    return () => {
      alive = false;
    };
  }, [open]);

  const canSubmit = backendAvailable && !checkingBackend;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    const cleaned = message.trim();
    if (cleaned.length < 5) {
      toast.error("Please share a few words so management knows how to help.");
      return;
    }

    setSubmitting(true);
    try {
      type FeedbackDb = {
        from: (t: string) => {
          insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string; status?: number } | null }>;
        };
      };
      const dbCategoryMap: Record<PrivateFeedbackCategory, string> = {
        food_quality: "food_issue",
        restaurant_service: "service_issue",
        waiting_time: "service_issue",
        cleanliness: "other",
        general_experience: "compliment",
        other_feedback: "other",
      };
      const categoryLabel = PRIVATE_FEEDBACK_CATEGORIES.find((c) => c.id === category)?.label ?? "Feedback";
      const { error } = await (supabase as unknown as FeedbackDb)
        .from("private_dining_feedback")
        .insert({
          user_id: user?.id ?? null,
          order_id: orderId || null,
          table_session_id: tableSession?.sessionId ?? null,
          table_label: tableSession?.displayName ?? null,
          guest_name: guestName.trim() || null,
          guest_phone: contactPreference !== "none" ? guestPhone.trim() || null : null,
          category: dbCategoryMap[category],
          message: `[${categoryLabel}] ${cleaned}`,
          wants_manager_visit: contactPreference !== "none",
        });

      if (error) {
        if (isBackendMissingError(error)) {
          setBackendAvailable(false);
          return;
        }
        toast.error("Could not send right now — please call +264 83 288 8000 to speak with management.");
        return;
      }

      toast.success("Sent privately to Butcher Block management. Thank you.");
      setMessage("");
      setContactPreference("none");
      onOpenChange(false);
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
        <SheetTitle className="sr-only">Private Dining Feedback</SheetTitle>
        <SheetDescription className="sr-only">
          Send private dining feedback directly to Butcher Block management. Never published publicly.
        </SheetDescription>

        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-3.5 pt-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <MessageSquareHeart className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-[17px] font-bold text-white">Private Dining Feedback</h2>
              <p className="flex items-center gap-1 text-[13px] text-[#A3A3A3]">
                <Lock className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                Private to management — never published
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close private feedback"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          id="private-feedback-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4"
        >
          {!checkingBackend && !backendAvailable && (
            <FeatureAvailabilityState
              compact
              status="coming_soon"
              title="Private feedback submission isn't connected yet"
              description="This private channel will deliver notes securely to Butcher Block management once backend integration is live. For immediate assistance, call +264 83 288 8000."
            />
          )}

          {(orderReference || tableSession) && (
            <div className="rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-[14px] text-[#C4C4C4]">
              {orderReference && (
                <span>
                  Related order: <strong className="font-mono text-white">#{orderReference}</strong>
                </span>
              )}
              {orderReference && tableSession && " · "}
              {tableSession && (
                <span>
                  Table: <strong className="text-white">{tableSession.displayName}</strong>
                </span>
              )}
            </div>
          )}

          {/* 6 Approved Feedback Categories */}
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
              Feedback category
            </p>
            <div className="flex flex-wrap gap-2">
              {PRIVATE_FEEDBACK_CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    disabled={!canSubmit}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "min-h-[44px] rounded-full border px-4 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      active
                        ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                        : "border-white/10 bg-[#242424] text-white hover:bg-[#303030]",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="private-feedback-msg" className="mb-1.5 block text-[14px] font-semibold text-white">
              Your message
            </label>
            <textarea
              id="private-feedback-msg"
              rows={4}
              maxLength={1500}
              required
              disabled={!canSubmit}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share private notes on your meal, service, or visit…"
              className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[14px]"
            />
          </div>

          {/* Optional Contact Preference */}
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
              Contact preference (optional)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "none", label: "No follow-up" },
                  { id: "phone", label: "Phone call" },
                  { id: "message", label: "Message" },
                ] as const
              ).map((opt) => {
                const active = contactPreference === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    disabled={!canSubmit}
                    onClick={() => setContactPreference(opt.id)}
                    className={cn(
                      "min-h-[44px] rounded-xl border px-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      active
                        ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-white"
                        : "border-white/10 bg-[#242424] text-[#A3A3A3] hover:text-white",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {contactPreference !== "none" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="fb-name" className="mb-1 block text-[13px] text-[#A3A3A3]">
                  Name (optional)
                </label>
                <input
                  id="fb-name"
                  type="text"
                  disabled={!canSubmit}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                  className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#242424] px-3.5 text-[16px] text-white disabled:opacity-50 sm:text-[14px]"
                />
              </div>
              <div>
                <label htmlFor="fb-phone" className="mb-1 block text-[13px] text-[#A3A3A3]">
                  Phone number
                </label>
                <input
                  id="fb-phone"
                  type="tel"
                  disabled={!canSubmit}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+264 81 000 0000"
                  className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#242424] px-3.5 text-[16px] text-white disabled:opacity-50 sm:text-[14px]"
                />
              </div>
            </div>
          )}
        </form>

        <div className="shrink-0 border-t border-white/10 bg-[#121212] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="submit"
            form="private-feedback-form"
            disabled={!canSubmit || submitting}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {checkingBackend
              ? "Checking availability…"
              : !backendAvailable
                ? "Private Feedback Coming Soon"
                : submitting
                  ? "Sending…"
                  : "Send Privately to Management"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
