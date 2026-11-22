import { forwardRef, useState } from "react";
import { Heart, Search, SlidersHorizontal, UtensilsCrossed, X } from "lucide-react";
import { categories } from "@/data/menu";
import { categoryArtwork } from "@/lib/menuArtwork";

export type PriceBand = "all" | "under150" | "150to300" | "over300";
export type MenuSort = "default" | "price-asc" | "price-desc";

type SearchAndCategoriesProps = {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  featuredOnly: boolean;
  onFeaturedToggle: () => void;
  favoritesOnly?: boolean;
  onFavoritesToggle?: () => void;
  favoritesCount?: number;
  priceBand?: PriceBand;
  onPriceBandChange?: (band: PriceBand) => void;
  sortBy?: MenuSort;
  onSortByChange?: (sort: MenuSort) => void;
  onResetFilters?: () => void;
  categoryList?: string[];
  placeholder?: string;
  artworkResolver?: (category: string) => string | null;
};

const PRICE_OPTIONS: { value: PriceBand; label: string }[] = [
  { value: "all", label: "All prices" },
  { value: "under150", label: "Under N$ 150" },
  { value: "150to300", label: "N$ 150 – N$ 300" },
  { value: "over300", label: "N$ 300+" },
];

const SORT_OPTIONS: { value: MenuSort; label: string }[] = [
  { value: "default", label: "Menu order" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export const SearchAndCategories = forwardRef<HTMLInputElement, SearchAndCategoriesProps>(
  function SearchAndCategories(
    {
      search,
      onSearchChange,
      category,
      onCategoryChange,
      featuredOnly,
      onFeaturedToggle,
      favoritesOnly = false,
      onFavoritesToggle,
      favoritesCount = 0,
      priceBand = "all",
      onPriceBandChange,
      sortBy = "default",
      onSortByChange,
      onResetFilters,
      categoryList = categories,
      placeholder = "Search for dishes, steaks, drinks...",
      artworkResolver = categoryArtwork,
    },
    inputRef,
  ) {
    const [filtersOpen, setFiltersOpen] = useState(false);

    const activeFilterCount =
      (featuredOnly ? 1 : 0) +
      (favoritesOnly ? 1 : 0) +
      (priceBand !== "all" ? 1 : 0) +
      (sortBy !== "default" ? 1 : 0);

    return (
      <div className="mt-5 space-y-5">
        {/* Large rounded iOS search bar + functional filter trigger */}
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#A3A3A3]"
            />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              aria-label="Search menu"
              className="min-h-[50px] w-full rounded-2xl border border-white/10 bg-[#242424] pl-11 pr-11 text-[16px] text-white outline-none placeholder:text-[#A3A3A3] focus:border-[#FF5A1F] focus:ring-1 focus:ring-[#FF5A1F] sm:text-[15px]"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[#A3A3A3] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            aria-label={filtersOpen ? "Close filter options" : "Open filter options"}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((prev) => !prev)}
            className={
              "relative flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
              (filtersOpen || activeFilterCount > 0
                ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                : "border-white/10 bg-[#242424] text-white hover:bg-[#303030]")
            }
          >
            <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
            {activeFilterCount > 0 && !filtersOpen && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#121212] bg-white px-1 text-[10px] font-bold text-[#121212]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Smoothly Collapsible Filter Panel */}
        <div
          className="bb-collapsible"
          data-open={filtersOpen ? "true" : "false"}
          aria-hidden={!filtersOpen}
        >
          <div>
            <div
              role="region"
              aria-label="Menu filters"
              className="space-y-4 rounded-[22px] border border-white/10 bg-[#242424] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-bold text-white">Filter &amp; Sort</p>
                {activeFilterCount > 0 && onResetFilters && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="text-[13px] font-semibold text-[#FF5A1F] hover:text-white"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={featuredOnly}
                  onClick={onFeaturedToggle}
                  className={
                    "bb-press min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold " +
                    (featuredOnly
                      ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                      : "border-white/10 bg-[#303030] text-white/85 hover:border-white/25")
                  }
                >
                  House favourites
                </button>
                {onFavoritesToggle && (
                  <button
                    type="button"
                    aria-pressed={favoritesOnly}
                    onClick={onFavoritesToggle}
                    className={
                      "bb-press inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold " +
                      (favoritesOnly
                        ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                        : "border-white/10 bg-[#303030] text-white/85 hover:border-white/25")
                    }
                  >
                    <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                    Saved ({favoritesCount})
                  </button>
                )}
              </div>

              {onPriceBandChange && (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A3A3A3]">
                    Price Range
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PRICE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={priceBand === opt.value}
                        onClick={() => onPriceBandChange(opt.value)}
                        className={
                          "bb-press min-h-[38px] rounded-full border px-3 text-[13px] font-medium " +
                          (priceBand === opt.value
                            ? "border-[#FF5A1F] bg-[#FF5A1F]/20 text-[#FF5A1F]"
                            : "border-white/10 bg-[#1B1B1B] text-[#A3A3A3] hover:text-white")
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {onSortByChange && (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A3A3A3]">
                    Sort By
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={sortBy === opt.value}
                        onClick={() => onSortByChange(opt.value)}
                        className={
                          "bb-press min-h-[38px] rounded-full border px-3 text-[13px] font-medium " +
                          (sortBy === opt.value
                            ? "border-[#FF5A1F] bg-[#FF5A1F]/20 text-[#FF5A1F]"
                            : "border-white/10 bg-[#1B1B1B] text-[#A3A3A3] hover:text-white")
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Horizontally scrollable circular category selectors with orange active ring */}
        <div
          role="group"
          aria-label="Menu categories"
          className="-mx-5 flex snap-x gap-3.5 overflow-x-auto px-5 pb-1 scrollbar-hide sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
        >
          {categoryList.map((name) => {
            const active = name === category;
            const photo = artworkResolver(name);
            return (
              <button
                type="button"
                key={name}
                aria-pressed={active}
                onClick={() => onCategoryChange(name)}
                className="bb-press group flex min-w-[68px] max-w-[84px] shrink-0 snap-start flex-col items-center gap-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                <span
                  className={
                    "bb-ease-spring flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full border-[2.5px] p-[3px] transition-[border-color,transform] duration-200 " +
                    (active ? "scale-[1.04] border-[#FF5A1F]" : "border-white/10 group-hover:border-white/30")
                  }
                >
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#242424]">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UtensilsCrossed aria-hidden="true" className="h-5 w-5 text-[#A3A3A3]" />
                    )}
                  </span>
                </span>
                <span
                  className={
                    "line-clamp-2 text-[12px] font-semibold leading-tight " +
                    (active ? "text-[#FF5A1F]" : "text-[#A3A3A3] group-hover:text-white")
                  }
                >
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);
