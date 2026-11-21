import { forwardRef } from "react";
import { Search, SlidersHorizontal, X, UtensilsCrossed } from "lucide-react";
import { categories } from "@/data/menu";
import { categoryArtwork } from "@/lib/menuArtwork";

type SearchAndCategoriesProps = {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  featuredOnly: boolean;
  onFeaturedToggle: () => void;
  categoryList?: string[];
  placeholder?: string;
  artworkResolver?: (category: string) => string | null;
};

export const SearchAndCategories = forwardRef<HTMLInputElement, SearchAndCategoriesProps>(
  function SearchAndCategories({
    search,
    onSearchChange,
    category,
    onCategoryChange,
    featuredOnly,
    onFeaturedToggle,
    categoryList = categories,
    placeholder = "Search dishes",
    artworkResolver = categoryArtwork,
  }, inputRef) {
    return (
      <div className="mt-7 space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-white/45" />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              aria-label="Search menu"
              className="min-h-[52px] w-full rounded-full border border-white/15 bg-[#242424] pl-12 pr-12 text-[15px] text-white outline-none placeholder:text-white/45 focus:border-[#ff5a1f] focus:ring-1 focus:ring-[#ff5a1f]"
            />
            {search.trim() && (
              <button type="button" onClick={() => onSearchChange("")} aria-label="Clear search" className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/65 hover:text-white">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label={featuredOnly ? "Show all menu items" : "Show featured menu items"}
            aria-pressed={featuredOnly}
            onClick={onFeaturedToggle}
            className={"flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] " +
              (featuredOnly ? "border-[#ff5a1f] bg-[#ff5a1f] text-white" : "border-white/15 bg-[#242424] text-white hover:border-white/40")}
          >
            <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div role="group" aria-label="Menu categories" className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide sm:-mx-8 sm:px-8">
          {categoryList.map((name) => {
            const active = name === category;
            const photo = artworkResolver(name);
            return (
              <button type="button" key={name} aria-pressed={active} onClick={() => onCategoryChange(name)}
                className="group flex min-w-[68px] max-w-[84px] shrink-0 snap-start flex-col items-center gap-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
              >
                <span className={"flex h-[66px] w-[66px] items-center justify-center overflow-hidden rounded-full border-[3px] p-[3px] transition-colors " +
                  (active ? "border-[#ff5a1f]" : "border-transparent group-hover:border-white/30")}
                >
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#292929]">
                    {photo ? <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <UtensilsCrossed aria-hidden="true" className="h-5 w-5 text-white/55" />}
                  </span>
                </span>
                <span className={"line-clamp-2 text-[12px] font-medium leading-tight " + (active ? "text-[#ff7b50]" : "text-white/60")}>{name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);
