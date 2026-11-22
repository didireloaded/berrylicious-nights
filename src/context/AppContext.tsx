import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TrackableOrderSnapshot } from "@/lib/orderTrackingStorage";
import { AUTH_SIGNED_OUT_EVENT } from "@/lib/authUtils";

export type CurrentOrderState = (TrackableOrderSnapshot & { id: string }) | null;

export type CurrentBookingState = {
  date: string;
  time: string;
  guests: number;
  arrival_code?: string | null;
} | null;

const SESSION_BOOKING_KEY = "berrylicious-session-booking";
const ACTIVE_ORDER_KEY = "berrylicious-current-order";
const ORDER_TTL_MS = 24 * 60 * 60 * 1000;

function readActiveOrder(): CurrentOrderState {
  try {
    const raw = localStorage.getItem(ACTIVE_ORDER_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { order?: CurrentOrderState; savedAt?: number };
    if (!saved.order?.id || !saved.savedAt || Date.now() - saved.savedAt > ORDER_TTL_MS) {
      localStorage.removeItem(ACTIVE_ORDER_KEY);
      return null;
    }
    if (!["pending", "preparing", "ready"].includes(saved.order.status)) return null;
    return saved.order;
  } catch {
    return null;
  }
}

function writeActiveOrder(order: CurrentOrderState) {
  try {
    if (!order) localStorage.removeItem(ACTIVE_ORDER_KEY);
    else localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify({ order, savedAt: Date.now() }));
  } catch {
    // Storage can be unavailable in private browsing. The React state still works.
  }
}


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
  const [currentOrder, setCurrentOrderState] = useState<CurrentOrderState>(() => typeof localStorage !== "undefined" ? readActiveOrder() : null);
  const [currentBooking, setCurrentBookingRaw] = useState<CurrentBookingState>(() =>
    typeof sessionStorage !== "undefined" ? readSessionBooking() : null,
  );

  const clearCurrentOrder = useCallback(() => {
    setCurrentOrderState(null);
    writeActiveOrder(null);
  }, []);
  const setCurrentOrder = useCallback((order: CurrentOrderState) => {
    setCurrentOrderState(order);
    writeActiveOrder(order);
  }, []);
  const clearCurrentBooking = useCallback(() => {
    setCurrentBookingRaw(null);
    writeSessionBooking(null);
  }, []);

  const setCurrentBooking = useCallback((booking: CurrentBookingState) => {
    setCurrentBookingRaw(booking);
    writeSessionBooking(booking);
  }, []);

  useEffect(() => {
    const onSignedOut = () => {
      setCurrentOrderState(null);
      setCurrentBookingRaw(null);
      writeActiveOrder(null);
      writeSessionBooking(null);
    };
    window.addEventListener(AUTH_SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(AUTH_SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const value = useMemo(
    () => ({
      currentOrder,
      setCurrentOrder,
      clearCurrentOrder,
      currentBooking,
      setCurrentBooking,
      clearCurrentBooking,
    }),
    [currentOrder, setCurrentOrder, clearCurrentOrder, currentBooking, setCurrentBooking, clearCurrentBooking],
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
