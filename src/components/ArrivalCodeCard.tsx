import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { bookingArrivalValidUntilMs, orderArrivalValidUntilMs } from "@/lib/arrivalCode";
import { cn } from "@/lib/utils";

type ArrivalCodeCardProps = {
  code: string;
  /** For countdown to reservation start (booking). */
  bookingDate?: string;
  bookingTime?: string;
  /** Pickup / cart orders — 6h window from placement. */
  orderCreatedAt?: string;
  className?: string;
};

export function ArrivalCodeCard({
  code,
  bookingDate,
  bookingTime,
  orderCreatedAt,
  className,
}: ArrivalCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const slotStartMs = useMemo(() => {
    if (!bookingDate || !bookingTime) return null;
    const [y, m, d] = bookingDate.split("-").map(Number);
    const [hh, mm = 0] = bookingTime.split(":").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime();
  }, [bookingDate, bookingTime]);

  const validThroughMs = useMemo(() => {
    if (bookingDate && bookingTime) return bookingArrivalValidUntilMs(bookingDate, bookingTime);
    if (orderCreatedAt) return orderArrivalValidUntilMs(orderCreatedAt, 6);
    return null;
  }, [bookingDate, bookingTime, orderCreatedAt]);

  const countdownLabel = useMemo(() => {
    if (slotStartMs == null) return null;
    const diff = slotStartMs - tick;
    if (diff <= 0) return "Your table time has started — head in when you’re ready.";
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 48) return null;
    if (h > 0) return `About ${h}h ${m}m until your slot`;
    return `About ${m} min until your slot`;
  }, [slotStartMs, tick]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }, [code]);

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-primary/30 bg-card/80 p-5 text-center shadow-inner shadow-black/20",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">Your arrival code</p>
      <p className="mt-3 font-display text-3xl font-bold tracking-wide text-primary">{code}</p>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
        Show this at the door — we’ll match you in one tap.
      </p>
      {validThroughMs != null && (
        <p className="mt-1 text-[10px] text-muted-foreground/80">
          Code valid through{" "}
          {new Date(validThroughMs).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
          {bookingDate && bookingTime ? " (2h after your table time)" : " (6h from order time)"}
        </p>
      )}
      <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
        <QRCodeSVG value={code} size={160} level="M" marginSize={1} />
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground btn-press w-full max-w-xs"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy code"}
      </button>
      {countdownLabel && <p className="mt-4 text-xs text-muted-foreground leading-snug">{countdownLabel}</p>}
    </div>
  );
}
