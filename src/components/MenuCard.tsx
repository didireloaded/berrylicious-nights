import { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Plus, Star, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useDishRatings } from "@/hooks/useDishRatings";
import { menuArtwork } from "@/lib/menuArtwork";
import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/vibe";

const MenuCard = memo(function MenuCard({ item, disabled = false }: { item: MenuItem; disabled?: boolean }) {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const dishRatings = useDishRatings();
  const ratingSummary = dishRatings.get(item.id);
  const artwork = menuArtwork(item);
  const favorited = isFavorite(item.id);

  const isSeasonalQuote = Boolean(item.priceLabel);
  const priceText = item.priceLabel
    ? item.priceLabel
    : item.variations && item.variations.length > 1
      ? `From ${formatPrice(Math.min(...item.variations.map((v) => v.price)))}`
      : formatPrice(item.price);

  const sizeHint =
    item.variations && item.variations.length > 0
      ? item.variations.map((v) => v.size).join(" / ")
      : item.region || null;

  const handleQuickAdd = () => {
    if (disabled || isSeasonalQuote) return;
    const defaultVariation = item.variations?.[0];
    if (defaultVariation) {
      addItem(item, {
        weight: defaultVariation.size,
        priceOverride: defaultVariation.price,
      });
      toast.success(`${item.name} (${defaultVariation.size}) added to your order`);
      return;
    }
    addItem(item);
    toast.success(`${item.name} added to your order`);
  };

  const handleToggleFavorite = () => {
    const added = toggleFavorite(item.id);
    toast.success(added ? `Saved ${item.name} to favourites` : `Removed ${item.name} from favourites`);
  };

  return (
    <article
      style={{ contentVisibility: "auto", containIntrinsicSize: "272px" }}
      className={
        "bb-card-motion group relative flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#242424] " +
        (disabled ? "opacity-55" : "hover:border-white/20")
      }
    >
      {/* Visual header (representative photo or honest clean category header fallback) */}
      <div className="relative h-[156px] w-full overflow-hidden bg-[#1B1B1B]">
        <Link
          to={`/menu/${item.id}`}
          aria-label={`View ${item.name}`}
          className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF5A1F]"
        >
          {artwork.src ? (
            <>
              <img
                src={artwork.src}
                alt={artwork.isExactDish ? item.name : ""}
                loading="lazy"
                decoding="async"
                className="bb-ease-spring h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.035]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#242424] via-[#242424]/25 to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2B2B2B] to-[#1A1A1A] px-6 text-center">
              <UtensilsCrossed className="h-7 w-7 text-[#FF5A1F]/80" strokeWidth={1.6} aria-hidden="true" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#A3A3A3]">
                {item.category}
              </span>
            </div>
          )}
        </Link>

        {/* Real persisted favourite button */}
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-pressed={favorited}
          aria-label={favorited ? `Remove ${item.name} from favourites` : `Save ${item.name} to favourites`}
          className="bb-press absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#121212]/70 text-white backdrop-blur-md active:scale-90 hover:bg-[#121212]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
        >
          <Heart
            key={favorited ? "fav" : "unfav"}
            className={"h-5 w-5 transition-colors " + (favorited ? "bb-pop fill-[#FF5A1F] text-[#FF5A1F]" : "text-white")}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        </button>

        {disabled && (
          <span className="absolute left-3 top-3 rounded-full bg-[#121212]/85 px-3 py-1 text-[12px] font-semibold text-white/80">
            Unavailable
          </span>
        )}
        {!disabled && ratingSummary && ratingSummary.review_count > 0 && (
          <span
            aria-label={`Verified rating ${ratingSummary.avg_rating.toFixed(1)} from ${ratingSummary.review_count} orders`}
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-[#121212]/80 px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur-md tabular-nums"
          >
            <Star className="h-3.5 w-3.5 fill-[#FF5A1F] text-[#FF5A1F]" aria-hidden="true" />
            {ratingSummary.avg_rating.toFixed(1)}
            <span className="font-normal text-[#A3A3A3]">({ratingSummary.review_count})</span>
          </span>
        )}
      </div>

      {/* Dish details & primary action row */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-2">
        <Link
          to={`/menu/${item.id}`}
          className="focus-visible:outline-none focus-visible:underline"
        >
          <h3 className="text-[18px] font-bold leading-snug tracking-[-0.025em] text-white">
            {item.name}
          </h3>
        </Link>

        {sizeHint && (
          <p className="mt-0.5 text-[13px] font-medium text-white/75">{sizeHint}</p>
        )}

        <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-[#A3A3A3]">
          {item.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <Link to={`/menu/${item.id}`} className="min-w-0">
            <span className="block text-[18px] font-extrabold tabular-nums text-[#FF5A1F]">
              {priceText}
            </span>
          </Link>

          {!disabled && (
            isSeasonalQuote ? (
              <Link
                to={`/menu/${item.id}`}
                aria-label={`View seasonal quote details for ${item.name}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-[#303030] px-4 text-[13px] font-semibold text-white hover:bg-[#3A3A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                Details <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleQuickAdd}
                aria-label={`Add ${item.name} to order`}
                className="bb-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF5A1F] text-white hover:bg-[#E84D15] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            )
          )}
        </div>
      </div>
    </article>
  );
});

export default MenuCard;
