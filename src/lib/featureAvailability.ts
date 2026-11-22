/**
 * Shared availability and integration model for the 10 approved Butcher Block
 * customer features. Keeps UI states honest when a feature requires sign-in,
 * a validated table session, or backend endpoints not yet deployed.
 */

export type FeatureAvailabilityStatus =
  | "available"
  | "loading"
  | "empty"
  | "requires_sign_in"
  | "requires_table_session"
  | "temporarily_unavailable"
  | "coming_soon"
  | "error";

export type FeatureIntegrationTier = "CONNECTED" | "FRONTEND_READY" | "UNAVAILABLE";

export interface FeatureDefinition {
  number: number;
  id: string;
  name: string;
  destination: "Home" | "Menu" | "Cart" | "Book" | "More / Profile";
  tier: FeatureIntegrationTier;
  summary: string;
}

export const APPROVED_CUSTOMER_FEATURES: readonly FeatureDefinition[] = [
  {
    number: 1,
    id: "live-order-tracking",
    name: "Live order tracking and notifications",
    destination: "Home",
    tier: "CONNECTED",
    summary: "Real-time order tracking via Supabase orders; persistent notification history awaits backend table.",
  },
  {
    number: 2,
    id: "verified-food-ratings",
    name: "Verified food ratings",
    destination: "Menu",
    tier: "FRONTEND_READY",
    summary: "Display and rating bottom sheet ready; submission disabled until verified review endpoints are live.",
  },
  {
    number: 3,
    id: "butcher-block-rewards",
    name: "Butcher Block Rewards",
    destination: "More / Profile",
    tier: "FRONTEND_READY",
    summary: "Membership overview and Guest of the Week subsection ready; neutral coming-soon state until loyalty backend is live.",
  },
  {
    number: 4,
    id: "qr-table-ordering",
    name: "QR table ordering",
    destination: "Cart",
    tier: "FRONTEND_READY",
    summary: "Route /table/:tableCode and validated session header ready; never trusts unvalidated URL codes.",
  },
  {
    number: 5,
    id: "call-your-waiter",
    name: "Call your waiter",
    destination: "More / Profile",
    tier: "FRONTEND_READY",
    summary: "Contextual table-service bottom sheet with 6 request options; submission disabled without live table-service backend.",
  },
  {
    number: 6,
    id: "my-usual-and-reorder",
    name: "My usual order and reorder",
    destination: "More / Profile",
    tier: "CONNECTED",
    summary: "Reads real order history, validates every dish against live menu availability and prices, and adds safely to cart.",
  },
  {
    number: 7,
    id: "group-orders-split-bills",
    name: "Group orders and split bills",
    destination: "Cart",
    tier: "FRONTEND_READY",
    summary: "Integer-cent local split-bill preview connected to the current cart; shared multi-phone group ordering awaits backend.",
  },
  {
    number: 8,
    id: "food-and-wine-pairing",
    name: "Food and wine pairing",
    destination: "Menu",
    tier: "CONNECTED",
    summary: "Explicit restaurant-approved pairings over real menu items with View drink and Add to order actions.",
  },
  {
    number: 9,
    id: "table-waitlist",
    name: "Table waitlist",
    destination: "Book",
    tier: "CONNECTED",
    summary: "Contextual waitlist sheet wired to existing waitlist backend; never fabricates queue positions or wait times.",
  },
  {
    number: 10,
    id: "private-dining-feedback",
    name: "Private dining feedback",
    destination: "More / Profile",
    tier: "FRONTEND_READY",
    summary: "Private management feedback sheet with 6 approved categories; submission disabled until secure endpoint is live.",
  },
] as const;

export type PrivateFeedbackCategory =
  | "food_quality"
  | "restaurant_service"
  | "waiting_time"
  | "cleanliness"
  | "general_experience"
  | "other_feedback";

export const PRIVATE_FEEDBACK_CATEGORIES: readonly { id: PrivateFeedbackCategory; label: string }[] = [
  { id: "food_quality", label: "Food quality" },
  { id: "restaurant_service", label: "Restaurant service" },
  { id: "waiting_time", label: "Waiting time" },
  { id: "cleanliness", label: "Cleanliness" },
  { id: "general_experience", label: "General experience" },
  { id: "other_feedback", label: "Other feedback" },
] as const;

/**
 * Detects PostgREST / PostgreSQL missing-relation, missing-RPC, or schema-cache errors
 * so frontend-ready features display an honest unavailable/coming-soon state rather than
 * pretending to succeed or showing a broken technical error.
 */
export function isBackendMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string; hint?: string; status?: number };
  if (e.status === 404) return true;
  const blob = [e.code, e.message, e.details, e.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    blob.includes("42p01") ||
    blob.includes("42883") ||
    blob.includes("pgrst202") ||
    blob.includes("pgrst204") ||
    blob.includes("pgrst205") ||
    blob.includes("schema cache") ||
    blob.includes("does not exist") ||
    blob.includes("could not find the function") ||
    blob.includes("could not find the table") ||
    blob.includes("not found")
  );
}
