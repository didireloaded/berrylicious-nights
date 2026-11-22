import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Info, ListOrdered, Minus, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { bookingTimeSlots } from "@/lib/bookingSlots";
import type { BookingNavState } from "@/lib/eventBooking";
import { insertBookingWithArrivalCode, isBookingSlotConflictError } from "@/lib/supabaseArrivalInsert";
import { supabase } from "@/integrations/supabase/client";
import { parseRpcBookedTimes } from "@/lib/bookingRpc";
import { getWindhoekDateISO } from "@/lib/windhoekDate";

type RpcSupabaseClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

const rpcClient = supabase as unknown as RpcSupabaseClient;

type DayChip = {
  iso: string;
  weekday: string;
  dayNum: string;
  monthShort: string;
};

function buildWindhoekDateStrip(startISO: string, days = 14): DayChip[] {
  const [y, m, d] = startISO.split("-").map(Number);
  const baseUtc = Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0);
  const result: DayChip[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const dt = new Date(baseUtc + offset * 86_400_000);
    const iso = dt.toISOString().slice(0, 10);
    const weekday = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const dayNum = String(dt.getUTCDate());
    const monthShort = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    result.push({ iso, weekday, dayNum, monthShort });
  }
  return result;
}

const BookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const querySuggestedTime = searchParams.get("time")?.trim() ?? "";
  const planState = (location.state ?? null) as BookingNavState | null;
  const suggestedTime = planState?.suggestedTime?.trim() || querySuggestedTime || "";
  const suggestedGuests = planState?.suggestedGuests;
  const suggestedDate = planState?.suggestedDate?.trim() ?? "";
  const eventTitle = planState?.eventTitle?.trim() ?? "";
  const eventTimeSlots = planState?.eventTimeSlots;

  const { user, profile } = useAuth();
  const today = getWindhoekDateISO();
  const dateStrip = useMemo(() => buildWindhoekDateStrip(today, 14), [today]);

  const [date, setDate] = useState(() => suggestedDate || today);
  const [selectedTime, setSelectedTime] = useState(() => suggestedTime.trim() || "19:30");
  const [guests, setGuests] = useState(
    typeof suggestedGuests === "number" && suggestedGuests > 0 ? suggestedGuests : 2,
  );
  const [specialRequests, setSpecialRequests] = useState(() => (eventTitle ? `Event: ${eventTitle}` : ""));
  const [guestName, setGuestName] = useState(() => {
    try {
      return localStorage.getItem("butcher-block-guest-name") || "";
    } catch {
      return "";
    }
  });
  const [guestPhone, setGuestPhone] = useState(() => {
    try {
      return localStorage.getItem("butcher-block-guest-phone") || "";
    } catch {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [checkingTimes, setCheckingTimes] = useState(true);
  const [timesError, setTimesError] = useState(false);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [waitlistSnap, setWaitlistSnap] = useState<{ position: number; est: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCheckingTimes(true);
    setTimesError(false);
    setBookedTimes([]);
    setWaitlistSnap(null);
    void Promise.resolve(rpcClient.rpc("booked_table_times", { p_date: date }))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;
        setBookedTimes(parseRpcBookedTimes(data));
      })
      .catch(() => {
        if (!cancelled) setTimesError(true);
      })
      .finally(() => {
        if (!cancelled) setCheckingTimes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const slotOptions = useMemo(() => {
    if (eventTimeSlots?.length && date === suggestedDate && suggestedDate) {
      const allowed = new Set(eventTimeSlots);
      const filtered = bookingTimeSlots.filter((s) => allowed.has(s.time));
      return filtered.length > 0 ? filtered : [...bookingTimeSlots];
    }
    return [...bookingTimeSlots];
  }, [eventTimeSlots, date, suggestedDate]);

  useEffect(() => {
    if (!slotOptions.length) return;
    if (!selectedTime || !slotOptions.some((s) => s.time === selectedTime)) {
      setSelectedTime(slotOptions[0].time);
    }
  }, [slotOptions, selectedTime]);

  useEffect(() => {
    if (checkingTimes || timesError || !bookedTimes.includes(selectedTime)) return;
    const nextOpenSlot = slotOptions.find((slot) => !bookedTimes.includes(slot.time));
    if (nextOpenSlot) setSelectedTime(nextOpenSlot.time);
  }, [checkingTimes, timesError, bookedTimes, selectedTime, slotOptions]);

  const fullyBooked = useMemo(() => {
    if (slotOptions.length === 0) return false;
    const taken = new Set(bookedTimes);
    return slotOptions.every((s) => taken.has(s.time));
  }, [slotOptions, bookedTimes]);

  const handleConfirm = async () => {
    if (loading || !date || !selectedTime) return;
    if (checkingTimes || timesError) {
      toast.error("Availability could not be verified. Please retry or pick another date.");
      return;
    }
    if (bookedTimes.includes(selectedTime)) {
      toast.error("That time is unavailable. Please select another slot.");
      return;
    }
    if (!user && !guestName.trim()) {
      toast.error("Please enter your name for the reservation.");
      return;
    }

    setLoading(true);
    // Mandatory pre-submit recheck against Supabase availability RPC
    try {
      const { data, error } = await rpcClient.rpc("booked_table_times", { p_date: date });
      if (error) throw error;
      const latestBooked = parseRpcBookedTimes(data);
      if (latestBooked.includes(selectedTime)) {
        setBookedTimes(latestBooked);
        toast.error("That table time has just been taken. Please pick another time.");
        setLoading(false);
        return;
      }
    } catch {
      toast.error("We couldn't verify live availability. Nothing was booked — please try again.");
      setLoading(false);
      return;
    }

    const bookingData = {
      user_id: user?.id || null,
      guest_name: user ? null : guestName.trim(),
      guest_phone: user ? null : guestPhone.trim() || null,
      date,
      time: selectedTime,
      guests,
      special_requests: specialRequests.trim() || null,
    };

    let booking_id: string | null = null;
    let arrival_code: string | null = null;
    let assigned_table_code: string | null = null;
    try {
      const res = await insertBookingWithArrivalCode(bookingData);
      booking_id = res.booking_id;
      arrival_code = res.arrival_code;
      assigned_table_code = res.assigned_table_code;
    } catch (err) {
      if (isBookingSlotConflictError(err)) {
        try {
          const { data } = await rpcClient.rpc("booked_table_times", { p_date: date });
          setBookedTimes(parseRpcBookedTimes(data));
        } catch {
          /* ignore secondary refresh error */
        }
        toast.error("That table slot was just booked by another guest. Available times have been updated.");
      } else {
        toast.error("Could not complete your reservation. Please try again.");
      }
      setLoading(false);
      return;
    }

    try {
      if (!user && guestName.trim()) localStorage.setItem("butcher-block-guest-name", guestName.trim());
      if (!user && guestPhone.trim()) localStorage.setItem("butcher-block-guest-phone", guestPhone.trim());
    } catch {
      /* ignore storage errors */
    }

    const reservation_number =
      arrival_code || (booking_id ? `BB-${booking_id.slice(0, 6).toUpperCase()}` : null);

    const localData = {
      ...(booking_id ? { id: booking_id } : {}),
      date,
      time: selectedTime,
      guests,
      specialRequests: specialRequests.trim(),
      ...(eventTitle ? { eventTitle } : {}),
      createdAt: new Date().toISOString(),
      ...(arrival_code ? { arrival_code } : {}),
      ...(reservation_number ? { reservation_number } : {}),
      ...(assigned_table_code ? { assigned_table_code } : {}),
    };

    try {
      const existing = JSON.parse(localStorage.getItem("berrylicious-bookings") || "[]");
      if (Array.isArray(existing)) {
        existing.push(localData);
        localStorage.setItem("berrylicious-bookings", JSON.stringify(existing));
      }
    } catch {
      /* ignore local history errors */
    }

    navigate("/booking/success", { state: localData });
  };

  const joinWaitlist = async () => {
    const name = user ? (profile?.display_name?.trim() || "Guest") : guestName.trim();
    const phone = user ? (profile?.phone?.trim() || guestPhone.trim()) : guestPhone.trim();
    if (!user && !name) {
      toast.error("Please enter your name");
      return;
    }
    if (phone.length < 6) {
      toast.error("Add a phone number Butcher Block can use to contact you");
      return;
    }
    setWaitlistBusy(true);
    try {
      const { data, error } = await rpcClient.rpc("join_waitlist", {
        p_party_size: guests,
        p_preferred_date: date,
        p_guest_name: name,
        p_guest_phone: phone,
      });
      if (error) throw error;
      const j = data as unknown as { position?: number; estimated_wait_minutes?: number } | null;
      setWaitlistSnap({
        position: Number(j?.position) || 1,
        est: Number(j?.estimated_wait_minutes) || 15,
      });
      toast.success("You're on the waitlist");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't join waitlist");
    } finally {
      setWaitlistBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#121212] pb-32 text-white lg:pb-16">
      <div className="mx-auto max-w-[560px] px-5 pt-[max(20px,env(safe-area-inset-top,0px))] sm:px-6 lg:max-w-2xl lg:pt-8">
        {/* Clean iOS Header matching reference */}
        <header className="flex items-center gap-3">
          <Link
            to="/home"
            aria-label="Back to home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="font-display text-[24px] font-extrabold tracking-[-0.035em] text-white">
              Reserve a Table
            </h1>
            <p className="text-[13px] text-[#A3A3A3]">Am Weinberg Estate · Windhoek</p>
          </div>
        </header>

        {eventTitle && (
          <div className="mt-5 inline-flex items-center rounded-full border border-[#FF5A1F]/40 bg-[#FF5A1F]/15 px-4 py-1.5 text-[13px] font-bold text-[#FF5A1F]">
            Reserving for: {eventTitle}
          </div>
        )}

        {/* Horizontal Windhoek Date Strip matching approved reference */}
        <section className="mt-6" aria-labelledby="select-date-heading">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="select-date-heading" className="text-[15px] font-bold text-white">
              Select Date
            </h2>
            <span className="text-[13px] text-[#A3A3A3]">{date}</span>
          </div>

          <div
            role="group"
            aria-label="Quick date selection"
            className="-mx-5 mt-3 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 scrollbar-hide sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
          >
            {dateStrip.map((chip) => {
              const active = date === chip.iso;
              return (
                <button
                  key={chip.iso}
                  type="button"
                  onClick={() => setDate(chip.iso)}
                  aria-pressed={active}
                  className={
                    "flex min-h-[76px] min-w-[62px] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] " +
                    (active
                      ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                      : "border-white/10 bg-[#242424] text-white/85 hover:bg-[#303030]")
                  }
                >
                  <span className={"text-[12px] font-medium " + (active ? "text-white/90" : "text-[#A3A3A3]")}>
                    {chip.weekday}
                  </span>
                  <span className="text-[20px] font-extrabold leading-tight tabular-nums">
                    {chip.dayNum}
                  </span>
                  <span className={"text-[11px] font-medium " + (active ? "text-white/85" : "text-[#737373]")}>
                    {chip.monthShort}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Native date picker for further-out dates */}
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#242424] px-3.5 py-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
            <label htmlFor="booking-custom-date" className="text-[13px] font-medium text-[#A3A3A3]">
              Other date:
            </label>
            <input
              id="booking-custom-date"
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[38px] flex-1 bg-transparent text-right text-[14px] font-semibold text-white focus:outline-none [color-scheme:dark]"
            />
          </div>
        </section>

        {/* Select Time pills matching approved reference */}
        <section className="mt-7" aria-labelledby="select-time-heading">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="select-time-heading" className="text-[15px] font-bold text-white">
              Select Time
            </h2>
            <span className="text-[13px] text-[#A3A3A3]">
              {checkingTimes ? "Checking live tables…" : timesError ? "Availability unavailable" : "Windhoek time"}
            </span>
          </div>

          {timesError && (
            <p role="alert" className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-[14px] text-amber-200">
              We couldn&apos;t verify table availability for this date. Please retry or pick another date before booking.
            </p>
          )}

          {fullyBooked && !checkingTimes && !timesError && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#242424] p-3.5 text-[14px] text-white/85">
              <span>All listed times are currently taken for {date}. Join the waitlist below or check the next day.</span>
              <button
                type="button"
                onClick={() => {
                  const idx = dateStrip.findIndex((c) => c.iso === date);
                  if (idx >= 0 && idx + 1 < dateStrip.length) {
                    setDate(dateStrip[idx + 1].iso);
                  } else {
                    const [y, m, d] = date.split("-").map(Number);
                    const next = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + 1, 12, 0, 0));
                    setDate(next.toISOString().slice(0, 10));
                  }
                }}
                className="min-h-[38px] rounded-full bg-[#FF5A1F] px-3.5 text-[13px] font-bold text-white"
              >
                Try next day
              </button>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {slotOptions.map((slot) => {
              const isBooked = bookedTimes.includes(slot.time);
              const selected = selectedTime === slot.time && !isBooked;
              return (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setSelectedTime(slot.time)}
                  disabled={checkingTimes || timesError || isBooked}
                  aria-pressed={selected}
                  aria-label={`${slot.time}, ${isBooked ? "unavailable" : slot.label}`}
                  className={
                    "flex min-h-[54px] flex-col items-center justify-center rounded-2xl border px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] disabled:cursor-not-allowed " +
                    (isBooked
                      ? "border-white/5 bg-[#1B1B1B] text-[#737373] line-through opacity-45"
                      : selected
                        ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                        : "border-white/10 bg-[#242424] text-white hover:bg-[#303030]")
                  }
                >
                  <span className="text-[15px] font-bold tabular-nums">{slot.time}</span>
                  <span className={"text-[11px] font-medium " + (selected ? "text-white/90" : "text-[#A3A3A3]")}>
                    {isBooked ? "Taken" : slot.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Guests Counter */}
        <section className="mt-7" aria-labelledby="guests-heading">
          <h2 id="guests-heading" className="text-[15px] font-bold text-white">
            Guests
          </h2>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-[#242424] px-4 py-3">
            <span className="text-[15px] font-medium text-[#A3A3A3]">
              Party size
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease guests"
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#303030] text-white transition-colors hover:bg-[#3A3A3A] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <output aria-label="Number of guests" className="min-w-[32px] text-center text-[18px] font-extrabold tabular-nums text-white">
                {guests}
              </output>
              <button
                type="button"
                aria-label="Increase guests"
                onClick={() => setGuests(Math.min(20, guests + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF5A1F] text-white transition-colors hover:bg-[#E84D15] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* Guest Information (when not signed in) */}
        {!user && (
          <section className="mt-7 space-y-3.5" aria-label="Guest details">
            <h2 className="text-[15px] font-bold text-white">Guest Details</h2>
            <div>
              <label htmlFor="booking-guest-name" className="mb-1.5 block text-[13px] font-medium text-[#A3A3A3]">
                Your Name <span className="text-[#FF5A1F]">*</span>
              </label>
              <input
                id="booking-guest-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-[#242424] px-4 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[15px]"
              />
            </div>
            <div>
              <label htmlFor="booking-guest-phone" className="mb-1.5 block text-[13px] font-medium text-[#A3A3A3]">
                Phone (optional)
              </label>
              <input
                id="booking-guest-phone"
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+264 81 234 5678"
                className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-[#242424] px-4 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[15px]"
              />
            </div>
          </section>
        )}

        {/* Special Requests */}
        <section className="mt-7">
          <label htmlFor="booking-notes" className="mb-2 block text-[15px] font-bold text-white">
            Special Requests <span className="font-normal text-[#A3A3A3]">(optional)</span>
          </label>
          <textarea
            id="booking-notes"
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Birthday celebration, dietary requirements, terrace seating..."
            className="h-24 w-full resize-none rounded-2xl border border-white/10 bg-[#242424] p-4 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[15px]"
          />
        </section>

        {/* Confirm CTA */}
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={
            !date ||
            !selectedTime ||
            loading ||
            checkingTimes ||
            timesError ||
            bookedTimes.includes(selectedTime) ||
            fullyBooked
          }
          className="mt-7 flex min-h-[54px] w-full items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[16px] font-bold text-white transition-colors hover:bg-[#E84D15] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {loading
            ? "Confirming Reservation…"
            : checkingTimes
              ? "Checking Availability…"
              : timesError
                ? "Availability Unavailable"
                : fullyBooked
                  ? "No Open Times — Join Waitlist Below"
                  : "Confirm Reservation"}
        </button>

        {/* Reservation & Cancellation Policy */}
        <section className="mt-6 flex items-start gap-3 rounded-[20px] border border-white/10 bg-[#1B1B1B] p-4 text-[13px] leading-relaxed text-[#A3A3A3]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
          <p>
            Tables are held for 15 minutes past your booking time. Running late, modifying party size, or cancelling? Call Butcher Block on{" "}
            <a href="tel:+264832888000" className="font-semibold text-white underline underline-offset-2">
              +264 83 288 8000
            </a>
            .
          </p>
        </section>

        {/* Smart Waitlist preserved */}
        <section className="mt-6 rounded-[22px] border border-white/10 bg-[#242424] p-4">
          <div className="flex items-center gap-2 text-[15px] font-bold text-white">
            <ListOrdered className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            Smart Waitlist
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-[#A3A3A3]">
            Prefer to queue for {date}? We&apos;ll notify you if an earlier table opens up.
          </p>
          {waitlistSnap ? (
            <p className="mt-3 text-[14px] font-semibold text-white">
              You&apos;re #{waitlistSnap.position} in line · ~{waitlistSnap.est} min estimated.
            </p>
          ) : (
            <button
              type="button"
              disabled={waitlistBusy}
              onClick={() => void joinWaitlist()}
              className="mt-3 min-h-[44px] w-full rounded-full border border-white/15 bg-[#303030] text-[14px] font-semibold text-white transition-colors hover:bg-[#3A3A3A] disabled:opacity-50"
            >
              {waitlistBusy ? "Joining waitlist…" : "Join waitlist for this date"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
};

export default BookingPage;
