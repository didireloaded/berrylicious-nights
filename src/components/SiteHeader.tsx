import { Link, useLocation } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";

const links = [
  { to: "/home", label: "Home" },
  { to: "/menu", label: "Food" },
  { to: "/drinks", label: "Drinks" },
  { to: "/events", label: "Events" },
  { to: "/booking", label: "Reservations" },
  { to: "/profile", label: "Profile" },
];

export default function SiteHeader() {
  const { pathname } = useLocation();
  const { totalItems } = useCart();
  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-background/95 lg:block">
      <div className="mx-auto flex h-[78px] max-w-7xl items-center justify-between gap-8 px-8 xl:px-12">
        <Link to="/" aria-label="Butcher Block Steakhouse home" className="font-display text-2xl font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <img src={butcherBlockLogo} alt="Butcher Block Steakhouse" className="h-9 w-auto object-contain" />
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-7">
          {links.map((item) => {
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={active
                  ? "border-b border-primary pb-1 text-sm font-semibold text-foreground"
                  : "border-b border-transparent pb-1 text-sm text-muted-foreground transition-colors hover:text-foreground"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link to="/cart" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          Order{totalItems > 0 ? " (" + totalItems + ")" : ""}
        </Link>
      </div>
    </header>
  );
}
