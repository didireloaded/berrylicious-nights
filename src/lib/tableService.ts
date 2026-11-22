/**
 * Domain types & validation helpers for Butcher Block QR Table Ordering and
 * Waiter Service Requests.
 */

export type ServiceRequestType =
  | "waiter"
  | "cutlery"
  | "water"
  | "condiments"
  | "bill"
  | "other";

export type ServiceRequestStatus = "pending" | "acknowledged" | "completed" | "cancelled";

export interface ActiveTableSession {
  sessionId: string;
  sessionToken: string;
  tableId: string;
  tableNumber: string;
  displayName: string;
  area: string;
  expiresAt: string;
}

export interface RestaurantTableRow {
  id: string;
  table_number: string;
  display_name: string;
  table_code: string;
  qr_version: number;
  capacity: number;
  area: string;
  active: boolean;
  created_at: string;
}

export interface TableSessionRow {
  id: string;
  table_id: string;
  status: "active" | "closed";
  verified_by_staff: boolean;
  opened_at: string;
  expires_at: string;
  closed_at: string | null;
}

export interface ServiceRequestRow {
  id: string;
  table_id: string;
  table_session_id: string;
  user_id: string | null;
  guest_session_key: string | null;
  request_type: ServiceRequestType;
  note: string | null;
  status: ServiceRequestStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export const SERVICE_REQUEST_OPTIONS: {
  type: ServiceRequestType;
  label: string;
  description: string;
}[] = [
  { type: "waiter", label: "Call a waiter", description: "Request a floor team member at your table" },
  { type: "water", label: "Request water", description: "Still or sparkling water for the table" },
  { type: "cutlery", label: "Extra cutlery", description: "Steak knives, forks, napkins, or sharing plates" },
  { type: "condiments", label: "Condiments", description: "Salt, pepper mill, mustard, or chilli" },
  { type: "bill", label: "Ask for the bill", description: "Request your table bill or card machine" },
  { type: "other", label: "Other assistance", description: "Add a short note for your server" },
];

export function getServiceRequestLabel(type: string): string {
  return SERVICE_REQUEST_OPTIONS.find((o) => o.type === type)?.label ?? "Table assistance";
}

/** Validates format of a scanned QR table code before hitting the server. */
export function isValidTableCodeFormat(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmed = code.trim();
  return /^[A-Za-z0-9_-]{4,48}$/.test(trimmed);
}

/** Checks if a stored client table session has passed its expiration timestamp. */
export function isTableSessionExpired(session: Pick<ActiveTableSession, "expiresAt">, nowMs = Date.now()): boolean {
  const exp = Date.parse(session.expiresAt);
  if (!Number.isFinite(exp)) return true;
  return nowMs >= exp;
}

/** Builds the canonical QR destination URL for a restaurant table code. */
export function buildTableQrUrl(tableCode: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://butcherblock.com.na");
  return `${base.replace(/\/$/, "")}/table/${encodeURIComponent(tableCode.trim())}`;
}

/** Checks whether a customer can cancel a specific service request. */
export function canCustomerCancelServiceRequest(
  req: Pick<ServiceRequestRow, "status" | "user_id" | "guest_session_key">,
  actor: { userId?: string | null; guestKey?: string | null },
): boolean {
  if (req.status !== "pending") return false;
  if (req.user_id) return Boolean(actor.userId && actor.userId === req.user_id);
  if (req.guest_session_key) return Boolean(actor.guestKey && actor.guestKey === req.guest_session_key);
  return true;
}

/** Checks if an active request of the same type already exists to avoid duplicate requests. */
export function findDuplicateActiveServiceRequest(
  requests: Pick<ServiceRequestRow, "id" | "request_type" | "status">[],
  requestType: ServiceRequestType,
): Pick<ServiceRequestRow, "id" | "request_type" | "status"> | null {
  return (
    requests.find(
      (r) => r.request_type === requestType && (r.status === "pending" || r.status === "acknowledged"),
    ) ?? null
  );
}
