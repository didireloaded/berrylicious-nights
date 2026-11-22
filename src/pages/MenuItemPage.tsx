import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flame,
  Heart,
  Leaf,
  MessageSquare,
  Minus,
  Plus,
  Salad,
  Share2,
  Soup,
  Utensils,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";
import {
  menuItems,
  PDF_COMPLIMENTARY_SIDES,
  PDF_DONENESS_GUIDE,
  PDF_SAUCE_ADDONS,
} from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { useFavorites } from "@/hooks/useFavorites";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";
import { menuArtwork } from "@/lib/menuArtwork";
import { getUpsellItems } from "@/services/upsell";
import { formatPrice } from "@/lib/vibe";
import MenuCard from "@/components/MenuCard";
import { DishReviewsSection } from "@/components/DishReviewsSection";
import restaurantPhoto from "@/assets/hero-restaurant.jpg";

function SideIcon({ side }: { side: string }) {
  const lower = side.toLowerCase();
  if (lower.includes("salad")) return <Salad className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />;
  if (lower.includes("veg")) return <Leaf className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />;
  if (lower.includes("mash") || lower.includes("pap")) return <Soup className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />;
  if (lower.includes("rice") || lower.includes("onion")) return <Wheat className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />;
  if (lower.includes("baked")) return <Flame className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />;
  return <Utensils className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />;
}

export default function MenuItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, totalItems } = useCart();
  const { isUnavailable } = useMenuAvailability();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { openAssistant } = useRestaurantAssistant();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const item = menuItems.find((candidate) => candidate.id === id);

  const isSteakCut = Boolean(
    item &&
      item.menuSection === "food" &&
      (item.category === "Choice Cuts" || item.category === "Butcher's Choice" || item.category === "Combos"),
  );
  const hasVariations = Boolean(item?.variations && item.variations.length > 1);
  const isSeasonalQuote = Boolean(item?.priceLabel);

  const [selectedVariation, setSelectedVariation] = useState<string>("");
  const [selectedDoneness, setSelectedDoneness] = useState<string>("Medium Rare");
  const [selectedSide, setSelectedSide] = useState<string>("Chips");
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [alcoholFree, setAlcoholFree] = useState(false);

  useEffect(() => {
    setQuantity(1);
    setJustAdded(false);
    setSelectedVariation(item?.variations?.[0]?.size ?? "");
    setSelectedDoneness("Medium Rare");
    setSelectedSide("Chips");
    setSelectedSauces([]);
    setAlcoholFree(false);
  }, [item?.id, item?.variations]);

  const related = useMemo(() => {
    if (!id) return [];
    return getUpsellItems(id, 4).filter((suggestion) => !isUnavailable(suggestion.id));
  }, [id, isUnavailable]);

  const baseUnitPrice = useMemo(() => {
    if (!item) return 0;
    if (item.variations && item.variations.length > 0) {
      const matched = item.variations.find((v) => v.size === selectedVariation);
      return matched ? matched.price : item.variations[0].price;
    }
    return item.price;
  }, [item, selectedVariation]);

  const saucesPrice = useMemo(() => {
    if (!isSteakCut || selectedSauces.length === 0) return 0;
    let sum = 0;
    for (const s of selectedSauces) {
      const found = PDF_SAUCE_ADDONS.find((opt) => opt.id === s);
      if (found) sum += found.price;
    }
    return sum;
  }, [isSteakCut, selectedSauces]);

  if (!item) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-start justify-center bg-[#121212] px-6 text-white">
        <h1 className="text-[28px] font-bold">Item not found</h1>
        <p className="mt-2 text-[14px] text-[#A3A3A3]">This dish or drink may no longer be on the menu.</p>
        <Link
          to="/menu"
          className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[15px] font-semibold text-white"
        >
          Back to Menu <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const artwork = menuArtwork(item);
  const imageSrc = artwork.src ?? restaurantPhoto;
  const unavailable = isUnavailable(item.id) || isSeasonalQuote;
  const favorited = isFavorite(item.id);
  const unitPrice = isSteakCut ? baseUnitPrice + saucesPrice : baseUnitPrice;
  const lineTotal = unitPrice * quantity;
  const activeDonenessNote = PDF_DONENESS_GUIDE.find((d) => d.label === selectedDoneness)?.note ?? "";
  const backRoute = item.menuSection === "drinks" ? "/drinks" : "/menu";

  const toggleSauce = (sauceName: string) => {
    setJustAdded(false);
    setSelectedSauces((prev) =>
      prev.includes(sauceName) ? prev.filter((s) => s !== sauceName) : [...prev, sauceName],
    );
  };

  const handleToggleFavorite = () => {
    const added = toggleFavorite(item.id);
    toast.success(added ? `Saved ${item.name} to favourites` : `Removed ${item.name} from favourites`);
  };

  const addToBag = () => {
    if (unavailable) return;
    if (isSteakCut) {
      const customization = {
        weight: selectedVariation || undefined,
        doneness: selectedDoneness,
        side: selectedSide,
        sauces: selectedSauces,
        priceOverride: unitPrice,
      };
      for (let count = 0; count < quantity; count += 1) addItem(item, customization);
      setJustAdded(true);
      const summary = [selectedVariation, selectedDoneness, selectedSide].filter(Boolean).join(" · ");
      toast.success(`${quantity} × ${item.name} (${summary}) added to order`);
      return;
    }
    if (hasVariations || (item.alcoholFreeOption && alcoholFree)) {
      const customization = {
        weight: selectedVariation || undefined,
        doneness: alcoholFree ? "Alcohol-Free" : undefined,
        priceOverride: unitPrice,
      };
      for (let count = 0; count < quantity; count += 1) addItem(item, customization);
      setJustAdded(true);
      const summary = [selectedVariation, alcoholFree ? "Alcohol-Free" : ""].filter(Boolean).join(" · ");
      toast.success(`${quantity} × ${item.name}${summary ? ` (${summary})` : ""} added to order`);
      return;
    }
    for (let count = 0; count < quantity; count += 1) addItem(item);
    setJustAdded(true);
    toast.success(`${quantity} × ${item.name} added to order`);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${item.name} · Butcher Block Steakhouse`, text: item.description, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } else {
        toast.error("Copy the link from your browser's address bar.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("Unable to share this item.");
    }
  };

  return (
    <div className="min-h-dvh bg-[#121212] pb-32 text-white lg:pb-24">
      <div className="mx-auto max-w-[560px] lg:max-w-4xl lg:px-8 lg:pt-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-10">
          {/* Full-bleed Hero Photography matching Screen 04 */}
          <div className="relative h-[300px] w-full overflow-hidden bg-[#181818] sm:h-[340px] lg:col-span-5 lg:h-[460px] lg:rounded-[28px] lg:border lg:border-white/10">
            <img
              src={imageSrc}
              alt={artwork.isExactDish ? item.name : ""}
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-[#121212] lg:to-black/40" />

            {/* Top bar controls */}
            <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(18px,env(safe-area-inset-top,0px))] sm:px-6 lg:pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#121212]/70 text-white backdrop-blur-md transition-transform active:scale-95 hover:bg-[#121212]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void share()}
                  aria-label={`Share ${item.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#121212]/70 text-white backdrop-blur-md transition-transform active:scale-95 hover:bg-[#121212]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
                >
                  <Share2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  aria-pressed={favorited}
                  aria-label={favorited ? `Remove ${item.name} from favourites` : `Save ${item.name} to favourites`}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#121212]/70 text-white backdrop-blur-md transition-transform active:scale-95 hover:bg-[#121212]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
                >
                  <Heart
                    className={"h-5 w-5 transition-colors " + (favorited ? "fill-[#FF5A1F] text-[#FF5A1F]" : "text-white")}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </header>
          </div>

          {/* Product Details & Inline Customization */}
          <div className="-mt-6 relative z-10 px-5 sm:px-6 lg:col-span-7 lg:mt-0 lg:px-0">
            <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-[32px]">
              {item.name}
            </h1>
            <p className="mt-1 text-[14px] font-medium text-[#A3A3A3]">
              {item.category}
              {selectedVariation ? ` · ${selectedVariation}` : ""}
              {item.region ? ` · ${item.region}` : ""}
            </p>

            <p className="mt-3 text-[24px] font-extrabold tabular-nums text-[#FF5A1F]">
              {isSeasonalQuote ? "S.Q." : formatPrice(unitPrice)}
            </p>

            <p className="mt-3 text-[15px] leading-relaxed text-[#C4C4C4]">{item.description}</p>

            {isSeasonalQuote && (
              <p className="mt-4 rounded-2xl border border-white/10 bg-[#242424] p-4 text-[14px] text-white/80">
                Seasonal Quote (S.Q.) — please confirm availability and today&apos;s market price with your waiter.
              </p>
            )}

            {!isSeasonalQuote && unavailable && (
              <p role="status" className="mt-4 rounded-2xl border border-white/10 bg-[#242424] p-4 text-[14px] text-white/80">
                This item isn&apos;t available right now.
              </p>
            )}

            {/* Non-steak variations (Wine Bottle/Glass, Garlic Bread, etc.) */}
            {!isSteakCut && hasVariations && item.variations && !unavailable && (
              <section className="mt-6" aria-label="Choose option">
                <h2 className="text-[15px] font-bold text-white">Select Option</h2>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {item.variations.map((v) => {
                    const active = selectedVariation === v.size;
                    return (
                      <button
                        key={v.size}
                        type="button"
                        onClick={() => {
                          setSelectedVariation(v.size);
                          setJustAdded(false);
                        }}
                        aria-pressed={active}
                        className={
                          "min-h-[56px] rounded-2xl border px-4 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                          (active
                            ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                            : "border-white/10 bg-[#242424] text-white/85 hover:bg-[#303030]")
                        }
                      >
                        <span className="block text-[15px] font-bold">{v.size}</span>
                        <span className={"mt-0.5 block text-[13px] tabular-nums " + (active ? "text-white/90" : "text-[#A3A3A3]")}>
                          {formatPrice(v.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Alcohol-free cocktail toggle */}
            {item.alcoholFreeOption && !unavailable && (
              <section className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setAlcoholFree((prev) => !prev);
                    setJustAdded(false);
                  }}
                  aria-pressed={alcoholFree}
                  className={
                    "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                    (alcoholFree
                      ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-white"
                      : "border-white/10 bg-[#242424] text-white/85 hover:bg-[#303030]")
                  }
                >
                  <span>Prepare Alcohol-Free (Mocktail)</span>
                  <span
                    className={
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
                      (alcoholFree ? "border-[#FF5A1F] bg-[#FF5A1F] text-white" : "border-white/30")
                    }
                  >
                    {alcoholFree && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </button>
              </section>
            )}

            {/* Full Steak Customization matching Screen 04 */}
            {isSteakCut && !unavailable && (
              <div className="mt-6 space-y-6">
                {/* 1. Weight / Cut Size */}
                {item.variations && item.variations.length > 1 && (
                  <section aria-label="Choose cut weight">
                    <h2 className="text-[15px] font-bold text-white">Select Cut Weight</h2>
                    <div className={`mt-3 grid gap-2.5 ${item.variations.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {item.variations.map((v) => {
                        const active = selectedVariation === v.size;
                        return (
                          <button
                            key={v.size}
                            type="button"
                            onClick={() => {
                              setSelectedVariation(v.size);
                              setJustAdded(false);
                            }}
                            aria-pressed={active}
                            className={
                              "min-h-[56px] rounded-2xl border px-3 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                              (active
                                ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                                : "border-white/10 bg-[#242424] text-white/85 hover:bg-[#303030]")
                            }
                          >
                            <span className="block text-[15px] font-bold">{v.size}</span>
                            <span className={"mt-0.5 block text-[12px] tabular-nums " + (active ? "text-white/90" : "text-[#A3A3A3]")}>
                              {formatPrice(v.price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 2. Choose Doneness (Screen 04 inline tile bar) */}
                <section aria-label="Choose doneness">
                  <h2 className="text-[15px] font-bold text-white">Choose Doneness</h2>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {PDF_DONENESS_GUIDE.map((opt) => {
                      const active = selectedDoneness === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            setSelectedDoneness(opt.label);
                            setJustAdded(false);
                          }}
                          aria-pressed={active}
                          className={
                            "flex min-h-[48px] items-center justify-center rounded-2xl border px-2 py-2 text-center text-[13px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                            (active
                              ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                              : "border-white/10 bg-[#242424] text-white/85 hover:bg-[#303030]")
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {activeDonenessNote && (
                    <p className="mt-2.5 text-[13px] text-[#A3A3A3]">{activeDonenessNote}</p>
                  )}
                </section>

                {/* 3. Select a Side (1 Included — Screen 04 icon-tile grid) */}
                <section aria-label="Select a complimentary side">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-[15px] font-bold text-white">
                      Select a Side <span className="font-medium text-[#A3A3A3]">(1 Included)</span>
                    </h2>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {PDF_COMPLIMENTARY_SIDES.map((side) => {
                      const active = selectedSide === side;
                      return (
                        <button
                          key={side}
                          type="button"
                          onClick={() => {
                            setSelectedSide(side);
                            setJustAdded(false);
                          }}
                          aria-pressed={active}
                          className={
                            "relative flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                            (active
                              ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-white"
                              : "border-white/10 bg-[#242424] text-[#C4C4C4] hover:bg-[#303030]")
                          }
                        >
                          {active && (
                            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF5A1F] text-white">
                              <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                            </span>
                          )}
                          <span className={active ? "text-[#FF5A1F]" : "text-[#A3A3A3]"}>
                            <SideIcon side={side} />
                          </span>
                          <span className="line-clamp-2 text-[12px] font-semibold leading-tight">
                            {side}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 4. Optional Sauces */}
                <section aria-label="Optional sauces">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-[15px] font-bold text-white">Add a Sauce</h2>
                    <span className="text-[13px] text-[#A3A3A3]">Optional</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {PDF_SAUCE_ADDONS.map((sauce) => {
                      const active = selectedSauces.includes(sauce.id);
                      return (
                        <button
                          key={sauce.id}
                          type="button"
                          onClick={() => toggleSauce(sauce.id)}
                          aria-pressed={active}
                          className={
                            "flex min-h-[48px] items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left text-[13px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                            (active
                              ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-white"
                              : "border-white/10 bg-[#242424] text-white/85 hover:bg-[#303030]")
                          }
                        >
                          <span className="min-w-0">{sauce.id}</span>
                          <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#FF5A1F]">
                            +{formatPrice(sauce.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* Inline assistant & bag link */}
            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={openAssistant}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 bg-[#242424] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                <MessageSquare className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                Ask about pairings
              </button>
              {totalItems > 0 && (
                <Link
                  to="/cart"
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-[#FF5A1F] hover:text-white"
                >
                  View cart ({totalItems}) <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Verified Diner Reviews (real completed orders only; neutral empty state when none) */}
        <DishReviewsSection menuItemId={item.id} />

        {/* Related recommendations */}
        {related.length > 0 && (
          <section className="mt-12 border-t border-white/10 px-5 pt-8 sm:px-6 lg:px-0" aria-labelledby="related-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="related-heading" className="text-[20px] font-bold tracking-[-0.03em] text-white">
                Pairs well with
              </h2>
              <Link to={backRoute} className="text-[14px] font-semibold text-[#FF5A1F] hover:text-white">
                Full {item.menuSection === "drinks" ? "drinks" : "menu"}
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {related.map((suggestion) => (
                <MenuCard key={suggestion.id} item={suggestion} disabled={isUnavailable(suggestion.id)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky iOS Bottom Action Bar matching Screen 04 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#121212]/95 px-4 pb-[max(14px,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[560px] items-center gap-3 lg:max-w-4xl">
          {!isSeasonalQuote && (
            <div className="flex h-[52px] shrink-0 items-center gap-1 rounded-full border border-white/10 bg-[#242424] px-1.5">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => {
                  setQuantity((v) => Math.max(1, v - 1));
                  setJustAdded(false);
                }}
                disabled={quantity <= 1 || unavailable}
                className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-[#303030] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <output aria-label="Quantity" className="min-w-[26px] text-center text-[16px] font-bold tabular-nums text-white">
                {quantity}
              </output>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => {
                  setQuantity((v) => Math.min(20, v + 1));
                  setJustAdded(false);
                }}
                disabled={quantity >= 20 || unavailable}
                className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-[#303030] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={addToBag}
            disabled={unavailable}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#FF5A1F] px-4 text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {isSeasonalQuote ? (
              <span>Ask waiter for today&apos;s quote</span>
            ) : unavailable ? (
              <span>Currently Unavailable</span>
            ) : justAdded ? (
              <>
                <Check className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
                <span>Added · {formatPrice(lineTotal)}</span>
              </>
            ) : (
              <span>Add to Order · {formatPrice(lineTotal)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
