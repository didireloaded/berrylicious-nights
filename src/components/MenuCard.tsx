import { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Plus, Star, UtensilsCrossed, Wine } from "lucide-react";
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
  const isDrink = item.menuSection === "drinks";

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

  const hasVerifiedRating = Boolean(!disabled && ratingSummary && ratingSummary.review_count > 0);

  return (
    <article
      style={{ contentVisibility: "auto", containIntrinsicSize: "120px" }}
      className={
        "bb-card-motion group relative flex items-center gap-3 overflow-hidden rounded-[20px] border border-white/10 bg-[#242424] p-2.5 sm:gap-3.5 sm:p-3 " +
        (disabled ? "opacity-55" : "hover:border-white/20 hover:bg-[#292929]")
      }
    >
      {/* Compact square visual thumbnail (or clean category icon fallback) */}
      <Link
        to={`/menu/${item.id}`}
        aria-label={`View ${item.name}`}
        className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[14px] bg-[#1B1B1B] sm:h-[96px] sm:w-[96px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
      >
        {artwork.src ? (
          <img
            src={artwork.src}
            alt={artwork.isExactDish ? item.name : ""}
            loading="lazy"
            decoding="async"
            className="bb-ease-spring h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.045]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-[#2B2B2B] to-[#1A1A1A] px-2 text-center">
            {isDrink ? (
              <Wine className="h-5 w-5 text-[#FF5A1F]/80" strokeWidth={1.7} aria-hidden="true" />
            ) : (
              <UtensilsCrossed className="h-5 w-5 text-[#FF5A1F]/80" strokeWidth={1.7} aria-hidden="true" />
            )}
          </div>
        )}

        {disabled && (
          <span className="absolute inset-x-1 bottom-1 rounded-full bg-[#121212]/90 px-2 py-0.5 text-center text-[10px] font-semibold text-white/90">
            Unavailable
          </span>
        )}
      </Link>

      {/* Persisted favourite button (44x44px hit box pinned top-right) */}
      <button
        type="button"
        onClick={handleToggleFavorite}
        aria-pressed={favorited}
        aria-label={favorited ? `Remove ${item.name} from favourites` : `Save ${item.name} to favourites`}
        className="bb-press absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:text-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
      >
        <Heart
          key={favorited ? "fav" : "unfav"}
          className={"h-[18px] w-[18px] transition-colors " + (favorited ? "bb-pop fill-[#FF5A1F] text-[#FF5A1F]" : "text-current")}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </button>

      {/* Compact dish info, metadata & price/action row */}
      <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
        <div className="pr-9">
          <Link
            to={`/menu/${item.id}`}
            className="block focus-visible:outline-none focus-visible:underline"
          >
            <h3 className="line-clamp-1 text-[16px] font-bold leading-snug tracking-[-0.02em] text-white">
              {item.name}
            </h3>
          </Link>

          {(sizeHint || hasVerifiedRating) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-medium text-white/70">
              {sizeHint && <span className="truncate">{sizeHint}</span>}
              {hasVerifiedRating && ratingSummary && (
                <span
                  aria-label={`Verified rating ${ratingSummary.avg_rating.toFixed(1)} from ${ratingSummary.review_count} orders`}
                  className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-white tabular-nums"
                >
                  <Star className="h-3 w-3 fill-[#FF5A1F] text-[#FF5A1F]" aria-hidden="true" />
                  {ratingSummary.avg_rating.toFixed(1)}
                  <span className="font-normal text-[#A3A3A3]">({ratingSummary.review_count})</span>
                </span>
              )}
            </div>
          )}
        </div>

        <p className="mt-0.5 line-clamp-1 text-[14px] leading-snug text-[#A3A3A3]">
          {item.description}
        </p>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Link to={`/menu/${item.id}`} className="min-w-0">
            <span className="block truncate text-[16px] font-extrabold tabular-nums text-[#FF5A1F] sm:text-[17px]">
              {priceText}
            </span>
          </Link>

          {!disabled && (
            isSeasonalQuote ? (
              <Link
                to={`/menu/${item.id}`}
                aria-label={`View seasonal quote details for ${item.name}`}
                className="bb-press inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-white/15 bg-[#303030] px-3.5 text-[13px] font-semibold text-white hover:bg-[#3A3A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                Details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleQuickAdd}
                aria-label={`Add ${item.name} to order`}
                className="bb-press -mb-0.5 -mr-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF5A1F] text-white hover:bg-[#E84D15] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
