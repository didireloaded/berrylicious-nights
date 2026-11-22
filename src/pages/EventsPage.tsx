import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calendar, Clock, Instagram, MapPin } from "lucide-react";
import { butcherBlockEvents } from "@/data/eventsData";
import { useActiveUpdates } from "@/hooks/useActiveUpdates";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import type { HomeUpdateRow } from "@/lib/eventBooking";
import { useCart } from "@/context/CartContext";
import dishCocktail from "@/assets/dish-cocktail.jpg";
import dishLamb from "@/assets/dish-lamb.jpg";
import dishBurger from "@/assets/dish-burger.jpg";

const FALLBACK_EVENT_IMAGES = [dishCocktail, dishLamb, dishBurger];

export default function EventsPage() {
  const updates = useActiveUpdates();
  const { totalItems } = useCart();
  const [selectedEvent, setSelectedEvent] = useState<HomeUpdateRow | null>(null);

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
        description:
          staticMatch?.description ??
          (u.subtitle || "Reserve your table at Butcher Block Steakhouse, Am Weinberg Estate."),
        image: staticMatch?.image ?? FALLBACK_EVENT_IMAGES[idx % FALLBACK_EVENT_IMAGES.length],
      };
    });
  }, [updates]);

  return (
    <div
      className={
        "min-h-dvh bg-[#121212] text-white lg:pb-16 " +
        (totalItems > 0 ? "pb-44" : "pb-28")
      }
    >
      <div className="mx-auto max-w-[560px] px-5 pt-[max(20px,env(safe-area-inset-top,0px))] sm:px-6 lg:max-w-5xl lg:px-8 lg:pt-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              aria-label="Back to Home"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <div>
              <h1 className="font-display text-[26px] font-extrabold tracking-[-0.04em] text-white sm:text-[30px]">
                Events &amp; Nights
              </h1>
              <p className="text-[13px] text-[#A3A3A3]">Am Weinberg Estate, Windhoek</p>
            </div>
          </div>

          <Link
            to="/booking"
            className="inline-flex min-h-[44px] items-center rounded-full bg-[#FF5A1F] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Book Table
          </Link>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {eventCards.map((event) => (
            <article
              key={event.id}
              className="flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#242424]"
            >
              <div className="relative h-44 w-full overflow-hidden bg-[#181818]">
                <img
                  src={event.image}
                  alt={event.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#242424] via-[#242424]/30 to-transparent" />
                <span className="absolute left-3.5 top-3.5 rounded-full bg-[#FF5A1F] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                  {event.tag}
                </span>
              </div>

              <div className="flex flex-1 flex-col px-4 pb-4 pt-2">
                <h2 className="text-[20px] font-bold tracking-[-0.03em] text-white">
                  {event.title}
                </h2>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-[#A3A3A3]">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                    {event.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                    {event.time}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                    Am Weinberg Estate
                  </span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-[#C4C4C4]">
                  {event.description}
                </p>

                <button
                  type="button"
                  onClick={() => setSelectedEvent(event.row)}
                  className="mt-auto pt-4"
                >
                  <span className="flex min-h-[48px] w-full items-center justify-between rounded-full border border-white/10 bg-[#303030] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#FF5A1F]">
                    <span>Reserve a table</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-8 flex flex-col justify-between gap-4 rounded-[24px] border border-white/10 bg-[#242424] p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#FF5A1F]">
              Follow Butcher Block
            </p>
            <h2 className="mt-1 text-[20px] font-bold tracking-[-0.03em] text-white">
              @butcherblocknamibia
            </h2>
            <p className="mt-1 text-[14px] text-[#A3A3A3]">
              Seasonal evenings, cellar pours, and steakhouse updates from Windhoek.
            </p>
          </div>
          <a
            href="https://www.instagram.com/butcherblocknamibia/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#E84D15]"
          >
            <Instagram className="h-4 w-4" aria-hidden="true" />
            Open Instagram
          </a>
        </section>
      </div>

      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
