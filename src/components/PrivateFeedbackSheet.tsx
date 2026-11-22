import { useState } from "react";
import { Lock, MessageSquareHeart, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useTableSession } from "@/context/TableSessionContext";
import { cn } from "@/lib/utils";

type FeedbackCategory = "compliment" | "service_issue" | "food_issue" | "manager_request" | "other";

const CATEGORIES: { id: FeedbackCategory; label: string }[] = [
  { id: "compliment", label: "Compliment" },
  { id: "service_issue", label: "Service issue" },
  { id: "food_issue", label: "Food issue" },
  { id: "manager_request", label: "Request manager" },
  { id: "other", label: "Other note" },
];

type PrivateFeedbackSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string | null;
};

export function PrivateFeedbackSheet({ open, onOpenChange, orderId = null }: PrivateFeedbackSheetProps) {
  const { user, profile } = useAuth();
  const { session: tableSession } = useTableSession();
  const [category, setCategory] = useState<FeedbackCategory>("compliment");
  const [message, setMessage] = useState("");
  const [wantsManagerVisit, setWantsManagerVisit] = useState(false);
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
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const cleaned = message.trim();
    if (cleaned.length < 5) {
      toast.error("Please share a few words so management knows how to help.");
      return;
    }

    setSubmitting(true);
    try {
      type FeedbackDb = {
        from: (t: string) => {
          insert: (row: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
        };
      };
      const { error } = await (supabase as unknown as FeedbackDb)
        .from("private_dining_feedback")
        .insert({
          user_id: user?.id ?? null,
          order_id: orderId || null,
          table_session_id: tableSession?.sessionId ?? null,
          table_label: tableSession?.displayName ?? null,
          guest_name: guestName.trim() || null,
          guest_phone: guestPhone.trim() || null,
          category,
          message: cleaned,
          wants_manager_visit: category === "manager_request" || wantsManagerVisit,
        });

      if (error) {
        toast.error("Could not send right now — please call +264 83 288 8000 or speak with the floor manager.");
        return;
      }

      toast.success("Sent privately to Butcher Block management. Thank you.");
      setMessage("");
      setWantsManagerVisit(false);
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
          "flex max-h-[min(90dvh,740px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Private Dining Feedback</SheetTitle>
        <SheetDescription className="sr-only">
          Send a private compliment, report an issue, or request a manager at Butcher Block.
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
              <p className="flex items-center gap-1 text-[12px] text-[#A3A3A3]">
                <Lock className="h-3 w-3 text-[#FF5A1F]" aria-hidden="true" />
                Only Butcher Block management sees this — never public
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
          {tableSession && (
            <div className="rounded-2xl border border-white/10 bg-[#242424] px-4 py-2.5 text-[13px] text-[#C4C4C4]">
              Linked table: <span className="font-bold text-white">{tableSession.displayName}</span>
            </div>
          )}

          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">Topic</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
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
            <label htmlFor="private-feedback-msg" className="mb-1.5 block text-[13px] font-semibold text-white">
              Your message to management
            </label>
            <textarea
              id="private-feedback-msg"
              rows={4}
              maxLength={1500}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                category === "compliment"
                  ? "Let us know who made your evening memorable…"
                  : "Tell our duty manager how we can make things right…"
              }
              className="w-full rounded-2xl border border-white/10 bg-[#242424] px-4 py-3 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-[#242424] p-3.5 text-[13px] text-[#E5E5E5]">
            <input
              type="checkbox"
              checked={category === "manager_request" || wantsManagerVisit}
              onChange={(e) => setWantsManagerVisit(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#FF5A1F]"
            />
            <span>I would like a duty manager to check in with me at my table or follow up by phone.</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="fb-name" className="mb-1 block text-[12px] text-[#A3A3A3]">
                Name (optional)
              </label>
              <input
                id="fb-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#242424] px-3.5 text-[16px] text-white sm:text-[14px]"
              />
            </div>
            <div>
              <label htmlFor="fb-phone" className="mb-1 block text-[12px] text-[#A3A3A3]">
                Phone for follow-up (optional)
              </label>
              <input
                id="fb-phone"
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+264 81 000 0000"
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#242424] px-3.5 text-[16px] text-white sm:text-[14px]"
              />
            </div>
          </div>
        </form>

        <div className="shrink-0 border-t border-white/10 bg-[#121212] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="submit"
            form="private-feedback-form"
            disabled={submitting}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-45"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {submitting ? "Sending…" : "Send Privately to Management"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
