import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { menuItems, categories } from "@/data/menu";
import MenuCard from "@/components/MenuCard";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { Input } from "@/components/ui/input";

type MenuLens = "all" | "popular" | "featured";

const MenuPage = () => {
  const { isUnavailable } = useMenuAvailability();
  const [searchParams] = useSearchParams();
  const [lens, setLens] = useState<MenuLens>("all");
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat && categories.includes(cat)) {
      setLens("all");
      setActiveCategory(cat);
    }
  }, [searchParams]);

  const popular = useMemo(() => menuItems.filter((i) => i.popular), []);
  const featuredOnly = useMemo(() => menuItems.filter((i) => i.featured), []);

  const categoryFiltered =
    activeCategory === "All" ? menuItems : menuItems.filter((i) => i.category === activeCategory);

  const gridItems =
    lens === "popular" ? popular : lens === "featured" ? featuredOnly : categoryFiltered;

  const displayedItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gridItems;
    return gridItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [gridItems, search]);

  const lensPills: { id: MenuLens; label: string }[] = [
    { id: "all", label: "Full menu" },
    { id: "popular", label: "Most ordered" },
    { id: "featured", label: "Featured" },
  ];

  return (
    <div className="pb-safe-nav animate-fade-in">
      <div className="px-4 pt-2 max-w-6xl mx-auto sm:px-8 sm:pt-8">
        <h1 className="font-display text-3xl sm:text-5xl font-semibold leading-tight">Explore the menu</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6 leading-snug">
          Find something for the table. Browse by course or search for a favourite.
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes, ingredients…"
            className="h-12 rounded-lg border-border bg-card pl-10 pr-9 text-base placeholder:text-muted-foreground/70"
            aria-label="Search menu"
            autoComplete="off"
            enterKeyHint="search"
          />
          {search.trim() !== "" && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Decision layer */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-hide">
          {lensPills.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLens(p.id)}
              className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors btn-press ${
                lens === p.id
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/15"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Category tabs — full menu lens only */}
        {lens === "all" && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-1.5 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-4 py-2.5 rounded-md text-sm font-medium transition-colors btn-press ${
                  activeCategory === cat
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-card text-muted-foreground border border-border hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {lens !== "all" && (
          <p className="text-[11px] text-muted-foreground mb-1.5 mt-1">
            {lens === "popular" ? "What everyone’s ordering right now." : "Chef’s spotlight picks tonight."}
          </p>
        )}

        {/* Menu grid */}
        {displayedItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search.trim() ? (
              <>
                No dishes match “{search.trim()}”.{" "}
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Clear search
                </button>
              </>
            ) : (
              "Nothing in this section."
            )}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {displayedItems.map((item, index) => (
              <div
                key={item.id}
                className="h-full"
                
              >
                <MenuCard item={item} disabled={isUnavailable(item.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuPage;
