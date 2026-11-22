import { Link } from "react-router-dom";
import { Plus, Wine } from "lucide-react";
import { toast } from "sonner";
import type { FoodWinePairing as PairingRecord } from "@/services/upsell";
import { useCart } from "@/context/CartContext";
import { menuArtwork } from "@/lib/menuArtwork";
import { formatPrice } from "@/lib/vibe";

export interface FoodWinePairingProps {
  pairings: PairingRecord[];
  isUnavailable: (menuItemId: string) => boolean;
}

/**
 * Understated, restaurant-approved Food & Wine Pairing section for dish detail pages.
 * Driven strictly by explicit verified pairing entries — omits itself completely when
 * no restaurant-approved pairing exists for the dish.
 */
export function FoodWinePairing({ pairings, isUnavailable }: FoodWinePairingProps) {
  const { addItem } = useCart();

  const availablePairings = pairings.filter(
    (p) => !isUnavailable(p.item.id) && !p.item.priceLabel,
  );

  if (availablePairings.length === 0) return null;

  const handleQuickAdd = (entry: PairingRecord) => {
    const drink = entry.item;
    const defaultVar = drink.variations?.[0];
    if (defaultVar) {
      addItem(drink, { weight: defaultVar.size, priceOverride: defaultVar.price });
      toast.success(`${drink.name} (${defaultVar.size}) added to your order`);
      return;
    }
    addItem(drink);
    toast.success(`${drink.name} added to your order`);
  };

  return (
    <section
      className="mt-7 border-t border-white/10 pt-6"
      aria-labelledby="pairs-beautifully-heading"
    >
      <div className="flex items-center gap-2">
        <Wine className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
        <h2 id="pairs-beautifully-heading" className="text-[17px] font-bold tracking-[-0.02em] text-white">
          Pairs beautifully with
        </h2>
      </div>

      <div className="mt-3.5 space-y-2.5">
        {availablePairings.map((entry) => {
          const { item: drink, pairingNote } = entry;
          const art = menuArtwork(drink);
          const price = drink.variations?.[0]?.price ?? drink.price;
          const sizeTag = drink.variations?.[0]?.size;

          return (
            <div
              key={drink.id}
              className="flex items-center gap-3.5 rounded-[20px] border border-white/10 bg-[#242424] p-3"
            >
              {art.src ? (
                <img
                  src={art.src}
                  alt={art.isExactDish ? drink.name : ""}
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#303030] text-[#FF5A1F]">
                  <Wine className="h-6 w-6" aria-hidden="true" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <Link
                  to={`/menu/${drink.id}`}
                  className="block truncate text-[15px] font-bold text-white hover:text-[#FF5A1F]"
                >
                  {drink.name}
                </Link>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#A3A3A3]">
                  {pairingNote}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-extrabold tabular-nums text-[#FF5A1F]">
                    {formatPrice(price)}
                    {sizeTag ? <span className="ml-1 text-[12px] font-medium text-[#A3A3A3]">· {sizeTag}</span> : null}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/menu/${drink.id}`}
                      className="inline-flex min-h-[36px] items-center rounded-full border border-white/15 bg-[#303030] px-3 text-[12px] font-semibold text-white hover:bg-[#3A3A3A]"
                    >
                      View drink
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(entry)}
                      aria-label={`Add ${drink.name} to order`}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#FF5A1F] px-3 text-[12px] font-bold text-white hover:bg-[#E84D15]"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
