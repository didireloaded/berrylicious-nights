import { Link, useLocation } from "react-router-dom";
import { Home, UtensilsCrossed, CalendarDays, ShoppingBag, User, Sparkles } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/menu", icon: UtensilsCrossed, label: "Menu" },
  { to: "/plan", icon: Sparkles, label: "Plan" },
  { to: "/booking", icon: CalendarDays, label: "Book" },
  { to: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around max-w-lg mx-auto py-2">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
