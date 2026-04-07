import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, Tag } from "lucide-react";
import { menuItems, type MenuItem } from "@/data/menu";
import { promoSpotlight, isPromoSpotlightActive } from "@/data/promoSpotlight";
import { formatPrice } from "@/lib/vibe";
import { useCart } from "@/context/CartContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";

const PromoSpotlightPage = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isUnavailable } = useMenuAvailability();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const active = isPromoSpotlightActive(promoSpotlight);
  const menuItem = useMemo(() => {
    if (!promoSpotlight.menuItemId) return null;
    return menuItems.find((i) => i.id === promoSpotlight.menuItemId) ?? null;
  }, []);

  const pricedItem: MenuItem | null = useMemo(() => {
    if (!menuItem) return null;
    const p = promoSpotlight.promoPrice;
    if (p == null || Number.isNaN(p)) return menuItem;
    return { ...menuItem, price: p };
  }, [menuItem]);

  const offMenu = menuItem && isUnavailable(menuItem.id);

  const handleAdd = () => {
    if (!pricedItem || offMenu || !active) return;
    for (let i = 0; i < qty; i++) addItem(pricedItem);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  };

  return (
    <div className="min-h-screen pb-safe-nav animate-fade-in max-w-lg mx-auto">
      <div className="relative">
        <img
          src={promoSpotlight.heroImage}
          alt=""
          className="h-72 w-full object-cover"
          width={800}
          height={600}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>

        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-lg">
            <Tag className="h-3.5 w-3.5" />
            {promoSpotlight.badge}
          </span>
          {!active && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              Promo ended
            </span>
          )}
        </div>
      </div>

      <div className="px-6 -mt-2 space-y-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
            {promoSpotlight.windowKind === "daily" ? "Promo · today" : "Promo · this window"}
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold leading-tight text-foreground">{promoSpotlight.title}</h1>
          {!active && (
            <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              This run has ended — the story below is what we ran. Check the menu for what&apos;s live now, or watch home for the next drop.
            </p>
          )}
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {promoSpotlight.storyParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {menuItem && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">On the menu</p>
            <p className="mt-1 font-semibold text-foreground">{menuItem.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{menuItem.description}</p>
            {offMenu ? (
              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                This dish is off tonight — ask the team for a swap or browse the full menu.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  {promoSpotlight.promoPrice != null && promoSpotlight.promoPrice !== menuItem.price ? (
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-bold text-primary">{formatPrice(promoSpotlight.promoPrice)}</span>
                      <span className="text-sm text-muted-foreground line-through">{formatPrice(menuItem.price)}</span>
                    </div>
                  ) : (
                    <span className="font-display text-2xl font-bold text-primary">{formatPrice(menuItem.price)}</span>
                  )}
                  <p className="text-[11px] text-muted-foreground">Spotlight price where shown · excl. service where applicable</p>
                </div>
                {active && pricedItem && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-1">
                      <button
                        type="button"
                        className="p-2 text-muted-foreground hover:text-foreground"
                        aria-label="Decrease quantity"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        className="p-2 text-muted-foreground hover:text-foreground"
                        aria-label="Increase quantity"
                        onClick={() => setQty((q) => q + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={!active}
                      className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground btn-press disabled:opacity-40"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {added ? "Added" : "Add"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!menuItem && active && (
          <p className="text-sm text-muted-foreground">
            This promo isn&apos;t tied to a single dish in the app — mention it when you book or order, or browse everything we&apos;re cooking.
          </p>
        )}

        <div className="flex flex-col gap-2 pb-6">
          <Link
            to="/menu"
            className="flex w-full items-center justify-center rounded-xl border border-primary py-3.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
          >
            Full menu
          </Link>
          <Link to="/booking" className="text-center text-sm font-medium text-muted-foreground hover:text-foreground">
            Book a table
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PromoSpotlightPage;
