import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ChevronRight, Settings2, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useNotificationCenter } from "@/context/NotificationCenterContext";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { NotificationList } from "@/components/NotificationList";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import { isActiveOrderStatus, getOrderStageCopy } from "@/lib/orderLifecycle";
import type { FeatureAvailabilityStatus } from "@/lib/featureAvailability";
import { cn } from "@/lib/utils";

export function NotificationCenterSheet() {
  const {
    notifications,
    unreadCount,
    preferences,
    loading,
    sheetOpen,
    backendAvailable,
    setSheetOpen,
    markAsRead,
    markAllRead,
    updatePreference,
  } = useNotificationCenter();
  const { user } = useAuth();
  const { currentOrder } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState<"inbox" | "prefs">("inbox");
  const dragStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? dragStartY.current;
    if (endY - dragStartY.current > 72) setSheetOpen(false);
    dragStartY.current = null;
  };

  const hasLiveOrder = Boolean(currentOrder && isActiveOrderStatus(currentOrder.status));
  const activeStage = currentOrder ? getOrderStageCopy(currentOrder.status, currentOrder.order_type) : null;

  const listAvailability: FeatureAvailabilityStatus = !user
    ? "requires_sign_in"
    : loading && notifications.length === 0
      ? "loading"
      : !backendAvailable
        ? "coming_soon"
        : notifications.length === 0
          ? "empty"
          : "available";

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => setSheetOpen(false)}
        className={cn(
          "flex h-[min(86dvh,680px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Butcher Block Notifications</SheetTitle>
        <SheetDescription className="sr-only">
          Order status updates and notification preferences for Butcher Block Steakhouse.
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
              <p className="text-[13px] text-[#A3A3A3]">
                {backendAvailable && unreadCount > 0
                  ? `${unreadCount} unread`
                  : hasLiveOrder
                    ? "Active order in progress"
                    : "Order updates"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {user && backendAvailable && unreadCount > 0 && view === "inbox" && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-white/10 bg-[#242424] px-3 text-[12px] font-semibold text-white hover:bg-[#303030]"
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] space-y-4">
          {/* Active Order Shortcut (real order only) */}
          {view === "inbox" && hasLiveOrder && currentOrder && activeStage && (
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                navigate(`/order/${currentOrder.id}`);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#FF5A1F]/35 bg-[#FF5A1F]/10 p-4 text-left transition-colors hover:bg-[#FF5A1F]/15"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-white">
                  Order #BB-{String(currentOrder.id).slice(0, 6).toUpperCase()} · {activeStage.headline}
                </p>
                <p className="mt-0.5 text-[13px] text-[#C4C4C4]">{activeStage.notificationMessage}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
            </button>
          )}

          {view === "prefs" && user ? (
            backendAvailable ? (
              <div className="space-y-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                  Alert Preferences
                </p>
                {(
                  [
                    { key: "order_updates", label: "Kitchen & order status", detail: "Updates when your order moves stages." },
                    { key: "service_updates", label: "Table & waiter requests", detail: "Updates when staff respond to table requests." },
                    { key: "rewards_updates", label: "Butcher Block Rewards", detail: "Membership activity and approved rewards." },
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
                          enabled ? "justify-end bg-[#FF5A1F]" : "justify-start bg-[#303030]",
                        )}
                      >
                        <span className="h-5 w-5 rounded-full bg-white" />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <FeatureAvailabilityState
                status="coming_soon"
                title="Notification preferences aren't connected yet"
                description="Saving custom alert preferences will become available once the notification backend is connected."
              />
            )
          ) : (
            <NotificationList
              notifications={notifications}
              availability={listAvailability}
              onSignInClick={() => setSheetOpen(false)}
              onSelectNotification={(n) => {
                void markAsRead(n.id);
                if (n.action_url) {
                  setSheetOpen(false);
                  navigate(n.action_url);
                }
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
