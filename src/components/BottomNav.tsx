import { Link, useLocation } from "react-router-dom";
import { CalendarHeart, Home, ShoppingBag, Sparkles, UtensilsCrossed, Wine } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";

export default function BottomNav() {
  const { pathname } = useLocation();
  const { totalItems } = useCart();
  const { openAssistant } = useRestaurantAssistant();

  const isHome = pathname === "/";
  const isFood = pathname === "/menu" || pathname === "/food";
  const isDrinks = pathname === "/drinks";
  const isCart = pathname === "/cart";
  const isEvents = pathname === "/events";

  const itemStyle = (active: boolean) =>
    "relative flex h-12 min-w-[54px] flex-col items-center justify-center gap-0.5 rounded-full px-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85 " +
    (active ? "bg-white text-[#121212]" : "text-[#b3b3b3] hover:bg-white/10 hover:text-white");

  const showAssistantFab = !isCart;
  const fabBottomClass =
    totalItems > 0
      ? "bottom-[calc(max(16px,env(safe-area-inset-bottom,0px))+148px)]"
      : "bottom-[calc(max(16px,env(safe-area-inset-bottom,0px))+76px)]";

  return (
    <>
      {showAssistantFab && (
        <button
          type="button"
          onClick={openAssistant}
          aria-label="Ask Butcher Block for a recommendation"
          className={
            "fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#ff5a1f] text-white shadow-[0_10px_28px_rgba(255,90,31,0.4)] ring-2 ring-white/90 ring-offset-[3px] ring-offset-[#121212] transition-all duration-200 hover:scale-[1.05] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white " +
            fabBottomClass
          }
        >
          <Sparkles className="h-[20px] w-[20px]" strokeWidth={1.9} aria-hidden="true" />
        </button>
      )}

      <nav
        aria-label="Main app navigation"
        className="fixed bottom-[max(16px,env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex w-[calc(100%-24px)] max-w-[388px] -translate-x-1/2 items-center justify-between rounded-full border border-white/10 bg-[#242424]/95 px-2 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.36)] backdrop-blur-xl"
      >
        <Link to="/" aria-current={isHome ? "page" : undefined} aria-label="Home" className={itemStyle(isHome)}>
          <Home className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
        </Link>
        <Link to="/menu" aria-current={isFood ? "page" : undefined} aria-label="Food menu" className={itemStyle(isFood)}>
          <UtensilsCrossed className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Food</span>
        </Link>
        <Link to="/drinks" aria-current={isDrinks ? "page" : undefined} aria-label="Drinks and wine list" className={itemStyle(isDrinks)}>
          <Wine className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Drinks</span>
        </Link>
        <Link to="/cart" aria-current={isCart ? "page" : undefined} aria-label={`Your order, ${totalItems} items`} className={itemStyle(isCart)}>
          <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Cart</span>
          {totalItems > 0 && (
            <span className="absolute right-1 top-0.5 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#ff5a1f] px-1 text-[9px] font-bold text-white">
              {totalItems > 99 ? "99+" : totalItems}
            </span>
          )}
        </Link>
        <Link to="/events" aria-current={isEvents ? "page" : undefined} aria-label="Events" className={itemStyle(isEvents)}>
          <CalendarHeart className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Events</span>
        </Link>
      </nav>
    </>
  );
}
