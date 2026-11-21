import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, ShoppingBag, Wine } from "lucide-react";
import { toast } from "sonner";
import { drinkCategories, wineList } from "@/data/drinksData";
import { menuItems, type MenuItem } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import MenuCard from "@/components/MenuCard";
import { formatPrice } from "@/lib/vibe";
import dishCocktail from "@/assets/dish-cocktail.jpg";

type DrinkFilter = "All" | (typeof drinkCategories)[number];

const FILTER_OPTIONS: DrinkFilter[] = ["All", ...drinkCategories];

export default function DrinksPage() {
  const { addItem, totalItems } = useCart();
  const { isUnavailable } = useMenuAvailability();
  const [filter, setFilter] = useState<DrinkFilter>("All");

  const winesByVarietal = useMemo(() => {
    const map = new Map<string, typeof wineList>();
    for (const wine of wineList) {
      const list = map.get(wine.category) ?? [];
      list.push(wine);
      map.set(wine.category, list);
    }
    return Array.from(map.entries());
  }, []);

  const barItems = useMemo(() => {
    const drinks = menuItems.filter((item) => item.category === "Drinks");
    const nonWine = drinks.filter((item) => item.tag === "Classic" || item.tag === "Jar" || item.tag === "Shooter");
    if (filter === "Cocktails") return nonWine.filter((item) => item.tag === "Classic");
    if (filter === "Jars") return nonWine.filter((item) => item.tag === "Jar");
    if (filter === "Shooters") return nonWine.filter((item) => item.tag === "Shooter");
    return nonWine;
  }, [filter]);

  const showWines = filter === "All" || filter === "Wine";
  const showBar = filter !== "Wine";

  const addWineBottle = (wine: (typeof wineList)[number]) => {
    const matchingMenu = menuItems.find(
      (m) => m.name.toLowerCase().includes(wine.name.toLowerCase()) || wine.name.toLowerCase().includes(m.name.toLowerCase()),
    );
    const payload: MenuItem = matchingMenu ?? {
      id: `wine-${wine.id}`,
      name: wine.name,
      description: `${wine.category} · ${wine.region} (Bottle)`,
      price: wine.price,
      image: dishCocktail,
      category: "Drinks",
      tag: wine.category,
    };
    addItem(payload);
    toast.success(`${payload.name} added to your order`);
  };

  return (
    <div className={"min-h-dvh bg-[#121212] text-white " + (totalItems > 0 ? "pb-56" : "pb-36")}>
      <div className="mx-auto max-w-[560px] px-5 pt-[max(30px,env(safe-area-inset-top,0px))] sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/menu"
            aria-label="Back to Food menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ff7342]">
            CELLAR &amp; BAR
          </span>
          <Link
            to="/cart"
            aria-label={`Your order, ${totalItems} items`}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#ff5a1f] px-1 text-[11px] font-bold">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </Link>
        </header>

        <div className="mt-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ff7342]">
            BUTCHER BLOCK CELLAR
          </p>
          <h1 className="mt-3 text-[clamp(3rem,11vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.065em]">
            Wine &amp; Drinks
          </h1>
          <p className="mt-4 max-w-[380px] text-[14px] leading-relaxed text-white/55">
            South African cellar selections, signature copper-mug cocktails, jars, and shooters.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div
          role="tablist"
          aria-label="Drink categories"
          className="mt-7 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
        >
          {FILTER_OPTIONS.map((cat) => {
            const active = filter === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(cat)}
                className={
                  "min-h-11 shrink-0 rounded-full px-5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] " +
                  (active
                    ? "bg-[#ff5a1f] text-white"
                    : "border border-white/15 bg-[#242424] text-white/80 hover:bg-[#303030]")
                }
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Typographic South African Wine List */}
        {showWines && (
          <section className="mt-10" aria-labelledby="wine-list-heading">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#ff7342]">
                  South African Estates
                </p>
                <h2 id="wine-list-heading" className="mt-1.5 text-[30px] font-semibold tracking-[-0.05em]">
                  Wine List
                </h2>
              </div>
              <Wine className="mb-1.5 h-5 w-5 text-[#ff7b50]" aria-hidden="true" />
            </div>

            <div className="mt-5 space-y-6">
              {winesByVarietal.map(([varietal, wines]) => (
                <div
                  key={varietal}
                  className="rounded-[27px] border border-white/10 bg-[#242424] px-5 py-5"
                >
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#ff7b50]">
                    {varietal}
                  </h3>
                  <ul className="mt-4 divide-y divide-white/10">
                    {wines.map((wine) => (
                      <li key={wine.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-[16px] font-semibold leading-snug tracking-[-0.025em] text-white">
                            {wine.name}
                          </p>
                          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">
                            {wine.region} · Bottle
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-[16px] font-semibold tabular-nums text-white">
                            {formatPrice(wine.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => addWineBottle(wine)}
                            aria-label={`Add ${wine.name} to order`}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#121212] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
                          >
                            <Plus className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cocktails, Jars & Shooters Grid using exact MenuCard circular plate style */}
        {showBar && barItems.length > 0 && (
          <section className="mt-12" aria-labelledby="bar-grid-heading">
            <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#ff7342]">
              From the Bar
            </p>
            <h2 id="bar-grid-heading" className="mt-1.5 text-[30px] font-semibold tracking-[-0.05em]">
              {filter === "All" ? "Cocktails, Jars & Shooters" : filter}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
              {barItems.map((item) => (
                <MenuCard key={item.id} item={item} disabled={isUnavailable(item.id)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
