import { useParams, useNavigate, Link, useHref } from "react-router-dom";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/vibe";
import { ArrowLeft, Minus, Plus, Share2, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { getUpsellItems } from "@/services/upsell";

const MenuItemPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isUnavailable } = useMenuAvailability();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const item = menuItems.find((i) => i.id === id);
  const sharePath = useHref(id ? `/menu/${id}` : "/menu");
  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? new URL(sharePath, window.location.href).href : ""),
    [sharePath],
  );

  const upsellItems = useMemo(() => {
    const it = menuItems.find((i) => i.id === id);
    if (!it) return [];
    return getUpsellItems(it.id, 5).filter((u) => !isUnavailable(u.id));
  }, [id, isUnavailable]);

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Item not found</p>
      </div>
    );
  }

  if (isUnavailable(item.id)) {
    return (
      <div className="min-h-screen pb-safe-nav px-6 flex flex-col items-center justify-center max-w-lg mx-auto text-center">
        <p className="font-display text-xl font-bold text-foreground">Off the menu tonight</p>
        <p className="text-muted-foreground text-sm mt-2">{item.name} isn’t available right now. Pick something else?</p>
        <Link to="/menu" className="mt-6 text-primary font-semibold">
          Back to menu
        </Link>
      </div>
    );
  }

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${item.name} · Berrylicious`,
          text: item.description,
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      } else {
        toast.error("Sharing isn’t available in this browser.");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("Couldn’t share — copy the address from the bar instead.");
    }
  };

  return (
    <div className="pb-safe-nav animate-fade-in">
      {/* Image */}
      <div className="relative">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-72 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur text-foreground"
            aria-label="Share this dish"
          >
            <Share2 className="h-4 w-4" />
          </button>
          {item.popular && (
            <span className="bg-primary px-3 py-1 text-xs font-bold text-primary-foreground rounded-full">Popular</span>
          )}
        </div>
      </div>

      <div className="px-6 max-w-lg mx-auto -mt-6 relative">
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">
          {item.name}
        </h1>
        <p className="text-primary font-semibold text-xl mb-4">
          {formatPrice(item.price)}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          {item.description}
        </p>

        {/* Quantity + Add */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-8 h-8 rounded bg-surface flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
            >
              <Minus className="w-4 h-4 text-foreground" />
            </button>
            <span className="text-foreground font-semibold text-lg w-8 text-center">{qty}</span>
            <button
              onClick={() => setQty(qty + 1)}
              className="w-8 h-8 rounded bg-surface flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4 text-foreground" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            className={`flex-1 font-semibold py-3.5 rounded-lg text-center transition-all active:scale-[0.97] flex items-center justify-center gap-2 ${
              added
                ? "bg-green-600/20 text-green-400 border border-green-600/30"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            {added ? "Added to Cart ✓" : `Add to Cart — ${formatPrice(item.price * qty)}`}
          </button>
        </div>

        {upsellItems.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-semibold mb-1">Goes well with</h2>
            <p className="text-xs text-muted-foreground mb-3">Drinks and sides guests often add with this dish.</p>
            <div className="space-y-3">
              {upsellItems.map((r) => (
                <div key={r.id} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
                  <Link to={`/menu/${r.id}`} className="flex flex-1 min-w-0 items-center gap-3 hover:opacity-90">
                    <img src={r.image} alt={r.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold text-sm truncate">{r.name}</p>
                      <p className="text-muted-foreground text-xs truncate">{r.description}</p>
                    </div>
                    <span className="text-primary font-semibold text-sm shrink-0">{formatPrice(r.price)}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      addItem(r);
                      toast.success(`Added ${r.name}`);
                    }}
                    className="shrink-0 rounded-lg bg-primary/15 px-3 py-2 text-xs font-bold text-primary btn-press"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuItemPage;
