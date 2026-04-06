import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/vibe";
import { ArrowLeft, Clock } from "lucide-react";
import { toast } from "sonner";

const statusSteps = [
  { key: "pending", emoji: "📋", label: "Got your order", desc: "We're reviewing it now" },
  { key: "preparing", emoji: "👨‍🍳", label: "Preparing", desc: "Our chef is working on it" },
  { key: "ready", emoji: "🔥", label: "Ready!", desc: "Your food is ready" },
  { key: "completed", emoji: "✅", label: "Complete", desc: "Enjoy your meal!" },
];

const OrderTrackingPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const prevStatus = useRef<string | null>(null);

  const statusMessages: Record<string, string> = {
    preparing: "👨‍🍳 Your order is being prepared!",
    ready: "🔥 Your order is ready for pickup!",
    completed: "✅ Order complete — enjoy your meal!",
  };

  useEffect(() => {
    if (!id) return;

    // Fetch initial order
    const fetchOrder = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
      setOrder(data);
      prevStatus.current = data?.status ?? null;
      setLoading(false);
    };
    fetchOrder();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newOrder = payload.new as any;
          const newStatus = newOrder.status;
          if (prevStatus.current && newStatus !== prevStatus.current && statusMessages[newStatus]) {
            toast.success(statusMessages[newStatus], { duration: 6000 });
          }
          prevStatus.current = newStatus;
          setOrder(newOrder);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading order...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-lg mb-4">Order not found</p>
        <Link to="/" className="text-primary font-semibold hover:opacity-80">
          Back to Home
        </Link>
      </div>
    );
  }

  const currentIndex = statusSteps.findIndex((s) => s.key === order.status);
  const etaMinutes = order.eta_minutes;
  const etaSetAt = order.eta_set_at;

  // Calculate remaining ETA
  let etaRemaining: number | null = null;
  if (etaMinutes && etaSetAt) {
    const elapsed = Math.floor((Date.now() - new Date(etaSetAt).getTime()) / 60000);
    etaRemaining = Math.max(0, etaMinutes - elapsed);
  }

  return (
    <div className="min-h-screen pb-24 px-6 pt-6 max-w-lg mx-auto animate-fade-in">
      <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="font-display text-3xl font-bold text-foreground mb-2">
        Order Tracking
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Order #{order.id.slice(0, 8)} • {formatPrice(Number(order.total))}
      </p>

      {/* ETA */}
      {etaRemaining !== null && order.status !== "completed" && order.status !== "ready" && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-8 flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary" />
          <div>
            <p className="text-foreground font-semibold">
              Ready in ~{etaRemaining} min
            </p>
            <p className="text-muted-foreground text-xs">Estimated by kitchen</p>
          </div>
        </div>
      )}

      {/* Status Steps */}
      <div className="space-y-0 mb-8">
        {statusSteps.map((step, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          const isPending = i > currentIndex;

          return (
            <div key={step.key} className="flex gap-4">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                    isActive
                      ? "bg-primary/20 border-2 border-primary scale-110"
                      : isDone
                      ? "bg-primary/10 border border-primary/40"
                      : "bg-card border border-border"
                  }`}
                >
                  {step.emoji}
                </div>
                {i < statusSteps.length - 1 && (
                  <div
                    className={`w-0.5 h-12 transition-colors ${
                      isDone ? "bg-primary/40" : "bg-border"
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`pt-2 pb-6 ${isPending ? "opacity-40" : ""}`}>
                <p className={`font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>
                  {step.label}
                </p>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Items */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-foreground font-semibold mb-3">Your Items</h2>
        <div className="space-y-2">
          {Array.isArray(order.items) &&
            order.items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.name} × {item.qty}
                </span>
                <span className="text-muted-foreground">
                  {formatPrice(item.price * item.qty)}
                </span>
              </div>
            ))}
          <div className="border-t border-border pt-2 flex justify-between font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-primary">{formatPrice(Number(order.total))}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
