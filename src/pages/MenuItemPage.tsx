import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, Flame, Minus, Plus, Share2, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";
import { menuArtwork } from "@/lib/menuArtwork";
import { getUpsellItems } from "@/services/upsell";
import { formatPrice } from "@/lib/vibe";
import MenuCard from "@/components/MenuCard";
import restaurantPhoto from "@/assets/hero-restaurant.jpg";

const DONENESS_OPTIONS = [
  { label: "Rare", note: "Cool red centre. Still mooing." },
  { label: "Medium Rare", note: "Warm red centre. Our butcher's gold standard." },
  { label: "Medium", note: "Warm pink centre with a hint of red." },
  { label: "Medium Well", note: "Slight hint of pink. On thin ice." },
  { label: "Well Done", note: "Finished and klaar... Not recommended by our chefs." },
] as const;

const COMPLIMENTARY_SIDES = [
  "Chips",
  "Baked Potato",
  "Mashed Potato",
  "Savoury Rice",
  "Pap & Chakalaka",
  "Side Salad",
] as const;

const SAUCE_ADDONS = [
  { id: "Creamy Garlic", price: 45 },
  { id: "Cowboy Butter", price: 55 },
  { id: "Green Peppercorn", price: 48 },
  { id: "Mushroom", price: 45 },
  { id: "Bordelaise", price: 52 },
] as const;

export default function MenuItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, totalItems } = useCart();
  const { isUnavailable } = useMenuAvailability();
  const { openAssistant } = useRestaurantAssistant();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const item = menuItems.find((candidate) => candidate.id === id);

  const isCustomizableSteak = Boolean(
    item && (item.category === "Choice Cuts" || item.category === "Combos" || (item.variations && item.variations.length > 0)),
  );

  const [selectedWeight, setSelectedWeight] = useState<string>("");
  const [selectedDoneness, setSelectedDoneness] = useState<string>("Medium Rare");
  const [selectedSide, setSelectedSide] = useState<string>("Chips");
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);

  useEffect(() => {
    setQuantity(1);
    setAdded(false);
    setSelectedWeight(item?.variations?.[0]?.size ?? "");
    setSelectedDoneness("Medium Rare");
    setSelectedSide("Chips");
    setSelectedSauces([]);
  }, [item?.id, item?.variations]);

  const related = useMemo(() => {
    if (!id) return [];
    return getUpsellItems(id, 4).filter((suggestion) => !isUnavailable(suggestion.id));
  }, [id, isUnavailable]);

  const baseCutPrice = useMemo(() => {
    if (!item) return 0;
    if (item.variations && item.variations.length > 0) {
      const matched = item.variations.find((v) => v.size === selectedWeight);
      return matched ? matched.price : item.variations[0].price;
    }
    return item.price;
  }, [item, selectedWeight]);

  const saucesPrice = useMemo(() => {
    if (!isCustomizableSteak || selectedSauces.length === 0) return 0;
    let sum = 0;
    for (const s of selectedSauces) {
      const found = SAUCE_ADDONS.find((opt) => opt.id === s);
      if (found) sum += found.price;
    }
    return sum;
  }, [isCustomizableSteak, selectedSauces]);

  if (!item) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-start justify-center bg-[#121212] px-7 text-white">
        <h1 className="text-3xl font-semibold">We couldn't find that dish.</h1>
        <p className="mt-3 text-sm text-white/55">It may have been removed from the menu.</p>
        <Link to="/menu" className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#ff5a1f] px-6 text-sm font-semibold">Back to the menu <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );
  }

  const artwork = menuArtwork(item);
  const imageSrc = artwork.src ?? restaurantPhoto;
  const unavailable = isUnavailable(item.id);
  const unitPrice = isCustomizableSteak ? baseCutPrice + saucesPrice : item.price;
  const numberPrice = new Intl.NumberFormat("en-NA", { maximumFractionDigits: 2 }).format(unitPrice);
  const activeDonenessNote = DONENESS_OPTIONS.find((d) => d.label === selectedDoneness)?.note ?? "";

  const toggleSauce = (sauceName: string) => {
    setAdded(false);
    setSelectedSauces((prev) =>
      prev.includes(sauceName) ? prev.filter((s) => s !== sauceName) : [...prev, sauceName],
    );
  };

  const addToBag = () => {
    if (unavailable) return;
    if (isCustomizableSteak) {
      const customization = {
        weight: selectedWeight || undefined,
        doneness: selectedDoneness,
        side: selectedSide,
        sauces: selectedSauces,
        priceOverride: unitPrice,
      };
      for (let count = 0; count < quantity; count += 1) {
        addItem(item, customization);
      }
      setAdded(true);
      const summary = [selectedWeight, selectedDoneness, selectedSide].filter(Boolean).join(" · ");
      toast.success(`${quantity} × ${item.name} (${summary}) added to your order`);
      return;
    }
    for (let count = 0; count < quantity; count += 1) addItem(item);
    setAdded(true);
    toast.success(`${quantity} × ${item.name} added to your order`);
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
    <div className="mx-auto max-w-[560px] bg-[#121212] text-white">
      <section className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-black">
        <img
          src={imageSrc}
          alt={artwork.isExactDish ? item.name : ""}
          decoding="async"
          fetchPriority="high"
          className="food-photo absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/25 via-[40%] to-black/90" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/20 via-transparent to-transparent" aria-hidden="true" />

        <header className="flex items-start justify-between gap-5 px-5 pt-[max(28px,env(safe-area-inset-top,0px))] sm:px-7">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#121212] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <Link
            to="/cart"
            aria-label={`View your bag, ${totalItems} items`}
            className="relative flex min-h-[56px] w-14 flex-col items-center justify-center rounded-[18px] border border-white/25 bg-black/45 text-white backdrop-blur-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={1.8} />
            <span className="mt-1 text-[12px] font-semibold">{totalItems}</span>
          </Link>
        </header>

        <div className="food-enter px-5 pt-[clamp(35px,9vh,80px)] sm:px-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff7647]">BUTCHER BLOCK MENU</p>
          <h1 className="mt-4 text-[clamp(3.6rem,15vw,5.8rem)] font-extrabold leading-[0.94] tracking-[-0.075em]">{item.category}</h1>
          <p className="mt-3 max-w-[370px] text-[21px] font-medium leading-snug tracking-[-0.03em] text-white/90">{item.name}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => document.getElementById("dish-information")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="inline-flex min-h-12 items-center gap-3 rounded-full border border-white/55 bg-white/10 px-5 text-[14px] font-medium text-white backdrop-blur-lg transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
            >
              {isCustomizableSteak ? (
                <>
                  <Flame className="h-4 w-4 text-[#ff7647]" aria-hidden="true" /> Customize cut
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" aria-hidden="true" /> Information
                </>
              )}
            </button>
          </div>
          {!artwork.isExactDish && (
            <p className="mt-4 max-w-[240px] text-[11px] leading-relaxed text-white/55">
              {artwork.src ? "Category photography is illustrative." : "Restaurant atmosphere photographed separately from this dish."}
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-col items-end px-5 pb-3 pt-6 sm:px-7">
          <button
            type="button"
            onClick={openAssistant}
            className="group mb-5 inline-flex max-w-[210px] items-center gap-2 rounded-full border border-white/40 bg-black/55 py-2 pl-2 pr-4 text-left text-[12px] font-medium leading-tight text-white backdrop-blur-md transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff5a1f]"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
            Need a suggestion? Ask us.
          </button>
        </div>

        <div className="relative mt-2 flex w-full items-end">
          <div className="flex min-h-[178px] w-[calc(100%-106px)] flex-col justify-center rounded-tr-[75px] border-r border-t border-white/20 bg-black/65 px-6 py-5 backdrop-blur-xl sm:px-8">
            <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/55">
              {isCustomizableSteak && selectedWeight ? `${selectedWeight} · ${selectedDoneness}` : "Price per dish"}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[18px] font-medium text-white/70">N$</span>
              <span className="text-[clamp(2.7rem,10vw,3.7rem)] font-semibold leading-none tracking-[-0.07em]">{numberPrice}</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[13px] text-white/65">Quantity</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => { setQuantity((value) => Math.max(1, value - 1)); setAdded(false); }}
                  disabled={quantity <= 1 || unavailable}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
                ><Minus className="h-4 w-4" /></button>
                <span className="min-w-4 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => { setQuantity((value) => Math.min(20, value + 1)); setAdded(false); }}
                  disabled={quantity >= 20 || unavailable}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
                ><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
          <div className="flex w-[106px] justify-center pb-[max(22px,env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={addToBag}
              disabled={unavailable}
              aria-label={unavailable ? "This dish is currently unavailable" : `Add ${quantity} ${item.name} to your order`}
              className="flex h-[129px] w-[76px] flex-col items-center justify-center gap-2 rounded-full border border-white/35 bg-white/15 text-white backdrop-blur-lg transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#121212]"><ShoppingBag className="h-5 w-5" strokeWidth={1.9} /></span>
              <span className="max-w-14 text-center text-[11px] font-semibold leading-[1.3]">{unavailable ? "Not available" : added ? "Added" : "Add to order"}</span>
            </button>
          </div>
        </div>
      </section>

      <section id="dish-information" className="scroll-mt-5 px-6 py-14 sm:px-8" aria-labelledby="about-dish">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff784a]">THE DETAILS</p>
        <h2 id="about-dish" className="mt-2 text-[31px] font-semibold tracking-[-0.05em]">{item.name}</h2>
        <p className="mt-4 text-[15px] leading-7 text-white/65">{item.description}</p>
        {unavailable && <p role="status" className="mt-4 rounded-xl border border-white/15 bg-[#222] p-4 text-sm text-white/75">This item isn't available right now. Browse the rest of the menu instead.</p>}

        {/* Native Steak Customizer — rendered only for Choice Cuts & Combos using existing dark tokens */}
        {isCustomizableSteak && !unavailable && (
          <div id="customize" className="mt-8 space-y-7 border-t border-white/10 pt-8">
            {/* 1. Weight Selector */}
            {item.variations && item.variations.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff784a]">
                  1. Select Cut Weight
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2.5">
                  {item.variations.map((v) => {
                    const active = selectedWeight === v.size;
                    return (
                      <button
                        key={v.size}
                        type="button"
                        onClick={() => { setSelectedWeight(v.size); setAdded(false); }}
                        aria-pressed={active}
                        className={
                          "rounded-2xl border px-3 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] " +
                          (active
                            ? "border-[#ff5a1f] bg-[#ff5a1f] text-white"
                            : "border-white/15 bg-[#242424] text-white/80 hover:border-white/35")
                        }
                      >
                        <span className="block text-[15px] font-bold">{v.size}</span>
                        <span className={"mt-0.5 block text-[12px] " + (active ? "text-white/90" : "text-white/55")}>
                          {formatPrice(v.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Doneness Selector */}
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff784a]">
                2. How would you like it cooked?
              </p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {DONENESS_OPTIONS.map((opt) => {
                  const active = selectedDoneness === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => { setSelectedDoneness(opt.label); setAdded(false); }}
                      aria-pressed={active}
                      className={
                        "min-h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] " +
                        (active
                          ? "bg-white text-[#121212]"
                          : "border border-white/15 bg-[#242424] text-white/80 hover:border-white/35")
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {activeDonenessNote && (
                <p className="mt-2.5 text-[12px] italic text-white/55">&ldquo;{activeDonenessNote}&rdquo;</p>
              )}
            </div>

            {/* 3. Complimentary Side */}
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff784a]">
                  3. Complimentary Side
                </p>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Included</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {COMPLIMENTARY_SIDES.map((side) => {
                  const active = selectedSide === side;
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => { setSelectedSide(side); setAdded(false); }}
                      aria-pressed={active}
                      className={
                        "flex min-h-11 items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] " +
                        (active
                          ? "border-[#ff5a1f] bg-[#ff5a1f]/15 text-white"
                          : "border-white/10 bg-[#242424] text-white/75 hover:border-white/30")
                      }
                    >
                      <span>{side}</span>
                      <span
                        className={
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
                          (active ? "border-[#ff5a1f] bg-[#ff5a1f] text-white" : "border-white/25")
                        }
                      >
                        {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Sauce Add-ons */}
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff784a]">
                  4. Sauce Add-ons
                </p>
                <span className="text-[11px] text-white/45">Optional</span>
              </div>
              <div className="mt-3 space-y-2">
                {SAUCE_ADDONS.map((sauce) => {
                  const active = selectedSauces.includes(sauce.id);
                  return (
                    <button
                      key={sauce.id}
                      type="button"
                      onClick={() => toggleSauce(sauce.id)}
                      aria-pressed={active}
                      className={
                        "flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] " +
                        (active
                          ? "border-[#ff5a1f] bg-[#ff5a1f]/15 text-white"
                          : "border-white/10 bg-[#242424] text-white/80 hover:border-white/30")
                      }
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border " +
                            (active ? "border-[#ff5a1f] bg-[#ff5a1f] text-white" : "border-white/30")
                          }
                        >
                          {active && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        {sauce.id}
                      </span>
                      <span className="text-[12px] font-semibold tabular-nums text-[#ff8157]">
                        +{formatPrice(sauce.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={addToBag}
              className="flex min-h-14 w-full items-center justify-between rounded-full bg-[#ff5a1f] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#fa703f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>{added ? "Added to your bag" : `Add ${quantity} × ${item.name}`}</span>
              <span className="font-bold tabular-nums">{formatPrice(unitPrice * quantity)}</span>
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/cart" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ff5a1f] px-5 text-[14px] font-semibold text-white"><ShoppingBag className="h-4 w-4" /> View your bag ({totalItems})</Link>
          <button type="button" onClick={() => void share()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-[14px] font-semibold text-white"><Share2 className="h-4 w-4" /> Share item</button>
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-white/10 px-6 pb-20 pt-10 sm:px-8" aria-labelledby="related-heading">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff784a]">KEEP EXPLORING</p>
          <h2 id="related-heading" className="mt-2 text-[29px] font-semibold tracking-[-0.045em]">Pairs well with</h2>
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5">
            {related.map((suggestion) => <MenuCard key={suggestion.id} item={suggestion} disabled={isUnavailable(suggestion.id)} />)}
          </div>
          <Link to="/menu" className="mt-8 inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold text-[#ff8157]">Back to the menu <ArrowRight className="h-4 w-4" /></Link>
        </section>
      )}
    </div>
  );
}
