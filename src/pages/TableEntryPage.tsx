import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTableSession } from "@/context/TableSessionContext";
import { useCart } from "@/context/CartContext";
import { useApp } from "@/context/AppContext";
import { isValidTableCodeFormat, type ActiveTableSession } from "@/lib/tableService";
import { isBackendMissingError } from "@/lib/featureAvailability";
import { FeatureAvailabilityState } from "@/components/FeatureAvailabilityState";
import { TableSessionHeader } from "@/components/TableSessionHeader";
import { isActiveOrderStatus } from "@/lib/orderLifecycle";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";

type ResolveQrResult = {
  session_id: string;
  session_token: string;
  table_id: string;
  table_number: string;
  display_name: string;
  area: string;
  expires_at: string;
};

/**
 * QR Table Ordering entry route (/table/:tableCode).
 * Never treats an arbitrary URL parameter as a valid restaurant table.
 * When backend table validation is not yet deployed, shows a restrained, honest
 * informational state with a working link to the menu.
 */
export default function TableEntryPage() {
  const { tableCode } = useParams();
  const navigate = useNavigate();
  const { session, setActiveSession, openServiceSheet } = useTableSession();
  const { totalItems } = useCart();
  const { currentOrder } = useApp();
  const [status, setStatus] = useState<"loading" | "ready" | "coming_soon" | "invalid">("loading");
  const [errorReason, setErrorReason] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const code = tableCode?.trim() ?? "";

    type RpcClient = {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        data: ResolveQrResult | null;
        error: { code?: string; message?: string; status?: number } | null;
        status?: number;
      }>;
    };

    void (supabase as unknown as RpcClient)
      .rpc("resolve_table_qr", { p_table_code: code })
      .then(({ data, error, status: httpStatus }) => {
        if (!alive) return;
        if (httpStatus === 404 || (error && isBackendMissingError(error))) {
          setStatus("coming_soon");
          return;
        }
        if (!isValidTableCodeFormat(code)) {
          setStatus("invalid");
          setErrorReason("This table code format is not valid. Please scan an official Butcher Block table placard.");
          return;
        }
        if (error || !data?.session_id || !data?.session_token) {
          setStatus("invalid");
          setErrorReason(
            "This table code is inactive, expired, or has been rotated by Butcher Block management. You can still browse the menu and order using regular checkout.",
          );
          return;
        }
        const nextSession: ActiveTableSession = {
          sessionId: data.session_id,
          sessionToken: data.session_token,
          tableId: data.table_id,
          tableNumber: data.table_number,
          displayName: data.display_name,
          area: data.area,
          expiresAt: data.expires_at,
        };
        try {
          localStorage.setItem("bb-welcome-seen", "1");
        } catch {
          /* ignore */
        }
        setActiveSession(nextSession);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("coming_soon");
      });

    return () => {
      alive = false;
    };
  }, [tableCode, setActiveSession]);

  const activeOrderId =
    currentOrder && isActiveOrderStatus(currentOrder.status) ? currentOrder.id : null;

  return (
    <div className="min-h-dvh bg-[#121212] px-5 pb-32 pt-[max(32px,env(safe-area-inset-top,0px))] text-white lg:pb-16">
      <div className="mx-auto max-w-[480px]">
        <img
          src={butcherBlockLogo}
          alt="Butcher Block Steakhouse"
          className="h-9 w-auto object-contain"
        />

        <div className="mt-8">
          {status === "loading" && (
            <FeatureAvailabilityState
              status="loading"
              title="Validating your table"
              description="Checking for an active Butcher Block table session."
            />
          )}

          {status === "coming_soon" && (
            <FeatureAvailabilityState
              status="coming_soon"
              title="Table ordering is being prepared"
              description="Table ordering is being prepared. You can still browse the menu and order using the regular checkout."
              icon={<QrCode className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />}
              primaryAction={{ label: "Browse Menu", to: "/menu" }}
              secondaryAction={{ label: "Back to Home", to: "/home" }}
            />
          )}

          {status === "invalid" && (
            <FeatureAvailabilityState
              status="error"
              title="Table code not accepted"
              description={errorReason}
              primaryAction={{ label: "Browse Menu", to: "/menu" }}
              secondaryAction={{ label: "Back to Home", to: "/home" }}
            />
          )}

          {status === "ready" && session && (
            <TableSessionHeader
              session={session}
              cartCount={totalItems}
              activeOrderId={activeOrderId}
              onBrowseMenu={() => navigate("/menu")}
              onRequestWaiter={openServiceSheet}
            />
          )}
        </div>
      </div>
    </div>
  );
}
