import { formatPrice } from "@/lib/vibe";
import { calculatePriority, type KitchenOrder } from "@/lib/kitchen-ai";

interface Props {
  title: string;
  emoji: string;
  orders: KitchenOrder[];
  colorClass: string;
  selectedId: string | null;
  onSelect: (order: KitchenOrder) => void;
  onStatusChange: (id: string, status: string) => void;
}

const nextStatus: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

const nextLabel: Record<string, string> = {
  pending: "Start →",
  preparing: "Ready →",
  ready: "Done →",
};

const priorityBorder: Record<string, string> = {
  high: "border-l-red-400",
  normal: "border-l-yellow-500/50",
  low: "border-l-border",
};

const KitchenColumn = ({ title, emoji, orders, colorClass, selectedId, onSelect, onStatusChange }: Props) => {
  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2 text-sm">
        {emoji} {title}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
          {orders.length}
        </span>
      </h3>
      <div className="space-y-2">
        {orders.map((o) => {
          const priority = calculatePriority(o);
          const isSelected = selectedId === o.id;
          const items = Array.isArray(o.items) ? o.items : [];
          const elapsed = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);

          return (
            <div
              key={o.id}
              onClick={() => onSelect(o)}
              className={`bg-card border rounded-lg p-3 cursor-pointer transition-all border-l-4 ${priorityBorder[priority]} ${
                isSelected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <p className="text-foreground font-semibold text-sm">{formatPrice(o.total)}</p>
                <span className="text-muted-foreground text-[10px]">{elapsed}m ago</span>
              </div>
              <p className="text-muted-foreground text-xs line-clamp-2">
                {items.map((i: any) => `${i.name} ×${i.qty || 1}`).join(", ") || "Items"}
              </p>

              {/* Quick action */}
              {nextStatus[o.status] && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(o.id, nextStatus[o.status]);
                  }}
                  className="mt-2 w-full bg-primary/10 text-primary text-xs font-semibold py-1.5 rounded-lg hover:bg-primary/20 transition-colors active:scale-[0.97]"
                >
                  {nextLabel[o.status]}
                </button>
              )}
            </div>
          );
        })}
        {orders.length === 0 && (
          <p className="text-muted-foreground/50 text-xs text-center py-6">No orders</p>
        )}
      </div>
    </div>
  );
};

export default KitchenColumn;
