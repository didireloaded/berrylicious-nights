import { Bell, ChevronRight } from "lucide-react";
import type { UserNotificationRow } from "@/context/NotificationCenterContext";
import type { FeatureAvailabilityStatus } from "@/lib/featureAvailability";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import { cn } from "@/lib/utils";

function formatRelativeTime(iso: string): string {
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

export interface NotificationListProps {
  notifications: UserNotificationRow[];
  availability: FeatureAvailabilityStatus;
  onSelectNotification: (notification: UserNotificationRow) => void;
  onSignInClick?: () => void;
}

export function NotificationList({
  notifications,
  availability,
  onSelectNotification,
  onSignInClick,
}: NotificationListProps) {
  if (availability === "loading") {
    return (
      <FeatureAvailabilityState
        status="loading"
        title="Checking notifications"
        description="Loading your Butcher Block order updates."
      />
    );
  }

  if (availability === "requires_sign_in") {
    return (
      <FeatureAvailabilityState
        status="requires_sign_in"
        title="Sign in for order notifications"
        description="Sign in to view your saved order alerts and updates across visits. Active orders on this device can still be tracked directly."
        primaryAction={{ label: "Sign in", to: "/auth", onClick: onSignInClick }}
      />
    );
  }

  if (availability === "coming_soon" || availability === "temporarily_unavailable") {
    return (
      <FeatureAvailabilityState
        status={availability}
        title="Notification history isn't connected yet"
        description="Persistent order notifications will appear here once backend notification storage is enabled. Live order progress remains available on your order tracker."
        icon={<Bell className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />}
      />
    );
  }

  if (availability === "error") {
    return (
      <FeatureAvailabilityState
        status="error"
        title="Couldn't load notifications"
        description="Please try again shortly. You can still follow live progress from your order receipt."
      />
    );
  }

  if (notifications.length === 0) {
    return (
      <FeatureAvailabilityState
        status="empty"
        title="No notifications yet"
        description="Updates from the Butcher Block kitchen will appear here when you place an order."
        icon={<Bell className="h-5 w-5 text-[#A3A3A3]" aria-hidden="true" />}
      />
    );
  }

  return (
    <ul className="space-y-2.5" aria-label="Notifications">
      {notifications.map((n) => {
        const unread = !n.read_at;
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onSelectNotification(n)}
              className={cn(
                "flex min-h-[64px] w-full items-start gap-3 rounded-[20px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]",
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
                  <span className="shrink-0 text-[12px] text-[#A3A3A3]">
                    {formatRelativeTime(n.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-[#C4C4C4]">{n.body}</p>
              </div>
              {n.action_url && (
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#A3A3A3]" aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
