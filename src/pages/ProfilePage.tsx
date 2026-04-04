import { User, Gift, Clock, CalendarDays, LogOut, ChevronRight, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatPrice } from "@/lib/vibe";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const ProfilePage = () => {
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "Guest";
  const totalVisits = profile?.total_visits || 0;
  const totalOrders = profile?.total_orders || 0;
  const loyaltyTarget = 5;
  const loyaltyPercent = Math.min((totalVisits / loyaltyTarget) * 100, 100);

  useEffect(() => {
    if (user) {
      supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
        .then(({ data }) => setOrders(data ?? []));
      supabase.from("bookings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
        .then(({ data }) => setBookings(data ?? []));
    } else {
      // Fallback to localStorage for guests
      setOrders(JSON.parse(localStorage.getItem("berrylicious-orders") || "[]").reverse());
      setBookings(JSON.parse(localStorage.getItem("berrylicious-bookings") || "[]").reverse());
    }
  }, [user]);

  const lastOrder = orders[0];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen pb-24 px-6 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <User className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {user ? `Welcome, ${displayName} 👋` : "Guest Mode"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {user ? `${totalOrders} orders • ${totalVisits} visits` : "Sign in for a personalised experience"}
          </p>
        </div>
      </div>

      {/* Auth prompt for guests */}
      {!user && (
        <Link
          to="/auth"
          className="block bg-primary text-primary-foreground font-semibold py-3 px-4 rounded-lg text-center mb-6 hover:opacity-90 transition-opacity"
        >
          Sign In / Create Account
        </Link>
      )}

      {/* Admin link */}
      {isAdmin && (
        <Link
          to="/admin"
          className="flex items-center gap-2 bg-card border border-primary/30 rounded-lg p-4 mb-6 hover:border-primary transition-colors"
        >
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-foreground font-semibold">Admin Dashboard</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
        </Link>
      )}

      {/* Loyalty */}
      {user && (
        <div className="bg-card border border-border rounded-lg p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-primary" />
            <span className="text-foreground font-semibold">Loyalty Rewards</span>
          </div>
          <p className="text-muted-foreground text-sm mb-3">
            🎁 {totalVisits} / {loyaltyTarget} visits → Free Drink
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
      )}

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
                {Array.isArray(lastOrder.items)
                  ? lastOrder.items.map((i: any) => `${i.name} × ${i.qty}`).join(", ")
                  : "Order"}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {formatPrice(Number(lastOrder.total))} • {new Date(lastOrder.created_at || lastOrder.createdAt).toLocaleDateString()}
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
            {bookings.slice(0, 3).map((b: any, i: number) => (
              <div key={b.id || i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  Table for {b.guests} • {new Date(b.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} • {b.time}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  b.status === "confirmed" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {b.status || "confirmed"}
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
            {orders.map((o: any, i: number) => (
              <div key={o.id || i} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm">
                    {Array.isArray(o.items) ? o.items.map((x: any) => x.name).join(", ") : "Order"}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">{new Date(o.created_at || o.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="text-primary font-semibold text-sm">{formatPrice(Number(o.total))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign Out */}
      {user && (
        <button
          onClick={handleSignOut}
          className="w-full border border-border text-muted-foreground py-3 rounded-lg hover:text-foreground hover:border-foreground/20 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      )}
    </div>
  );
};

export default ProfilePage;
