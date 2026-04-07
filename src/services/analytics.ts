type OrderLike = { items?: { name?: string; qty?: number }[] };

export function getPopularItems(orders: OrderLike[]): [string, number][] {
  const count: Record<string, number> = {};

  for (const order of orders) {
    if (!Array.isArray(order.items)) continue;
    for (const item of order.items) {
      const name = item.name?.trim() || "Unknown";
      const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
      count[name] = (count[name] || 0) + qty;
    }
  }

  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}
