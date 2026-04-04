import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import heroImage from "@/assets/hero-restaurant.jpg";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import { getVibeLine } from "@/lib/vibe";
import { menuItems } from "@/data/menu";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/vibe";
import { CalendarDays, ShoppingBag, Plus, Star } from "lucide-react";

interface Update {
  id: string;
  title: string;
  subtitle: string | null;
  type: string;
}

const HomePage = () => {
  const vibeLine = getVibeLine();
  const featured = menuItems.filter((i) => i.featured);
  const { addItem } = useCart();
  const { user, profile } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);

  useEffect(() => {
    const fetchUpdates = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("updates")
        .select("id, title, subtitle, type")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order("created_at", { ascending: false });
      setUpdates(data ?? []);
    };
    fetchUpdates();
  }, []);

  const displayName = profile?.display_name || user?.user_metadata?.full_name;

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <section className="relative h-screen max-h-[800px] min-h-[600px]">
        <img src={heroImage} alt="Berrylicious restaurant interior" className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/50 to-background" />
        <div className="relative h-full flex flex-col justify-end px-6 pb-12 max-w-lg mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-2">
            Berrylicious
          </h1>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">
            Restaurant & Lounge
          </p>
          <p className="text-muted-foreground text-sm flex items-center gap-1 mb-1">
            <Star className="w-4 h-4 text-primary fill-primary" /> 4.5 • Freedom Plaza, Windhoek
          </p>

          {/* Vibe line */}
          <div className="bg-surface/80 backdrop-blur-sm border border-border rounded-lg px-4 py-3 mb-6 mt-4">
            <p className="text-foreground text-sm font-medium">{vibeLine}</p>
          </div>

          {/* CTAs */}
          <div className="flex gap-3">
            <Link
              to="/booking"
              className="flex-1 bg-primary text-primary-foreground font-semibold py-3.5 rounded-lg text-center hover:opacity-90 transition-opacity active:scale-[0.97] flex items-center justify-center gap-2"
            >
              <CalendarDays className="w-5 h-5" /> Book a Table
            </Link>
            <Link
              to="/menu"
              className="flex-1 border border-primary text-primary font-semibold py-3.5 rounded-lg text-center hover:bg-primary/10 transition-colors active:scale-[0.97] flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" /> Order Food
            </Link>
          </div>
        </div>
      </section>

      <div className="px-6 max-w-lg mx-auto space-y-10 mt-10">
        {/* Welcome back */}
        {user && displayName && (
          <section className="animate-fade-in">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-foreground font-semibold">Welcome back, {displayName} 👋</p>
              {profile?.last_order && (
                <p className="text-muted-foreground text-sm mt-1">
                  Your usual: {typeof profile.last_order === 'object' && profile.last_order?.name ? profile.last_order.name : "Check your profile"} 🍔
                </p>
              )}
            </div>
          </section>
        )}

        {/* Featured Dishes */}
        <section className="animate-fade-in">
          <h2 className="font-display text-2xl font-semibold mb-4">Featured Dishes</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 snap-x snap-mandatory scrollbar-hide">
            {featured.map((item) => (
              <div key={item.id} className="min-w-[200px] snap-start bg-card rounded-lg overflow-hidden border border-border flex-shrink-0">
                <img src={item.image} alt={item.name} loading="lazy" className="w-full h-32 object-cover" />
                <div className="p-3">
                  <h3 className="font-display text-sm font-semibold truncate">{item.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-primary font-semibold text-sm">{formatPrice(item.price)}</span>
                    <button
                      onClick={() => addItem(item)}
                      className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tonight's Events — from database */}
        {updates.length > 0 && (
          <section className="animate-fade-in">
            <h2 className="font-display text-2xl font-semibold mb-4">What's On Tonight</h2>
            <div className="space-y-3">
              {updates.map((update) => (
                <div key={update.id} className="bg-card border border-border rounded-lg p-4 border-l-4 border-l-primary">
                  <span className="text-xs text-primary font-semibold uppercase tracking-wider">{update.type}</span>
                  <h3 className="font-display text-foreground font-semibold mt-1">{update.title}</h3>
                  {update.subtitle && <p className="text-muted-foreground text-sm">{update.subtitle}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Gallery */}
        <section className="animate-fade-in">
          <h2 className="font-display text-2xl font-semibold mb-4">Gallery</h2>
          <div className="grid grid-cols-3 gap-2">
            {[gallery1, gallery2, gallery3].map((img, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg">
                <img src={img} alt={`Gallery ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border">
          <p className="font-display text-lg text-foreground">Berrylicious</p>
          <p className="text-muted-foreground text-sm mt-1">Restaurant & Lounge</p>
          <p className="text-muted-foreground text-xs mt-1">Freedom Plaza, City Centre, Windhoek</p>
          <p className="text-muted-foreground text-xs mt-4">© {new Date().getFullYear()} Berrylicious. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;
