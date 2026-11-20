import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Minus, Plus, Share2, ShoppingBag, Sparkles } from "lucide-react";
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

export default function MenuItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, totalItems } = useCart();
  const { isUnavailable } = useMenuAvailability();
  const { openAssistant } = useRestaurantAssistant();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const item = menuItems.find((candidate) => candidate.id === id);
  const related = useMemo(() => {
    if (!id) return [];
    return getUpsellItems(id, 4).filter((suggestion) => !isUnavailable(suggestion.id));
  }, [id, isUnavailable]);

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
  const numberPrice = new Intl.NumberFormat("en-NA", { maximumFractionDigits: 2 }).format(item.price);

  const addToBag = () => {
    if (unavailable) return;
    for (let count = 0; count < quantity; count += 1) addItem(item);
    setAdded(true);
    toast.success(`${quantity} × ${item.name} added to your order`);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${item.name} · Berrylicious`, text: item.description, url });
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
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff7647]">BERRYLICIOUS MENU</p>
          <h1 className="mt-4 text-[clamp(3.6rem,15vw,5.8rem)] font-extrabold leading-[0.94] tracking-[-0.075em]">{item.category}</h1>
          <p className="mt-3 max-w-[370px] text-[21px] font-medium leading-snug tracking-[-0.03em] text-white/90">{item.name}</p>
          <button
            type="button"
            onClick={() => document.getElementById("dish-information")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-full border border-white/55 bg-white/10 px-5 text-[14px] font-medium text-white backdrop-blur-lg transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Information
          </button>
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
            <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/55">Price per dish</span>
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
