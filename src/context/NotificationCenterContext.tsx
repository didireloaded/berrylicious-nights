import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeUserToWebPush,
  unsubscribeUserFromWebPush,
} from "@/lib/orderStatusNotify";
import { isBackendMissingError } from "@/lib/featureAvailability";

export interface UserNotificationRow {
  id: string;
  user_id: string;
  order_id: string | null;
  event_key: string;
  event_type: string;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  order_updates: boolean;
  service_updates: boolean;
  rewards_updates: boolean;
  events_updates: boolean;
  push_enabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  order_updates: true,
  service_updates: true,
  rewards_updates: true,
  events_updates: true,
  push_enabled: false,
};

interface NotificationCenterContextValue {
  notifications: UserNotificationRow[];
  unreadCount: number;
  preferences: NotificationPreferences;
  loading: boolean;
  sheetOpen: boolean;
  backendAvailable: boolean;
  openNotificationCenter: () => void;
  closeNotificationCenter: () => void;
  setSheetOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  updatePreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => Promise<void>;
  togglePushSubscription: (enable: boolean) => Promise<void>;
}

const NotificationCenterContext = createContext<NotificationCenterContextValue | null>(null);

type DynamicClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { code?: string; message?: string } | null }>;
        };
        maybeSingle: () => Promise<{ data: unknown | null; error: { code?: string; message?: string } | null }>;
      };
    };
    update: (vals: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: string) => Promise<{ error: { message?: string } | null }>;
        is: (col2: string, val2: null) => Promise<{ error: { message?: string } | null }>;
      };
    };
    upsert: (
      vals: Record<string, unknown>,
      opts?: { onConflict?: string },
    ) => Promise<{ error: { message?: string } | null }>;
  };
};

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotificationRow[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);

  const db = supabase as unknown as DynamicClient;

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setPreferences(DEFAULT_PREFS);
      return;
    }
    setLoading(true);
    try {
      const [notifRes, prefRes] = await Promise.all([
        db
          .from("user_notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        db
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (isBackendMissingError(notifRes.error)) {
        setBackendAvailable(false);
        setNotifications([]);
      } else if (!notifRes.error) {
        setBackendAvailable(true);
        setNotifications((notifRes.data ?? []) as UserNotificationRow[]);
      }

      if (!prefRes.error && prefRes.data) {
        const p = prefRes.data as Partial<NotificationPreferences>;
        setPreferences({
          order_updates: p.order_updates ?? true,
          service_updates: p.service_updates ?? true,
          rewards_updates: p.rewards_updates ?? true,
          events_updates: p.events_updates ?? true,
          push_enabled: p.push_enabled ?? false,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setPreferences(DEFAULT_PREFS);
      return;
    }

    void refresh();

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as UserNotificationRow;
          if (!row?.id) return;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === row.id || n.event_key === row.event_key)) return prev;
            return [row, ...prev].slice(0, 60);
          });
          toast(row.title, { description: row.body });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as UserNotificationRow;
          if (!row?.id) return;
          setNotifications((prev) => prev.map((n) => (n.id === row.id ? row : n)));
        },
      )
      .subscribe();

    const handleReconnect = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    window.addEventListener("online", handleReconnect);
    document.addEventListener("visibilitychange", handleReconnect);

    return () => {
      window.removeEventListener("online", handleReconnect);
      document.removeEventListener("visibilitychange", handleReconnect);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user?.id) return;
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId && !n.read_at ? { ...n, read_at: now } : n)),
      );
      if (!backendAvailable) return;
      await db
        .from("user_notifications")
        .update({ read_at: now })
        .eq("id", notificationId)
        .eq("user_id", user.id);
    },
    [user?.id, backendAvailable], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    if (!backendAvailable) return;
    await db
      .from("user_notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
  }, [user?.id, backendAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePreference = useCallback(
    async <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
      const next = { ...preferences, [key]: value };
      setPreferences(next);
      if (!user?.id || !backendAvailable) return;
      const { error } = await db.from("notification_preferences").upsert(
        {
          user_id: user.id,
          ...next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) {
        toast.error("Could not save notification preference.");
      }
    },
    [preferences, user?.id, backendAvailable], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const togglePushSubscription = useCallback(
    async (enable: boolean) => {
      if (!user?.id) {
        toast.error("Sign in to manage push notifications.");
        return;
      }
      if (enable) {
        const res = await subscribeUserToWebPush(user.id);
        if (res.ok) {
          toast.success(res.message);
          await updatePreference("push_enabled", true);
        } else {
          toast.error(res.message);
          await updatePreference("push_enabled", false);
        }
      } else {
        await unsubscribeUserFromWebPush(user.id);
        await updatePreference("push_enabled", false);
        toast.success("Push notifications turned off. In-app updates remain active.");
      }
    },
    [user?.id, updatePreference],
  );

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.read_at ? 0 : 1), 0),
    [notifications],
  );

  const openNotificationCenter = useCallback(() => setSheetOpen(true), []);
  const closeNotificationCenter = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<NotificationCenterContextValue>(
    () => ({
      notifications,
      unreadCount,
      preferences,
      loading,
      sheetOpen,
      backendAvailable,
      openNotificationCenter,
      closeNotificationCenter,
      setSheetOpen,
      refresh,
      markAsRead,
      markAllRead,
      updatePreference,
      togglePushSubscription,
    }),
    [
      notifications,
      unreadCount,
      preferences,
      loading,
      sheetOpen,
      backendAvailable,
      openNotificationCenter,
      closeNotificationCenter,
      refresh,
      markAsRead,
      markAllRead,
      updatePreference,
      togglePushSubscription,
    ],
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const ctx = useContext(NotificationCenterContext);
  if (!ctx) throw new Error("useNotificationCenter must be used inside NotificationCenterProvider");
  return ctx;
}
