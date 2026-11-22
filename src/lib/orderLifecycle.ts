/**
 * Canonical 6-stage Butcher Block kitchen order lifecycle, transition rules,
 * exact customer notification templates, and guest access token utilities.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "handover"
  | "completed"
  | "cancelled";

export type OrderFulfillmentType = "dinein" | "pickup" | "preorder" | string | null | undefined;

export const ORDER_STAGE_SEQUENCE: readonly Exclude<OrderStatus, "cancelled">[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "handover",
  "completed",
] as const;

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["handover", "completed", "cancelled"],
  handover: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isValidOrderStatus(status: string | null | undefined): status is OrderStatus {
  return (
    status === "pending" ||
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready" ||
    status === "handover" ||
    status === "completed" ||
    status === "cancelled"
  );
}

export function canTransitionOrderStatus(fromStatus: string, toStatus: string): boolean {
  if (!isValidOrderStatus(fromStatus) || !isValidOrderStatus(toStatus)) return false;
  if (fromStatus === toStatus) return false;
  return VALID_ORDER_TRANSITIONS[fromStatus].includes(toStatus);
}

export function getNextKitchenStage(status: string): Exclude<OrderStatus, "cancelled"> | null {
  switch (status) {
    case "pending":
      return "confirmed";
    case "confirmed":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return "handover";
    case "handover":
      return "completed";
    default:
      return null;
  }
}

export function getKitchenActionLabel(status: string, orderType?: OrderFulfillmentType): string | null {
  switch (status) {
    case "pending":
      return "Confirm order";
    case "confirmed":
      return "Start preparing";
    case "preparing":
      return "Mark ready";
    case "ready":
      return orderType === "dinein" ? "Send to table" : "Ready at counter";
    case "handover":
      return "Complete order";
    default:
      return null;
  }
}

export interface OrderStageCopy {
  stageNumber: number;
  label: string;
  headline: string;
  notificationMessage: string;
  progressPercent: number;
}

export function getOrderStageCopy(status: string, orderType?: OrderFulfillmentType): OrderStageCopy {
  switch (status) {
    case "pending":
      return {
        stageNumber: 1,
        label: "Order Received",
        headline: "Order received",
        notificationMessage: "Your order has been received by Butcher Block.",
        progressPercent: 16,
      };
    case "confirmed":
      return {
        stageNumber: 2,
        label: "Kitchen Confirmed",
        headline: "Kitchen confirmed",
        notificationMessage: "The kitchen has confirmed your order.",
        progressPercent: 34,
      };
    case "preparing":
      return {
        stageNumber: 3,
        label: "Preparing",
        headline: "Preparing your meal",
        notificationMessage: "Your food is being prepared.",
        progressPercent: 56,
      };
    case "ready":
      return {
        stageNumber: 4,
        label: "Ready",
        headline: "Your order is ready",
        notificationMessage: "Your order is ready.",
        progressPercent: 76,
      };
    case "handover":
      if (orderType === "dinein") {
        return {
          stageNumber: 5,
          label: "On the Way",
          headline: "On its way to your table",
          notificationMessage: "Your food is on its way to your table.",
          progressPercent: 90,
        };
      }
      return {
        stageNumber: 5,
        label: "Collection",
        headline: "Ready for collection",
        notificationMessage: "Your order is ready for collection.",
        progressPercent: 90,
      };
    case "completed":
      return {
        stageNumber: 6,
        label: "Completed",
        headline: "Enjoy your meal",
        notificationMessage: "Enjoy your meal. We'd love to hear what you think.",
        progressPercent: 100,
      };
    case "cancelled":
      return {
        stageNumber: 0,
        label: "Cancelled",
        headline: "Order cancelled",
        notificationMessage: "This order was cancelled and is no longer being prepared by the kitchen.",
        progressPercent: 0,
      };
    default:
      return {
        stageNumber: 1,
        label: "Order Received",
        headline: "Order received",
        notificationMessage: "Your order has been received by Butcher Block.",
        progressPercent: 16,
      };
  }
}

export function isActiveOrderStatus(status: string | null | undefined): boolean {
  return (
    status === "pending" ||
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready" ||
    status === "handover"
  );
}

/** Deterministic idempotency event key matching the Postgres trigger/RPC convention. */
export function buildOrderNotificationEventKey(orderId: string, status: string): string {
  return `order:${orderId}:${status}`;
}

/** Generates a 32-char URL-safe opaque token for guest order tracking/claiming. */
export function generateGuestAccessToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Computes lowercase hex SHA-256 hash using Web Crypto (matches pgcrypto digest sha256). */
export async function sha256Hex(input: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}
