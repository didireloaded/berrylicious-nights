// Kitchen AI — smart logic layer (not UI, just decisions)

export interface KitchenOrder {
  id: string;
  items: any[];
  status: string;
  total: number;
  created_at: string;
  eta_minutes?: number;
  eta_set_at?: string;
  priority?: string;
  order_type?: string;
}

// Smart ETA based on item count + kitchen load
export function estimateETA(order: KitchenOrder, activeOrderCount: number): number {
  const base = 8;
  const itemCount = Array.isArray(order.items) ? order.items.reduce((sum: number, i: any) => sum + (i.qty || 1), 0) : 1;
  const itemFactor = itemCount * 2;
  const loadFactor = Math.min(activeOrderCount * 1.5, 15);
  return Math.round(base + itemFactor + loadFactor);
}

// Auto-priority based on order characteristics
export function calculatePriority(order: KitchenOrder): "high" | "normal" | "low" {
  const itemCount = Array.isArray(order.items) ? order.items.reduce((sum: number, i: any) => sum + (i.qty || 1), 0) : 1;
  
  // High value orders get priority
  if (order.total > 500) return "high";
  // Small quick orders
  if (itemCount <= 2) return "high";
  // Large orders take longer, lower priority
  if (itemCount > 6) return "low";
  return "normal";
}

// Kitchen load level
export type LoadLevel = "low" | "medium" | "high" | "critical";

export function getKitchenLoad(activeOrders: KitchenOrder[]): LoadLevel {
  const count = activeOrders.filter(o => o.status === "pending" || o.status === "preparing").length;
  if (count <= 3) return "low";
  if (count <= 7) return "medium";
  if (count <= 12) return "high";
  return "critical";
}

export function getLoadColor(load: LoadLevel): string {
  switch (load) {
    case "low": return "text-green-400";
    case "medium": return "text-yellow-400";
    case "high": return "text-orange-400";
    case "critical": return "text-red-400";
  }
}

export function getLoadBg(load: LoadLevel): string {
  switch (load) {
    case "low": return "bg-green-500/10";
    case "medium": return "bg-yellow-500/10";
    case "high": return "bg-orange-500/10";
    case "critical": return "bg-red-500/10";
  }
}

// Smart suggestions based on current state
export interface Suggestion {
  message: string;
  type: "info" | "warning" | "action";
  icon: string;
}

export function getSuggestions(orders: KitchenOrder[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const pending = orders.filter(o => o.status === "pending");
  const preparing = orders.filter(o => o.status === "preparing");
  const ready = orders.filter(o => o.status === "ready");
  
  if (pending.length > 5) {
    suggestions.push({
      message: "High queue — start preparing orders now",
      type: "warning",
      icon: "⚡"
    });
  }
  
  if (preparing.length > 4 && pending.length > 0) {
    suggestions.push({
      message: "Kitchen at capacity — hold new orders",
      type: "warning",
      icon: "🔥"
    });
  }
  
  if (ready.length > 3) {
    suggestions.push({
      message: `${ready.length} orders ready for pickup — clear the pass`,
      type: "action",
      icon: "📦"
    });
  }
  
  if (pending.length === 0 && preparing.length <= 2) {
    suggestions.push({
      message: "Kitchen running smooth — good pace",
      type: "info",
      icon: "✅"
    });
  }

  // Check for old pending orders (> 5 min)
  const now = Date.now();
  const staleOrders = pending.filter(o => now - new Date(o.created_at).getTime() > 5 * 60 * 1000);
  if (staleOrders.length > 0) {
    suggestions.push({
      message: `${staleOrders.length} order(s) waiting 5+ min — prioritize`,
      type: "warning",
      icon: "⏰"
    });
  }

  return suggestions;
}

// Revenue calculation
export function calculateRevenue(orders: KitchenOrder[]): number {
  return orders
    .filter(o => o.status === "completed" || o.status === "ready" || o.status === "preparing")
    .reduce((sum, o) => sum + (o.total || 0), 0);
}

// Peak hour detection
export function getPeakHour(orders: KitchenOrder[]): string | null {
  if (orders.length === 0) return null;
  const hourCounts: Record<number, number> = {};
  orders.forEach(o => {
    const hour = new Date(o.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const peak = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  if (!peak) return null;
  const h = parseInt(peak[0]);
  return `${h.toString().padStart(2, '0')}:00`;
}

// Top ordered item
export function getTopItem(orders: KitchenOrder[]): string | null {
  const itemCounts: Record<string, number> = {};
  orders.forEach(o => {
    if (Array.isArray(o.items)) {
      o.items.forEach((i: any) => {
        const name = i.name || "Unknown";
        itemCounts[name] = (itemCounts[name] || 0) + (i.qty || 1);
      });
    }
  });
  const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

// Average prep time estimation
export function getAvgPrepTime(activeOrders: number): string {
  const avg = Math.round(8 + activeOrders * 1.5);
  return `~${avg} min`;
}
