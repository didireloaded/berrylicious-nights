import { useEffect, useState } from "react";
import { CheckCircle2, ListOrdered, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { bookingTimeSlots } from "@/lib/bookingSlots";
import { isBackendMissingError } from "@/lib/featureAvailability";
import { cn } from "@/lib/utils";

export interface WaitlistSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  defaultTime: string;
  defaultGuests: number;
  defaultName?: string;
  defaultPhone?: string;
}

interface WaitlistConfirmation {
  date: string;
  preferredTime: string;
  guests: number;
  position: number | null;
  estimatedWaitMinutes: number | null;
}

/**
 * Clean Table Waitlist bottom sheet triggered contextually from Booking when no
 * suitable reservation time is available.
 * Reuses the existing Supabase waitlist integration without fabricating queue
 * positions or estimated wait times.
 */
export function WaitlistSheet({
  open,
  onOpenChange,
  defaultDate,
  defaultTime,
  defaultGuests,
  defaultName = "",
  defaultPhone = "",
}: WaitlistSheetProps) {
  const { user, profile } = useAuth();
  const [guestName, setGuestName] = useState(defaultName);
  const [guestPhone, setGuestPhone] = useState(defaultPhone);
  const [partySize, setPartySize] = useState(defaultGuests);
  const [requestedDate, setRequestedDate] = useState(defaultDate);
  const [preferredTime, setPreferredTime] = useState(defaultTime || bookingTimeSlots[2].time);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<WaitlistConfirmation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRequestedDate(defaultDate);
      setPreferredTime(defaultTime || bookingTimeSlots[2].time);
      setPartySize(defaultGuests);
      setGuestName(profile?.display_name?.trim() || defaultName);
      setGuestPhone(profile?.phone?.trim() || defaultPhone);
      setNotes("");
      setConfirmed(null);
      setSubmitError(null);
    }
  }, [open, defaultDate, defaultTime, defaultGuests, defaultName, defaultPhone, profile?.display_name, profile?.phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const cleanedName = guestName.trim();
    const cleanedPhone = guestPhone.trim();
    if (!cleanedName) {
      setSubmitError("Please enter your name for the waitlist.");
      return;
    }
    if (cleanedPhone.length < 6) {
      setSubmitError("Please add a contact phone number so our host team can reach you.");
      return;
    }

    setSubmitting(true);
    try {
      type WaitlistClient = {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
        from: (t: string) => {
          insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
        };
      };
      const client = supabase as unknown as WaitlistClient;

      // 1. Try existing join_waitlist RPC first
      const { data, error } = await client.rpc("join_waitlist", {
        p_party_size: partySize,
        p_preferred_date: requestedDate,
        p_guest_name: cleanedName,
        p_guest_phone: cleanedPhone,
      });

      if (!error) {
        const res = (data && typeof data === "object" ? data : null) as {
          position?: unknown;
          estimated_wait_minutes?: unknown;
        } | null;
        const pos = typeof res?.position === "number" && res.position > 0 ? res.position : null;
        const est =
          typeof res?.estimated_wait_minutes === "number" && res.estimated_wait_minutes > 0
            ? res.estimated_wait_minutes
            : null;
        setConfirmed({
          date: requestedDate,
          preferredTime,
          guests: partySize,
          position: pos,
          estimatedWaitMinutes: est,
        });
        toast.success("Added to the Butcher Block waitlist");
        return;
      }

      // 2. If RPC is not deployed, fall back to direct INSERT into existing live waitlist_entries table
      if (isBackendMissingError(error)) {
        const { error: insertErr } = await client.from("waitlist_entries").insert({
          user_id: user?.id ?? null,
          party_size: partySize,
          preferred_date: requestedDate,
          guest_name: notes.trim()
            ? `${cleanedName} (${preferredTime} · ${notes.trim()})`.slice(0, 140)
            : `${cleanedName} (${preferredTime})`,
          guest_phone: cleanedPhone,
        });

        if (!insertErr) {
          setConfirmed({
            date: requestedDate,
            preferredTime,
            guests: partySize,
            position: null,
            estimatedWaitMinutes: null,
          });
          toast.success("Added to the Butcher Block waitlist");
          return;
        }
      }

      setSubmitError(
        "We couldn't confirm your waitlist request right now. Please call Butcher Block on +264 83 288 8000 for live table openings.",
      );
    } catch {
      setSubmitError(
        "We couldn't reach Butcher Block right now. Nothing was submitted — please try again or call +264 83 288 8000.",
      );
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
        <SheetTitle className="sr-only">Join the Waitlist</SheetTitle>
        <SheetDescription className="sr-only">
          Join the Butcher Block Steakhouse table waitlist when your preferred reservation time is unavailable.
        </SheetDescription>

        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-3.5 pt-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <ListOrdered className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-[17px] font-bold text-white">Join the waitlist</h2>
              <p className="text-[13px] text-[#A3A3A3]">We&apos;ll reach out if a table opens up</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close waitlist form"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {confirmed ? (
          <div className="px-5 py-6 pb-[max(2rem,env(safe-area-inset-bottom,0px))] text-center space-y-4">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#FF5A1F] bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[20px] font-extrabold text-white">You&apos;re on the waitlist</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[#A3A3A3]">
                {confirmed.guests} {confirmed.guests === 1 ? "guest" : "guests"} · {confirmed.date} around {confirmed.preferredTime}.
                {confirmed.position !== null ? ` Position #${confirmed.position}.` : ""}
                {confirmed.estimatedWaitMinutes !== null ? ` Est. ~${confirmed.estimatedWaitMinutes} min.` : ""}
              </p>
              <p className="mt-2 text-[13px] text-[#A3A3A3]">
                Our host team will contact you by phone if a table becomes available.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-[48px] w-full rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white hover:bg-[#E84D15]"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <form
              id="waitlist-sheet-form"
              onSubmit={handleSubmit}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="wl-name" className="mb-1.5 block text-[13px] font-semibold text-white">
                    Guest name <span className="text-[#FF5A1F]">*</span>
                  </label>
                  <input
                    id="wl-name"
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your full name"
                    className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#242424] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                  />
                </div>
                <div>
                  <label htmlFor="wl-phone" className="mb-1.5 block text-[13px] font-semibold text-white">
                    Contact phone <span className="text-[#FF5A1F]">*</span>
                  </label>
                  <input
                    id="wl-phone"
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+264 81 000 0000"
                    className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#242424] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#242424] px-4 py-3">
                <span className="text-[14px] font-semibold text-white">Party size</span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    aria-label="Decrease waitlist party size"
                    onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#181818] text-white"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <output className="min-w-[26px] text-center text-[16px] font-extrabold tabular-nums text-white">
                    {partySize}
                  </output>
                  <button
                    type="button"
                    aria-label="Increase waitlist party size"
                    onClick={() => setPartySize((n) => Math.min(20, n + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A1F] text-white"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="wl-date" className="mb-1.5 block text-[13px] font-semibold text-white">
                    Requested date
                  </label>
                  <input
                    id="wl-date"
                    type="date"
                    value={requestedDate}
                    min={defaultDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#242424] px-3.5 text-[16px] text-white [color-scheme:dark] sm:text-[14px]"
                  />
                </div>
                <div>
                  <label htmlFor="wl-time" className="mb-1.5 block text-[13px] font-semibold text-white">
                    Preferred time
                  </label>
                  <select
                    id="wl-time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#242424] px-3.5 text-[14px] text-white"
                  >
                    {bookingTimeSlots.map((slot) => (
                      <option key={slot.time} value={slot.time}>
                        {slot.time} ({slot.label})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="wl-notes" className="mb-1.5 block text-[13px] font-semibold text-white">
                  Additional notes <span className="font-normal text-[#A3A3A3]">(optional)</span>
                </label>
                <textarea
                  id="wl-notes"
                  rows={2}
                  maxLength={160}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Terrace preference, high chair, flexible timing…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#242424] px-3.5 py-2.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                />
              </div>

              {submitError && (
                <p role="alert" className="rounded-xl border border-red-500/35 bg-red-950/25 px-3.5 py-2.5 text-[13px] text-red-200">
                  {submitError}
                </p>
              )}
            </form>

            <div className="shrink-0 border-t border-white/10 bg-[#121212] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <button
                type="submit"
                form="waitlist-sheet-form"
                disabled={submitting}
                className="flex min-h-[50px] w-full items-center justify-center rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] disabled:opacity-45"
              >
                {submitting ? "Submitting request…" : "Join the Waitlist"}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
