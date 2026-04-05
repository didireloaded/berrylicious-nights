import { useState } from "react";
import { useCart } from "@/context/CartContext";
import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/vibe";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

const MenuCard = ({ item }: { item: MenuItem }) => {
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
    <Link
      to={`/menu/${item.id}`}
      className="group bg-card rounded-lg overflow-hidden border border-border hover:border-primary/30 transition-all animate-fade-in hover:-translate-y-0.5"
    >
      <div className="relative overflow-hidden aspect-[16/10]">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {item.popular && (
          <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
            Popular
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-foreground font-semibold truncate">{item.name}</h3>
            <p className="text-muted-foreground text-sm line-clamp-1">{item.description}</p>
          </div>
          <button
            onClick={handleAdd}
            className={`shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-all active:scale-95 ${pulse ? "animate-scale-pulse" : ""}`}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <p className="text-primary font-semibold mt-1">{formatPrice(item.price)}</p>
      </div>
    </Link>
  );
};

export default MenuCard;
