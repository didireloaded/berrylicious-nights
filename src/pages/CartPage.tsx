import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Minus, Plus, Search, ShoppingBag, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/vibe";
import { menuArtwork } from "@/lib/menuArtwork";
import { saveOrderSnapshotForTracking, type TrackableOrderSnapshot } from "@/lib/orderTrackingStorage";
import { insertOrderWithArrivalCode } from "@/lib/supabaseArrivalInsert";
import { getWindhoekDateISO } from "@/lib/windhoekDate";

type OrderType = "preorder" | "pickup" | "dinein";

const options: { value: OrderType; label: string; detail: string }[] = [
  { value: "pickup", label: "Pickup", detail: "Collect at the Butcher Block counter when the kitchen marks it ready." },
  { value: "preorder", label: "Pre-order", detail: "Schedule ahead so the grill fires right before you arrive." },
  { value: "dinein", label: "Dine-in", detail: "Send straight to the kitchen from your table." },
];

const PICKUP_TIMES = ["ASAP (~25 min)", "In 45 min", "In 1 hour"];
const PREORDER_SLOTS = ["12:30", "18:00", "19:30", "20:00", "21:00"];

function readStoredGuest(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice, clearCart, totalItems } = useCart();
  const { user, profile, refreshProfile } = useAuth();
  const { setCurrentOrder } = useApp();
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
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCheckout() {
    if (submitting || items.length === 0) return;
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

    try {
      if (guestName.trim()) localStorage.setItem("butcher-block-guest-name", guestName.trim());
      if (guestPhone.trim()) localStorage.setItem("butcher-block-guest-phone", guestPhone.trim());
    } catch {
      /* ignore storage errors */
    }

    const scheduledTime =
      orderType === "pickup"
        ? pickupTime
        : orderType === "preorder"
          ? `${preorderDate} at ${preorderSlot}`
          : null;

    setSubmitting(true);
    const orderItems = items.map((item) => ({
      name: item.name,
      qty: item.quantity,
      price: item.price,
      ...(item.weight ? { weight: item.weight } : {}),
      ...(item.doneness ? { doneness: item.doneness } : {}),
      ...(item.side ? { side: item.side } : {}),
      ...(item.sauces?.length ? { sauces: item.sauces } : {}),
    }));
    const total = totalPrice;
    let orderId: string;
    let arrivalCode: string | null = null;
    try {
      const row = await insertOrderWithArrivalCode({
        user_id: user?.id || null,
        items: orderItems,
        total,
        order_type: orderType,
      });
      orderId = row.id;
      arrivalCode = row.arrival_code ?? null;
    } catch (error) {
      console.error("[CartPage] Unable to place order", error);
      toast.error("Your order could not be placed. Nothing was submitted. Please try again.");
      setSubmitting(false);
      return;
    }

    // Guest RLS blocks SELECT on orders even though INSERT succeeded.
    // Only fetch the row back for signed-in users; guests track from the saved snapshot.
    let full: Record<string, unknown> | null = null;
    if (user) {
      try {
        const response = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
        full = response.data as Record<string, unknown> | null;
      } catch {
        // The server already accepted the order, so continue with local tracking.
      }
    }

    const snapshot: TrackableOrderSnapshot = {
      id: orderId,
      items: full?.items ?? orderItems,
      total: Number(full?.total ?? total),
      status: String(full?.status ?? "pending"),
      order_type: typeof full?.order_type === "string" ? full.order_type : orderType,
      table_number: orderType === "dinein" ? resolvedTable : null,
      scheduled_time: scheduledTime,
      guest_name: resolvedName || null,
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
          items: orderItems,
          total,
          status: snapshot.status,
          order_type: orderType,
          table_number: snapshot.table_number,
          scheduled_time: snapshot.scheduled_time,
          guest_name: snapshot.guest_name,
          createdAt: snapshot.created_at,
          arrival_code: snapshot.arrival_code,
        });
        localStorage.setItem("berrylicious-orders", JSON.stringify(saved));
      }
    } catch {
      // An unavailable local history must not interrupt a successful restaurant order.
    }

    clearCart();
    toast.success("Order confirmed — here is your receipt");
    navigate(`/order/${orderId}`);
    setSubmitting(false);
    if (refreshProfile) void Promise.resolve(refreshProfile()).catch(() => undefined);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] bg-[#121212] px-5 pb-36 pt-[max(24px,env(safe-area-inset-top,0px))] text-white sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <Link to="/menu" aria-label="Return to the menu" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-[20px] font-semibold tracking-[-0.04em]">Your cart</h1>
        <Link to="/menu?focusSearch=1" aria-label="Search the menu" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
          <Search className="h-5 w-5" aria-hidden="true" />
        </Link>
      </header>

      {items.length === 0 ? (
        <section className="flex min-h-[58dvh] flex-col items-center justify-center px-5 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#242424] text-[#ff7044]">
            <ShoppingBag className="h-9 w-9" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2 className="mt-7 text-[32px] font-extrabold leading-tight tracking-[-0.06em]">Your bag is empty.</h2>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/55">Find a dish or drink you love, then add it here to place an order.</p>
          <Link to="/menu" className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#ff5a1f] px-7 text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Explore the menu <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <>
          <div className="mt-10 flex items-baseline justify-between">
            <h2 className="text-[30px] font-extrabold tracking-[-0.06em]">Your selection</h2>
            <span className="text-[14px] font-medium text-white/50">{totalItems} {totalItems === 1 ? "item" : "items"}</span>
          </div>

          <ul className="mt-6 space-y-3" aria-label="Items in your cart">
            {items.map((item) => {
              const art = menuArtwork(item);
              return (
                <li key={item.id} className="rounded-[24px] border border-white/10 bg-[#242424] p-4">
                  <div className="flex items-start gap-3">
                    {art.src ? (
                      <img src={art.src} alt={item.name} className="h-[67px] w-[67px] shrink-0 rounded-[19px] object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <span className="flex h-[67px] w-[67px] shrink-0 items-center justify-center rounded-[19px] bg-[#333] text-[10px] font-bold uppercase tracking-wide text-white/60">{item.category}</span>
                    )}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h3 className="text-[16px] font-semibold leading-tight tracking-[-0.025em]">{item.name}</h3>
                      {(item.weight || item.doneness || item.side || (item.sauces && item.sauces.length > 0)) ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.weight && (
                            <span className="rounded-full bg-[#171717] px-2.5 py-0.5 text-[11px] font-medium text-white/85">
                              {item.weight}
                            </span>
                          )}
                          {item.doneness && (
                            <span className="rounded-full bg-[#ff5a1f]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#ff8055]">
                              {item.doneness}
                            </span>
                          )}
                          {item.side && (
                            <span className="rounded-full bg-[#171717] px-2.5 py-0.5 text-[11px] text-white/70">
                              Side: {item.side}
                            </span>
                          )}
                          {item.sauces && item.sauces.length > 0 && (
                            <span className="rounded-full bg-[#171717] px-2.5 py-0.5 text-[11px] text-white/70">
                              Sauce: {item.sauces.join(", ")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-white/50">{item.description}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <div className="min-w-0">
                      <span className="text-[17px] font-bold tabular-nums text-[#ff8055]">{formatPrice(item.price * item.quantity)}</span>
                      {item.quantity > 1 && <span className="mt-0.5 block text-xs text-white/45">{formatPrice(item.price)} each</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-[#171717] p-1">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label={`Decrease ${item.name} quantity`} className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <output aria-label={`${item.name} quantity`} className="min-w-[17px] text-center text-[14px] font-semibold tabular-nums">{item.quantity}</output>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label={`Increase ${item.name} quantity`} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <section className="mt-10" aria-labelledby="order-type-heading">
            <h2 id="order-type-heading" className="text-[22px] font-bold tracking-[-0.04em]">How will you order?</h2>
            <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Choose order type">
              {options.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    setOrderType(option.value);
                    setFormError(null);
                  }}
                  aria-pressed={orderType === option.value}
                  className={
                    "min-h-[54px] rounded-2xl border px-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] " +
                    (orderType === option.value ? "border-[#ff5a1f] bg-[#ff5a1f] text-white" : "border-white/15 bg-[#242424] text-white/75 hover:border-white/35")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/55">{options.find((option) => option.value === orderType)?.detail}</p>

            {/* Fulfillment-specific details */}
            <div className="mt-4 rounded-[24px] border border-white/10 bg-[#1c1c1c] p-4 space-y-4">
              {orderType === "pickup" && (
                <>
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      <Clock className="h-3.5 w-3.5 text-[#ff7b50]" aria-hidden="true" />
                      Pickup time
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PICKUP_TIMES.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setPickupTime(slot)}
                          aria-pressed={pickupTime === slot}
                          className={
                            "min-h-10 rounded-xl border px-2 text-[12px] font-semibold transition-colors " +
                            (pickupTime === slot
                              ? "border-[#ff5a1f] bg-[#ff5a1f]/20 text-[#ff8055]"
                              : "border-white/15 bg-[#242424] text-white/75 hover:border-white/30")
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
                        <label htmlFor="pickup-name" className="mb-1.5 block text-[12px] font-medium text-white/65">
                          Name for pickup <span className="text-[#ff7b50]">*</span>
                        </label>
                        <input
                          id="pickup-name"
                          type="text"
                          value={guestName}
                          onChange={(e) => {
                            setGuestName(e.target.value);
                            setFormError(null);
                          }}
                          placeholder="Your name"
                          className="h-11 w-full rounded-xl border border-white/15 bg-[#242424] px-3.5 text-[14px] text-white placeholder:text-white/35 focus:border-[#ff5a1f] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="pickup-phone" className="mb-1.5 block text-[12px] font-medium text-white/65">
                          Phone (optional)
                        </label>
                        <input
                          id="pickup-phone"
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="+264 81 000 0000"
                          className="h-11 w-full rounded-xl border border-white/15 bg-[#242424] px-3.5 text-[14px] text-white placeholder:text-white/35 focus:border-[#ff5a1f] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {orderType === "preorder" && (
                <>
                  <div>
                    <label htmlFor="preorder-date" className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      <CalendarDays className="h-3.5 w-3.5 text-[#ff7b50]" aria-hidden="true" />
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
                      className="h-11 w-full rounded-xl border border-white/15 bg-[#242424] px-3.5 text-[14px] text-white focus:border-[#ff5a1f] focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      Arrival time
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {PREORDER_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setPreorderSlot(slot)}
                          aria-pressed={preorderSlot === slot}
                          className={
                            "min-h-10 rounded-xl border px-3.5 text-[13px] font-semibold transition-colors " +
                            (preorderSlot === slot
                              ? "border-[#ff5a1f] bg-[#ff5a1f]/20 text-[#ff8055]"
                              : "border-white/15 bg-[#242424] text-white/75 hover:border-white/30")
                          }
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!user && (
                    <div>
                      <label htmlFor="preorder-name" className="mb-1.5 block text-[12px] font-medium text-white/65">
                        Guest name <span className="text-[#ff7b50]">*</span>
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
                        className="h-11 w-full rounded-xl border border-white/15 bg-[#242424] px-3.5 text-[14px] text-white placeholder:text-white/35 focus:border-[#ff5a1f] focus:outline-none"
                      />
                    </div>
                  )}
                </>
              )}

              {orderType === "dinein" && (
                <div>
                  <label htmlFor="dinein-table" className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-[#ff7b50]" aria-hidden="true" />
                    Table number <span className="text-[#ff7b50]">*</span>
                  </label>
                  <input
                    id="dinein-table"
                    type="text"
                    inputMode="text"
                    value={tableNumber}
                    onChange={(e) => {
                      setTableNumber(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="e.g. Table 12 or Terrace 4"
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#242424] px-3.5 text-[14px] text-white placeholder:text-white/35 focus:border-[#ff5a1f] focus:outline-none"
                  />
                  <p className="mt-1.5 text-[12px] text-white/45">
                    Your server and the grill pass will bring dishes directly to this table.
                  </p>
                </div>
              )}

              {formError && (
                <p role="alert" className="text-[13px] font-medium text-[#ff8055]">
                  {formError}
                </p>
              )}
            </div>
          </section>

          <section className="mt-8 rounded-[26px] border border-white/10 bg-[#242424] p-5" aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="text-[22px] font-bold tracking-[-0.04em]">Order summary</h2>
            <div className="mt-5 flex justify-between gap-4 text-[14px] text-white/60">
              <span>Service</span>
              <span className="font-medium text-white">
                {orderType === "dinein"
                  ? tableNumber.trim()
                    ? `Dine-in · ${tableNumber.trim()}`
                    : "Dine-in"
                  : orderType === "preorder"
                    ? `Pre-order · ${preorderDate} ${preorderSlot}`
                    : `Pickup · ${pickupTime}`}
              </span>
            </div>
            <div className="mt-2.5 flex justify-between gap-4 text-[14px] text-white/60">
              <span>Subtotal</span>
              <span className="font-medium text-white">{formatPrice(totalPrice)}</span>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex justify-between gap-4 text-[15px] font-semibold">
                <span>Total</span>
                <span className="text-[23px] font-extrabold tabular-nums">{formatPrice(totalPrice)}</span>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-white/50">
              Your order is sent directly to the Butcher Block kitchen and generates an itemized receipt with your order number. Settle at the restaurant.
            </p>
          </section>

          <div className="sticky bottom-[calc(91px+env(safe-area-inset-bottom,0px))] z-30 -mx-5 mt-6 border-t border-white/10 bg-[#121212]/95 px-5 py-4 backdrop-blur-lg sm:-mx-8 sm:px-8">
            <button
              type="button"
              onClick={() => void handleCheckout()}
              disabled={submitting}
              className="flex min-h-[58px] w-full items-center justify-between gap-4 rounded-full bg-[#ff5a1f] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#f77043] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>{submitting ? "Placing your order…" : "Place order"}</span>
              <span className="flex items-center gap-2 font-bold tabular-nums">
                {formatPrice(totalPrice)} {!submitting && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
