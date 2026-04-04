import { User, Gift, Clock, CalendarDays, LogOut, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/vibe";

const ProfilePage = () => {
  // Demo data — replace with real user data when auth is added
  const user = { name: "Guest", totalVisits: 3, totalOrders: 3 };
  const loyaltyTarget = 5;
  const loyaltyPercent = Math.min((user.totalVisits / loyaltyTarget) * 100, 100);

  const orders = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
  const bookings = JSON.parse(localStorage.getItem("berrylicious-bookings") || "[]");
  const lastOrder = orders[orders.length - 1];

  return (
    <div className="min-h-screen pb-24 px-6 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <User className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Welcome, {user.name} 👋</h1>
          <p className="text-muted-foreground text-sm">{user.totalOrders} orders • {user.totalVisits} visits</p>
        </div>
      </div>

      {/* Loyalty */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-5 h-5 text-primary" />
          <span className="text-foreground font-semibold">Loyalty Rewards</span>
        </div>
        <p className="text-muted-foreground text-sm mb-3">
          🎁 {user.totalVisits} / {loyaltyTarget} visits → Free Drink
        </p>
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full animate-fill-bar"
            style={{ width: `${loyaltyPercent}%` }}
          />
        </div>
        {loyaltyPercent >= 100 && (
          <p className="text-primary text-sm font-semibold mt-2">🎁 You've earned a free drink! Show this to staff.</p>
        )}
      </div>

      {/* Last Order */}
      {lastOrder && (
        <div className="bg-card border border-border rounded-lg p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-foreground font-semibold">Your Last Order</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground text-sm">
                {lastOrder.items.map((i: any) => `${i.name} × ${i.qty}`).join(", ")}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {formatPrice(lastOrder.total)} • {new Date(lastOrder.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Link to="/menu" className="text-primary text-sm font-semibold hover:opacity-80 flex items-center gap-1">
              Reorder <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Upcoming Bookings */}
      {bookings.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5 text-primary" />
            <span className="text-foreground font-semibold">Your Bookings</span>
          </div>
          <div className="space-y-3">
            {bookings.slice(-3).reverse().map((b: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  Table for {b.guests} • {new Date(b.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} • {b.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order History */}
      {orders.length > 0 && (
        <div className="mb-6 animate-fade-in">
          <h2 className="font-display text-lg font-semibold mb-3">Order History</h2>
          <div className="space-y-2">
            {orders.slice().reverse().map((o: any, i: number) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm">{o.items.map((x: any) => x.name).join(", ")}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{new Date(o.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="text-primary font-semibold text-sm">{formatPrice(o.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign Out */}
      <button className="w-full border border-border text-muted-foreground py-3 rounded-lg hover:text-foreground hover:border-foreground/20 transition-colors flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
};

export default ProfilePage;
