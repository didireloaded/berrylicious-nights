import { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { menuArtwork } from "@/lib/menuArtwork";
import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/vibe";

const MenuCard = memo(function MenuCard({ item, disabled = false }: { item: MenuItem; disabled?: boolean }) {
  const { addItem } = useCart();
  const artwork = menuArtwork(item);

  const isSeasonalQuote = Boolean(item.priceLabel);
  const priceText = item.priceLabel
    ? item.priceLabel
    : item.variations && item.variations.length > 1
      ? `From ${formatPrice(Math.min(...item.variations.map((v) => v.price)))}`
      : formatPrice(item.price);

  const add = () => {
    if (disabled || isSeasonalQuote) return;
    addItem(item);
    toast.success(`${item.name} added to your order`);
  };

  return (
    <article className={"relative mt-12 flex min-w-0 flex-col justify-between rounded-[27px] bg-[#242424] px-4 pb-4 pt-[72px] transition-transform duration-200 " + (disabled ? "opacity-55" : "hover:-translate-y-1")}>
      <Link
        to={`/menu/${item.id}`}
        className="group absolute -top-11 left-1/2 flex h-[112px] w-[112px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-[5px] border-[#121212] bg-[#303030] shadow-[0_12px_20px_rgba(0,0,0,0.22)] outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
        aria-label={`View ${item.name}`}
      >
        {artwork.src ? (
          <img
            src={artwork.src}
            alt={artwork.isExactDish ? item.name : ""}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
          />
        ) : (
          <span className="max-w-[80px] text-center text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">{item.category}</span>
        )}
      </Link>
      <div className="mt-3 flex flex-1 flex-col">
        <Link to={`/menu/${item.id}`} className="min-h-[55px] text-[17px] font-semibold leading-[1.2] tracking-[-0.035em] text-white outline-none focus-visible:underline">
          {item.name}
        </Link>
        <p className="mt-2 line-clamp-2 min-h-[38px] text-[12px] leading-[1.45] text-[#a4a4a4]">{item.description}</p>
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#ff7b50]">
          {item.tag ? `${item.category} · ${item.tag}` : item.category}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <span className="block text-[17px] font-semibold tracking-tight text-white">
              {priceText}
            </span>
            {disabled && <span className="mt-1 block text-xs text-white/50">Unavailable</span>}
          </div>
          {!disabled && (
            <div className="flex items-center gap-1.5">
              <Link
                to={`/menu/${item.id}`}
                aria-label={`Details for ${item.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              {!isSeasonalQuote && (
                <button
                  type="button"
                  onClick={add}
                  aria-label={`Add ${item.name} to order`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#121212] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

export default MenuCard;
