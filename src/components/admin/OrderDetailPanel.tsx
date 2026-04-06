import { X, Clock, ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/vibe";
import { estimateETA, calculatePriority, type KitchenOrder } from "@/lib/kitchen-ai";

interface Props {
  order: KitchenOrder;
  activeOrderCount: number;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  onSetETA: (id: string, minutes: number) => void;
}

const nextStatus: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

const nextLabel: Record<string, string> = {
  pending: "Start Preparing →",
  preparing: "Mark Ready →",
  ready: "Complete Order →",
};

const statusEmoji: Record<string, string> = {
  pending: "📋",
  preparing: "👨‍🍳",
  ready: "🔥",
  completed: "✅",
};

const priorityColors: Record<string, string> = {
  high: "text-red-400 bg-red-500/10 border-red-500/20",
  normal: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-muted-foreground bg-muted/50 border-border",
};

const OrderDetailPanel = ({ order, activeOrderCount, onClose, onStatusChange, onSetETA }: Props) => {
  const priority = calculatePriority(order);
  const suggestedETA = estimateETA(order, activeOrderCount);
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="bg-card border border-border rounded-xl p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusEmoji[order.status] || "📋"}</span>
          <h3 className="text-foreground font-bold text-lg">Order Details</h3>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Status + Priority */}
      <div className="flex gap-2 mb-4">
        <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium capitalize">
          {order.status}
        </span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium border ${priorityColors[priority]}`}>
          {priority} priority
        </span>
      </div>

      {/* Time */}
      <p className="text-muted-foreground text-xs mb-4">
        {new Date(order.created_at).toLocaleString()} • AI ETA: ~{suggestedETA} min
      </p>

      {/* Items */}
      <div className="space-y-2 mb-5 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Items</p>
        {items.map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-foreground text-sm">{item.name}</span>
            <span className="text-muted-foreground text-sm">×{item.qty || 1}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between border-t border-border pt-3 mb-5">
        <span className="text-muted-foreground text-sm">Total</span>
        <span className="text-primary font-bold text-lg">{formatPrice(order.total)}</span>
      </div>

      {/* ETA Controls (when preparing) */}
      {order.status === "preparing" && (
        <div className="mb-5">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Set ETA (suggested: {suggestedETA}m)
          </p>
          <div className="flex gap-2 flex-wrap">
            {[10, 15, 20, 25, 30].map((mins) => (
              <button
                key={mins}
                onClick={() => onSetETA(order.id, mins)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  (order as any).eta_minutes === mins
                    ? "border-primary text-primary bg-primary/10"
                    : mins === suggestedETA
                    ? "border-primary/50 text-primary/70"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Action */}
      {nextStatus[order.status] && (
        <button
          onClick={() => onStatusChange(order.id, nextStatus[order.status])}
          className="w-full bg-primary text-primary-foreground text-sm font-bold py-3.5 rounded-xl hover:opacity-90 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
        >
          {nextLabel[order.status]}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default OrderDetailPanel;
