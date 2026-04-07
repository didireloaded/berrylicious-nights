import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { CalendarDays, Clock, Users } from "lucide-react";
import { ArrivalCodeCard } from "@/components/ArrivalCodeCard";
import { useApp } from "@/context/AppContext";

const BookingSuccessPage = () => {
  const location = useLocation();
  const { setCurrentBooking } = useApp();
  const booking = location.state as {
    date: string;
    time: string;
    guests: number;
    arrival_code?: string;
    assigned_table_code?: string;
  } | null;

  useEffect(() => {
    if (!booking?.date || !booking?.time) return;
    setCurrentBooking({
      date: booking.date,
      time: booking.time,
      guests: booking.guests,
      arrival_code: booking.arrival_code,
    });
  }, [booking?.date, booking?.time, booking?.guests, booking?.arrival_code, setCurrentBooking]);

  const formattedDate = booking?.date
    ? new Date(booking.date + "T00:00").toLocaleDateString("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="min-h-screen pb-safe-nav flex flex-col items-center justify-center px-6 max-w-lg mx-auto text-center animate-fade-in">

      {/* Animated checkmark */}
      <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mb-6">
        <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="hsl(43, 65%, 52%)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw-check"
          />
        </svg>
      </div>

      <h1 className="font-display text-3xl font-bold text-foreground mb-2">
        You're all set 🎉
      </h1>

      {booking ? (
        <>
          {booking.arrival_code ? (
            <ArrivalCodeCard
              code={booking.arrival_code}
              bookingDate={booking.date}
              bookingTime={booking.time}
              className="mb-5"
            />
          ) : null}
          {/* Booking summary card */}
          <div className="bg-card border border-border rounded-xl p-5 w-full mb-4 text-left space-y-3">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Date</p>
                <p className="text-foreground font-semibold">{formattedDate}</p>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Time</p>
                <p className="text-foreground font-semibold">{booking.time}</p>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Guests</p>
                <p className="text-foreground font-semibold">
                  {booking.guests} guest{booking.guests > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {booking.assigned_table_code ? (
              <>
                <div className="border-t border-border" />
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Table</p>
                  <p className="text-foreground font-semibold font-mono tracking-wide">{booking.assigned_table_code}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Auto-assigned for your party size — staff may adjust on arrival.</p>
                </div>
              </>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm mb-8">
            {booking.arrival_code
              ? "Keep the code handy — we’ll match you in seconds at the door."
              : "We'll remind you 1 hour before. See you then. 🍸"}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-lg mb-8">
          Your table is confirmed. We'll see you soon 🍽️
        </p>
      )}

      <div className="flex gap-3 w-full">
        <Link
          to="/menu"
          className="flex-1 bg-primary text-primary-foreground font-semibold py-4 rounded-lg text-center btn-press"
        >
          Skip the wait — Pre-order now →
        </Link>
        <Link
          to="/"
          className="flex-1 border border-border text-foreground font-semibold py-4 rounded-lg text-center hover:bg-card transition-colors btn-press"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default BookingSuccessPage;
