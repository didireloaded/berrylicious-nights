import { Link, useLocation } from "react-router-dom";
import { CalendarDays, Home, Menu as MoreIcon, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function BottomNav() {
  const { pathname } = useLocation();
  const { totalItems } = useCart();

  const isHome = pathname === "/home";
  const isMenu = pathname === "/menu" || pathname === "/food" || pathname === "/drinks";
  const isCart = pathname === "/cart";
  const isBook = pathname === "/booking" || pathname === "/booking/success";
  const isMore = pathname === "/profile" || pathname === "/events" || pathname === "/messages" || pathname === "/auth";

  const tabClass = (active: boolean) =>
    "flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
    (active ? "text-[#FF5A1F]" : "text-[#A3A3A3] hover:text-white");

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#181818]/95 pb-[max(10px,env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-[560px] items-center justify-around px-3">
        <Link to="/home" aria-current={isHome ? "page" : undefined} className={tabClass(isHome)}>
          <Home className="h-[21px] w-[21px]" strokeWidth={isHome ? 2.2 : 1.8} aria-hidden="true" />
          <span className="text-[11px] font-semibold tracking-tight">Home</span>
        </Link>

        <Link to="/menu" aria-current={isMenu ? "page" : undefined} className={tabClass(isMenu)}>
          <UtensilsCrossed className="h-[21px] w-[21px]" strokeWidth={isMenu ? 2.2 : 1.8} aria-hidden="true" />
          <span className="text-[11px] font-semibold tracking-tight">Menu</span>
        </Link>

        {/* Elevated circular Cart button matching approved iOS tab bar */}
        <Link
          to="/cart"
          aria-current={isCart ? "page" : undefined}
          aria-label={`Your cart, ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
          className={
            "relative -mt-3 flex h-[52px] w-[52px] items-center justify-center rounded-full border transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white " +
            (isCart
              ? "border-[#FF5A1F] bg-[#FF5A1F] text-white shadow-[0_8px_24px_rgba(255,90,31,0.35)]"
              : "border-white/15 bg-[#303030] text-white shadow-[0_8px_22px_rgba(0,0,0,0.45)] hover:bg-[#3A3A3A]")
          }
        >
          <ShoppingBag className="h-[21px] w-[21px]" strokeWidth={2} aria-hidden="true" />
          {totalItems > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full border-2 border-[#181818] bg-[#FF5A1F] px-1 text-[10px] font-bold text-white tabular-nums">
              {totalItems > 99 ? "99+" : totalItems}
            </span>
          )}
        </Link>

        <Link to="/booking" aria-current={isBook ? "page" : undefined} className={tabClass(isBook)}>
          <CalendarDays className="h-[21px] w-[21px]" strokeWidth={isBook ? 2.2 : 1.8} aria-hidden="true" />
          <span className="text-[11px] font-semibold tracking-tight">Book</span>
        </Link>

        <Link to="/profile" aria-current={isMore ? "page" : undefined} className={tabClass(isMore)}>
          <MoreIcon className="h-[21px] w-[21px]" strokeWidth={isMore ? 2.2 : 1.8} aria-hidden="true" />
          <span className="text-[11px] font-semibold tracking-tight">More</span>
        </Link>
      </div>
    </nav>
  );
}
