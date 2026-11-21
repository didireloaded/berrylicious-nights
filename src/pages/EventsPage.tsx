import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calendar, Clock, Instagram, MapPin } from "lucide-react";
import { butcherBlockEvents } from "@/data/eventsData";
import { useActiveUpdates } from "@/hooks/useActiveUpdates";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import type { HomeUpdateRow } from "@/lib/eventBooking";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import dishCocktail from "@/assets/dish-cocktail.jpg";
import dishLamb from "@/assets/dish-lamb.jpg";
import dishBurger from "@/assets/dish-burger.jpg";

const FALLBACK_EVENT_IMAGES = [dishCocktail, dishLamb, dishBurger];

export default function EventsPage() {
  const updates = useActiveUpdates();
  const { totalItems } = useCart();
  const { user, profile } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<HomeUpdateRow | null>(null);

  const guestSavedName =
    typeof localStorage !== "undefined" ? localStorage.getItem("butcher-block-guest-name") : null;
  const displayName = (profile?.display_name || user?.user_metadata?.full_name || guestSavedName || "Guest").trim();
  const initial = displayName.charAt(0).toUpperCase();

  const eventCards = useMemo(() => {
    const staticByTitle = new Map(
      butcherBlockEvents.map((e) => [e.title.toLowerCase(), e]),
    );
    return updates.map((u, idx) => {
      const staticMatch = staticByTitle.get(u.title.toLowerCase());
      return {
        row: u,
        id: u.id,
        title: u.title,
        tag: staticMatch?.tag ?? (u.type || "Event"),
        date: staticMatch?.date ?? (u.event_date || u.type || "Upcoming"),
        time: staticMatch?.time ?? (u.event_time ? `From ${u.event_time}` : "Evening"),
        description: staticMatch?.description ?? (u.subtitle || "Reserve your table at Butcher Block Steakhouse, Am Weinberg Estate."),
        image: staticMatch?.image ?? FALLBACK_EVENT_IMAGES[idx % FALLBACK_EVENT_IMAGES.length],
      };
    });
  }, [updates]);

  return (
    <div className={"min-h-dvh bg-[#121212] text-white " + (totalItems > 0 ? "pb-56" : "pb-36")}>
      <div className="mx-auto max-w-[560px] px-5 pt-[max(30px,env(safe-area-inset-top,0px))] sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/home"
            aria-label="Back to Home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ff7342]">
            AM WEINBERG ESTATE
          </span>
          <div className="flex items-center gap-2">
            <Link
              to="/booking"
              className="flex min-h-10 shrink-0 items-center rounded-full border border-white/25 bg-[#242424] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
            >
              Book
            </Link>
            <Link
              to="/profile"
              aria-label={`Profile: ${displayName}`}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#242424] text-xs font-semibold text-white transition-colors hover:border-[#ff5a1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
            >
              {initial}
            </Link>
          </div>
        </header>

        <div className="mt-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ff7342]">
            ON THE CALENDAR
          </p>
          <h1 className="mt-3 text-[clamp(2.8rem,11vw,4.3rem)] font-extrabold leading-[0.98] tracking-[-0.065em]">
            Events &amp; Nights
          </h1>
          <p className="mt-4 max-w-[380px] text-[14px] leading-relaxed text-white/55">
            Weekly steakhouse rituals and special evenings at Butcher Block Windhoek. Reserve a table to receive your reservation number.
          </p>
        </div>

        <div className="mt-8 space-y-5">
          {eventCards.map((event) => (
            <article
              key={event.id}
              className="overflow-hidden rounded-[27px] border border-white/10 bg-[#242424] shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
            >
              <div className="relative h-48 w-full overflow-hidden bg-black">
                <img
                  src={event.image}
                  alt={event.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#242424] via-[#242424]/30 to-transparent" />
                <span className="absolute left-4 top-4 rounded-full bg-[#ff5a1f] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                  {event.tag}
                </span>
              </div>

              <div className="px-5 pb-5 pt-2">
                <h2 className="text-[24px] font-bold leading-tight tracking-[-0.04em] text-white">
                  {event.title}
                </h2>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-white/65">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#ff7b50]" aria-hidden="true" />
                    {event.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#ff7b50]" aria-hidden="true" />
                    {event.time}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#ff7b50]" aria-hidden="true" />
                    Am Weinberg Estate
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[#a4a4a4]">
                  {event.description}
                </p>

                <button
                  type="button"
                  onClick={() => setSelectedEvent(event.row)}
                  className="mt-5 flex min-h-12 w-full items-center justify-between rounded-full border border-white/15 bg-[#171717] px-5 text-[13px] font-semibold text-white transition-colors hover:border-[#ff5a1f] hover:bg-[#1e1e1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
                >
                  <span>Reserve a table</span>
                  <ArrowRight className="h-4 w-4 text-[#ff7b50]" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Instagram feed card */}
        <section className="mt-10 rounded-[27px] border border-white/10 bg-[#202020] p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff7b50]">
            FOLLOW THE FLOOR
          </p>
          <h2 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.04em]">
            @butcherblocknamibia
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">
            Live announcements, seasonal specials, and cellar evenings straight from Butcher Block at Am Weinberg Estate.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="https://www.instagram.com/butcherblocknamibia/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ff5a1f] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#fa703f]"
            >
              <Instagram className="h-4 w-4" aria-hidden="true" />
              Follow on Instagram
            </a>
          </div>
        </section>
      </div>

      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
