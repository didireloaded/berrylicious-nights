import { Shield, Activity } from "lucide-react";
import { formatPrice } from "@/lib/vibe";
import { getKitchenLoad, getLoadColor, getLoadBg, getAvgPrepTime, type KitchenOrder } from "@/lib/kitchen-ai";

interface Props {
  orders: KitchenOrder[];
  bookingsToday: number;
  revenue: number;
}

const AdminTopBar = ({ orders, bookingsToday, revenue }: Props) => {
  const activeOrders = orders.filter(o => o.status === "pending" || o.status === "preparing");
  const load = getKitchenLoad(orders);

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Kitchen Control</h1>
            <p className="text-muted-foreground text-xs">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          {/* Active Orders */}
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{activeOrders.length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>

          {/* Kitchen Load */}
          <div className={`text-center px-3 py-1.5 rounded-lg ${getLoadBg(load)}`}>
            <div className="flex items-center gap-1">
              <Activity className={`w-4 h-4 ${getLoadColor(load)}`} />
              <p className={`text-sm font-semibold capitalize ${getLoadColor(load)}`}>{load}</p>
            </div>
            <p className="text-xs text-muted-foreground">{getAvgPrepTime(activeOrders.length)} avg</p>
          </div>

          {/* Bookings Today */}
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{bookingsToday}</p>
            <p className="text-xs text-muted-foreground">Bookings</p>
          </div>

          {/* Revenue */}
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{formatPrice(revenue)}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTopBar;
