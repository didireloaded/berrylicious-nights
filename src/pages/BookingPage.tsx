import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Minus, Plus, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const timeSlots = [
  { time: "18:00", label: "Quiet" },
  { time: "19:30", label: "Best Time" },
  { time: "20:00", label: "Popular" },
  { time: "21:00", label: "Lively" },
];

const BookingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [date, setDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [guests, setGuests] = useState(2);
  const [specialRequests, setSpecialRequests] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

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

    const { error } = await supabase.from("bookings").insert(bookingData);

    if (error) {
      toast.error("Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    // Also save to localStorage for backward compatibility
    const localData = { date, time: selectedTime, guests, specialRequests, createdAt: new Date().toISOString() };
    const existing = JSON.parse(localStorage.getItem("berrylicious-bookings") || "[]");
    existing.push(localData);
    localStorage.setItem("berrylicious-bookings", JSON.stringify(existing));

    navigate("/booking/success", { state: localData });
  };

  return (
    <div className="min-h-screen pb-24 px-6 pt-6 max-w-lg mx-auto">
      <h1 className="font-display text-3xl font-bold mb-8">Book a Table</h1>

      {/* Suggested Times */}
      <div className="mb-8 animate-fade-in">
        <label className="text-sm text-muted-foreground font-medium mb-3 block">Suggested Times</label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {timeSlots.map((slot) => (
            <button
              key={slot.time}
              onClick={() => setSelectedTime(slot.time)}
              className={`shrink-0 px-4 py-3 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${
                selectedTime === slot.time
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/40"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{slot.time}</span>
              <span className="text-xs opacity-70">{slot.label}</span>
            </button>
          ))}
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
            className="w-full bg-card border border-border rounded-lg py-3 pl-10 pr-4 text-foreground focus:outline-none focus:border-primary transition-colors [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Guests */}
      <div className="mb-6 animate-fade-in">
        <label className="text-sm text-muted-foreground font-medium mb-2 block">Guests</label>
        <div className="flex items-center gap-4 bg-card border border-border rounded-lg p-3">
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

      {/* Confirm */}
      <button
        onClick={handleConfirm}
        disabled={!date || !selectedTime || loading}
        className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-lg hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Booking..." : "Confirm Booking"}
      </button>
    </div>
  );
};

export default BookingPage;
