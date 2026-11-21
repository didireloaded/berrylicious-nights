import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, UtensilsCrossed } from "lucide-react";
import { slotLabel } from "@/lib/bookingSlots";
import {
  computeOpenSlotsForDate,
  resolveBaseSlots,
  resolveEventDate,
  resolveHeadlineTime,
  type BookingNavState,
  type HomeUpdateRow,
} from "@/lib/eventBooking";

function formatNightLabel(isoDate: string) {
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return isoDate;
  }
}

type EventDetailSheetProps = {
  event: HomeUpdateRow | null;
  onClose: () => void;
};

export function EventDetailSheet({ event, onClose }: EventDetailSheetProps) {
  const navigate = useNavigate();
  const [openSlots, setOpenSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);

  useEffect(() => {
    if (!event) return;
    const date = resolveEventDate(event);
    const candidates = resolveBaseSlots(event);
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(false);
    void computeOpenSlotsForDate(date, candidates)
      .then((open) => {
        if (cancelled) return;
        setOpenSlots(open);
      })
      .catch(() => {
        if (cancelled) return;
        setSlotsError(true);
        setOpenSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event]);

  useEffect(() => {
    if (!event) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [event]);

  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  if (!event) return null;

  const details =
    event.subtitle?.trim() ||
    "Explore the menu or check available reservation times for this date.";

  const eventDate = resolveEventDate(event);
  const headlineTime = resolveHeadlineTime(event);
  const nightLabel = formatNightLabel(eventDate);

  const primaryTime =
    openSlots.length === 0
      ? headlineTime
      : openSlots.includes(headlineTime)
        ? headlineTime
        : openSlots[0];

  const goBooking = (time: string) => {
    const state: BookingNavState = {
      eventId: event.id,
      eventTitle: event.title,
      suggestedDate: eventDate,
      suggestedTime: time,
      eventTimeSlots: openSlots.length > 0 ? openSlots : undefined,
    };
    onClose();
    navigate("/booking", { state });
  };

  const sheet = (
    <div className="fixed inset-0 z-[100] flex flex-col pointer-events-none">
      <button
        type="button"
        aria-label="Dismiss"
        className="min-h-[20dvh] flex-1 pointer-events-auto bg-background/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-sheet-title"
        className="pointer-events-auto flex max-h-[min(85dvh,720px)] w-full max-w-lg flex-col rounded-t-3xl border border-border border-b-0 bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.45)] animate-panel-up mx-auto"
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-muted-foreground/35" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
            {event.type}
          </p>
          <h2 id="event-sheet-title" className="font-display mt-1 text-xl font-bold leading-tight text-foreground">
            {event.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{details}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {nightLabel} · featured {headlineTime}
            {slotLabel(headlineTime) ? ` · ${slotLabel(headlineTime)}` : ""}
          </p>

          <p className="mt-6 text-sm font-semibold text-foreground">Available tables</p>
          {slotsLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Checking what&apos;s open…</p>
          ) : slotsError ? (
            <p role="alert" className="mt-2 text-sm text-muted-foreground leading-relaxed">
              We couldn't check live availability. Please try booking directly.
            </p>
          ) : openSlots.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              No tables currently show as available for these times. Try another date.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {openSlots.map((slot) => {
                const best = slot === headlineTime;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => goBooking(slot)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors btn-press ${
                      best
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "border border-border bg-card text-foreground hover:border-primary/35"
                    }`}
                  >
                    {slot}
                    {slotLabel(slot) ? (
                      <span className={`ml-1 text-xs font-normal opacity-80`}>({slotLabel(slot)})</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-card px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => goBooking(primaryTime)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-center text-sm font-bold text-primary-foreground btn-press"
          >
            <CalendarDays className="h-5 w-5 shrink-0" />
            {slotsLoading || slotsError || openSlots.length === 0 ? "Check table availability" : "Reserve for this event"}
          </button>
          <Link
            to="/menu"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-center text-sm font-semibold text-foreground btn-press"
          >
            <UtensilsCrossed className="h-5 w-5 shrink-0" />
            View menu
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
