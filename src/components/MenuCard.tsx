import { memo, useState, useRef } from "react";
import { useCart } from "@/context/CartContext";
import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/vibe";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

const MenuCard = memo(function MenuCard({ item, disabled }: { item: MenuItem; disabled?: boolean }) {
  const { addItem } = useCart();
  const [bounce, setBounce] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(item);

    setBounce(true);
    setTimeout(() => setBounce(false), 300);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const inner = (
    <>
      <div className="relative overflow-hidden aspect-[4/3]">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
        />
        {disabled ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Off tonight
          </span>
        ) : null}
        {item.popular && !disabled && (
          <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[8px] font-semibold px-1.5 py-0.5 rounded">
            Popular
          </span>
        )}
      </div>
      <div className="p-1">
        <h3 className="font-display text-foreground text-[10px] sm:text-xs font-semibold truncate leading-tight">{item.name}</h3>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-primary font-semibold text-xs">{formatPrice(item.price)}</span>
          {!disabled ? (
            <button
              ref={btnRef}
              onClick={handleAdd}
              className={`shrink-0 w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center btn-press ${bounce ? "animate-scale-bounce" : ""}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-[9px] text-muted-foreground">—</span>
          )}
        </div>
      </div>
    </>
  );

  if (disabled) {
    return (
      <div className="group block h-full bg-card rounded-lg overflow-hidden border border-border opacity-60 pointer-events-none">{inner}</div>
    );
  }

  return (
    <Link
      to={`/menu/${item.id}`}
      className="group block h-full bg-card rounded-lg overflow-hidden border border-border card-interactive transition-transform duration-150 ease-out active:scale-[0.96] active:ring-2 active:ring-primary/35 active:ring-offset-2 active:ring-offset-background"
    >
      {inner}
    </Link>
  );
});

export default MenuCard;
