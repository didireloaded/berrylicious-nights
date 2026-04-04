import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/vibe";
import { Minus, Plus, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

const CartPage = () => {
  const { items, updateQuantity, removeItem, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const [ordered, setOrdered] = useState(false);
  const deliveryFee = items.length > 0 ? 20 : 0;

  const handleCheckout = async () => {
    const orderItems = items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price }));
    const total = totalPrice + deliveryFee;

    // Save to database
    const { error } = await supabase.from("orders").insert({
      user_id: user?.id || null,
      items: orderItems,
      total,
    });

    if (error) {
      toast.error("Something went wrong. Try again.");
      return;
    }

    // Also save to localStorage for backward compatibility
    const order = { items: orderItems, total, status: "pending", createdAt: new Date().toISOString() };
    const existing = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
    existing.push(order);
    localStorage.setItem("berrylicious-orders", JSON.stringify(existing));

    clearCart();
    setOrdered(true);
  };

  if (ordered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 max-w-lg mx-auto text-center animate-fade-in">
        <span className="text-5xl mb-4">📋</span>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Got your order — we're on it.</h1>
        <p className="text-muted-foreground mb-8">You'll see updates on your profile page.</p>
        <Link to="/" className="bg-primary text-primary-foreground font-semibold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity">
          Back to Home
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen pb-24 px-6 pt-6 max-w-lg mx-auto">
        <h1 className="font-display text-3xl font-bold mb-8">Your Order</h1>
        <EmptyState message="Your cart is empty 🍽️" actionLabel="Browse Menu →" actionTo="/menu" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-6 pt-6 max-w-lg mx-auto">
      <h1 className="font-display text-3xl font-bold mb-6">Your Order</h1>

      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 bg-card border border-border rounded-lg p-3 animate-fade-in">
            <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <h3 className="font-display text-foreground font-semibold truncate">{item.name}</h3>
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 rounded bg-surface flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-foreground font-medium w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 rounded bg-surface flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-primary font-semibold">{formatPrice(item.price * item.quantity)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-2">
        <div className="flex justify-between text-muted-foreground text-sm">
          <span>Subtotal</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground text-sm">
          <span>Delivery</span>
          <span>{formatPrice(deliveryFee)}</span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between text-foreground font-semibold">
          <span>Total</span>
          <span className="text-primary">{formatPrice(totalPrice + deliveryFee)}</span>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-lg hover:opacity-90 transition-all active:scale-[0.97]"
      >
        Place Order
      </button>
    </div>
  );
};

export default CartPage;
