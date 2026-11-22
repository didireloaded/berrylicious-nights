import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ChevronRight, Settings2, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useNotificationCenter } from "@/context/NotificationCenterContext";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { getWebPushCapability } from "@/lib/orderStatusNotify";
import { cn } from "@/lib/utils";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "Just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Africa/Windhoek",
    day: "numeric",
    month: "short",
  });
}

export function NotificationCenterSheet() {
  const {
    notifications,
    unreadCount,
    preferences,
    loading,
    sheetOpen,
    setSheetOpen,
    markAsRead,
    markAllRead,
    updatePreference,
    togglePushSubscription,
  } = useNotificationCenter();
  const { user } = useAuth();
  const { currentOrder } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState<"inbox" | "prefs">("inbox");
  const dragStartY = useRef<number | null>(null);
  const pushCapability = getWebPushCapability();

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? dragStartY.current;
    if (endY - dragStartY.current > 72) setSheetOpen(false);
    dragStartY.current = null;
  };

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => setSheetOpen(false)}
        className={cn(
          "flex h-[min(88dvh,700px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Butcher Block Notifications</SheetTitle>
        <SheetDescription className="sr-only">
          Live kitchen order alerts, service updates, and notification preferences.
        </SheetDescription>

        {/* Grabber */}
        <div
          className="flex shrink-0 justify-center pt-3 pb-1"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-3.5 pt-1"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-[17px] font-bold tracking-tight text-white">Notifications</p>
              <p className="text-[12px] text-[#A3A3A3]">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {user && unreadCount > 0 && view === "inbox" && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-white/10 bg-[#242424] px-3 text-[12px] font-semibold text-white hover:bg-[#303030]"
              >
                <CheckCheck className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                Mark all read
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={() => setView((v) => (v === "inbox" ? "prefs" : "inbox"))}
                aria-label={view === "inbox" ? "Notification preferences" : "Back to notifications"}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
                  view === "prefs"
                    ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-[#FF5A1F]"
                    : "border-white/10 bg-[#242424] text-white hover:bg-[#303030]",
                )}
              >
                <Settings2 className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close notifications"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          {!user ? (
            <div className="space-y-4">
              {currentOrder && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    navigate(`/order/${currentOrder.id}`);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#FF5A1F]/35 bg-[#FF5A1F]/10 p-4 text-left"
                >
                  <div>
                    <p className="text-[14px] font-bold text-white">
                      Active Order #BB-{String(currentOrder.id).slice(0, 6).toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#A3A3A3]">
                      Status: {currentOrder.status} · Tap to view live tracker
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                </button>
              )}

              <div className="rounded-[22px] border border-white/10 bg-[#242424] p-5 text-center">
                <p className="text-[16px] font-bold text-white">Sign in for persistent alerts</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#A3A3A3]">
                  Keep your order updates, waiter responses, and Butcher Block Rewards notifications synced across sessions.
                </p>
                <Link
                  to="/auth"
                  onClick={() => setSheetOpen(false)}
                  className="mt-4 inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#FF5A1F] px-6 text-[14px] font-bold text-white hover:bg-[#E84D15]"
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : view === "prefs" ? (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                Alert Preferences
              </p>

              {(
                [
                  { key: "order_updates", label: "Kitchen & order status", detail: "Confirmation, preparing, ready, and table handover alerts." },
                  { key: "service_updates", label: "Table & waiter requests", detail: "Updates when staff acknowledge or resolve table requests." },
                  { key: "rewards_updates", label: "Butcher Block Rewards", detail: "Points earned, reward redemptions, and Guest of the Week invites." },
                  { key: "events_updates", label: "Restaurant events", detail: "Upcoming dining nights and special schedules." },
                ] as const
              ).map((item) => {
                const enabled = preferences[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => void updatePreference(item.key, !enabled)}
                    className="flex min-h-[64px] w-full items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[#242424] px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-white">{item.label}</p>
                      <p className="mt-0.5 text-[13px] text-[#A3A3A3]">{item.detail}</p>
                    </div>
                    <span
                      className={cn(
                        "flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors",
                        enabled ? "bg-[#FF5A1F] justify-end" : "bg-[#303030] justify-start",
                      )}
                    >
                      <span className="h-5 w-5 rounded-full bg-white" />
                    </span>
                  </button>
                );
              })}

              <div className="rounded-[20px] border border-white/10 bg-[#242424] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-white">Device push alerts</p>
                    <p className="mt-0.5 text-[13px] text-[#A3A3A3]">
                      {pushCapability === "denied"
                        ? "Blocked in browser settings. In-app updates remain active."
                        : pushCapability === "unsupported"
                          ? "Not supported on this browser. In-app updates remain active."
                          : "Receive alerts on this device when your order moves stages."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pushCapability === "unsupported" || pushCapability === "denied"}
                    onClick={() => void togglePushSubscription(!preferences.push_enabled)}
                    className={cn(
                      "min-h-[44px] shrink-0 rounded-full px-4 text-[13px] font-bold transition-colors disabled:opacity-45",
                      preferences.push_enabled
                        ? "border border-white/15 bg-[#303030] text-white"
                        : "bg-[#FF5A1F] text-white hover:bg-[#E84D15]",
                    )}
                  >
                    {preferences.push_enabled ? "Turn off" : "Enable"}
                  </button>
                </div>
              </div>
            </div>
          ) : loading && notifications.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-[#A3A3A3]">Loading notifications…</p>
          ) : notifications.length === 0 ? (
            <div className="rounded-[22px] border border-white/10 bg-[#242424] p-6 text-center">
              <p className="text-[15px] font-bold text-white">No notifications yet</p>
              <p className="mt-1 text-[14px] text-[#A3A3A3]">
                Live updates from the Butcher Block kitchen, waiter requests, and rewards will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {notifications.map((n) => {
                const unread = !n.read_at;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        void markAsRead(n.id);
                        if (n.action_url) {
                          setSheetOpen(false);
                          navigate(n.action_url);
                        }
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[20px] border p-4 text-left transition-colors",
                        unread
                          ? "border-[#FF5A1F]/35 bg-[#FF5A1F]/10 hover:bg-[#FF5A1F]/15"
                          : "border-white/10 bg-[#242424] hover:bg-[#303030]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                          unread ? "bg-[#FF5A1F]" : "bg-white/20",
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[14px] font-bold text-white">{n.title}</p>
                          <span className="shrink-0 text-[12px] text-[#A3A3A3]">{relativeTime(n.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-[#C4C4C4]">{n.body}</p>
                      </div>
                      {n.action_url && (
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#A3A3A3]" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
