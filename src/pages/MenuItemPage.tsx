import { useParams, useNavigate, Link } from "react-router-dom";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/vibe";
import { ArrowLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";

const MenuItemPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const item = menuItems.find((i) => i.id === id);

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Item not found</p>
      </div>
    );
  }

  const related = menuItems
    .filter((i) => i.category === item.category && i.id !== item.id)
    .slice(0, 3);

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      {/* Image */}
      <div className="relative">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-72 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        {item.popular && (
          <span className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
            Popular
          </span>
        )}
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

        {/* Related Items */}
        {related.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-semibold mb-3">
              More from {item.category}
            </h2>
            <div className="space-y-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/menu/${r.id}`}
                  className="flex items-center gap-3 bg-card border border-border rounded-lg p-3 hover:border-primary/30 transition-colors"
                >
                  <img src={r.image} alt={r.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold text-sm truncate">{r.name}</p>
                    <p className="text-muted-foreground text-xs truncate">{r.description}</p>
                  </div>
                  <span className="text-primary font-semibold text-sm shrink-0">{formatPrice(r.price)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuItemPage;
