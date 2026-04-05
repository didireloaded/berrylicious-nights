import { useCart } from "@/context/CartContext";
import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/vibe";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const PopularCard = ({ item }: { item: MenuItem }) => {
  const { addItem } = useCart();
  const [pulse, setPulse] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(item);
    setPulse(true);
    setTimeout(() => setPulse(false), 400);
  };

  return (
    <Link to={`/menu/${item.id}`} className="shrink-0 w-36 bg-card rounded-lg overflow-hidden border border-border hover:border-primary/30 transition-colors">
      <img
        src={item.image}
        alt={item.name}
        loading="lazy"
        className="w-full h-24 object-cover"
      />
      <div className="p-2">
        <p className="text-foreground text-xs font-semibold truncate">{item.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-primary text-xs font-semibold">{formatPrice(item.price)}</span>
          <button
            onClick={handleAdd}
            className={`w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-95 transition-all ${
              pulse ? "animate-scale-pulse" : ""
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Link>
  );
};

export default PopularCard;
