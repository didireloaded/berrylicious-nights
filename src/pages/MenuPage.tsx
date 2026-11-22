import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, MessageSquare } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";
import { foodItems, categories, type MenuItem } from "@/data/menu";
import MenuCard from "@/components/MenuCard";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { useFavorites } from "@/hooks/useFavorites";
import {
  SearchAndCategories,
  type MenuSort,
  type PriceBand,
} from "@/components/SearchAndCategories";
import { ActiveOrderBanner } from "@/components/ActiveOrderBanner";

function itemBasePrice(item: MenuItem): number {
  if (item.variations && item.variations.length > 0) {
    return Math.min(...item.variations.map((v) => v.price));
  }
  return item.price;
}

function matchesPriceBand(item: MenuItem, band: PriceBand): boolean {
  if (band === "all") return true;
  if (item.priceLabel) return false;
  const price = itemBasePrice(item);
  if (band === "under150") return price < 150;
  if (band === "150to300") return price >= 150 && price <= 300;
  return price > 300;
}

export default function MenuPage() {
  const [params] = useSearchParams();
  const searchInput = useRef<HTMLInputElement>(null);
  const { totalItems } = useCart();
  const { isUnavailable } = useMenuAvailability();
  const { favoriteIds, isFavorite } = useFavorites();
  const { openAssistant } = useRestaurantAssistant();

  const [category, setCategory] = useState(() => {
    const fromUrl = params.get("category");
    return fromUrl && categories.includes(fromUrl) ? fromUrl : "All";
  });
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [priceBand, setPriceBand] = useState<PriceBand>("all");
  const [sortBy, setSortBy] = useState<MenuSort>("default");
  const [query, setQuery] = useState(() => params.get("search") ?? "");

  useEffect(() => {
    const fromUrl = params.get("category");
    if (fromUrl && categories.includes(fromUrl)) setCategory(fromUrl);
    if (params.get("focusSearch") === "1") {
      searchInput.current?.focus();
      searchInput.current?.scrollIntoView({ block: "nearest" });
    }
  }, [params]);

  const foodFavoriteCount = useMemo(
    () => foodItems.filter((item) => favoriteIds.includes(item.id)).length,
    [favoriteIds],
  );

  const displayedItems = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim();
    const filtered = foodItems.filter((item) => {
      if (category !== "All" && item.category !== category) return false;
      if (onlyFeatured && !item.featured) return false;
      if (favoritesOnly && !isFavorite(item.id)) return false;
      if (!matchesPriceBand(item, priceBand)) return false;
      if (!needle) return true;
      return [item.name, item.description, item.category, item.tag ?? ""].some((text) =>
        text.toLocaleLowerCase().includes(needle),
      );
    });
    if (sortBy === "price-asc") {
      return [...filtered].sort((a, b) => itemBasePrice(a) - itemBasePrice(b));
    }
    if (sortBy === "price-desc") {
      return [...filtered].sort((a, b) => itemBasePrice(b) - itemBasePrice(a));
    }
    return filtered;
  }, [category, onlyFeatured, favoritesOnly, priceBand, sortBy, query, isFavorite]);

  const groupedByCategory = useMemo(() => {
    const orderedCats = categories.filter((c) => c !== "All");
    return orderedCats
      .map((cat) => ({
        name: cat,
        items: foodItems.filter((item) => item.category === cat),
      }))
      .filter((group) => group.items.length > 0);
  }, []);

  const hasActiveFilters =
    onlyFeatured || favoritesOnly || priceBand !== "all" || sortBy !== "default" || Boolean(query.trim());
  const showCategoryShelves = category === "All" && !hasActiveFilters;

  const selectCategory = (cat: string) => {
    setCategory(cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFilters = () => {
    setCategory("All");
    setOnlyFeatured(false);
    setFavoritesOnly(false);
    setPriceBand("all");
    setSortBy("default");
    setQuery("");
  };

  return (
    <div
      className={
        "min-h-dvh bg-[#121212] text-white lg:pb-16 " +
        (totalItems > 0 ? "pb-44" : "pb-28")
      }
    >
      <div className="mx-auto max-w-[560px] px-5 pt-[max(20px,env(safe-area-inset-top,0px))] sm:px-6 lg:max-w-5xl lg:px-8 lg:pt-8">
        {/* Clean iOS Page Header + Food/Drinks Switcher */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-extrabold tracking-[-0.04em] text-white sm:text-[32px]">
              Our Menu
            </h1>
            <p className="mt-0.5 text-[14px] text-[#A3A3A3]">
              Wet-aged Namibian beef, grill &amp; kitchen
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#242424] p-1">
            <span className="rounded-full bg-[#FF5A1F] px-3.5 py-2 text-[13px] font-bold text-white">
              Food
            </span>
            <Link
              to="/drinks"
              className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-[#A3A3A3] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              Drinks
            </Link>
          </div>
        </header>

        <ActiveOrderBanner />

        <SearchAndCategories
          ref={searchInput}
          search={query}
          onSearchChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          featuredOnly={onlyFeatured}
          onFeaturedToggle={() => setOnlyFeatured((v) => !v)}
          favoritesOnly={favoritesOnly}
          onFavoritesToggle={() => setFavoritesOnly((v) => !v)}
          favoritesCount={foodFavoriteCount}
          priceBand={priceBand}
          onPriceBandChange={setPriceBand}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onResetFilters={resetFilters}
          categoryList={categories}
          placeholder="Search for dishes, steaks, burgers..."
        />

        {/* Grouped Category Shelves when browsing All (fast rendering) */}
        {showCategoryShelves ? (
          <div id="menu-full-list" className="mt-7 space-y-10">
            {groupedByCategory.map((group) => (
              <section key={group.name} aria-labelledby={`cat-${group.name}`}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 id={`cat-${group.name}`} className="text-[22px] font-bold tracking-[-0.03em] text-white">
                    {group.name}
                  </h2>
                  {group.items.length > 3 && (
                    <button
                      type="button"
                      onClick={() => selectCategory(group.name)}
                      className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-[#FF5A1F] hover:text-white focus-visible:outline-none focus-visible:underline"
                    >
                      See all ({group.items.length}) <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.items.slice(0, 3).map((item) => (
                    <MenuCard key={item.id} item={item} disabled={isUnavailable(item.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section id="menu-full-list" className="mt-7 scroll-mt-6" aria-labelledby="full-menu-heading">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 id="full-menu-heading" className="text-[24px] font-bold tracking-[-0.03em] text-white">
                  {category === "All" ? "Filtered menu" : category}
                </h2>
                <p className="mt-0.5 text-[14px] text-[#A3A3A3]">
                  {displayedItems.length} {displayedItems.length === 1 ? "dish" : "dishes"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[44px] text-[14px] font-semibold text-[#FF5A1F] hover:text-white focus-visible:outline-none focus-visible:underline"
              >
                Show all
              </button>
            </div>

            {displayedItems.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayedItems.map((item) => (
                  <MenuCard key={item.id} item={item} disabled={isUnavailable(item.id)} />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-white/10 bg-[#242424] p-6">
                <h3 className="text-[18px] font-bold text-white">No matching dishes</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#A3A3A3]">
                  Try another search term, price band, or category.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FF5A1F] px-5 text-[14px] font-semibold text-white"
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        )}

        {/* Helpful non-obstructive menu assistant prompt */}
        <div className="mt-10 flex items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[#242424] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-white">Unsure which cut or pairing to pick?</p>
            <p className="text-[13px] text-[#A3A3A3]">Ask our restaurant assistant for suggestions.</p>
          </div>
          <button
            type="button"
            onClick={openAssistant}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-[#303030] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#3A3A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <MessageSquare className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
