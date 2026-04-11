import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import heroImage from "@/assets/hero-restaurant.jpg";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useActiveUpdates } from "@/hooks/useActiveUpdates";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { DEFAULT_HOME_SUGGESTED_NIGHT, readSuggestedNight } from "@/lib/suggestedNight";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import { type HomeUpdateRow, type BookingNavState, resolveHeadlineTime } from "@/lib/eventBooking";
import { fetchCrowdSnapshot, type CrowdSnapshot } from "@/lib/homeCrowd";
import { getHomeTimeContext } from "@/lib/homeSmart";
import { planDraftInProgress } from "@/lib/planDraft";
import { CalendarDays, ShoppingBag, MessageCircle, Sparkles, Instagram, Heart, Users, Tag } from "lucide-react";
import { RestaurantChatSheet } from "@/components/RestaurantChatSheet";
import { clientOfTheDay } from "@/data/clientOfTheDay";
import { getHomePromoTeaser } from "@/data/promoSpotlight";

const heroVideoUrl = (import.meta.env.VITE_HERO_VIDEO_URL ?? "").trim();

const HomePage = () => {
  const { addItem } = useCart();
  const { user, profile } = useAuth();
  const { currentOrder, currentBooking } = useApp();
  const updates = useActiveUpdates();
  const { openAbout } = useAboutSheet();
  const [selectedEvent, setSelectedEvent] = useState<HomeUpdateRow | null>(null);
  const [crowd, setCrowd] = useState<CrowdSnapshot | null>(null);
  const [crowdLoading, setCrowdLoading] = useState(true);
  const [videoError, setVideoError] = useState(() => !heroVideoUrl);
  const [chatOpen, setChatOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [nightBlurb, setNightBlurb] = useState(() => {
    const s = readSuggestedNight();
    return s
      ? { time: s.time, food: s.food, drink: s.drink, guests: s.guests }
      : {
          time: DEFAULT_HOME_SUGGESTED_NIGHT.time,
          food: DEFAULT_HOME_SUGGESTED_NIGHT.food,
          drink: DEFAULT_HOME_SUGGESTED_NIGHT.drink,
          guests: undefined as number | undefined,
        };
  });

  useEffect(() => {
    const syncNightBlurb = () => {
      const s = readSuggestedNight();
      setNightBlurb(
        s
          ? { time: s.time, food: s.food, drink: s.drink, guests: s.guests }
          : {
              time: DEFAULT_HOME_SUGGESTED_NIGHT.time,
              food: DEFAULT_HOME_SUGGESTED_NIGHT.food,
              drink: DEFAULT_HOME_SUGGESTED_NIGHT.drink,
              guests: undefined as number | undefined,
            },
      );
    };
    syncNightBlurb();
    document.addEventListener("visibilitychange", syncNightBlurb);
    return () => document.removeEventListener("visibilitychange", syncNightBlurb);
  }, []);

  useEffect(() => {
    const bump = () => setNowTick(Date.now());
    const id = window.setInterval(bump, 60_000);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setCrowdLoading(true);
    void (async () => {
      try {
        const c = await fetchCrowdSnapshot(today);
        setCrowd(c);
      } catch (e) {
        console.warn("[HomePage] fetchCrowdSnapshot:", e);
        setCrowd({
          level: "quiet",
          label: "Quiet",
          hint: "We couldn’t load live data — tables may still be available.",
          bookingCount: 0,
          bookedSlotCount: 0,
        });
      } finally {
        setCrowdLoading(false);
      }
    })();
  }, []);

  const displayName = profile?.display_name || user?.user_metadata?.full_name;

  const popularItems = useMemo(() => menuItems.filter((i) => i.popular), []);
  const trendingDrinks = useMemo(() => {
    const drinks = menuItems.filter((i) => i.category === "Drinks");
    return [...drinks]
      .sort((a, b) => {
        const sa = (a.popular ? 2 : 0) + (a.featured ? 1 : 0);
        const sb = (b.popular ? 2 : 0) + (b.featured ? 1 : 0);
        return sb - sa;
      })
      .slice(0, 5);
  }, []);
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const promoTeaser = useMemo(() => getHomePromoTeaser(), []);

  const continueBookingState = useMemo((): BookingNavState => {
    const guests =
      typeof nightBlurb.guests === "number" && nightBlurb.guests > 0 ? nightBlurb.guests : 2;
    return {
      suggestedDate: todayStr,
      suggestedTime: nightBlurb.time,
      suggestedGuests: guests,
      tablesAlmostFull: !crowdLoading && crowd?.level === "busy",
    };
  }, [todayStr, nightBlurb, crowdLoading, crowd?.level]);

  const timeCtx = useMemo(() => getHomeTimeContext(new Date(nowTick)), [nowTick]);

  const heroGoldLine =
    updates.length > 0
      ? `${updates[0].title} • ${crowdLoading ? "…" : crowd?.label ?? "Tonight"}`
      : `${timeCtx.part === "evening" || timeCtx.part === "late" ? "Tonight’s line-up" : "What’s on"} • ${crowdLoading ? "…" : crowd?.label ?? "Walk-ins welcome"}`;

  const orderInProgress =
    currentOrder &&
    currentOrder.status !== "completed" &&
    ["pending", "preparing", "ready"].includes(String(currentOrder.status));

  const bookingTonight =
    currentBooking &&
    currentBooking.date === todayStr &&
    typeof currentBooking.guests === "number" &&
    currentBooking.guests > 0;

  const showPlanContinue = planDraftInProgress();

  type HomePriority = "order" | "booking" | "plan" | null;
  const homePriority: HomePriority = orderInProgress
    ? "order"
    : bookingTonight
      ? "booking"
      : showPlanContinue
        ? "plan"
        : null;

  return (
    <div className="min-h-[100dvh] pb-safe-nav">
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="fixed right-4 z-[60] flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:border-primary/55 hover:bg-black/55 hover:shadow-[0_12px_40px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.96] top-[max(12px,calc(env(safe-area-inset-top,0px)+8px))]"
        aria-label="Open chat"
      >
        <MessageCircle className="h-[22px] w-[22px] text-primary" strokeWidth={2.2} />
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary shadow-sm ring-2 ring-black/60" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/90" />
        </span>
      </button>

      <RestaurantChatSheet open={chatOpen} onOpenChange={setChatOpen} />

      {homePriority === "order" && currentOrder && (
        <Link
          to={`/order/${currentOrder.id}`}
          className="fixed left-4 right-4 z-[55] mx-auto max-w-lg rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3 text-center text-sm font-bold text-primary shadow-lg backdrop-blur-md transition-colors hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 top-[max(12px,calc(env(safe-area-inset-top,0px)+8px))]"
        >
          Order live — {String(currentOrder.status)} · tap to track
        </Link>
      )}
      {homePriority === "booking" && currentBooking && (
        <Link
          to="/booking/success"
          state={currentBooking}
          className="fixed left-4 right-4 z-[55] mx-auto max-w-lg rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-center text-sm font-bold text-emerald-200 shadow-lg backdrop-blur-md transition-colors hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 top-[max(12px,calc(env(safe-area-inset-top,0px)+8px))]"
        >
          Table tonight {currentBooking.time} · {currentBooking.guests} guests — details and code
        </Link>
      )}
      {homePriority === "plan" && (
        <Link
          to="/plan"
          className="fixed left-4 right-16 z-[55] max-w-lg rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-center text-sm font-bold text-amber-100 shadow-lg backdrop-blur-md transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 top-[max(12px,calc(env(safe-area-inset-top,0px)+8px))]"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            Continue your plan — picks saved
          </span>
        </Link>
      )}

      {/* Hero */}
      <section className="relative h-[100dvh] max-h-[880px] min-h-[min(100dvh,600px)]">
        {heroVideoUrl && !videoError ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            className="absolute inset-0 w-full h-full object-cover"
            poster={heroImage}
          >
            <source src={heroVideoUrl} type="video/mp4" />
          </video>
        ) : (
          <img
            src={heroImage}
            alt="Berrylicious restaurant interior"
            className="absolute inset-0 w-full h-full object-cover"
            width={1920}
            height={1080}
            decoding="async"
            fetchPriority="high"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/50 to-background" />
        <div
          className={`relative h-full flex flex-col justify-end px-6 pb-10 max-w-lg mx-auto ${homePriority ? "pt-[4.25rem]" : ""}`}
        >
          {/* 1. Hero — time-of-day + crowd / events */}
          {updates.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedEvent(updates[0])}
              className="w-full text-left rounded-2xl border border-white/10 bg-black/45 px-4 py-4 backdrop-blur-md card-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <p className="text-[22px] font-bold leading-tight text-white">{timeCtx.heroTitle}</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug text-primary">{heroGoldLine}</p>
              <p className="mt-1 text-xs text-white/50 leading-snug">{timeCtx.heroSubtitle}</p>
              <p className="mt-2 text-sm text-white/60">
                Best time: {nightBlurb.time}
                {!crowdLoading && crowd?.hint ? <span className="text-white/45"> · {crowd.hint}</span> : null}
              </p>
            </button>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-4 backdrop-blur-md">
              <p className="text-[22px] font-bold leading-tight text-white">{timeCtx.heroTitle}</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug text-primary">{heroGoldLine}</p>
              <p className="mt-1 text-xs text-white/50 leading-snug">{timeCtx.heroSubtitle}</p>
              <p className="mt-2 text-sm text-white/60">
                Best time: {nightBlurb.time}
                {!crowdLoading && crowd?.hint ? <span className="text-white/45"> · {crowd.hint}</span> : null}
              </p>
            </div>
          )}

          {/* 2. Primary action — Plan first (menu + preorder continuity) */}
          <div className="mt-5 rounded-[20px] bg-[#1A1A1A] px-5 py-5 shadow-2xl ring-1 ring-white/10">
            <p className="text-xl font-bold leading-tight text-white">Tonight is sorted</p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/55">
              {nightBlurb.time} · {nightBlurb.food} · {nightBlurb.drink}
            </p>
            <Link
              to="/plan"
              className="mt-3 block w-full rounded-xl bg-primary py-3.5 text-center text-base font-bold text-primary-foreground btn-press shadow-lg shadow-primary/25"
            >
              Continue
            </Link>
            <Link
              to="/booking"
              state={continueBookingState}
              className="mt-3 block text-center text-xs font-medium text-white/45 transition-colors hover:text-white/70"
            >
              Book a table only
            </Link>
            {bookingTonight && homePriority !== "booking" && currentBooking && (
              <p className="mt-2 text-center text-[11px] text-white/40">
                Table lined up for {currentBooking.time} ·{" "}
                <Link to="/booking/success" state={currentBooking} className="text-primary/90 hover:underline">
                  View booking
                </Link>
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <Link
              to="/booking"
              state={continueBookingState}
              className="font-semibold text-primary hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
            >
              <CalendarDays className="w-4 h-4" /> Book
            </Link>
            <span className="text-white/25" aria-hidden>
              ·
            </span>
            <Link
              to="/menu"
              className="font-semibold text-white/70 hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4" /> Order
            </Link>
          </div>
        </div>
      </section>

      <div className="px-6 max-w-lg mx-auto space-y-10 mt-10">
        {/* 3. Events — compact grid */}
        {updates.length > 0 && (
          <section className="animate-fade-in">
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Events</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {updates.map((update) => {
                const evTime = resolveHeadlineTime(update);
                return (
                  <button
                    key={update.id}
                    type="button"
                    onClick={() => setSelectedEvent(update)}
                    className="rounded-xl border border-border bg-[#1A1A1A] p-2.5 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 card-interactive btn-press"
                  >
                    <h3 className="line-clamp-2 text-sm font-semibold text-white">{update.title}</h3>
                    <p className="mt-1.5 text-xs text-white/50">{evTime}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Social hook — story-style entry points (replaces busy menu grid) */}
        <section className="animate-fade-in">
          <h2 className="font-display text-lg font-semibold text-foreground">The room tonight</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">
            Peek the feed, browse the menu, and see who we&apos;re celebrating tonight — before you pick plates.
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide snap-x snap-mandatory">
            <Link
              to="/promo"
              className="snap-start shrink-0 w-[148px] overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/12 via-card to-card text-left shadow-md shadow-black/15 transition-colors hover:border-primary/45 btn-press"
            >
              <div className="relative h-16 w-full">
                <img
                  src={promoTeaser.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <span className="absolute left-2 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  {promoTeaser.active ? promoTeaser.badge : "Promos"}
                </span>
              </div>
              <div className="p-3 pt-2.5">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Tag className="h-4 w-4" />
                </div>
                <p className="text-sm font-bold leading-tight text-foreground line-clamp-2">{promoTeaser.title}</p>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground line-clamp-3">{promoTeaser.shortLine}</p>
                {!promoTeaser.active && (
                  <p className="mt-1.5 text-[10px] font-semibold text-muted-foreground">See what&apos;s next →</p>
                )}
              </div>
            </Link>
            <a
              href="https://instagram.com/berrylicious__restaurant"
              target="_blank"
              rel="noopener noreferrer"
              className="snap-start shrink-0 w-[148px] rounded-2xl border border-border bg-card p-4 text-left shadow-md shadow-black/10 transition-colors hover:border-primary/30 btn-press"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-500/15 text-pink-400 mb-3">
                <Instagram className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-foreground leading-tight">@berrylicious__restaurant</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">Stories from the floor, specials, drops.</p>
            </a>
            <button
              type="button"
              onClick={() => openAbout()}
              className="snap-start shrink-0 w-[148px] rounded-2xl border border-border bg-card p-4 text-left shadow-md shadow-black/10 transition-colors hover:border-primary/30 btn-press"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white mb-3">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-bold text-foreground leading-tight">Our story</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">Hours, contact, gallery — the vibe in one place.</p>
            </button>
          </div>
          <div className="mt-5 rounded-2xl border border-border/80 bg-gradient-to-br from-card to-background/80 px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Right now</p>
            <div className="flex gap-3 text-sm text-muted-foreground leading-snug">
              <Users className="w-5 h-5 shrink-0 text-primary mt-0.5" aria-hidden />
              <p>
                {crowdLoading
                  ? "Checking how the room feels…"
                  : crowd?.hint ?? "Walk in or book — the room finds its own rhythm."}
              </p>
            </div>
            <div className="mt-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card/80 to-background/90 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{clientOfTheDay.headline}</p>
              <p className="mt-1 font-display text-lg font-bold text-foreground">{clientOfTheDay.name}</p>
              <div className="mt-3 flex gap-2">
                {clientOfTheDay.photos.map((src, i) => (
                  <div
                    key={i}
                    className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-border ring-1 ring-white/5"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{clientOfTheDay.story}</p>
            </div>
          </div>
        </section>

        {/* Decision shortcuts — popular tonight */}
        {popularItems.length > 0 && (
          <section className="animate-fade-in">
            <h2 className="font-display text-lg font-semibold text-foreground">Popular tonight</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Crowd favourites — tap to add or open the dish.</p>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide snap-x snap-mandatory">
              {popularItems.map((item) => (
                <div key={item.id} className="w-[120px] shrink-0 snap-start touch-manipulation">
                  <Link to={`/menu/${item.id}`} className="block">
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                      <img
                        src={item.image}
                        alt=""
                        width={120}
                        height={120}
                        className="h-[120px] w-[120px] object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </Link>
                  <Link to={`/menu/${item.id}`} className="mt-2 block text-xs font-medium leading-tight text-foreground line-clamp-2 hover:text-primary transition-colors">
                    {item.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => addItem(item)}
                    className="mt-1 text-[11px] font-semibold text-primary"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {trendingDrinks.length > 0 && (
          <section className="animate-fade-in">
            <h2 className="font-display text-lg font-semibold text-foreground">Trending drinks</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Bar picks that pair with the room tonight.</p>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide snap-x snap-mandatory">
              {trendingDrinks.map((item) => (
                <div key={item.id} className="w-[120px] shrink-0 snap-start touch-manipulation">
                  <Link to={`/menu/${item.id}`} className="block">
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                      <img
                        src={item.image}
                        alt=""
                        width={120}
                        height={120}
                        className="h-[120px] w-[120px] object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </Link>
                  <Link to={`/menu/${item.id}`} className="mt-2 block text-xs font-medium leading-tight text-foreground line-clamp-2 hover:text-primary transition-colors">
                    {item.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => addItem(item)}
                    className="mt-1 text-[11px] font-semibold text-primary"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
            <Link
              to="/menu?category=Drinks"
              className="mt-2 inline-block text-xs font-semibold text-primary hover:opacity-90"
            >
              Full drinks list →
            </Link>
          </section>
        )}

        {/* Welcome back */}
        {user && displayName && (
          <section className="animate-fade-in">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-foreground font-semibold">Welcome back, {displayName}</p>
              {profile?.last_order && (
                <p className="text-muted-foreground text-sm mt-1">
                  Your usual:{" "}
                  {typeof profile.last_order === "object" && profile.last_order?.name
                    ? profile.last_order.name
                    : "Check your profile"}
                </p>
              )}
              <Link to="/menu" className="mt-3 inline-block text-sm font-semibold text-primary">
                Order again →
              </Link>
            </div>
          </section>
        )}

        {/* 6. Gallery — light */}
        <section className="animate-fade-in opacity-90">
          <h2 className="font-display text-base font-medium text-muted-foreground mb-3">Gallery</h2>
          <div className="grid grid-cols-3 gap-2">
            {[gallery1, gallery2, gallery3].slice(0, 3).map((img, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg opacity-95">
                <img
                  src={img}
                  alt={`Gallery ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => openAbout()}
            className="mt-2 block w-full text-center text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            View more
          </button>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border">
          <p className="font-display text-lg text-foreground">Berrylicious</p>
          <p className="text-muted-foreground text-sm mt-1">Restaurant & Lounge</p>
          <p className="text-muted-foreground text-xs mt-1">Freedom Plaza, City Centre, Windhoek</p>
          <button
            type="button"
            onClick={() => openAbout()}
            className="mt-4 text-sm font-medium text-primary transition-opacity hover:opacity-80"
          >
            About us &amp; hours
          </button>
          <p className="text-muted-foreground text-xs mt-4">&copy; {new Date().getFullYear()} Berrylicious. All rights reserved.</p>
        </footer>
      </div>

      {selectedEvent && (
        <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
};

export default HomePage;
