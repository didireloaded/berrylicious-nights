import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/vibe";
import { menuArtwork } from "@/lib/menuArtwork";
import {
  buildOrderSubmissionFingerprint,
  resolveBaseMenuItemId,
  resolveCanonicalUnitPrice,
  revalidateCartForOrder,
} from "@/lib/orderPricing";
import { saveOrderSnapshotForTracking, type TrackableOrderSnapshot } from "@/lib/orderTrackingStorage";
import { generateClientUuid, insertOrderWithArrivalCode } from "@/lib/supabaseArrivalInsert";
import { generateGuestAccessToken, sha256Hex } from "@/lib/orderLifecycle";
import { getWindhoekDateISO } from "@/lib/windhoekDate";

type OrderType = "pickup" | "preorder" | "dinein";

const ORDER_MODES: { value: OrderType; label: string; detail: string }[] = [
  { value: "pickup", label: "Pickup", detail: "Collect from Butcher Block when the kitchen marks your order ready." },
  { value: "preorder", label: "Pre-order", detail: "Schedule ahead so the grill fires shortly before you arrive." },
  { value: "dinein", label: "Dine-in", detail: "Send straight to the kitchen from your table at Am Weinberg Estate." },
];

const PICKUP_TIMES = ["ASAP (~25 min)", "In 45 min", "In 1 hour"];
const PREORDER_SLOTS = ["12:30", "18:00", "19:30", "20:00", "21:00"];
const DIETARY_QUICK_FLAGS = ["Nut allergy", "Dairy-free", "Gluten-sensitive", "Shellfish allergy", "No pork"];

function readStoredGuest(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, totalItems } = useCart();
  const { user, profile, refreshProfile } = useAuth();
  const { setCurrentOrder } = useApp();
  const { isUnavailable, refresh: refreshAvailability } = useMenuAvailability();
  const navigate = useNavigate();

  const today = getWindhoekDateISO();
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [pickupTime, setPickupTime] = useState<string>(PICKUP_TIMES[0]);
  const [preorderDate, setPreorderDate] = useState<string>(today);
  const [preorderSlot, setPreorderSlot] = useState<string>("19:30");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [guestName, setGuestName] = useState<string>(
    () => profile?.display_name || user?.user_metadata?.full_name || readStoredGuest("butcher-block-guest-name"),
  );
  const [guestPhone, setGuestPhone] = useState<string>(
    () => profile?.phone || readStoredGuest("butcher-block-guest-phone"),
  );
  const [dietaryFlags, setDietaryFlags] = useState<string[]>([]);
  const [dietaryCustomNote, setDietaryCustomNote] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Synchronous double-tap lock + idempotent order UUID per unique payload fingerprint
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; orderId: string } | null>(null);

  const unavailableItems = useMemo(
    () => items.filter((item) => isUnavailable(resolveBaseMenuItemId(item))),
    [items, isUnavailable],
  );

  // Re-sync live kitchen availability whenever the guest visits checkout with items in cart
  useEffect(() => {
    if (items.length > 0) {
      void refreshAvailability();
    }
  }, [items.length, refreshAvailability]);

  // Always display canonical menu prices rather than trusting stale localStorage prices
  const canonicalTotalPrice = useMemo(() => {
    let sum = 0;
    for (const item of items) {
      const unit = resolveCanonicalUnitPrice(item) ?? item.price;
      sum += unit * item.quantity;
    }
    return sum;
  }, [items]);

  const toggleDietaryFlag = (flag: string) => {
    setDietaryFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );
  };

  const removeUnavailableItems = () => {
    for (const item of unavailableItems) {
      removeItem(item.id);
    }
    setFormError(null);
    toast.success("Removed unavailable items from your cart");
  };

  async function handleCheckout() {
    if (submittingRef.current || submitting || items.length === 0) return;
    setFormError(null);

    const resolvedName = (profile?.display_name || user?.user_metadata?.full_name || guestName).trim();
    const resolvedTable = tableNumber.trim();

    if (orderType === "dinein" && !resolvedTable) {
      const msg = "Please enter your table number so we can bring your order to you.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    if (orderType === "pickup" && !user && !resolvedName) {
      const msg = "Please enter your name for pickup collection.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    if (orderType === "preorder") {
      if (!preorderDate) {
        const msg = "Please select an arrival date for your pre-order.";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      if (!user && !resolvedName) {
        const msg = "Please enter your name for your pre-order.";
        setFormError(msg);
        toast.error(msg);
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);

    // 1. Refresh live kitchen 86 board right before submitting so stale carts cannot order unavailable dishes
    let freshDisabled: Set<string>;
    try {
      freshDisabled = await refreshAvailability();
    } catch {
      freshDisabled = new Set();
    }

    const scheduledTime =
      orderType === "pickup"
        ? pickupTime
        : orderType === "preorder"
          ? `${preorderDate} at ${preorderSlot}`
          : null;

    const combinedDietaryNotes = [
      ...dietaryFlags,
      dietaryCustomNote.trim(),
    ]
      .filter(Boolean)
      .join(" · ");

    const orderMeta = {
      tableNumber: orderType === "dinein" ? resolvedTable : null,
      scheduledTime,
      guestName: resolvedName || null,
      dietaryNotes: combinedDietaryNotes || null,
    };

    // 2. Revalidate every item's availability & canonical price from the official catalog
    const validated = revalidateCartForOrder(items, freshDisabled, orderMeta);
    if ("reason" in validated) {
      if (validated.reason === "unavailable") {
        const names = validated.unavailableNames?.join(", ") || "One or more items";
        const msg = `${names} just became unavailable in the kitchen. Please remove to continue.`;
        setFormError(msg);
        toast.error(msg);
      } else {
        const msg = "One or more items in your cart could not be priced. Please refresh and try again.";
        setFormError(msg);
        toast.error(msg);
      }
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    if (validated.priceAdjusted) {
      toast.info("Menu prices were refreshed to the latest Butcher Block rates.");
    }

    try {
      if (guestName.trim()) localStorage.setItem("butcher-block-guest-name", guestName.trim());
      if (guestPhone.trim()) localStorage.setItem("butcher-block-guest-phone", guestPhone.trim());
    } catch {
      /* ignore storage errors */
    }

    // 3. Idempotent submission key so retries/double-taps cannot insert duplicate kitchen tickets
    const fingerprint = buildOrderSubmissionFingerprint(validated.items, orderType, orderMeta);
    let stableOrderId: string;
    if (idempotencyRef.current && idempotencyRef.current.fingerprint === fingerprint) {
      stableOrderId = idempotencyRef.current.orderId;
    } else {
      stableOrderId = generateClientUuid();
      idempotencyRef.current = { fingerprint, orderId: stableOrderId };
    }

    // Generate opaque guest tracking secret so guests can securely track/claim only their own order
    const guestAccessToken = user ? null : generateGuestAccessToken();
    const guestAccessTokenHash = guestAccessToken ? await sha256Hex(guestAccessToken) : null;

    let orderId: string;
    let arrivalCode: string | null = null;
    try {
      const row = await insertOrderWithArrivalCode(
        {
          user_id: user?.id || null,
          items: validated.items,
          total: validated.total,
          order_type: orderType,
          ...(orderMeta.tableNumber ? { table_number: orderMeta.tableNumber } : {}),
          ...(guestAccessTokenHash ? { guest_access_token_hash: guestAccessTokenHash } : {}),
        },
        { idempotencyId: stableOrderId },
      );
      orderId = row.id;
      arrivalCode = row.arrival_code ?? null;
    } catch (error) {
      console.error("[CartPage] Unable to place order", error);
      toast.error("Your order could not be placed. Nothing was submitted. Please try again.");
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    // Clear idempotency key after confirmed server acceptance
    idempotencyRef.current = null;

    // Only query back when authenticated; guest SELECT is restricted by RLS
    let full: Record<string, unknown> | null = null;
    if (user) {
      try {
        const response = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
        full = response.data as Record<string, unknown> | null;
      } catch {
        // Server already accepted the order; continue with snapshot tracking.
      }
    }

    const snapshot: TrackableOrderSnapshot = {
      id: orderId,
      items: full?.items ?? validated.items,
      total: Number(full?.total ?? validated.total),
      status: String(full?.status ?? "pending"),
      order_type: typeof full?.order_type === "string" ? full.order_type : orderType,
      table_number: orderMeta.tableNumber,
      scheduled_time: orderMeta.scheduledTime,
      guest_name: orderMeta.guestName,
      dietary_notes: orderMeta.dietaryNotes,
      guest_access_token: guestAccessToken,
      payment_status: typeof full?.payment_status === "string" ? full.payment_status : "unpaid",
      eta_minutes: typeof full?.eta_minutes === "number" ? full.eta_minutes : null,
      eta_set_at: typeof full?.eta_set_at === "string" ? full.eta_set_at : null,
      created_at: typeof full?.created_at === "string" ? full.created_at : new Date().toISOString(),
      arrival_code: typeof full?.arrival_code === "string" ? full.arrival_code : arrivalCode,
    };

    saveOrderSnapshotForTracking(snapshot);
    setCurrentOrder(snapshot);

    try {
      const saved = JSON.parse(localStorage.getItem("berrylicious-orders") || "[]");
      if (Array.isArray(saved)) {
        saved.push({
          id: orderId,
          items: validated.items,
          total: validated.total,
          status: snapshot.status,
          order_type: orderType,
          table_number: snapshot.table_number,
          scheduled_time: snapshot.scheduled_time,
          guest_name: snapshot.guest_name,
          dietary_notes: snapshot.dietary_notes,
          createdAt: snapshot.created_at,
          arrival_code: snapshot.arrival_code,
        });
        localStorage.setItem("berrylicious-orders", JSON.stringify(saved));
      }
    } catch {
      /* ignore local history failure */
    }

    clearCart();
    toast.success("Order placed — viewing your receipt");
    navigate(`/order/${orderId}`);
    submittingRef.current = false;
    setSubmitting(false);
    if (refreshProfile) void Promise.resolve(refreshProfile()).catch(() => undefined);
  }

  const serviceSummary =
    orderType === "dinein"
      ? tableNumber.trim()
        ? `Dine-in · ${tableNumber.trim()}`
        : "Dine-in"
      : orderType === "preorder"
        ? `Pre-order · ${preorderDate} at ${preorderSlot}`
        : `Pickup · ${pickupTime}`;

  return (
    <div className="min-h-dvh bg-[#121212] pb-32 text-white lg:pb-16">
      <div className="mx-auto max-w-[560px] px-5 pt-[max(20px,env(safe-area-inset-top,0px))] sm:px-6 lg:max-w-5xl lg:px-8 lg:pt-8">
        {/* Clean iOS Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/menu"
              aria-label="Back to menu"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <div>
              <h1 className="font-display text-[24px] font-extrabold tracking-[-0.035em] text-white">
                Your Cart
              </h1>
              {totalItems > 0 && (
                <p className="text-[13px] text-[#A3A3A3]">
                  {totalItems} {totalItems === 1 ? "item" : "items"}
                </p>
              )}
            </div>
          </div>
          <Link
            to="/menu"
            className="text-[14px] font-semibold text-[#FF5A1F] hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            Add more
          </Link>
        </header>

        {items.length === 0 ? (
          <section className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-[#FF5A1F]">
              <ShoppingBag className="h-9 w-9" strokeWidth={1.6} aria-hidden="true" />
            </span>
            <h2 className="mt-6 text-[26px] font-extrabold tracking-[-0.04em] text-white">
              Your cart is empty
            </h2>
            <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-[#A3A3A3]">
              Browse Butcher Block&apos;s steaks, burgers, sides, and cellar to start an order.
            </p>
            <Link
              to="/menu"
              className="mt-7 inline-flex min-h-[50px] items-center gap-2 rounded-full bg-[#FF5A1F] px-7 text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Explore Menu <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <div className="mt-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
            {/* Cart Item Rows */}
            <section className="space-y-4 lg:col-span-7" aria-label="Items in your cart">
              {unavailableItems.length > 0 && (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-[20px] border border-red-500/40 bg-red-500/10 p-4 text-[14px]"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
                    <p className="text-red-200">
                      {unavailableItems.map((i) => i.name).join(", ")}{" "}
                      {unavailableItems.length === 1 ? "is" : "are"} currently unavailable in the kitchen. Remove to place your order.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeUnavailableItems}
                    className="min-h-[40px] self-start rounded-full bg-red-500/20 px-4 text-[13px] font-bold text-red-200 hover:bg-red-500/30"
                  >
                    Remove unavailable {unavailableItems.length === 1 ? "item" : "items"}
                  </button>
                </div>
              )}

              <ul className="space-y-3">
                {items.map((item) => {
                  const art = menuArtwork(item);
                  const baseId = resolveBaseMenuItemId(item);
                  const itemUnavailable = isUnavailable(baseId);
                  const unitPrice = resolveCanonicalUnitPrice(item) ?? item.price;
                  const modParts = [
                    item.weight,
                    item.doneness,
                    item.side ? `Side: ${item.side}` : null,
                    item.sauces && item.sauces.length > 0 ? `+${item.sauces.join(", ")}` : null,
                  ].filter(Boolean);

                  return (
                    <li
                      key={item.id}
                      className={
                        "rounded-[22px] border p-3.5 " +
                        (itemUnavailable
                          ? "border-red-500/45 bg-red-950/20"
                          : "border-white/10 bg-[#242424]")
                      }
                    >
                      <div className="flex items-start gap-3.5">
                        {art.src ? (
                          <img
                            src={art.src}
                            alt={art.isExactDish ? item.name : ""}
                            loading="lazy"
                            decoding="async"
                            className="h-[64px] w-[64px] shrink-0 rounded-[16px] object-cover"
                          />
                        ) : (
                          <span className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[16px] bg-[#303030] text-[#A3A3A3]">
                            <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h2 className="text-[16px] font-bold leading-snug text-white">
                                {item.name}
                              </h2>
                              {itemUnavailable && (
                                <span className="mt-1 inline-block rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-bold text-red-300">
                                  Unavailable in kitchen
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label={`Remove ${item.name}`}
                              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#A3A3A3] transition-colors hover:bg-[#303030] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>

                          {modParts.length > 0 && (
                            <p className="mt-0.5 text-[13px] leading-snug text-[#A3A3A3]">
                              {modParts.join(" · ")}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div>
                              <span className="text-[16px] font-extrabold tabular-nums text-[#FF5A1F]">
                                {formatPrice(unitPrice * item.quantity)}
                              </span>
                              {item.quantity > 1 && (
                                <span className="ml-2 text-[12px] text-[#A3A3A3]">
                                  {formatPrice(unitPrice)} ea
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#181818] p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                aria-label={`Decrease ${item.name} quantity`}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
                              >
                                <Minus className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <output
                                aria-label={`${item.name} quantity`}
                                className="min-w-[24px] text-center text-[15px] font-bold tabular-nums text-white"
                              >
                                {item.quantity}
                              </output>
                              <button
                                type="button"
                                disabled={itemUnavailable}
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                aria-label={`Increase ${item.name} quantity`}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#303030] text-white transition-colors hover:bg-[#FF5A1F] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
                              >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Allergies & Dietary Flagging (honest shared-kitchen disclosure) */}
              <section className="rounded-[22px] border border-white/10 bg-[#242424] p-4" aria-labelledby="dietary-heading">
                <h2 id="dietary-heading" className="text-[15px] font-bold text-white">
                  Allergies &amp; Dietary Notes <span className="font-normal text-[#A3A3A3]">(optional)</span>
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DIETARY_QUICK_FLAGS.map((flag) => {
                    const active = dietaryFlags.includes(flag);
                    return (
                      <button
                        key={flag}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleDietaryFlag(flag)}
                        className={
                          "min-h-[38px] rounded-full border px-3 text-[13px] font-semibold transition-colors " +
                          (active
                            ? "border-[#FF5A1F] bg-[#FF5A1F]/20 text-[#FF5A1F]"
                            : "border-white/10 bg-[#1B1B1B] text-[#A3A3A3] hover:text-white")
                        }
                      >
                        {flag}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  id="cart-dietary-notes"
                  aria-label="Additional allergy or dietary requirements"
                  value={dietaryCustomNote}
                  onChange={(e) => setDietaryCustomNote(e.target.value)}
                  maxLength={240}
                  placeholder="Flag specific allergies or preparation notes for the kitchen..."
                  className="mt-3 h-20 w-full resize-none rounded-xl border border-white/10 bg-[#181818] p-3 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                />
                <p className="mt-2 text-[12px] leading-relaxed text-[#A3A3A3]">
                  Dishes are prepared in a shared kitchen. We cannot guarantee allergen-free preparation — please confirm severe allergies directly with staff or call{" "}
                  <a href="tel:+264832888000" className="text-white underline underline-offset-2">
                    +264 83 288 8000
                  </a>
                  .
                </p>
              </section>
            </section>

            {/* Fulfilment + Honest Summary + Place Order CTA */}
            <div className="mt-6 space-y-5 lg:col-span-5 lg:mt-0">
              <section className="rounded-[22px] border border-white/10 bg-[#242424] p-4" aria-labelledby="order-mode-heading">
                <h2 id="order-mode-heading" className="text-[16px] font-bold text-white">
                  Order Type
                </h2>
                <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#181818] p-1" role="group" aria-label="Choose fulfilment mode">
                  {ORDER_MODES.map((mode) => (
                    <button
                      type="button"
                      key={mode.value}
                      onClick={() => {
                        setOrderType(mode.value);
                        setFormError(null);
                      }}
                      aria-pressed={orderType === mode.value}
                      className={
                        "min-h-[44px] rounded-xl px-2 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                        (orderType === mode.value
                          ? "bg-[#FF5A1F] text-white"
                          : "text-[#A3A3A3] hover:text-white")
                      }
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-[#A3A3A3]">
                  {ORDER_MODES.find((m) => m.value === orderType)?.detail}
                </p>

                <div className="mt-4 space-y-3.5 border-t border-white/10 pt-4">
                  {orderType === "pickup" && (
                    <>
                      <div>
                        <span className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-white">
                          <Clock className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                          Collection time
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {PICKUP_TIMES.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setPickupTime(slot)}
                              aria-pressed={pickupTime === slot}
                              className={
                                "min-h-[44px] rounded-xl border px-2 text-[12px] font-semibold transition-colors " +
                                (pickupTime === slot
                                  ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-[#FF5A1F]"
                                  : "border-white/10 bg-[#1B1B1B] text-[#A3A3A3] hover:text-white")
                              }
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                      {!user && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label htmlFor="pickup-name" className="mb-1.5 block text-[13px] font-medium text-[#A3A3A3]">
                              Your name <span className="text-[#FF5A1F]">*</span>
                            </label>
                            <input
                              id="pickup-name"
                              type="text"
                              value={guestName}
                              onChange={(e) => {
                                setGuestName(e.target.value);
                                setFormError(null);
                              }}
                              placeholder="Name for collection"
                              className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                            />
                          </div>
                          <div>
                            <label htmlFor="pickup-phone" className="mb-1.5 block text-[13px] font-medium text-[#A3A3A3]">
                              Phone (optional)
                            </label>
                            <input
                              id="pickup-phone"
                              type="tel"
                              value={guestPhone}
                              onChange={(e) => setGuestPhone(e.target.value)}
                              placeholder="+264 81 000 0000"
                              className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {orderType === "preorder" && (
                    <>
                      <div>
                        <label htmlFor="preorder-date" className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-white">
                          <CalendarDays className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                          Arrival date
                        </label>
                        <input
                          id="preorder-date"
                          type="date"
                          min={today}
                          value={preorderDate}
                          onChange={(e) => {
                            setPreorderDate(e.target.value);
                            setFormError(null);
                          }}
                          className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white focus:border-[#FF5A1F] focus:outline-none [color-scheme:dark] sm:text-[14px]"
                        />
                      </div>
                      <div>
                        <span className="mb-2 block text-[13px] font-semibold text-white">Arrival time</span>
                        <div className="flex flex-wrap gap-2">
                          {PREORDER_SLOTS.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setPreorderSlot(slot)}
                              aria-pressed={preorderSlot === slot}
                              className={
                                "min-h-[44px] rounded-xl border px-3.5 text-[14px] font-semibold transition-colors " +
                                (preorderSlot === slot
                                  ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                                  : "border-white/10 bg-[#181818] text-[#A3A3A3] hover:text-white")
                              }
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                      {!user && (
                        <div>
                          <label htmlFor="preorder-name" className="mb-1.5 block text-[13px] font-medium text-[#A3A3A3]">
                            Guest name <span className="text-[#FF5A1F]">*</span>
                          </label>
                          <input
                            id="preorder-name"
                            type="text"
                            value={guestName}
                            onChange={(e) => {
                              setGuestName(e.target.value);
                              setFormError(null);
                            }}
                            placeholder="Name for your arrival"
                            className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {orderType === "dinein" && (
                    <div>
                      <label htmlFor="dinein-table" className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-white">
                        <UtensilsCrossed className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                        Table number <span className="text-[#FF5A1F]">*</span>
                      </label>
                      <input
                        id="dinein-table"
                        type="text"
                        value={tableNumber}
                        onChange={(e) => {
                          setTableNumber(e.target.value);
                          setFormError(null);
                        }}
                        placeholder="e.g. Table 12 or Terrace 4"
                        className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                      />
                    </div>
                  )}

                  {formError && (
                    <p role="alert" className="text-[14px] font-semibold text-[#FF5A1F]">
                      {formError}
                    </p>
                  )}
                </div>
              </section>

              {/* Honest N$ Order Summary */}
              <section className="rounded-[22px] border border-white/10 bg-[#242424] p-5" aria-labelledby="summary-heading">
                <h2 id="summary-heading" className="text-[16px] font-bold text-white">
                  Order Summary
                </h2>
                <div className="mt-4 space-y-2.5 text-[14px]">
                  <div className="flex justify-between gap-4">
                    <span className="text-[#A3A3A3]">Service</span>
                    <span className="font-semibold text-white">{serviceSummary}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#A3A3A3]">Subtotal</span>
                    <span className="font-semibold tabular-nums text-white">{formatPrice(canonicalTotalPrice)}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
                  <span className="text-[16px] font-bold text-white">Total</span>
                  <span className="text-[22px] font-extrabold tabular-nums text-[#FF5A1F]">
                    {formatPrice(canonicalTotalPrice)}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[#A3A3A3]">
                  Your order goes directly to the Butcher Block kitchen with an itemized receipt and order number. No card payment is taken in-app — settle at the restaurant.
                </p>

                <button
                  type="button"
                  onClick={() => void handleCheckout()}
                  disabled={submitting || unavailableItems.length > 0}
                  className="mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white transition-colors hover:bg-[#E84D15] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>
                    {submitting
                      ? "Placing Order…"
                      : unavailableItems.length > 0
                        ? "Remove Unavailable Items"
                        : "Place Order"}
                  </span>
                  {!submitting && unavailableItems.length === 0 && (
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
