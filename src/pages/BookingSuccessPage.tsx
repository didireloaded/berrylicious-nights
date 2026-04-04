import { Link, useLocation } from "react-router-dom";
import { Check } from "lucide-react";

const BookingSuccessPage = () => {
  const location = useLocation();
  const booking = location.state as { date: string; time: string; guests: number } | null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 max-w-lg mx-auto text-center animate-fade-in">
      {/* Animated checkmark */}
      <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mb-6">
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
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

      <h1 className="font-display text-3xl font-bold text-foreground mb-2">You're all set 🎉</h1>
      {booking ? (
        <p className="text-muted-foreground text-lg mb-2">
          Your table is reserved for {booking.guests} guest{booking.guests > 1 ? "s" : ""} on{" "}
          {new Date(booking.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at{" "}
          {booking.time}.
        </p>
      ) : (
        <p className="text-muted-foreground text-lg mb-2">Your booking has been confirmed.</p>
      )}
      <p className="text-muted-foreground text-sm mb-8">We'll remind you 1 hour before.</p>

      <div className="flex gap-3 w-full">
        <Link
          to="/menu"
          className="flex-1 bg-primary text-primary-foreground font-semibold py-3.5 rounded-lg text-center hover:opacity-90 transition-opacity"
        >
          Pre-order your meal →
        </Link>
        <Link
          to="/"
          className="flex-1 border border-border text-foreground font-semibold py-3.5 rounded-lg text-center hover:bg-card transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default BookingSuccessPage;
