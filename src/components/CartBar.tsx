import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useCart } from "@/context/CartContext";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/vibe";

const CartBar = () => {
  const { totalItems, totalPrice } = useCart();
  const prevCount = useRef(totalItems);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (totalItems > prevCount.current) {
      if (badgeRef.current) {
        badgeRef.current.classList.remove("animate-scale-bounce");
        void badgeRef.current.offsetWidth;
        badgeRef.current.classList.add("animate-scale-bounce");
      }
      if (barRef.current) {
        barRef.current.classList.remove("animate-scale-bounce");
        void barRef.current.offsetWidth;
        barRef.current.classList.add("animate-scale-bounce");
      }
    }
    prevCount.current = totalItems;
  }, [totalItems]);

  if (totalItems === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-50 px-4 animate-slide-up pointer-events-none"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <Link
        to="/cart"
        ref={barRef as any}
        className="flex min-h-[44px] touch-manipulation items-center justify-between bg-primary text-primary-foreground rounded-xl px-4 py-2.5 shadow-lg shadow-primary/20 btn-press max-w-lg mx-auto pointer-events-auto"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            <span
              ref={badgeRef}
              className="absolute -top-2 -right-2 min-w-[1rem] h-4 px-0.5 rounded-full bg-primary-foreground text-primary text-[10px] font-bold flex items-center justify-center"
            >
              {totalItems}
            </span>
          </div>
          <span className="font-semibold">
            {totalItems} item{totalItems > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 font-semibold">
          {formatPrice(totalPrice)}
          <ArrowRight className="w-4 h-4" />
        </div>
      </Link>
    </div>
  );
};

export default CartBar;
