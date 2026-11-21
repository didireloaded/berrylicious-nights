import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, ShoppingBag } from "lucide-react";
import { drinkItems, drinkMenuCategories } from "@/data/menu";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { SearchAndCategories } from "@/components/SearchAndCategories";
import { drinkCategoryArtwork } from "@/lib/menuArtwork";
import MenuCard from "@/components/MenuCard";
import { ActiveOrderBanner } from "@/components/ActiveOrderBanner";

export default function DrinksPage() {
  const searchInput = useRef<HTMLInputElement>(null);
  const { user, profile } = useAuth();
  const { totalItems } = useCart();
  const { isUnavailable } = useMenuAvailability();

  const [category, setCategory] = useState("All");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [query, setQuery] = useState("");

  const displayedItems = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim();
    return drinkItems.filter((item) => {
      if (category !== "All" && item.category !== category) return false;
      if (onlyFeatured && !item.featured) return false;
      if (!needle) return true;
      return [item.name, item.description, item.category, item.region ?? ""].some((text) =>
        text.toLocaleLowerCase().includes(needle),
      );
    });
  }, [category, onlyFeatured, query]);

  const groupedByCategory = useMemo(() => {
    const orderedCats = drinkMenuCategories.filter((c) => c !== "All");
    return orderedCats
      .map((cat) => ({
        name: cat,
        items: drinkItems.filter((item) => item.category === cat),
      }))
      .filter((group) => group.items.length > 0);
  }, []);

  const showCategoryShelves = category === "All" && !onlyFeatured && !query.trim();
  const guestSavedName =
    typeof localStorage !== "undefined" ? localStorage.getItem("butcher-block-guest-name") : null;
  const displayName = (profile?.display_name || user?.user_metadata?.full_name || guestSavedName || "Guest").trim();
  const initial = displayName.charAt(0).toUpperCase();

  const selectCategory = (cat: string) => {
    setCategory(cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFilters = () => {
    setCategory("All");
    setOnlyFeatured(false);
    setQuery("");
    searchInput.current?.focus();
  };

  return (
    <div className={"min-h-dvh bg-[#121212] text-white " + (totalItems > 0 ? "pb-56" : "pb-36")}>
      <div className="mx-auto max-w-[560px] px-5 pt-[max(30px,env(safe-area-inset-top,0px))] sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link to="/profile" className="group flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]" aria-label="Open your profile">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#303030] text-base font-semibold text-white">{initial}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{displayName}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[12px] text-white/55"><MapPin className="h-3 w-3" aria-hidden="true" /> Cellar &amp; Bar</span>
            </span>
          </Link>
          <Link to="/cart" className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]" aria-label={`Your order, ${totalItems} items`}>
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {totalItems > 0 && <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#ff5a1f] px-1 text-[11px] font-bold">{totalItems > 99 ? "99+" : totalItems}</span>}
          </Link>
        </header>

        <ActiveOrderBanner />

        <div className="mt-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ff7342]">
            BUTCHER BLOCK CELLAR &amp; BAR
          </p>
          <h1 className="mt-3 text-[clamp(3rem,11vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.065em]">
            Wine &amp; Drinks
          </h1>
          <p className="mt-4 max-w-[380px] text-[14px] leading-relaxed text-white/55">
            Browse our full wine list, signature cocktails, jars, and shooters by category.
          </p>
        </div>

        {/* Exact same circular category scroller & search bar as Food Menu */}
        <SearchAndCategories
          ref={searchInput}
          search={query}
          onSearchChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          featuredOnly={onlyFeatured}
          onFeaturedToggle={() => setOnlyFeatured((value) => !value)}
          categoryList={drinkMenuCategories}
          placeholder="Search wines, cocktails, jars, shooters..."
          artworkResolver={drinkCategoryArtwork}
        />

        {/* Grouped Visual Card Shelves when "All" is selected */}
        {showCategoryShelves ? (
          <div className="mt-10 space-y-12">
            {groupedByCategory.map((group) => (
              <section key={group.name} aria-labelledby={`drink-cat-${group.name}`}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#ff7342]">
                      {group.items.length} {group.items.length === 1 ? "selection" : "selections"}
                    </p>
                    <h2 id={`drink-cat-${group.name}`} className="mt-1 text-[28px] font-semibold tracking-[-0.05em]">
                      {group.name}
                    </h2>
                  </div>
                  {group.items.length > 2 && (
                    <button
                      type="button"
                      onClick={() => selectCategory(group.name)}
                      className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-[#ff8157] hover:text-white"
                    >
                      See all ({group.items.length}) <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
                  {group.items.slice(0, 2).map((item) => (
                    <MenuCard key={item.id} item={item} disabled={isUnavailable(item.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section className="mt-10 scroll-mt-6" aria-labelledby="drinks-filtered-heading">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#ff7342]">
                  {category === "All" ? "Filtered" : "Cellar & Bar"}
                </p>
                <h2 id="drinks-filtered-heading" className="mt-1 text-[30px] font-semibold tracking-[-0.05em]">
                  {onlyFeatured ? "Featured pours" : category === "All" ? "Search results" : category}
                </h2>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="mb-1 text-[13px] font-medium text-[#ff8157] hover:text-white"
              >
                All drinks
              </button>
            </div>
            <p className="mt-2 text-[13px] text-white/45">
              {displayedItems.length} {displayedItems.length === 1 ? "item" : "items"}
            </p>
            {displayedItems.length ? (
              <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5">
                {displayedItems.map((item) => (
                  <MenuCard key={item.id} item={item} disabled={isUnavailable(item.id)} />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-[#222] p-7">
                <h3 className="text-xl font-semibold">Nothing matches yet.</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">Try another estate, varietal, or cocktail name.</p>
                <button type="button" onClick={resetFilters} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#ff7b50]">
                  Clear filters <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
