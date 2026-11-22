import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/vibe";

export function FloatingCartBar() {
  const { pathname } = useLocation();
  const { totalItems, totalPrice } = useCart();

  if (
    !totalItems ||
    pathname === "/" ||
    pathname === "/cart" ||
    pathname === "/admin" ||
    pathname === "/booking" ||
    pathname === "/booking/success" ||
    pathname.startsWith("/order/") ||
    pathname.startsWith("/menu/")
  ) {
    return null;
  }

  return (
    <Link
      to="/cart"
      aria-label={`View cart: ${totalItems} ${totalItems === 1 ? "item" : "items"}, ${formatPrice(totalPrice)}`}
      className="fixed left-1/2 z-40 flex min-h-[56px] w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 items-center justify-between rounded-full bg-[#FF5A1F] py-2 pl-5 pr-2 text-white shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:hidden"
      style={{ bottom: "calc(max(12px, env(safe-area-inset-bottom, 0px)) + 74px)" }}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[12px] font-medium text-white/90">
            {totalItems} {totalItems === 1 ? "item" : "items"} in cart
          </span>
          <span className="text-[16px] font-bold tabular-nums">{formatPrice(totalPrice)}</span>
        </span>
      </span>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#121212] text-white">
        <ArrowRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </span>
    </Link>
  );
}
