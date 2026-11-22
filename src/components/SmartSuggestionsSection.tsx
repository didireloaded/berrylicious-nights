import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useDiningPreferences } from "@/hooks/useDiningPreferences";
import { useFavorites } from "@/hooks/useFavorites";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { buildSmartFoodSuggestions } from "@/lib/smartSuggestions";
import { menuArtwork } from "@/lib/menuArtwork";
import { formatPrice } from "@/lib/vibe";
import { normalizeReviewMenuItemId } from "@/lib/reviews";

function readRecentOrderItemIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const saved = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
    if (!Array.isArray(saved)) return [];
    const ids: string[] = [];
    for (const order of saved.slice(-6)) {
      if (Array.isArray(order?.items)) {
        for (const it of order.items) {
          const base = normalizeReviewMenuItemId(it?.id);
          if (base) ids.push(base);
        }
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Deterministic "Suggested for You" strip shown ONLY when the guest has real
 * dietary preferences, saved favourites, or prior orders to base recommendations on.
 */
export function SmartSuggestionsSection() {
  const { prefs } = useDiningPreferences();
  const { favoriteIds } = useFavorites();
  const { disabledIds } = useMenuAvailability();

  const pastItemIds = useMemo(() => readRecentOrderItemIds(), []);
  const hasPersonalSignal =
    prefs.dietaryPreferences.length > 0 || favoriteIds.length > 0 || pastItemIds.length > 0;

  const suggestions = useMemo(() => {
    if (!hasPersonalSignal) return [];
    return buildSmartFoodSuggestions({
      dietaryPreferences: prefs.dietaryPreferences,
      favoriteIds,
      pastOrderItemIds: pastItemIds,
      disabledIds,
      limit: 4,
    });
  }, [hasPersonalSignal, prefs.dietaryPreferences, favoriteIds, pastItemIds, disabledIds]);

  if (!hasPersonalSignal || suggestions.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="smart-suggestions-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="smart-suggestions-heading" className="flex items-center gap-2 text-[20px] font-bold tracking-[-0.03em] text-white">
          <Sparkles className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
          Suggested for You
        </h2>
        <Link
          to="/profile"
          className="text-[13px] font-semibold text-[#FF5A1F] hover:text-white"
        >
          Preferences
        </Link>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map(({ item, reason }) => {
          const art = menuArtwork(item);
          return (
            <Link
              key={item.id}
              to={`/menu/${item.id}`}
              className="group flex items-center gap-3.5 rounded-[22px] border border-white/10 bg-[#242424] p-3 transition-colors hover:bg-[#2C2C2C]"
            >
              {art.src && (
                <img
                  src={art.src}
                  alt={art.isExactDish ? item.name : ""}
                  loading="lazy"
                  className="h-[72px] w-[72px] shrink-0 rounded-[16px] object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-[#FF5A1F]">{reason}</p>
                <h3 className="truncate text-[15px] font-bold text-white">{item.name}</h3>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[14px] font-extrabold tabular-nums text-white">
                    {formatPrice(item.price)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#A3A3A3] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
