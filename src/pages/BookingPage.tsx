import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, Minus, Plus, Clock, ListOrdered } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { bookingTimeSlots } from "@/lib/bookingSlots";
import type { BookingNavState } from "@/lib/eventBooking";
import { insertBookingWithArrivalCode } from "@/lib/supabaseArrivalInsert";
import { supabase } from "@/integrations/supabase/client";

const BookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const querySuggestedTime = searchParams.get("time")?.trim() ?? "";
  const planState = (location.state ?? null) as BookingNavState | null;
  const suggestedTime = planState?.suggestedTime?.trim() || querySuggestedTime || "";
  const suggestedGuests = planState?.suggestedGuests;
  const suggestedDate = planState?.suggestedDate?.trim() ?? "";
  const eventTimeSlots = planState?.eventTimeSlots;
  const tablesAlmostFull = Boolean(planState?.tablesAlmostFull);

  const { user, profile } = useAuth();
  const [date, setDate] = useState(() => suggestedDate || new Date().toISOString().split("T")[0]);
  const [selectedTime, setSelectedTime] = useState(() => suggestedTime.trim() || "19:30");
  const [guests, setGuests] = useState(
    typeof suggestedGuests === "number" && suggestedGuests > 0 ? suggestedGuests : 2,
  );
  const [specialRequests, setSpecialRequests] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [waitlistSnap, setWaitlistSnap] = useState<{ position: number; est: number } | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let cancelled = false;
    void (supabase as any).rpc("booked_table_times", { p_date: date }).then(({ data }: any) => {
      if (!cancelled) setBookedTimes((data as string[] | null) ?? []);
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

  const handleConfirm = async () => {
    if (!date || !selectedTime) return;
    if (!user && !guestName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setLoading(true);
    const bookingData = {
      user_id: user?.id || null,
      guest_name: user ? null : guestName,
      guest_phone: user ? null : guestPhone,
      date,
      time: selectedTime,
      guests,
      special_requests: specialRequests || null,
    };

    let arrival_code: string | null = null;
    let assigned_table_code: string | null = null;
    try {
      const res = await insertBookingWithArrivalCode(bookingData);
      arrival_code = res.arrival_code;
      assigned_table_code = res.assigned_table_code;
    } catch {
      toast.error("Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    const localData = {
      date,
      time: selectedTime,
      guests,
      specialRequests,
      createdAt: new Date().toISOString(),
      ...(arrival_code ? { arrival_code } : {}),
      ...(assigned_table_code ? { assigned_table_code } : {}),
    };
    const existing = JSON.parse(localStorage.getItem("berrylicious-bookings") || "[]");
    existing.push(localData);
    localStorage.setItem("berrylicious-bookings", JSON.stringify(existing));

    navigate("/booking/success", { state: localData });
  };

  const recommendTime = useMemo(() => {
    if (suggestedTime && slotOptions.some((s) => s.time === suggestedTime)) return suggestedTime;
    return slotOptions.find((s) => s.time === "19:30")?.time ?? slotOptions[0]?.time ?? "19:30";
  }, [suggestedTime, slotOptions]);

  const bannerTime = recommendTime;

  const fullyBooked = useMemo(() => {
    if (slotOptions.length === 0) return false;
    const taken = new Set(bookedTimes);
    return slotOptions.every((s) => taken.has(s.time));
  }, [slotOptions, bookedTimes]);

  const joinWaitlist = async () => {
    const name = user ? (profile?.display_name?.trim() || "Guest") : guestName.trim();
    const phone = user ? (profile?.phone?.trim() || guestPhone.trim()) : guestPhone.trim();
    if (!user && !name) {
      toast.error("Enter your name");
      return;
    }
    if (phone.length < 6) {
      toast.error("Add a phone number so we can text you when a table opens");
      return;
    }
    setWaitlistBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("join_waitlist", {
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
      toast.success("You’re on the waitlist");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t join waitlist");
    } finally {
      setWaitlistBusy(false);
    }
  };

  return (
    <div className="min-h-screen pb-safe-nav px-6 pt-6 max-w-lg mx-auto animate-fade-in">
      <h1 className="font-display text-3xl font-bold mb-4">Book a table</h1>

      <div className="mb-6 rounded-2xl glass-card px-4 py-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Best time tonight:{" "}
          <span className="font-semibold text-foreground">{bannerTime}</span>
          {tablesAlmostFull ? " · Almost full" : " · Tables open"}
          {eventTimeSlots?.length && date === suggestedDate && suggestedDate ? " · Event night" : ""}
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {suggestedDate && eventTimeSlots?.length
            ? "Pre-filled from your event — change only if you need to."
            : "Your best slot is highlighted — confirm when you’re ready."}
        </p>
        {fullyBooked && (
          <p className="mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
            Every listed time is taken for this date — join the waitlist below or pick another night.
          </p>
        )}
      </div>

      {/* Times — confirm, don’t invent */}
      <div className="mb-8 animate-fade-in">
        <label className="text-sm font-semibold text-foreground mb-3 block">
          {eventTimeSlots?.length && date === suggestedDate ? "Your open times" : "Pick your time"}
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slotOptions.map((slot) => {
            const isSuggested = slot.time === recommendTime;
            const selected = selectedTime === slot.time;
            return (
              <button
                key={slot.time}
                type="button"
                onClick={() => setSelectedTime(slot.time)}
                className={`shrink-0 px-4 py-3 rounded-xl text-sm font-medium border-2 flex flex-col items-start gap-0.5 btn-press transition-transform ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground scale-[1.03] shadow-lg shadow-primary/25 ring-2 ring-primary/30"
                    : isSuggested
                      ? "border-primary bg-primary/20 text-foreground shadow-sm shadow-primary/10"
                      : "border-border glass-subtle text-foreground hover:border-primary/35"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="font-bold">{slot.time}</span>
                </span>
                <span className={`text-xs pl-6 ${selected ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                  {slot.label}
                  {isSuggested && !selected ? " · suggested" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date */}
      <div className="mb-6 animate-fade-in">
        <label className="text-sm text-muted-foreground font-medium mb-2 block">Date</label>
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full glass-subtle border-0 rounded-lg py-3 pl-10 pr-4 text-foreground focus:outline-none focus:border-primary transition-colors [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Guests */}
      <div className="mb-6 animate-fade-in">
        <label className="text-sm text-muted-foreground font-medium mb-2 block">Guests</label>
        <div className="flex items-center gap-4 glass-subtle rounded-lg p-3">
          <button
            onClick={() => setGuests(Math.max(1, guests - 1))}
            className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
          >
            <Minus className="w-5 h-5 text-foreground" />
          </button>
          <span className="text-2xl font-semibold text-foreground min-w-[40px] text-center">{guests}</span>
          <button
            onClick={() => setGuests(Math.min(20, guests + 1))}
            className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
          >
            <Plus className="w-5 h-5 text-foreground" />
          </button>
          <span className="text-muted-foreground text-sm ml-1">guest{guests > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Guest info (only if not logged in) */}
      {!user && (
        <div className="mb-6 space-y-4 animate-fade-in">
          <div>
            <label className="text-sm text-muted-foreground font-medium mb-2 block">Your Name</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-card border border-border rounded-lg py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground font-medium mb-2 block">Phone (optional)</label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+264 81 234 5678"
              className="w-full bg-card border border-border rounded-lg py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      )}

      {/* Special Requests */}
      <div className="mb-8 animate-fade-in">
        <label className="text-sm text-muted-foreground font-medium mb-2 block">Any special requests? (optional)</label>
        <textarea
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder="Birthday celebration, dietary needs, window seat..."
          className="w-full bg-card border border-border rounded-lg py-3 px-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors resize-none h-24"
        />
      </div>

      {/* Waitlist */}
      <div className="mb-8 rounded-2xl glass-card px-4 py-4">
        <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
          <ListOrdered className="w-4 h-4 text-primary shrink-0" />
          Smart waitlist
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          {fullyBooked
            ? "No open slots in this list? Join the queue — we’ll prioritise you when tables turn."
            : "Prefer to queue instead? We’ll estimate your spot and wait time."}
        </p>
        {waitlistSnap ? (
          <p className="text-sm text-foreground">
            You’re #{waitlistSnap.position} in line · ~{waitlistSnap.est} min estimated. Stay close — we’ll reach out
            when you’re up.
          </p>
        ) : (
          <button
            type="button"
            disabled={waitlistBusy}
            onClick={() => void joinWaitlist()}
            className="w-full rounded-xl border border-primary/50 bg-primary/10 py-3 text-sm font-bold text-primary btn-press disabled:opacity-50"
          >
            {waitlistBusy ? "Joining…" : "Join waitlist for this date"}
          </button>
        )}
      </div>

      {/* Confirm */}
      <button
        onClick={handleConfirm}
        disabled={!date || !selectedTime || loading || fullyBooked}
        className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl btn-press disabled:opacity-40 disabled:cursor-not-allowed text-base"
      >
        {loading ? "Booking…" : fullyBooked ? "No open times — use waitlist above" : "Confirm my table"}
      </button>
    </div>
  );
};

export default BookingPage;
