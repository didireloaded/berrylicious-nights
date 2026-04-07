import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { TrackableOrderSnapshot } from "@/lib/orderTrackingStorage";

export type CurrentOrderState = (TrackableOrderSnapshot & { id: string }) | null;

export type CurrentBookingState = {
  date: string;
  time: string;
  guests: number;
  arrival_code?: string | null;
} | null;

const SESSION_BOOKING_KEY = "berrylicious-session-booking";

function readSessionBooking(): CurrentBookingState {
  try {
    const raw = sessionStorage.getItem(SESSION_BOOKING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CurrentBookingState;
    if (!p?.date || !p?.time || typeof p.guests !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

function writeSessionBooking(b: CurrentBookingState) {
  try {
    if (!b) sessionStorage.removeItem(SESSION_BOOKING_KEY);
    else sessionStorage.setItem(SESSION_BOOKING_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

type AppContextValue = {
  currentOrder: CurrentOrderState;
  setCurrentOrder: (order: CurrentOrderState) => void;
  clearCurrentOrder: () => void;
  currentBooking: CurrentBookingState;
  setCurrentBooking: (booking: CurrentBookingState) => void;
  clearCurrentBooking: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentOrder, setCurrentOrderState] = useState<CurrentOrderState>(null);
  const [currentBooking, setCurrentBookingRaw] = useState<CurrentBookingState>(() =>
    typeof sessionStorage !== "undefined" ? readSessionBooking() : null,
  );

  const clearCurrentOrder = useCallback(() => setCurrentOrderState(null), []);
  const clearCurrentBooking = useCallback(() => {
    setCurrentBookingRaw(null);
    writeSessionBooking(null);
  }, []);

  const setCurrentBooking = useCallback((booking: CurrentBookingState) => {
    setCurrentBookingRaw(booking);
    writeSessionBooking(booking);
  }, []);

  const value = useMemo(
    () => ({
      currentOrder,
      setCurrentOrder: setCurrentOrderState,
      clearCurrentOrder,
      currentBooking,
      setCurrentBooking,
      clearCurrentBooking,
    }),
    [currentOrder, clearCurrentOrder, currentBooking, setCurrentBooking, clearCurrentBooking],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within AppProvider");
  }
  return ctx;
}
