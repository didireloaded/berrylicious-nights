import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateClientUuid } from "@/lib/supabaseArrivalInsert";
import {
  isTableSessionExpired,
  type ActiveTableSession,
} from "@/lib/tableService";

const SESSION_STORAGE_KEY = "bb-active-table-session";
const GUEST_KEY_STORAGE = "bb-table-guest-key";

function readStoredSession(): ActiveTableSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveTableSession;
    if (!parsed?.sessionId || !parsed?.sessionToken || isTableSessionExpired(parsed)) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getOrCreateTableGuestKey(): string {
  if (typeof localStorage === "undefined") return generateClientUuid();
  try {
    const existing = localStorage.getItem(GUEST_KEY_STORAGE);
    if (existing && existing.length >= 12) return existing;
    const next = `guest-${generateClientUuid()}`;
    localStorage.setItem(GUEST_KEY_STORAGE, next);
    return next;
  } catch {
    return generateClientUuid();
  }
}

interface TableSessionContextValue {
  session: ActiveTableSession | null;
  guestKey: string;
  serviceSheetOpen: boolean;
  setServiceSheetOpen: (open: boolean) => void;
  openServiceSheet: () => void;
  setActiveSession: (next: ActiveTableSession | null) => void;
  clearSession: () => void;
  verifySessionLive: () => Promise<{ valid: boolean; reason?: string }>;
}

const TableSessionContext = createContext<TableSessionContextValue | null>(null);

export function TableSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<ActiveTableSession | null>(readStoredSession);
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [guestKey] = useState<string>(getOrCreateTableGuestKey);

  const setActiveSession = useCallback((next: ActiveTableSession | null) => {
    setSessionState(next);
    try {
      if (next) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const clearSession = useCallback(() => {
    setServiceSheetOpen(false);
    setActiveSession(null);
  }, [setActiveSession]);

  const verifySessionLive = useCallback(async (): Promise<{ valid: boolean; reason?: string }> => {
    if (!session) return { valid: false, reason: "no_session" };
    if (isTableSessionExpired(session)) {
      clearSession();
      return { valid: false, reason: "expired" };
    }
    type RpcClient = {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        data: { valid?: boolean; reason?: string } | null;
        error: { code?: string; message?: string } | null;
      }>;
    };
    const { data, error } = await (supabase as unknown as RpcClient).rpc("validate_table_session", {
      p_session_id: session.sessionId,
      p_session_token: session.sessionToken,
    });
    if (error) {
      return { valid: false, reason: "verification_unavailable" };
    }
    if (!data?.valid) {
      clearSession();
      return { valid: false, reason: data?.reason ?? "closed" };
    }
    return { valid: true };
  }, [session, clearSession]);

  // Periodically expire stale table sessions in client memory
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(() => {
      if (isTableSessionExpired(session)) {
        clearSession();
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [session, clearSession]);

  const openServiceSheet = useCallback(() => setServiceSheetOpen(true), []);

  const value = useMemo<TableSessionContextValue>(
    () => ({
      session,
      guestKey,
      serviceSheetOpen,
      setServiceSheetOpen,
      openServiceSheet,
      setActiveSession,
      clearSession,
      verifySessionLive,
    }),
    [session, guestKey, serviceSheetOpen, openServiceSheet, setActiveSession, clearSession, verifySessionLive],
  );

  return <TableSessionContext.Provider value={value}>{children}</TableSessionContext.Provider>;
}

export function useTableSession() {
  const ctx = useContext(TableSessionContext);
  if (!ctx) throw new Error("useTableSession must be used inside TableSessionProvider");
  return ctx;
}
