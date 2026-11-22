import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Clock3,
  Flame,
  GlassWater,
  MessageSquare,
  ReceiptText,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useTableSession } from "@/context/TableSessionContext";
import { useAuth } from "@/context/AuthContext";
import {
  canCustomerCancelServiceRequest,
  findDuplicateActiveServiceRequest,
  getServiceRequestLabel,
  type ServiceRequestRow,
  type ServiceRequestType,
} from "@/lib/tableService";
import { isBackendMissingError } from "@/lib/featureAvailability";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import { cn } from "@/lib/utils";

type DynamicServiceRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string; status?: number } | null }>;
};

const REQUEST_CARDS: {
  type: ServiceRequestType;
  label: string;
  description: string;
  icon: typeof BellRing;
}[] = [
  { type: "waiter", label: "Call waiter", description: "Ask your server to stop by", icon: BellRing },
  { type: "water", label: "Request water", description: "Still or sparkling for the table", icon: GlassWater },
  { type: "cutlery", label: "Extra cutlery", description: "Fresh knives, forks, or napkins", icon: Utensils },
  { type: "condiments", label: "Request condiments", description: "Sauces, pepper, or salt", icon: Flame },
  { type: "bill", label: "Request the bill", description: "Ready to settle at your table", icon: ReceiptText },
  { type: "other", label: "Other assistance", description: "Send a short note to staff", icon: MessageSquare },
];

export function WaiterServiceSheet() {
  const { session, guestKey, serviceSheetOpen, setServiceSheetOpen, clearSession } = useTableSession();
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [selectedType, setSelectedType] = useState<ServiceRequestType | null>(null);
  const [otherNote, setOtherNote] = useState("");
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean>(false);
  const [checkingBackend, setCheckingBackend] = useState<boolean>(false);
  const dragStartY = useRef<number | null>(null);

  const loadRequests = useCallback(async () => {
    if (!session) {
      setRequests([]);
      setBackendAvailable(false);
      return;
    }
    setCheckingBackend(true);
    const rpc = supabase as unknown as DynamicServiceRpc;
    const { data, error } = await rpc.rpc("get_session_service_requests", {
      p_session_id: session.sessionId,
      p_session_token: session.sessionToken,
    });
    if (error) {
      setBackendAvailable(!isBackendMissingError(error));
      setRequests([]);
    } else {
      setBackendAvailable(true);
      setRequests(Array.isArray(data) ? (data as ServiceRequestRow[]) : []);
    }
    setCheckingBackend(false);
  }, [session]);

  useEffect(() => {
    if (!serviceSheetOpen) return;
    setSelectedType(null);
    setRequestError(null);
    if (!session) return;
    void loadRequests();

    const channel = supabase
      .channel(`table-service-${session.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          filter: `table_session_id=eq.${session.sessionId}`,
        },
        () => {
          void loadRequests();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [serviceSheetOpen, session, loadRequests]);

  const submitSelectedRequest = async () => {
    if (!session || !selectedType || !backendAvailable || sending) return;
    setRequestError(null);

    const existing = findDuplicateActiveServiceRequest(requests, selectedType);
    if (existing) {
      toast.info(`${getServiceRequestLabel(selectedType)} is already active for your table.`);
      return;
    }
    if (selectedType === "other" && !otherNote.trim()) {
      setRequestError("Please add a brief note explaining how we can help.");
      return;
    }

    setSending(true);
    try {
      const rpc = supabase as unknown as DynamicServiceRpc;
      const { error } = await rpc.rpc("create_service_request", {
        p_session_id: session.sessionId,
        p_session_token: session.sessionToken,
        p_request_type: selectedType,
        p_note: selectedType === "other" ? otherNote.trim() : null,
        p_guest_key: guestKey,
      });
      if (error) {
        if (isBackendMissingError(error)) {
          setBackendAvailable(false);
          return;
        }
        if (error.message?.toLowerCase().includes("closed") || error.message?.toLowerCase().includes("expired")) {
          clearSession();
        }
        setRequestError(error.message || "Could not send request. Please wave down your server.");
        return;
      }
      if (selectedType === "other") setOtherNote("");
      setSelectedType(null);
      toast.success(`Request received: ${getServiceRequestLabel(selectedType)}`);
      await loadRequests();
    } finally {
      setSending(false);
    }
  };

  const cancelRequest = async (reqId: string) => {
    if (!session || !backendAvailable) return;
    const rpc = supabase as unknown as DynamicServiceRpc;
    const { data, error } = await rpc.rpc("cancel_service_request", {
      p_request_id: reqId,
      p_session_token: session.sessionToken,
      p_guest_key: guestKey,
    });
    if (error || !data) {
      toast.error("Request could not be cancelled (a waiter may already be attending).");
      return;
    }
    toast.success("Request cancelled");
    await loadRequests();
  };

  const openRequests = requests.filter((r) => r.status === "pending" || r.status === "acknowledged");
  const canInteract = Boolean(session && backendAvailable && !checkingBackend);

  return (
    <Sheet open={serviceSheetOpen} onOpenChange={setServiceSheetOpen}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => setServiceSheetOpen(false)}
        className={cn(
          "flex max-h-[min(88dvh,720px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Call Your Waiter</SheetTitle>
        <SheetDescription className="sr-only">
          Request waiter assistance, water, cutlery, condiments, or the bill for your validated table session.
        </SheetDescription>

        <div
          className="flex shrink-0 justify-center pt-3 pb-1"
          onTouchStart={(e) => { dragStartY.current = e.touches[0]?.clientY ?? null; }}
          onTouchEnd={(e) => {
            if (dragStartY.current !== null && (e.changedTouches[0]?.clientY ?? 0) - dragStartY.current > 72) {
              setServiceSheetOpen(false);
            }
            dragStartY.current = null;
          }}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-3.5 pt-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <BellRing className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-[17px] font-bold text-white">Call Your Waiter</h2>
              <p className="text-[13px] text-[#A3A3A3]">
                {session ? `${session.displayName} · ${session.area}` : "Table service"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setServiceSheetOpen(false)}
            aria-label="Close table assistance"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {!session ? (
            <FeatureAvailabilityState
              status="requires_table_session"
              title="Requires a validated table session"
              description="Waiter requests are available once you scan an active Butcher Block table QR code."
            />
          ) : checkingBackend ? (
            <FeatureAvailabilityState
              status="loading"
              title="Connecting to table service"
              description="Checking active requests for your table."
            />
          ) : !backendAvailable ? (
            <FeatureAvailabilityState
              compact
              status="coming_soon"
              title="Table service requests aren't available yet"
              description="In-app waiter requests are prepared on the frontend and will activate once connected to floor staff."
            />
          ) : null}

          {/* Confirmed Active Requests (only when backend confirms them) */}
          {canInteract && openRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">
                Active Requests
              </p>
              {openRequests.map((req) => {
                const canCancel = canCustomerCancelServiceRequest(req, {
                  userId: user?.id,
                  guestKey,
                });
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[#FF5A1F]/35 bg-[#FF5A1F]/10 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[14px] font-bold text-white">
                        {req.status === "acknowledged" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Clock3 className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                        )}
                        {getServiceRequestLabel(req.request_type)}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#D4D4D4]">
                        {req.status === "acknowledged"
                          ? "Staff acknowledged — on the way"
                          : "Request received — waiting for staff"}
                      </p>
                    </div>
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => void cancelRequest(req.id)}
                        className="min-h-[40px] shrink-0 rounded-full border border-white/15 bg-[#242424] px-3.5 text-[12px] font-semibold text-white hover:bg-[#303030]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 6 Approved Request Options */}
          <div className="grid grid-cols-2 gap-2.5">
            {REQUEST_CARDS.map((opt) => {
              const Icon = opt.icon;
              const alreadyOpen = canInteract && Boolean(findDuplicateActiveServiceRequest(requests, opt.type));
              const isSelected = selectedType === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  disabled={!canInteract || alreadyOpen || sending}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedType(opt.type);
                    setRequestError(null);
                  }}
                  className={cn(
                    "flex min-h-[84px] flex-col items-start justify-center rounded-[20px] border p-3.5 text-left transition-colors disabled:cursor-not-allowed",
                    alreadyOpen
                      ? "border-[#FF5A1F]/30 bg-[#FF5A1F]/10 opacity-75"
                      : isSelected
                        ? "border-[#FF5A1F] bg-[#FF5A1F]/15 text-white"
                        : canInteract
                          ? "border-white/10 bg-[#242424] hover:bg-[#303030]"
                          : "border-white/10 bg-[#1B1B1B] opacity-50",
                  )}
                >
                  <Icon
                    className={cn("mb-2 h-4 w-4", isSelected || alreadyOpen ? "text-[#FF5A1F]" : "text-[#A3A3A3]")}
                    aria-hidden="true"
                  />
                  <span className="text-[14px] font-bold text-white">{opt.label}</span>
                  <span className="mt-0.5 text-[12px] text-[#A3A3A3]">
                    {alreadyOpen ? "In progress" : opt.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Optional note when "Other assistance" selected */}
          {canInteract && selectedType === "other" && (
            <div className="rounded-[20px] border border-white/10 bg-[#242424] p-4 space-y-2">
              <label htmlFor="waiter-other-note" className="block text-[14px] font-semibold text-white">
                How can our floor team help?
              </label>
              <input
                id="waiter-other-note"
                type="text"
                maxLength={240}
                value={otherNote}
                onChange={(e) => setOtherNote(e.target.value)}
                placeholder="e.g. High chair, ice bucket, extra plates…"
                className="min-h-[46px] w-full rounded-xl border border-white/10 bg-[#181818] px-3.5 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
              />
            </div>
          )}

          {requestError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-red-500/35 bg-red-950/20 px-4 py-3 text-[13px] text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <span>{requestError}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#121212] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            disabled={!canInteract || !selectedType || sending}
            onClick={() => void submitSelectedRequest()}
            className="flex min-h-[50px] w-full items-center justify-center rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!canInteract
              ? "Table Requests Unavailable"
              : sending
                ? "Sending Request…"
                : selectedType
                  ? `Send: ${getServiceRequestLabel(selectedType)}`
                  : "Select a Request Option"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { WaiterServiceSheet as WaiterRequestSheet };
