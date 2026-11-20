import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, MessageCircle, ShoppingBag } from "lucide-react";
import heroImage from "@/assets/hero-restaurant.jpg";
import { useApp } from "@/context/AppContext";
import { useActiveUpdates } from "@/hooks/useActiveUpdates";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import { RestaurantChatSheet } from "@/components/RestaurantChatSheet";
import { menuItems } from "@/data/menu";
import type { HomeUpdateRow } from "@/lib/eventBooking";
import { formatPrice } from "@/lib/vibe";
import { getWindhoekDateISO } from "@/lib/windhoekDate";

const heroVideoUrl = (import.meta.env.VITE_HERO_VIDEO_URL ?? "").trim();

export default function HomePageEditorial() {
  const updates = useActiveUpdates();
  const { currentOrder, currentBooking } = useApp();
  const { openAbout } = useAboutSheet();
  const [selectedEvent, setSelectedEvent] = useState<HomeUpdateRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const featured = useMemo(() => menuItems.filter((item) => item.popular).slice(0, 4), []);
  const hasCurrentBooking = Boolean(currentBooking && currentBooking.date >= getWindhoekDateISO());
  const hasCurrentOrder = Boolean(
    currentOrder && ["pending", "preparing", "ready"].includes(String(currentOrder.status)),
  );

  return (
    <div className="min-h-dvh overflow-x-clip pb-safe-nav">
      <section className="relative isolate flex min-h-[680px] flex-col justify-end overflow-hidden lg:min-h-[720px]">
        {heroVideoUrl && !videoFailed && !reduceMotion ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={heroImage}
            onError={() => setVideoFailed(true)}
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            aria-hidden="true"
          >
            <source src={heroVideoUrl} type="video/mp4" />
          </video>
        ) : (
          <img
            src={heroImage}
            alt=""
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/60 to-background/20 lg:bg-gradient-to-r lg:from-background/95 lg:via-background/65 lg:to-background/15" />
        <div className="absolute inset-x-0 top-0 mx-auto flex w-full max-w-7xl items-center justify-between px-5 pt-[max(24px,env(safe-area-inset-top,0px))] lg:hidden">
          <Link to="/" className="font-display text-2xl font-semibold tracking-tight text-white">
            Berrylicious<span className="text-primary">.</span>
          </Link>
          <Link to="/booking" className="rounded-full border border-white/40 px-4 py-2.5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Book a table
          </Link>
        </div>
        <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-40 sm:px-8 lg:px-12 lg:pb-28">
          <div className="max-w-[720px]">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-primary">Berrylicious · Windhoek</p>
            <h1 className="font-display text-[clamp(3.35rem,9vw,6.6rem)] font-medium leading-[0.98] tracking-[-0.045em] text-white">
              Come for dinner.<br />Stay for the night.
            </h1>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-white/80 sm:text-lg">
              Good food, drinks and time together. Make yourself at home.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/booking"
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Book a table <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/menu"
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-white/45 px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Explore the menu
              </Link>
            </div>
          </div>
          {(hasCurrentOrder || hasCurrentBooking) && (
            <div className="mt-9 flex max-w-xl flex-col gap-3 rounded-2xl border border-white/20 bg-background/85 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {hasCurrentOrder ? "Your order is in progress" : "You have an upcoming reservation"}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {hasCurrentOrder ? "See the latest status of your order." : currentBooking?.date + " at " + currentBooking?.time}
                </p>
              </div>
              <Link
                to={hasCurrentOrder && currentOrder ? "/order/" + currentOrder.id : "/booking/success"}
                state={!hasCurrentOrder ? currentBooking : undefined}
                className="inline-flex items-center gap-2 self-start text-sm font-semibold text-primary sm:self-auto"
              >
                View details <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="ways-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mb-11 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your evening, your way</p>
          <h2 id="ways-heading" className="font-display text-4xl font-medium leading-tight text-foreground sm:text-5xl">
            A place for the plans you make.
          </h2>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {[
            { num: "01", title: "Save your seat", text: "Choose the date, time and number of guests.", href: "/booking", action: "Reserve a table" },
            { num: "02", title: "Pick what you love", text: "Browse the menu and order before you arrive.", href: "/menu", action: "Explore dishes" },
            { num: "03", title: "Make a night of it", text: "Put together a dinner plan in a few simple steps.", href: "/plan", action: "Plan your evening" },
          ].map((item) => (
            <Link
              key={item.num}
              to={item.href}
              className="group grid gap-3 py-6 transition-colors hover:bg-card/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-[60px_1fr_auto] sm:items-center sm:gap-8 sm:py-8"
            >
              <span className="text-sm font-medium text-primary">{item.num}</span>
              <div>
                <h3 className="font-display text-2xl font-medium text-foreground sm:text-3xl">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">{item.text}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                {item.action} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="menu-heading" className="border-y border-border bg-card/50">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12 lg:py-28">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">From the menu</p>
            <h2 id="menu-heading" className="font-display text-4xl font-medium leading-tight text-foreground sm:text-5xl">
              Find your favourite.
            </h2>
            <p className="mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
              Start with the dishes guests keep coming back for, then explore the full menu.
            </p>
            <Link to="/menu" className="mt-7 inline-flex min-h-11 items-center gap-3 border-b border-primary pb-1 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              View full menu <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {featured.map((item) => (
              <Link
                key={item.id}
                to={"/menu/" + item.id}
                className="group flex items-start justify-between gap-6 py-5 first:pt-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-medium text-foreground sm:text-2xl">{item.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
                <span className="shrink-0 pt-1 text-sm font-semibold text-primary">{formatPrice(item.price)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {updates.length > 0 && (
        <section aria-labelledby="events-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">At Berrylicious</p>
          <h2 id="events-heading" className="font-display text-4xl font-medium text-foreground sm:text-5xl">What's happening</h2>
          <div className="mt-9 divide-y divide-border border-y border-border">
            {updates.slice(0, 6).map((event) => (
              <button
                type="button"
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="group flex w-full items-center justify-between gap-6 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-primary">{event.type}</span>
                  <span className="mt-2 block font-display text-2xl font-medium text-foreground">{event.title}</span>
                  {event.subtitle && <span className="mt-2 block text-sm text-muted-foreground">{event.subtitle}</span>}
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-9 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:px-12 lg:py-24">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">See you soon</p>
            <h2 className="font-display text-4xl font-medium text-foreground sm:text-5xl">There's a seat for you.</h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">Planning something or just looking for dinner? Start with a table.</p>
          </div>
          <Link to="/booking" className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Book a table <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-9 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span>Berrylicious · Windhoek, Namibia</span>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <button type="button" onClick={openAbout} className="text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">About & contact</button>
          <button type="button" onClick={() => setChatOpen(true)} className="inline-flex items-center gap-2 text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><MessageCircle className="h-4 w-4" aria-hidden="true" /> Ask us</button>
          <Link to="/cart" className="inline-flex items-center gap-2 text-foreground underline-offset-4 hover:underline"><ShoppingBag className="h-4 w-4" aria-hidden="true" /> Your order</Link>
          <a href="https://instagram.com/berrylicious__restaurant" rel="noreferrer noopener" target="_blank" className="text-foreground underline-offset-4 hover:underline">Instagram</a>
        </div>
      </footer>
      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      <RestaurantChatSheet open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
