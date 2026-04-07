/** Lets guests open /order/:id when RLS blocks SELECT (user_id null). */

export type TrackableOrderSnapshot = {
  id: string;
  items: unknown;
  total: number;
  status: string;
  order_type?: string;
  eta_minutes?: number | null;
  eta_set_at?: string | null;
  created_at?: string;
  arrival_code?: string | null;
};

export function saveOrderSnapshotForTracking(order: TrackableOrderSnapshot) {
  try {
    localStorage.setItem(`berrylicious-track-order-${order.id}`, JSON.stringify(order));
  } catch {
    /* ignore quota */
  }
}

export function loadOrderSnapshotFromStorage(orderId: string): TrackableOrderSnapshot | null {
  try {
    const raw = localStorage.getItem(`berrylicious-track-order-${orderId}`);
    if (!raw) return null;
    return JSON.parse(raw) as TrackableOrderSnapshot;
  } catch {
    return null;
  }
}
