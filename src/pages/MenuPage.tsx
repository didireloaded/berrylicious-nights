import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, MapPin, ShoppingBag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { menuItems, categories } from "@/data/menu";
import MenuCard from "@/components/MenuCard";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { useActiveUpdates } from "@/hooks/useActiveUpdates";
import { EventDetailSheet } from "@/components/EventDetailSheet";
import type { HomeUpdateRow } from "@/lib/eventBooking";
import { promoSpotlight, isPromoSpotlightActive } from "@/data/promoSpotlight";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";
import { SearchAndCategories } from "@/components/SearchAndCategories";
import { RestaurantActionPills } from "@/components/RestaurantActionPills";

export default function MenuPage() {
  const [params] = useSearchParams();
  const searchInput = useRef<HTMLInputElement>(null);
  const { user, profile } = useAuth();
  const { totalItems } = useCart();
  const { isUnavailable } = useMenuAvailability();
  const updates = useActiveUpdates();
  const { openAssistant } = useRestaurantAssistant();

  const [category, setCategory] = useState(() => {
    const fromUrl = params.get("category");
    return fromUrl && categories.includes(fromUrl) ? fromUrl : "All";
  });
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [query, setQuery] = useState(() => params.get("search") ?? "");
  const [selectedEvent, setSelectedEvent] = useState<HomeUpdateRow | null>(null);

  useEffect(() => {
    const fromUrl = params.get("category");
    if (fromUrl && categories.includes(fromUrl)) setCategory(fromUrl);
    if (params.get("focusSearch") === "1") {
      searchInput.current?.focus();
      searchInput.current?.scrollIntoView({ block: "nearest" });
    }
  }, [params]);

  const displayedItems = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim();
    return menuItems.filter((item) => {
      if (category !== "All" && item.category !== category) return false;
      if (onlyFeatured && !item.featured) return false;
      if (!needle) return true;
      return [item.name, item.description, item.category].some((text) => text.toLocaleLowerCase().includes(needle));
    });
  }, [category, onlyFeatured, query]);

  const housePicks = useMemo(() => menuItems.filter((item) => item.featured).slice(0, 4), []);
  const showPicks = category === "All" && !onlyFeatured && !query.trim();
  const displayName = (profile?.display_name || user?.user_metadata?.full_name || "Guest").trim();
  const initial = displayName.charAt(0).toUpperCase();
  const promoActive = isPromoSpotlightActive(promoSpotlight);

  const resetFilters = () => {
    setCategory("All");
    setOnlyFeatured(false);
    setQuery("");
    searchInput.current?.focus();
  };

  return (
    <div className="min-h-dvh bg-[#121212] pb-32 text-white">
      <div className="mx-auto max-w-[560px] px-5 pt-[max(30px,env(safe-area-inset-top,0px))] sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link to="/profile" className="group flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]" aria-label="Open your profile">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#303030] text-base font-semibold text-white">{initial}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{displayName}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[12px] text-white/55"><MapPin className="h-3 w-3" aria-hidden="true" /> Windhoek, Namibia</span>
            </span>
          </Link>
          <Link to="/cart" className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]" aria-label={`Your order, ${totalItems} items`}>
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {totalItems > 0 && <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#ff5a1f] px-1 text-[11px] font-bold">{totalItems > 99 ? "99+" : totalItems}</span>}
          </Link>
        </header>

        <div className="mt-12">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ff7342]">THE BERRYLICIOUS MENU</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <h1 className="max-w-[370px] text-[clamp(3.2rem,11vw,4.8rem)] font-extrabold leading-[0.98] tracking-[-0.065em]">What's your craving?</h1>
            <Link to="/booking" className="mb-1 shrink-0 border-b border-[#ff5a1f]/80 pb-1 text-[13px] font-semibold text-[#ff8157] transition-colors hover:text-white">
              Book table
            </Link>
          </div>
          <p className="mt-4 max-w-[380px] text-[14px] leading-relaxed text-white/55">Something good for tonight, picked your way.</p>
        </div>

        <SearchAndCategories
          ref={searchInput}
          search={query}
          onSearchChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          featuredOnly={onlyFeatured}
          onFeaturedToggle={() => setOnlyFeatured((value) => !value)}
        />
        <div className="mt-6">
          <RestaurantActionPills />
        </div>

        {showPicks && (
          <section className="mt-11" aria-labelledby="house-picks-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#ff7342]">Selected from the menu</p>
                <h2 id="house-picks-heading" className="mt-1.5 text-[30px] font-semibold tracking-[-0.055em]">House picks</h2>
              </div>
              <button type="button" onClick={() => { setOnlyFeatured(true); setCategory("All"); }} className="mb-1 text-[13px] font-medium text-[#ff8157] hover:text-white">See all</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
              {housePicks.map((item) => <MenuCard key={item.id} item={item} disabled={isUnavailable(item.id)} />)}
            </div>
          </section>
        )}

        <section id="menu-full-list" className="mt-12 scroll-mt-6" aria-labelledby="full-menu-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#ff7342]">Explore</p>
              <h2 id="full-menu-heading" className="mt-1.5 text-[30px] font-semibold tracking-[-0.05em]">{onlyFeatured ? "Featured dishes" : category === "All" ? "Full menu" : category}</h2>
            </div>
            <button
              type="button"
              onClick={() => { setOnlyFeatured((prev) => !prev); }}
              aria-pressed={onlyFeatured}
              className={"rounded-full border px-4 py-2 text-[13px] font-semibold " + (onlyFeatured ? "border-[#ff5a1f] bg-[#ff5a1f] text-white" : "border-white/20 text-white/70 hover:border-white/50")}
            >
              Featured only
            </button>
          </div>
          <p className="mt-2 text-[13px] text-white/45">{displayedItems.length} {displayedItems.length === 1 ? "item" : "items"}</p>
          {displayedItems.length ? (
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5">
              {displayedItems.map((item) => <MenuCard key={item.id} item={item} disabled={isUnavailable(item.id)} />)}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-white/10 bg-[#222] p-7">
              <h3 className="text-xl font-semibold">Nothing matches yet.</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">Try another dish, ingredient or category.</p>
              <button type="button" onClick={resetFilters} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#ff7b50]">Clear filters <ArrowRight className="h-4 w-4" /></button>
            </div>
          )}
        </section>

        {promoActive && (
          <section className="mt-12" aria-labelledby="offer-heading">
            <div className="flex items-center justify-between">
              <h2 id="offer-heading" className="text-[30px] font-semibold tracking-[-0.05em]">Offers</h2>
              <Link to="/promo" className="text-[13px] text-[#ff8157]">See more</Link>
            </div>
            <Link to="/promo" className="mt-4 flex min-h-28 items-center justify-between gap-4 rounded-[24px] bg-[#242424] p-5 transition-colors hover:bg-[#2b2b2b]">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-[#ff7545]">{promoSpotlight.badge}</p><h3 className="mt-2 text-lg font-semibold">{promoSpotlight.title}</h3></div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#121212]"><ArrowRight className="h-5 w-5" /></span>
            </Link>
          </section>
        )}

        {updates.length > 0 && (
          <section className="mt-12" aria-labelledby="updates-heading">
            <h2 id="updates-heading" className="text-[30px] font-semibold tracking-[-0.05em]">Happening here</h2>
            <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
              {updates.slice(0, 5).map((update) => (
                <button type="button" key={update.id} onClick={() => setSelectedEvent(update)} className="flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
                  <span><span className="text-xs font-semibold uppercase tracking-wider text-[#ff7b50]">{update.type}</span><span className="mt-1 block text-lg font-medium">{update.title}</span></span>
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 rounded-[28px] border border-white/10 bg-[#202020] px-6 py-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff7b50]">Not sure what to choose?</p>
          <h2 className="mt-3 max-w-[280px] text-[28px] font-semibold leading-tight tracking-[-0.045em]">Ask us what goes well together.</h2>
          <button type="button" onClick={openAssistant} className="mt-5 inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold text-[#ff845e]">Ask Berrylicious <ArrowRight className="h-4 w-4" /></button>
        </section>
        <p className="mt-7 text-center text-xs leading-relaxed text-white/35">Category photographs are illustrative until individual dish images are verified.</p>
      </div>
      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
