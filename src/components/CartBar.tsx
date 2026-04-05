import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/vibe";

const CartBar = () => {
  const { totalItems, totalPrice } = useCart();

  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 p-4 animate-slide-up">
      <Link
        to="/cart"
        className="flex items-center justify-between bg-primary text-primary-foreground rounded-xl px-5 py-4 shadow-lg shadow-primary/20 hover:opacity-95 transition-opacity max-w-lg mx-auto"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-2 -right-2 bg-primary-foreground text-primary text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          </div>
          <span className="font-semibold">
            {totalItems} item{totalItems > 1 ? "s" : ""} • {formatPrice(totalPrice)}
          </span>
        </div>
        <div className="flex items-center gap-1 font-medium">
          View Order <ArrowRight className="w-4 h-4" />
        </div>
      </Link>
    </div>
  );
};

export default CartBar;
