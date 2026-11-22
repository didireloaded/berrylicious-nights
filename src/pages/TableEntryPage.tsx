import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, MapPin, Users, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTableSession } from "@/context/TableSessionContext";
import { isValidTableCodeFormat, type ActiveTableSession } from "@/lib/tableService";
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

export default function TableEntryPage() {
  const { tableCode } = useParams();
  const navigate = useNavigate();
  const { session, setActiveSession, openServiceSheet } = useTableSession();
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">("loading");
  const [errorReason, setErrorReason] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const code = tableCode?.trim() ?? "";

    if (!isValidTableCodeFormat(code)) {
      setStatus("invalid");
      setErrorReason("This table QR code format is not valid. Please scan an official Butcher Block table placard.");
      return;
    }

    type RpcClient = {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        data: ResolveQrResult | null;
        error: { message?: string } | null;
      }>;
    };

    void (supabase as unknown as RpcClient)
      .rpc("resolve_table_qr", { p_table_code: code })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data?.session_id || !data?.session_token) {
          setStatus("invalid");
          setErrorReason(
            "This table code is inactive, expired, or has been rotated by Butcher Block management. Please scan the current QR code at your table or ask your server.",
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
      });

    return () => {
      alive = false;
    };
  }, [tableCode, setActiveSession]);

  return (
    <div className="min-h-dvh bg-[#121212] px-5 pb-32 pt-[max(32px,env(safe-area-inset-top,0px))] text-white lg:pb-16">
      <div className="mx-auto max-w-[480px]">
        <img
          src={butcherBlockLogo}
          alt="Butcher Block Steakhouse"
          className="h-9 w-auto object-contain"
        />

        {status === "loading" && (
          <div className="mt-10 rounded-[24px] border border-white/10 bg-[#242424] p-6 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#FF5A1F] border-t-transparent" />
            <p className="mt-4 text-[15px] font-bold text-white">Validating your table…</p>
            <p className="mt-1 text-[13px] text-[#A3A3A3]">
              Confirming active Butcher Block table session.
            </p>
          </div>
        )}

        {status === "invalid" && (
          <div className="mt-8 rounded-[24px] border border-red-500/35 bg-red-950/20 p-6">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <h1 className="font-display text-[20px] font-extrabold text-white">Table code not accepted</h1>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-[#D4D4D4]">{errorReason}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                to="/menu"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-[#FF5A1F] px-5 text-[14px] font-bold text-white hover:bg-[#E84D15]"
              >
                Browse Menu
              </Link>
              <Link
                to="/home"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/15 bg-[#242424] px-5 text-[14px] font-semibold text-white hover:bg-[#303030]"
              >
                Home
              </Link>
            </div>
          </div>
        )}

        {status === "ready" && session && (
          <div className="mt-8 space-y-5">
            <section className="rounded-[24px] border border-[#FF5A1F]/35 bg-[#242424] p-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5A1F]/15 px-3 py-1 text-[12px] font-bold text-[#FF5A1F]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Active Table Session
              </div>
              <h1 className="mt-3 font-display text-[28px] font-extrabold tracking-[-0.035em] text-white">
                {session.displayName}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-[14px] text-[#A3A3A3]">
                <MapPin className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                {session.area} · Butcher Block Windhoek
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-[#C4C4C4]">
                Your table number is prefilled for dine-in ordering. You can review your table before submitting any order or request a waiter anytime.
              </p>
            </section>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate("/menu")}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15]"
              >
                <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
                Order Food &amp; Drinks
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={openServiceSheet}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-[#242424] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#303030]"
              >
                <BellRing className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                Call Your Waiter / Request Service
              </button>

              <Link
                to="/group/new"
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-[#242424] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#303030]"
              >
                <Users className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                Start a Group Order at This Table
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
