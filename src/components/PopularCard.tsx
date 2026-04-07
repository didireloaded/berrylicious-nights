import { memo, useState } from "react";
import { useCart } from "@/context/CartContext";
import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/vibe";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

const PopularCard = memo(function PopularCard({ item, disabled }: { item: MenuItem; disabled?: boolean }) {
  const { addItem } = useCart();
  const [bounce, setBounce] = useState(false);

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

  const body = (
    <>
      <img
        src={item.image}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className="w-full h-24 object-cover opacity-90"
      />
      <div className="p-2">
        <p className="text-foreground text-xs font-semibold truncate">{item.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-primary text-xs font-semibold">{formatPrice(item.price)}</span>
          {!disabled ? (
            <button
              type="button"
              onClick={handleAdd}
              className={`min-h-9 min-w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center btn-press ${
                bounce ? "animate-scale-bounce" : ""
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[9px] text-muted-foreground">Off</span>
          )}
        </div>
      </div>
    </>
  );

  if (disabled) {
    return <div className="shrink-0 w-36 touch-manipulation bg-card rounded-lg overflow-hidden border border-border opacity-55 pointer-events-none">{body}</div>;
  }

  return (
    <Link
      to={`/menu/${item.id}`}
      className="shrink-0 w-36 touch-manipulation bg-card rounded-lg overflow-hidden border border-border card-interactive"
    >
      {body}
    </Link>
  );
});

export default PopularCard;
