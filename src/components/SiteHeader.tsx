import { Link, useLocation } from "react-router-dom";
import { MessageSquare, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useRestaurantAssistant } from "@/context/RestaurantAssistantContext";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";

const links = [
  { to: "/home", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/drinks", label: "Drinks" },
  { to: "/booking", label: "Reserve" },
  { to: "/events", label: "Events" },
  { to: "/profile", label: "Profile" },
];

export default function SiteHeader() {
  const { pathname } = useLocation();
  const { totalItems } = useCart();
  const { openAssistant } = useRestaurantAssistant();

  if (pathname === "/" || pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-40 hidden border-b border-white/10 bg-[#121212]/95 backdrop-blur-xl lg:block">
      <div className="mx-auto flex h-[76px] max-w-5xl items-center justify-between gap-6 px-8">
        <Link
          to="/home"
          aria-label="Butcher Block Steakhouse home"
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
        >
          <img src={butcherBlockLogo} alt="Butcher Block Steakhouse" className="h-9 w-auto object-contain" />
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-6">
          {links.map((item) => {
            const active = pathname === item.to || (item.to !== "/home" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={
                  "border-b-2 pb-1 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                  (active
                    ? "border-[#FF5A1F] text-white"
                    : "border-transparent text-[#A3A3A3] hover:text-white")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openAssistant}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 bg-[#242424] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <MessageSquare className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Ask us
          </button>
          <Link
            to="/cart"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FF5A1F] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Cart{totalItems > 0 ? ` (${totalItems})` : ""}
          </Link>
        </div>
      </div>
    </header>
  );
}
