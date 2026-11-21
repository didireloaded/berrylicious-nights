import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarHeart, ShoppingBag } from "lucide-react";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";
import { foodItems, drinkItems } from "@/data/menu";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useActiveUpdates } from "@/hooks/useActiveUpdates";
import { useAboutSheet } from "@/context/AboutSheetContext";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import { ActiveOrderBanner } from "@/components/ActiveOrderBanner";
import { formatPrice } from "@/lib/vibe";
import type { HomeUpdateRow } from "@/lib/eventBooking";

const MEAL_OF_THE_DAY = foodItems.find((item) => item.id === "6") ?? foodItems[0];
const DRINK_OF_THE_DAY = drinkItems.find((item) => item.id === "14") ?? drinkItems[0];
const WINE_PICK = drinkItems.find((item) => item.category === "Sauvignon Blanc") ?? drinkItems[1];

export default function DashboardHomePage() {
  const { user, profile } = useAuth();
  const { totalItems } = useCart();
  const updates = useActiveUpdates();
  const { openAbout } = useAboutSheet();
  const [selectedEvent, setSelectedEvent] = useState<HomeUpdateRow | null>(null);

  const guestSavedName =
    typeof localStorage !== "undefined" ? localStorage.getItem("butcher-block-guest-name") : null;
  const displayName = (profile?.display_name || user?.user_metadata?.full_name || guestSavedName || "Guest").trim();
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className={"min-h-dvh bg-[#121212] text-white " + (totalItems > 0 ? "pb-56" : "pb-36")}>
      <div className="mx-auto max-w-[560px] px-5 pt-[max(30px,env(safe-area-inset-top,0px))] sm:px-8">
        {/* Clean Header with Logo + Profile + Cart */}
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="Butcher Block welcome screen" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
            <img src={butcherBlockLogo} alt="Butcher Block Steakhouse" className="h-9 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-2.5">
            <Link
              to="/profile"
              aria-label={`Profile: ${displayName}`}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#242424] text-sm font-semibold text-white transition-colors hover:border-[#ff5a1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
            >
              {initial}
            </Link>
            <Link
              to="/cart"
              aria-label={`Your order, ${totalItems} items`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#ff5a1f] px-1 text-[10px] font-bold">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </Link>
          </div>
        </header>

        <ActiveOrderBanner />

        {/* Meal of the Day */}
        <section className="mt-8" aria-labelledby="meal-of-day-heading">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff7342]">
            MEAL OF THE DAY
          </p>
          <Link
            to={`/menu/${MEAL_OF_THE_DAY.id}`}
            className="group relative mt-3 block h-[270px] overflow-hidden rounded-[27px] border border-white/10 bg-[#242424] shadow-[0_14px_34px_rgba(0,0,0,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
          >
            <img
              src={MEAL_OF_THE_DAY.image}
              alt={MEAL_OF_THE_DAY.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
              <div className="min-w-0">
                <span className="inline-block rounded-full bg-[#ff5a1f] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                  {MEAL_OF_THE_DAY.category}
                </span>
                <h1 id="meal-of-day-heading" className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.04em] text-white">
                  {MEAL_OF_THE_DAY.name}
                </h1>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/70">
                  {MEAL_OF_THE_DAY.description}
                </p>
                <p className="mt-2 text-[16px] font-semibold text-white">{formatPrice(MEAL_OF_THE_DAY.price)}</p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#121212] transition-transform group-hover:scale-105">
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </section>

        {/* Quiet Drinks Strip */}
        <section className="mt-9" aria-labelledby="home-drinks-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff7342]">FROM THE BAR &amp; CELLAR</p>
              <h2 id="home-drinks-heading" className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">Drinks today</h2>
            </div>
            <Link to="/drinks" className="mb-0.5 text-[13px] font-medium text-[#ff8157] hover:text-white">
              Full drinks
            </Link>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3">
            {[DRINK_OF_THE_DAY, WINE_PICK].map((drink) => (
              <Link
                key={drink.id}
                to={`/menu/${drink.id}`}
                className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-[#242424] p-3 transition-colors hover:border-white/25"
              >
                <img
                  src={drink.image}
                  alt={drink.name}
                  className="h-12 w-12 shrink-0 rounded-full border-2 border-[#121212] object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-white">{drink.name}</p>
                  <p className="mt-0.5 text-[11px] text-white/50">{drink.category}</p>
                  <p className="mt-1 text-[13px] font-semibold text-[#ff8055]">{formatPrice(drink.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Subtle, Calm Upcoming Events */}
        {updates.length > 0 && (
          <section className="mt-9" aria-labelledby="home-events-heading">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff7342]">ON THE CALENDAR</p>
                <h2 id="home-events-heading" className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">Upcoming events</h2>
              </div>
              <Link to="/events" className="mb-0.5 text-[13px] font-medium text-[#ff8157] hover:text-white">
                See all
              </Link>
            </div>

            <div className="mt-3.5 divide-y divide-white/10 rounded-[24px] border border-white/10 bg-[#1c1c1c] px-4">
              {updates.slice(0, 2).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-[#ff8157] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#242424] text-[#ff7b50]">
                      <CalendarHeart className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-white">{event.title}</p>
                      <p className="mt-0.5 truncate text-[12px] text-white/50">{event.type}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Quick Menu & Contact Footer Row */}
        <div className="mt-9 flex items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-white/55">
          <Link to="/menu" className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-[#ff8157]">
            Explore full food menu <ArrowRight className="h-4 w-4 text-[#ff7b50]" />
          </Link>
          <button type="button" onClick={openAbout} className="underline-offset-4 hover:text-white hover:underline">
            Hours &amp; contact
          </button>
        </div>
      </div>

      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
