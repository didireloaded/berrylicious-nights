import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, MapPin, ShoppingBag } from "lucide-react";
import heroFood from "@/assets/dish-burger.jpg";
import detailFood from "@/assets/dish-lamb.jpg";
import cocktail from "@/assets/dish-cocktail.jpg";
import { useApp } from "@/context/AppContext";
import { useActiveUpdates } from "@/hooks/useActiveUpdates";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import type { HomeUpdateRow } from "@/lib/eventBooking";
import { getWindhoekDateISO } from "@/lib/windhoekDate";

export default function HomePageEditorial() {
  const { currentOrder, currentBooking } = useApp();
  const updates = useActiveUpdates();
  const { openAbout } = useAboutSheet();
  const [selectedEvent, setSelectedEvent] = useState<HomeUpdateRow | null>(null);
  const hasOrder = Boolean(currentOrder && ["pending", "preparing", "ready"].includes(String(currentOrder.status)));
  const hasBooking = Boolean(currentBooking && currentBooking.date >= getWindhoekDateISO());
  const statusLink = useMemo(() => {
    if (hasOrder && currentOrder) return { to: `/order/${currentOrder.id}`, label: "Track your order", state: undefined };
    if (hasBooking && currentBooking) return { to: "/booking/success", label: "View your reservation", state: currentBooking };
    return null;
  }, [hasOrder, hasBooking, currentOrder, currentBooking]);

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] bg-[#121212] text-white">
      <section className="relative isolate h-[100dvh] min-h-[640px] overflow-hidden bg-black">
        <img
          src={heroFood}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="food-photo absolute inset-0 -z-20 h-full w-full object-cover object-[50%_25%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/10 via-[34%] to-black/90" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden="true" />

        <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 pt-[max(30px,env(safe-area-inset-top,0px))] sm:px-7">
          <Link to="/" aria-label="Berrylicious home" className="font-display text-[19px] font-extrabold tracking-[-0.055em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            berrylicious<span className="text-[#ff5a1f]">.</span>
          </Link>
          <Link to="/booking" className="flex min-h-10 shrink-0 items-center rounded-full border border-white/50 bg-black/20 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Book a table
          </Link>
        </header>

        <div className="food-enter absolute inset-x-0 bottom-[166px] z-10 px-5 sm:px-7">
          <p className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.19em] text-white/75">
            <MapPin className="h-3 w-3 text-[#ff6b34]" aria-hidden="true" /> WINDHOEK, NAMIBIA
          </p>
          <h1 className="max-w-[510px] font-display text-[clamp(3.15rem,12.5vw,5.25rem)] font-extrabold leading-[0.95] tracking-[-0.075em] text-white">
            <span className="block">Come</span>
            <span className="flex items-center gap-[0.13em] whitespace-nowrap">
              hungry.
              <span className="relative inline-block h-[0.49em] w-[1.36em] shrink-0 overflow-hidden rounded-full border-2 border-white/60 bg-black/60 align-middle">
                <img src={detailFood} alt="" className="h-full w-full object-cover" aria-hidden="true" />
              </span>
            </span>
            <span className="block">Stay for</span>
            <span className="flex items-center gap-[0.14em] whitespace-nowrap">
              more.
              <span className="relative inline-block h-[0.49em] w-[1.4em] shrink-0 overflow-hidden rounded-full border-2 border-white/60 bg-black/60 align-middle">
                <img src={cocktail} alt="" className="h-full w-full object-cover" aria-hidden="true" />
              </span>
            </span>
          </h1>
          <p className="mt-5 max-w-[260px] text-[14px] leading-relaxed text-white/75">Good food. Good company. The rest is up to you.</p>
        </div>

        <div className="absolute bottom-6 left-5 z-20 max-w-[190px] sm:left-7">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">START HERE</span>
          <span className="mt-1 block text-sm font-semibold">Explore the menu</span>
        </div>
        <div className="absolute -bottom-3 -right-3 z-20 h-[156px] w-[156px] rounded-tl-[110px] bg-white p-[12px]">
          <Link
            to="/menu"
            aria-label="Explore the Berrylicious menu"
            className="flex h-full w-full items-center justify-center rounded-tl-[98px] bg-[#ff5a1f] text-white transition-colors duration-200 hover:bg-[#fa703f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
          >
            <ArrowRight className="ml-6 mt-7 h-9 w-9 transition-transform duration-200" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {statusLink && (
        <Link
          to={statusLink.to}
          state={statusLink.state}
          className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#202020] px-6 py-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
        >
          {statusLink.label} <ArrowRight className="h-5 w-5 text-[#ff5a1f]" />
        </Link>
      )}

      <section className="px-6 py-16 sm:px-8" aria-labelledby="night-heading">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ff794c]">MORE THAN A MEAL</p>
        <h2 id="night-heading" className="mt-3 max-w-sm text-[38px] font-extrabold leading-[1.05] tracking-[-0.06em]">Make an evening of it.</h2>
        <div className="mt-9 divide-y divide-white/10 border-y border-white/10">
          <Link to="/booking" className="flex items-center justify-between gap-6 py-5 transition-colors hover:text-[#ff8358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
            <span><span className="block text-lg font-semibold">Reserve a table</span><span className="mt-1 block text-sm text-white/50">Choose your date and time.</span></span><CalendarDays className="h-6 w-6 shrink-0" strokeWidth={1.6} />
          </Link>
          <Link to="/plan" className="flex items-center justify-between gap-6 py-5 transition-colors hover:text-[#ff8358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
            <span><span className="block text-lg font-semibold">Plan your night</span><span className="mt-1 block text-sm text-white/50">Build your evening in a few steps.</span></span><ArrowRight className="h-6 w-6 shrink-0" strokeWidth={1.6} />
          </Link>
          <Link to="/cart" className="flex items-center justify-between gap-6 py-5 transition-colors hover:text-[#ff8358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
            <span><span className="block text-lg font-semibold">Your order</span><span className="mt-1 block text-sm text-white/50">See what is in your bag.</span></span><ShoppingBag className="h-6 w-6 shrink-0" strokeWidth={1.6} />
          </Link>
        </div>
      </section>

      {updates.length > 0 && (
        <section className="border-t border-white/10 px-6 py-12 sm:px-8" aria-labelledby="events-heading">
          <h2 id="events-heading" className="text-[29px] font-semibold tracking-tight">What's happening</h2>
          <div className="mt-5 divide-y divide-white/10">
            {updates.slice(0, 5).map((event) => (
              <button
                type="button"
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="flex min-h-[76px] w-full items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
              >
                <span><span className="text-[11px] font-semibold uppercase tracking-wide text-[#ff8054]">{event.type}</span><span className="mt-1 block text-[16px] font-semibold">{event.title}</span></span>
                <ArrowRight className="h-5 w-5 shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 py-8 text-[13px] text-white/55 sm:px-8">
        <span>Berrylicious · Windhoek</span>
        <button type="button" onClick={openAbout} className="text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">About & contact</button>
      </footer>
      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
