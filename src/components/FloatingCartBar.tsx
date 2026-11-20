import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/vibe";

export function FloatingCartBar() {
  const { pathname } = useLocation();
  const { totalItems, totalPrice } = useCart();
  if (!totalItems || pathname === "/" || pathname === "/cart" || pathname === "/admin" || pathname.startsWith("/order/") || pathname.startsWith("/menu/")) return null;

  return (
    <Link
      to="/cart"
      aria-label={`View order: ${totalItems} items, ${formatPrice(totalPrice)}`}
      className="fixed left-1/2 z-40 flex min-h-[62px] w-[calc(100%-32px)] max-w-[348px] -translate-x-1/2 items-center justify-between rounded-full bg-[#ff5a1f] py-2 pl-6 pr-2 text-white shadow-[0_12px_28px_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{ bottom: "calc(max(16px, env(safe-area-inset-bottom, 0px)) + 83px)" }}
    >
      <span className="flex flex-col">
        <span className="text-[12px] font-medium text-white/85">{totalItems} {totalItems === 1 ? "item" : "items"} selected</span>
        <span className="text-[17px] font-bold tabular-nums">{formatPrice(totalPrice)}</span>
      </span>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#121212] text-white">
        <ArrowRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </span>
    </Link>
  );
}
