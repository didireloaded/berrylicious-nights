import { memo } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/vibe";

const MenuCard = memo(function MenuCard({ item, disabled = false }: { item: MenuItem; disabled?: boolean }) {
  const { addItem } = useCart();

  return (
    <article className="group flex h-full min-h-[200px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-200 hover:border-primary/40">
      <Link
        to={"/menu/" + item.id}
        className="block flex-1 p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        aria-label={"View " + item.name + " details"}
      >
        {item.verifiedImage && (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="mb-4 aspect-[16/10] w-full rounded-lg object-cover"
          />
        )}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {item.category}
          </span>
          {item.popular && !disabled && (
            <span className="text-xs text-muted-foreground">Guest favourite</span>
          )}
        </div>
        <h3 className="font-display text-xl font-semibold leading-snug text-foreground">{item.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
      </Link>
      <div className="flex items-center justify-between border-t border-border/80 px-5 py-3.5">
        <span className="text-base font-semibold text-foreground">{formatPrice(item.price)}</span>
        {disabled ? (
          <span className="text-sm text-muted-foreground">Unavailable</span>
        ) : (
          <button
            type="button"
            onClick={() => addItem(item)}
            aria-label={"Add " + item.name + " to order"}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Add</span>
          </button>
        )}
      </div>
    </article>
  );
});

export default MenuCard;
