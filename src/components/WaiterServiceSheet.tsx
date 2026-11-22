import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, Clock3, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useTableSession } from "@/context/TableSessionContext";
import { useAuth } from "@/context/AuthContext";
import {
  canCustomerCancelServiceRequest,
  findDuplicateActiveServiceRequest,
  getServiceRequestLabel,
  SERVICE_REQUEST_OPTIONS,
  type ServiceRequestRow,
  type ServiceRequestType,
} from "@/lib/tableService";
import { cn } from "@/lib/utils";

type DynamicServiceRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function WaiterServiceSheet() {
  const { session, guestKey, serviceSheetOpen, setServiceSheetOpen, clearSession } = useTableSession();
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [otherNote, setOtherNote] = useState("");
  const [sendingType, setSendingType] = useState<ServiceRequestType | null>(null);
  const dragStartY = useRef<number | null>(null);

  const loadRequests = useCallback(async () => {
    if (!session) {
      setRequests([]);
      return;
    }
    const rpc = supabase as unknown as DynamicServiceRpc;
    const { data, error } = await rpc.rpc("get_session_service_requests", {
      p_session_id: session.sessionId,
      p_session_token: session.sessionToken,
    });
    if (!error && Array.isArray(data)) {
      setRequests(data as ServiceRequestRow[]);
    }
  }, [session]);

  useEffect(() => {
    if (!serviceSheetOpen || !session) return;
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

  const sendRequest = async (type: ServiceRequestType) => {
    if (!session || sendingType) return;
    const existing = findDuplicateActiveServiceRequest(requests, type);
    if (existing) {
      toast.info(`${getServiceRequestLabel(type)} is already active for your table.`);
      return;
    }
    setSendingType(type);
    try {
      const rpc = supabase as unknown as DynamicServiceRpc;
      const { error } = await rpc.rpc("create_service_request", {
        p_session_id: session.sessionId,
        p_session_token: session.sessionToken,
        p_request_type: type,
        p_note: type === "other" ? otherNote.trim() || null : null,
        p_guest_key: guestKey,
      });
      if (error) {
        if (error.message?.toLowerCase().includes("closed") || error.message?.toLowerCase().includes("expired")) {
          clearSession();
        }
        toast.error(error.message || "Could not send request.");
        return;
      }
      if (type === "other") setOtherNote("");
      toast.success(`Sent to floor team: ${getServiceRequestLabel(type)}`);
      await loadRequests();
    } finally {
      setSendingType(null);
    }
  };

  const cancelRequest = async (reqId: string) => {
    if (!session) return;
    const rpc = supabase as unknown as DynamicServiceRpc;
    const { data, error } = await rpc.rpc("cancel_service_request", {
      p_request_id: reqId,
      p_session_token: session.sessionToken,
      p_guest_key: guestKey,
    });
    if (error || !data) {
      toast.error("Request could not be cancelled (a waiter may already be on the way).");
      return;
    }
    toast.success("Request cancelled");
    await loadRequests();
  };

  const openRequests = requests.filter((r) => r.status === "pending" || r.status === "acknowledged");

  return (
    <Sheet open={serviceSheetOpen} onOpenChange={setServiceSheetOpen}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => setServiceSheetOpen(false)}
        className={cn(
          "flex max-h-[min(86dvh,680px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Table Service Requests</SheetTitle>
        <SheetDescription className="sr-only">
          Call your Butcher Block waiter or request table items for your active table session.
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
              <p className="font-display text-[17px] font-bold text-white">Table Assistance</p>
              <p className="text-[12px] text-[#A3A3A3]">
                {session ? `${session.displayName} · ${session.area}` : "Scan a table QR code first"}
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] space-y-4">
          {!session ? (
            <div className="rounded-[22px] border border-white/10 bg-[#242424] p-5 text-center">
              <p className="text-[15px] font-bold text-white">No active table session</p>
              <p className="mt-1.5 text-[13px] text-[#A3A3A3]">
                Scan the QR placard on your Butcher Block table to enable instant waiter requests.
              </p>
            </div>
          ) : (
            <>
              {/* Active Requests Status */}
              {openRequests.length > 0 && (
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
                          <p className="mt-0.5 text-[12px] text-[#D4D4D4]">
                            {req.status === "acknowledged"
                              ? "Waiter has seen your request and is attending"
                              : "Sent to floor team — waiting for acknowledgment"}
                          </p>
                        </div>
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => void cancelRequest(req.id)}
                            className="min-h-[36px] shrink-0 rounded-full border border-white/15 bg-[#242424] px-3 text-[12px] font-semibold text-white hover:bg-[#303030]"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Request Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {SERVICE_REQUEST_OPTIONS.filter((o) => o.type !== "other").map((opt) => {
                  const alreadyOpen = Boolean(findDuplicateActiveServiceRequest(requests, opt.type));
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      disabled={alreadyOpen || sendingType !== null}
                      onClick={() => void sendRequest(opt.type)}
                      className={cn(
                        "flex min-h-[72px] flex-col items-start justify-center rounded-[20px] border p-3.5 text-left transition-colors",
                        alreadyOpen
                          ? "border-[#FF5A1F]/30 bg-[#FF5A1F]/10 opacity-75"
                          : "border-white/10 bg-[#242424] hover:bg-[#303030] active:scale-[0.98]",
                      )}
                    >
                      <span className="text-[14px] font-bold text-white">{opt.label}</span>
                      <span className="mt-0.5 text-[12px] text-[#A3A3A3]">
                        {alreadyOpen ? "In progress" : opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Other Assistance Note */}
              <div className="rounded-[20px] border border-white/10 bg-[#242424] p-4 space-y-2.5">
                <label htmlFor="waiter-other-note" className="block text-[13px] font-bold text-white">
                  Other assistance
                </label>
                <div className="flex gap-2">
                  <input
                    id="waiter-other-note"
                    type="text"
                    maxLength={280}
                    value={otherNote}
                    onChange={(e) => setOtherNote(e.target.value)}
                    placeholder="e.g. High chair, ice bucket, extra plates…"
                    className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-[#181818] px-3 text-[16px] text-white placeholder:text-[#737373] focus:border-[#FF5A1F] focus:outline-none sm:text-[14px]"
                  />
                  <button
                    type="button"
                    disabled={sendingType !== null || !otherNote.trim()}
                    onClick={() => void sendRequest("other")}
                    className="min-h-[44px] shrink-0 rounded-full bg-[#FF5A1F] px-4 text-[13px] font-bold text-white hover:bg-[#E84D15] disabled:opacity-45"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
