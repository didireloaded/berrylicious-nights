/** Single source for bookable times (booking UI + event availability). */
export const bookingTimeSlots = [
  { time: "12:30", label: "Lunch" },
  { time: "18:00", label: "Quiet" },
  { time: "19:30", label: "Best Time" },
  { time: "20:00", label: "Popular" },
  { time: "21:00", label: "Lively" },
] as const;

export const STANDARD_SLOT_TIMES = bookingTimeSlots.map((s) => s.time);

export const slotLabel = (time: string) =>
  bookingTimeSlots.find((s) => s.time === time)?.label ?? "";
