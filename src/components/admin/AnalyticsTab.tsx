import { BarChart3, TrendingUp, Clock, Star } from "lucide-react";
import { formatPrice } from "@/lib/vibe";
import { getPeakHour, getTopItem, calculateRevenue, type KitchenOrder } from "@/lib/kitchen-ai";

interface Props {
  orders: KitchenOrder[];
  bookings: any[];
}

const AnalyticsTab = ({ orders, bookings }: Props) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const todayOrders = orders.filter(o => o.created_at.startsWith(todayStr));
  const completedToday = todayOrders.filter(o => o.status === "completed");
  const revenue = calculateRevenue(todayOrders);
  const peakHour = getPeakHour(orders);
  const topItem = getTopItem(orders);
  const todayBookings = bookings.filter(b => b.date === todayStr);

  const stats = [
    { label: "Total Orders", value: orders.length.toString(), icon: BarChart3, color: "text-primary" },
    { label: "Today's Orders", value: todayOrders.length.toString(), icon: TrendingUp, color: "text-green-400" },
    { label: "Completed Today", value: completedToday.length.toString(), icon: Star, color: "text-yellow-400" },
    { label: "Today's Revenue", value: formatPrice(revenue), icon: TrendingUp, color: "text-primary" },
    { label: "Peak Hour", value: peakHour || "—", icon: Clock, color: "text-orange-400" },
    { label: "Top Item", value: topItem || "—", icon: Star, color: "text-primary" },
    { label: "Today's Bookings", value: todayBookings.length.toString(), icon: BarChart3, color: "text-green-400" },
    { label: "All-time Bookings", value: bookings.length.toString(), icon: BarChart3, color: "text-muted-foreground" },
  ];

  // Order status breakdown
  const statusCounts = {
    pending: orders.filter(o => o.status === "pending").length,
    preparing: orders.filter(o => o.status === "preparing").length,
    ready: orders.filter(o => o.status === "ready").length,
    completed: orders.filter(o => o.status === "completed").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-foreground font-bold text-lg truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Order Funnel */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-foreground font-semibold mb-4">Order Pipeline</h3>
        <div className="space-y-3">
          {Object.entries(statusCounts).map(([status, count]) => {
            const total = orders.length || 1;
            const pct = Math.round((count / total) * 100);
            const colors: Record<string, string> = {
              pending: "bg-primary/60",
              preparing: "bg-yellow-500/60",
              ready: "bg-green-500/60",
              completed: "bg-muted-foreground/40",
            };
            return (
              <div key={status}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground capitalize">{status}</span>
                  <span className="text-foreground font-medium">{count} ({pct}%)</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${colors[status]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
