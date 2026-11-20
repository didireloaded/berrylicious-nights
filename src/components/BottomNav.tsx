import { Link, useLocation } from "react-router-dom";
import { CalendarDays, Home, Sparkles, UtensilsCrossed, UserRound } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/menu", icon: UtensilsCrossed, label: "Menu" },
  { to: "/booking", icon: CalendarDays, label: "Book" },
  { to: "/plan", icon: Sparkles, label: "Plan" },
  { to: "/profile", icon: UserRound, label: "You" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={active
                ? "flex min-h-[50px] min-w-[58px] flex-col items-center justify-center gap-1 rounded-lg px-2 text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                : "flex min-h-[50px] min-w-[58px] flex-col items-center justify-center gap-1 rounded-lg px-2 text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} aria-hidden="true" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
