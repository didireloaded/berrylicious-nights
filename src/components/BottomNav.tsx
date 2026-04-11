import { Link, useLocation } from "react-router-dom";
import { Home, UtensilsCrossed, User, Sparkles } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/menu", icon: UtensilsCrossed, label: "Menu" },
  { to: "/plan", icon: Sparkles, label: "Plan" },
  { to: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-nav pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center justify-around max-w-lg mx-auto py-0.5">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={`flex min-h-[44px] min-w-[44px] touch-manipulation flex-col items-center justify-center gap-0.5 px-2 py-1 transition-all active:opacity-80 ${
                active ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
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
