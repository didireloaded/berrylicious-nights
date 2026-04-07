import { useCallback, useState } from "react";
import { ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  isBookingArrivalCodeInWindow,
  isOrderArrivalCodeInWindow,
  normalizeArrivalCodeInput,
} from "@/lib/arrivalCode";
import { formatPrice } from "@/lib/vibe";

type AdminArrivalVerifyProps = {
  onVerified: () => void;
};

export function AdminArrivalVerify({ onVerified }: AdminArrivalVerifyProps) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = useCallback(async () => {
    const code = normalizeArrivalCodeInput(raw);
    if (!code || code.length < 7) {
      toast.error("Enter a code like BRY-4821");
      return;
    }
    setBusy(true);
    try {
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("*")
        .eq("arrival_code", code)
        .limit(2);
      if (bErr) throw bErr;

      if (bookings && bookings.length > 0) {
        const b = bookings[0];
        if (bookings.length > 1) {
          toast.error("Ambiguous code — contact dev");
          return;
        }
        if (b.arrival_verified_at) {
          toast.message("Already checked in", {
            description: new Date(b.arrival_verified_at as string).toLocaleString(),
          });
          return;
        }
        if (!isBookingArrivalCodeInWindow(b.date as string, b.time as string)) {
          toast.error("This code has expired (outside 2h window after slot)");
          return;
        }
        const { error: uErr } = await supabase
          .from("bookings")
          .update({
            status: "arrived",
            arrival_verified_at: new Date().toISOString(),
          })
          .eq("id", b.id);
        if (uErr) throw uErr;
        toast.success("Guest checked in", {
          description: `${b.time} · ${b.guests} guests · ${code}`,
        });
        setRaw("");
        onVerified();
        return;
      }

      const { data: orderRows, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .eq("arrival_code", code)
        .limit(2);
      if (oErr) throw oErr;

      if (!orderRows?.length) {
        toast.error("No booking or order matches that code");
        return;
      }
      if (orderRows.length > 1) {
        toast.error("Ambiguous code — contact dev");
        return;
      }
      const o = orderRows[0];
      if (o.arrival_verified_at) {
        toast.message("Order already verified", {
          description: new Date(o.arrival_verified_at as string).toLocaleString(),
        });
        return;
      }
      if (!isOrderArrivalCodeInWindow(o.created_at as string, Date.now(), 6)) {
        toast.error("This pickup code has expired (6h from order time)");
        return;
      }
      const { error: ouErr } = await supabase
        .from("orders")
        .update({ arrival_verified_at: new Date().toISOString() })
        .eq("id", o.id);
      if (ouErr) throw ouErr;
      toast.success("Order / pickup verified", {
        description: `${typeLabel(o.order_type)} · ${formatPrice(Number(o.total))} · ${code}`,
      });
      setRaw("");
      onVerified();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Verify failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [onVerified, raw]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 max-w-lg">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2 mb-1">
        <ScanLine className="w-5 h-5 text-primary" />
        Check-in &amp; pickup
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Type or scan the guest code. Tables use a 2h window from booking time; orders use 6h from order time.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void verify();
          }}
          placeholder="BRY-4821"
          autoCapitalize="characters"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-mono tracking-wide text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void verify()}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground btn-press disabled:opacity-50"
        >
          {busy ? "…" : "Verify"}
        </button>
      </div>
    </section>
  );
}

function typeLabel(t: string | null | undefined) {
  if (t === "preorder") return "Pre-order";
  if (t === "dinein") return "Dine-in";
  return "Pickup";
}
