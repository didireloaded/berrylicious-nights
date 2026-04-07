import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Sparkles, UtensilsCrossed } from "lucide-react";
import heroImage from "@/assets/hero-restaurant.jpg";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import { slotLabel } from "@/lib/bookingSlots";
import {
  computeOpenSlotsForDate,
  resolveBaseSlots,
  resolveEventDate,
  resolveHeadlineTime,
  type BookingNavState,
  type HomeUpdateRow,
} from "@/lib/eventBooking";

const EVENT_IMAGES = [gallery1, gallery2, gallery3, heroImage];

function imageForEvent(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % EVENT_IMAGES.length;
  return EVENT_IMAGES[h];
}

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

  useEffect(() => {
    if (!event) return;
    const date = resolveEventDate(event);
    const candidates = resolveBaseSlots(event);
    let cancelled = false;
    setSlotsLoading(true);
    void computeOpenSlotsForDate(date, candidates).then((open) => {
      if (cancelled) return;
      setOpenSlots(open);
      setSlotsLoading(false);
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

  const imageSrc = imageForEvent(event.id);
  const details =
    event.subtitle?.trim() ||
    "Reserve a table or explore the menu — walk-ins welcome while space lasts.";

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
          <div className="overflow-hidden rounded-xl">
            <img
              src={imageSrc}
              alt=""
              className="h-44 w-full object-cover"
              decoding="async"
            />
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-primary">
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
          ) : openSlots.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              No open slots for the listed times on this night — continue to choose any time on the booking screen.
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
            Book for this event
          </button>
          <Link
            to="/plan"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 py-3 text-center text-sm font-semibold text-primary btn-press"
          >
            <Sparkles className="h-5 w-5 shrink-0" />
            Join — plan my night
          </Link>
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
