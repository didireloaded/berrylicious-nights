import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { CalendarDays, Check, Clock, Sparkles, Users } from "lucide-react";
import { ArrivalCodeCard } from "@/components/ArrivalCodeCard";
import { useApp } from "@/context/AppContext";

const BookingSuccessPage = () => {
  const location = useLocation();
  const { setCurrentBooking } = useApp();
  const booking = location.state as {
    id?: string;
    date: string;
    time: string;
    guests: number;
    eventTitle?: string;
    arrival_code?: string;
    reservation_number?: string;
    assigned_table_code?: string;
  } | null;

  const reservationNumber =
    booking?.arrival_code ||
    booking?.reservation_number ||
    (booking?.id ? `BB-${booking.id.slice(0, 6).toUpperCase()}` : null);

  useEffect(() => {
    if (!booking?.date || !booking?.time) return;
    setCurrentBooking({
      date: booking.date,
      time: booking.time,
      guests: booking.guests,
      arrival_code: reservationNumber ?? undefined,
    });
  }, [booking?.date, booking?.time, booking?.guests, reservationNumber, setCurrentBooking]);

  const formattedDate = booking?.date
    ? new Date(booking.date + "T12:00:00Z").toLocaleDateString("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : null;

  return (
    <div className="min-h-dvh bg-[#121212] px-5 pb-32 pt-[max(32px,env(safe-area-inset-top,0px))] text-white lg:pb-16">
      <div className="mx-auto flex max-w-[520px] flex-col items-center text-center animate-fade-in">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#FF5A1F] bg-[#FF5A1F]/15 text-[#FF5A1F]">
          <Check className="h-8 w-8" strokeWidth={2.6} aria-hidden="true" />
        </div>

        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.04em] text-white">
          {booking ? "Table Reserved" : "Reservation Not Found"}
        </h1>

        {booking ? (
          <>
            <p className="mt-1.5 text-[14px] text-[#A3A3A3]">
              Butcher Block Steakhouse · Am Weinberg Estate
            </p>

            {reservationNumber && (
              <ArrivalCodeCard
                code={reservationNumber}
                bookingDate={booking.date}
                bookingTime={booking.time}
                className="mt-6 rounded-[24px] border-white/10 bg-[#242424]"
              />
            )}

            <div className="mt-5 w-full divide-y divide-white/10 rounded-[22px] border border-white/10 bg-[#242424] px-5 text-left">
              {reservationNumber && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#A3A3A3]">
                    Reservation Number
                  </span>
                  <span className="font-mono text-[15px] font-bold text-[#FF5A1F]">
                    {reservationNumber}
                  </span>
                </div>
              )}

              {booking.eventTitle && (
                <div className="flex items-center gap-3 py-3.5">
                  <Sparkles className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.08em] text-[#A3A3A3]">Event</p>
                    <p className="text-[15px] font-semibold text-white">{booking.eventTitle}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 py-3.5">
                <CalendarDays className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                <div>
                  <p className="text-[12px] uppercase tracking-[0.08em] text-[#A3A3A3]">Date</p>
                  <p className="text-[15px] font-semibold text-white">{formattedDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 py-3.5">
                <Clock className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                <div>
                  <p className="text-[12px] uppercase tracking-[0.08em] text-[#A3A3A3]">Time</p>
                  <p className="text-[15px] font-semibold text-white">{booking.time}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 py-3.5">
                <Users className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                <div>
                  <p className="text-[12px] uppercase tracking-[0.08em] text-[#A3A3A3]">Guests</p>
                  <p className="text-[15px] font-semibold text-white">
                    {booking.guests} {booking.guests === 1 ? "guest" : "guests"}
                  </p>
                </div>
              </div>

              {booking.assigned_table_code && (
                <div className="py-3.5">
                  <p className="text-[12px] uppercase tracking-[0.08em] text-[#A3A3A3]">Table</p>
                  <p className="font-mono text-[15px] font-semibold text-white">{booking.assigned_table_code}</p>
                  <p className="mt-1 text-[12px] text-[#A3A3A3]">
                    Auto-assigned for your party size — staff may adjust on arrival.
                  </p>
                </div>
              )}
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-[#A3A3A3]">
              Present your reservation number on arrival. You can also view it anytime in Profile.
            </p>
          </>
        ) : (
          <p className="mt-4 text-[15px] text-[#A3A3A3]">
            No reservation details were found. You can book a table anytime.
          </p>
        )}

        <div className="mt-7 flex w-full gap-3">
          <Link
            to="/menu"
            className="flex min-h-[50px] flex-1 items-center justify-center rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15]"
          >
            Browse Menu
          </Link>
          <Link
            to="/home"
            className="flex min-h-[50px] flex-1 items-center justify-center rounded-full border border-white/15 bg-[#242424] text-[15px] font-semibold text-white transition-colors hover:bg-[#303030]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccessPage;
