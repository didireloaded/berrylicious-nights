import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Search, ShoppingBag, Sparkles } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";

export default function BottomNav() {
  const { pathname } = useLocation();
  const { totalItems } = useCart();
  const { openAssistant } = useRestaurantAssistant();
  const exploring = pathname === "/menu";

  const itemStyle = (active: boolean) =>
    "relative flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85 " +
    (active ? "bg-white text-[#121212]" : "text-[#b3b3b3] hover:bg-white/10 hover:text-white");

  return (
    <nav
      aria-label="Main app navigation"
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex w-[calc(100%-32px)] max-w-[348px] -translate-x-1/2 items-center justify-between rounded-full border border-white/10 bg-[#242424]/95 px-2.5 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.36)] backdrop-blur-xl"
    >
      <Link to="/menu" aria-current={exploring ? "page" : undefined} aria-label="Explore the menu" className={itemStyle(exploring)}>
        <LayoutGrid className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
      </Link>
      <Link to="/cart" aria-current={pathname === "/cart" ? "page" : undefined} aria-label={`Your order, ${totalItems} items`} className={itemStyle(pathname === "/cart")}>
        <ShoppingBag className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
        {totalItems > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#ff5a1f] px-1 text-[10px] font-bold text-white">
            {totalItems > 99 ? "99+" : totalItems}
          </span>
        )}
      </Link>
      <Link to="/menu?focusSearch=1" aria-label="Search dishes" className={itemStyle(false)}>
        <Search className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
      </Link>
      <button
        type="button"
        onClick={openAssistant}
        aria-label="Ask Berrylicious for a recommendation"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff5a1f] text-white ring-2 ring-white/90 ring-offset-[3px] ring-offset-[#242424] transition-transform duration-200 hover:scale-[1.04] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Sparkles className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden="true" />
      </button>
    </nav>
  );
}
