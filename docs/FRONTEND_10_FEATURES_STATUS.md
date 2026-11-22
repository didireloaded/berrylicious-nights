# Butcher Block Steakhouse — Final 10 Customer Features (Frontend Status & Backend Checklist)

This document maps the **10 approved customer features** across the five existing navigation destinations (`Home`, `Menu`, `Cart`, `Book`, `More / Profile`), records their honest frontend vs. backend connection state, and defines the **Backend Dependency Checklist** for the next phase.

No new database tables, migrations, RLS policies, Edge Functions, or payment integrations were created in this frontend-only phase.

---

## 1. Approved 10-Feature Status Matrix

| # | Approved Feature | Destination(s) | Status | Customer Behavior Today |
| --- | --- | --- | --- | --- |
| 1 | **Live order tracking and notifications** | Home, Order Detail (`/order/:id`), Profile | **CONNECTED** (tracking) / **FRONTEND READY** (persistent notification history) | Vertical `OrderProgressTimeline` reflects real `orders` statuses (`pending`, `confirmed`, `preparing`, `ready` / `"Ready for collection"`, dine-in `handover` only when genuine, `completed`) with actual kitchen ETA when present. `NotificationList` / `NotificationCenterSheet` links active tracked orders and shows an honest unavailable state when `user_notifications` is not connected (never fabricating unread counts). |
| 2 | **Verified food ratings** | Menu Detail (`/menu/:id`), Completed Orders, Profile | **FRONTEND READY** | Displays verified averages/snippets only when real backend views return data. Compact accessible `RatingSheet` & `OrderReviewSheet` disable submission with an honest explanation when verified-review endpoints are not connected. Never stores fake reviews or shows fake averages. |
| 3 | **Butcher Block Rewards** (incl. **Guest of the Week** subsection) | More / Profile | **FRONTEND READY** | `RewardsOverview` + `GuestOfTheWeek` subsection render a restrained coming-soon membership overview and neutral Guest of the Week program introduction when loyalty/recognition endpoints are not live. Never displays sample points balances, fabricated rewards, or invented winners. |
| 4 | **QR table ordering** | `/table/:tableCode`, Cart, Contextual Bar | **FRONTEND READY** | Route `/table/:tableCode` never trusts arbitrary URL codes or creates fake sessions. Displays `"Table ordering is being prepared. You can still browse the menu and order using the regular checkout."` with a working `Browse Menu` link until `resolve_table_qr` is live; renders `TableSessionHeader` once validated. |
| 5 | **Call your waiter** | Contextual Table Session / Profile (valid table session only) | **FRONTEND READY** | `WaiterServiceSheet` (`WaiterRequestSheet`) provides the 6 approved request options with Lucide icons (`Call waiter`, `Request water`, `Extra cutlery`, `Request condiments`, `Request the bill`, `Other assistance`) and full state representation. Submission remains disabled without a live validated table session and service-request endpoint. |
| 6 | **My usual order and reorder** | More / Profile, Menu (compact when history exists), Order Detail | **CONNECTED** | `MyUsualSection`, `PreviousOrderCard`, and `ReorderPreviewSheet` read real order history (`orders` for signed-in accounts, device orders for guests), validate every dish against live `src/data/menu.ts` & `menu_item_disabled`, recalculate current `N$` pricing, and add validated items to the cart without auto-submitting. Empty state: `"Your favorites will appear here after your first order."` with `Browse Menu`. |
| 7 | **Group orders and split bills** | Cart (`"Ordering with friends?"`), `/group/*` | **CONNECTED** (local integer-cent split preview) / **FRONTEND READY** (multi-phone group sync) | `GroupOrderSheet` opens from Cart with a live integer-cent `BillSplitPreview` (`Equally`, `By items`, `Custom`) over the customer's real cart with clear non-payment / non-server-record disclosure. Multi-phone group creation, join codes, and shared submission remain honestly disabled (`coming_soon`) until backend sync is live. |
| 8 | **Food and wine pairing** | Menu Detail (`/menu/:id`) | **CONNECTED** | Understated `FoodWinePairing` (`"Pairs beautifully with"`) placed directly below dish customization using explicit restaurant-approved pairings over real menu drinks with `View drink` and `Add` actions. Omitted entirely when no verified pairing exists for an item. |
| 9 | **Table waitlist** | Book (`/booking`) | **CONNECTED** | Contextual `"Join the waitlist"` action appears when reservation times are unavailable or taken, opening `WaitlistSheet` (guest name, phone, party size, date, preferred time, notes). Reuses existing Supabase waitlist persistence and never fabricates queue positions or wait times. |
| 10 | **Private dining feedback** | More / Profile, Completed Order Receipt (`/order/:id`) | **FRONTEND READY** | `PrivateFeedbackSheet` offers the 6 approved categories (`Food quality`, `Restaurant service`, `Waiting time`, `Cleanliness`, `General experience`, `Other feedback`), optional related order reference, message, and optional contact preference. Probes backend availability safely on open and disables submission cleanly until a secure private endpoint is deployed. Never publishes publicly or simulates delivery. |

---

## 2. Information Architecture (5 Existing Destinations)

- **Home (`/home`)**: Active order banner (when active), Notification bell (no fabricated unread count), House Signatures, upcoming reservation (when held), Upcoming Nights, Ask Butcher Block, Hours & location. Zero `"Coming soon"` clutter on the homepage.
- **Menu (`/menu`, `/drinks`, `/menu/:id`)**: Food & drinks catalog, genuine dish ratings (only when verified), `"Pairs beautifully with"` (`FoodWinePairing`), Favorites, compact contextual `MyUsualSection` reorder entry (only when genuine history exists).
- **Cart (`/cart`)**: Personal cart with live availability/price validation, validated table context banner (only when a valid session exists), `"Ordering with friends?"` entry opening `GroupOrderSheet` + `BillSplitPreview`.
- **Book (`/booking`)**: Windhoek-local date strip, live `booked_table_times` availability, reservation confirmation, and contextual `"Join the waitlist"` opening `WaitlistSheet` when slots are unavailable/taken.
- **More / Profile (`/profile`)**: `MyUsualSection`, `MyOrdersSection` (`PreviousOrderCard` + `ReorderPreviewSheet`), `RewardsAndGuestSection` (`RewardsOverview` + `GuestOfTheWeek`), `MyReviewsSection`, Saved Favourites, Notifications & Preferences, Private Dining Feedback, and contextual Table Service (only when a valid table session exists).

---

## 3. Reusable Frontend Components

- `src/lib/featureAvailability.ts` — Shared availability union (`available`, `loading`, `empty`, `requires_sign_in`, `requires_table_session`, `temporarily_unavailable`, `coming_soon`, `error`), `APPROVED_CUSTOMER_FEATURES`, `isBackendMissingError`.
- `src/components/FeatureAvailabilityState.tsx` — Unified honest status card/banner.
- `src/components/OrderProgressTimeline.tsx` — Vertical order progress timeline with pickup vs. dine-in wording.
- `src/components/NotificationList.tsx` & `src/components/NotificationCenterSheet.tsx` — Presentational notification list & sheet.
- `src/components/RatingSheet.tsx`, `src/components/DishReviewsSection.tsx`, `src/components/OrderReviewSheet.tsx` — Verified food rating display & compact rating bottom sheet.
- `src/components/RewardsOverview.tsx`, `src/components/GuestOfTheWeek.tsx`, `src/components/RewardsAndGuestSection.tsx` — Membership overview & Guest of the Week subsection.
- `src/components/TableSessionHeader.tsx` & `src/pages/TableEntryPage.tsx` — QR table validation & session header.
- `src/components/WaiterServiceSheet.tsx` (`WaiterRequestSheet`) — 6-option contextual waiter request bottom sheet.
- `src/components/PreviousOrderCard.tsx`, `src/components/MyUsualSection.tsx`, `src/components/ReorderPreviewSheet.tsx` — Genuine order history, usual dishes, and live-revalidated reorder confirmation.
- `src/components/BillSplitPreview.tsx` & `src/components/GroupOrderSheet.tsx` — Integer-cent split calculator & shared group-order sheet.
- `src/components/FoodWinePairing.tsx` — Explicit restaurant-approved pairing component.
- `src/components/WaitlistSheet.tsx` — Contextual table waitlist bottom sheet.
- `src/components/PrivateFeedbackSheet.tsx` — 6-category confidential feedback bottom sheet.

---

## 4. Backend Dependency Checklist (For Next Development Phase — Documentation Only)

> Do not execute during the frontend-only phase. Each item below is required before flipping its corresponding **FRONTEND READY** feature to live submission.

1. **Order Status History & Persistent Notifications (Feature 01)**
   - [ ] Enable `order_status_history` recording genuine kitchen transitions (`pending`, `confirmed`, `preparing`, `ready`, `handover`, `completed`, `cancelled`).
   - [ ] Enable `user_notifications` + `notification_preferences` tables with owner-only RLS (`auth.uid() = user_id`) and idempotent server-side trigger/RPC emission.
   - [ ] Expose authenticated guest tracking RPC (`get_guest_order_status`) verified by opaque token hash.
2. **Verified Food Ratings (Feature 02)**
   - [ ] Deploy `food_reviews`, `review_reports`, safe public views (`public_food_reviews`, `menu_item_rating_summary`), and `submit_verified_food_review` RPC enforcing completed-order ownership & rating immutability.
   - [ ] Ensure moderation updates cannot alter customer star ratings and record audit entries.
3. **Butcher Block Rewards & Guest of the Week (Feature 03)**
   - [ ] Deploy `loyalty_rules` (management-configurable), append-only `loyalty_ledger`, `rewards_catalog`, and atomic `redeem_loyalty_reward` RPC.
   - [ ] Deploy `guest_of_the_week` + `public_guest_of_the_week` view enforcing explicit customer opt-in consent and instant withdrawal before public display.
   - [ ] Obtain management sign-off on earning rates, exclusions, and approved rewards before setting `loyalty_rules.enabled = true`.
4. **QR Table Ordering (Feature 04)**
   - [ ] Deploy `restaurant_tables` and `table_sessions` with opaque session tokens, expiration, and QR rotation.
   - [ ] Deploy `resolve_table_qr(p_table_code)` and `validate_table_session(p_session_id, p_session_token)` RPCs and generate physical table placards.
5. **Call Your Waiter (Feature 05)**
   - [ ] Deploy `service_requests` table with active deduplication constraints and RLS scoped to validated table sessions & floor staff.
   - [ ] Deploy `create_service_request`, `get_session_service_requests`, `cancel_service_request`, and staff acknowledgment/completion RPCs with realtime broadcast.
6. **Group Orders & Split Bills Sync (Feature 07)**
   - [ ] Deploy `group_orders`, `group_participants`, `group_order_items` (integer minor units), `bill_allocations`, and `bill_settlements` tables with table-session-bound authorization.
   - [ ] Deploy atomic group submit (`submit_group_order`), exact-sum split validation (`save_group_bill_split`), and staff-only POS settlement (`mark_bill_allocation_settled`).
7. **Table Waitlist Enhancements (Feature 09)**
   - [ ] Confirm `join_waitlist` RPC (or keep existing `waitlist_entries` INSERT policy) and optionally expose server-verified queue status updates without client-side estimates.
8. **Private Dining Feedback (Feature 10)**
   - [ ] Deploy `private_dining_feedback` table with insert-allowed / management-only SELECT RLS (strictly isolated from public views and public food ratings).
   - [ ] Deploy staff acknowledgment/resolution RPC (`update_private_feedback_status`) and staff notification workflow.
