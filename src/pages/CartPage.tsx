import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/vibe";
import { Minus, Plus, X } from "lucide-react";
import { menuItems } from "@/data/menu";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { loadOrderSnapshotFromStorage, saveOrderSnapshotForTracking } from "@/lib/orderTrackingStorage";
import { useApp } from "@/context/AppContext";
import { insertOrderWithArrivalCode } from "@/lib/supabaseArrivalInsert";

type OrderType = "preorder" | "pickup" | "dinein";

const orderTypeOptions: { value: OrderType; label: string; desc: string }[] = [
  { value: "preorder", label: "Pre-order", desc: "Order ahead, food ready when you arrive" },
  { value: "pickup",   label: "Pickup",    desc: "Order now, collect when ready" },
  { value: "dinein",   label: "Dine-in",   desc: "Sitting at a table, order via app" },
];

const SuggestionItem = ({ item }: { item: any }) => {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-lg p-3 animate-fade-in">
      <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-semibold text-sm truncate">{item.name}</p>
        <p className="text-muted-foreground text-xs truncate">{item.description}</p>
        <p className="text-primary font-semibold text-sm mt-0.5">{formatPrice(item.price)}</p>
      </div>
      <button
        onClick={handleAdd}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold btn-press ${
          added
            ? "bg-green-600/20 text-green-400 border border-green-600/30"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {added ? "Added" : "Add"}
      </button>
    </div>
  );
};

const CartPage = () => {
  const { items, updateQuantity, removeItem, totalPrice, clearCart } = useCart();
  const { user, refreshProfile } = useAuth();
  const { setCurrentOrder } = useApp();
  const navigate = useNavigate();
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [submitting, setSubmitting] = useState(false);
  const deliveryFee = items.length > 0 ? 20 : 0;

  const handleCheckout = async () => {
    if (submitting) return;
    setSubmitting(true);

    const orderItems = items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price }));
    const total = totalPrice + deliveryFee;

    let orderId: string;
    try {
      const row = await insertOrderWithArrivalCode({
        user_id: user?.id || null,
        items: orderItems,
        total,
        order_type: orderType,
      });
      orderId = row.id;
    } catch {
      toast.error("Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    const { data: full, error: fetchErr } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (fetchErr || !full) {
      toast.error("Order placed but tracking is unavailable.");
      setSubmitting(false);
      return;
    }

    saveOrderSnapshotForTracking({
      id: full.id,
      items: full.items,
      total: Number(full.total),
      status: full.status,
      order_type: full.order_type as string | undefined,
      eta_minutes: full.eta_minutes as number | null | undefined,
      eta_set_at: full.eta_set_at as string | null | undefined,
      created_at: full.created_at,
      arrival_code: full.arrival_code as string | null | undefined,
    });

    const snap = loadOrderSnapshotFromStorage(full.id);
    setCurrentOrder(
      snap
        ? { ...snap, id: full.id }
        : {
            id: full.id,
            items: full.items,
            total: Number(full.total),
            status: String(full.status ?? "pending"),
            order_type: full.order_type as string | undefined,
            eta_minutes: full.eta_minutes as number | null | undefined,
            eta_set_at: full.eta_set_at as string | null | undefined,
            created_at: full.created_at,
            arrival_code: full.arrival_code as string | null | undefined,
          },
    );

    const order = {
      id: full.id,
      items: orderItems,
      total,
      status: "pending",
      order_type: orderType,
      createdAt: new Date().toISOString(),
      arrival_code: full.arrival_code as string | undefined,
    };
    const existing = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
    existing.push(order);
    localStorage.setItem("berrylicious-orders", JSON.stringify(existing));

    clearCart();
    if (refreshProfile) await refreshProfile();
    navigate(`/order/${full.id}`);
    setSubmitting(false);
  };

  if (items.length === 0) {
    const popular = menuItems.filter((i) => i.popular).slice(0, 3);

    return (
      <div className="min-h-screen pb-safe-nav px-6 pt-6 max-w-lg mx-auto animate-fade-in">
        <h1 className="font-display text-3xl font-bold mb-8">Your Order</h1>

        <div className="text-center py-8 mb-8">
          <p className="text-foreground font-semibold mb-1">Your cart is empty</p>
          <p className="text-muted-foreground text-sm">Start with something popular</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold mb-3">Popular right now</h2>
          <div className="space-y-3">
            {popular.map((item) => (
              <SuggestionItem key={item.id} item={item} />
            ))}
          </div>
        </div>

        <Link
          to="/menu"
          className="block w-full border border-primary text-primary font-semibold py-3.5 rounded-lg text-center hover:bg-primary/10 transition-colors mt-6 btn-press"
        >
          Browse Full Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-safe-nav px-6 pt-6 max-w-lg mx-auto animate-fade-in">
      <h1 className="font-display text-3xl font-bold mb-6">Your Order</h1>

      {/* Order Type Selector */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground font-medium mb-3">How are you ordering?</p>
        <div className="grid grid-cols-3 gap-2">
          {orderTypeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setOrderType(opt.value)}
              className={`py-3 px-2 rounded-lg text-center text-xs font-semibold border btn-press ${
                orderType === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs mt-2">
          {orderTypeOptions.find((o) => o.value === orderType)?.desc}
        </p>
      </div>

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
          <span>Service fee</span>
          <span>{formatPrice(deliveryFee)}</span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between text-foreground font-semibold">
          <span>Total</span>
          <span className="text-primary">{formatPrice(totalPrice + deliveryFee)}</span>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={submitting}
        className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-lg btn-press disabled:opacity-50"
      >
        {submitting ? "Placing order..." : "Place Order"}
      </button>
    </div>
  );
};

export default CartPage;
