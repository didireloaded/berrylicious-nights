import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, Minus, Plus, RotateCcw, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { revalidatePastOrderForReorder } from "@/lib/reorderValidation";
import { formatPrice } from "@/lib/vibe";
import { cn } from "@/lib/utils";

type ReorderPreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  orderItems: unknown;
};

export function ReorderPreviewSheet({
  open,
  onOpenChange,
  orderNumber,
  orderItems,
}: ReorderPreviewSheetProps) {
  const { addItem } = useCart();
  const { disabledIds, refresh: refreshAvailability } = useMenuAvailability();
  const navigate = useNavigate();
  const [liveDisabled, setLiveDisabled] = useState<Set<string>>(disabledIds);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void refreshAvailability().then((fresh) => {
      if (alive) setLiveDisabled(fresh);
    });
    return () => {
      alive = false;
    };
  }, [open, refreshAvailability]);

  const summary = useMemo(
    () => revalidatePastOrderForReorder(orderItems, liveDisabled),
    [orderItems, liveDisabled],
  );

  useEffect(() => {
    if (!open) return;
    const nextSelected = new Set<string>();
    const nextQty: Record<string, number> = {};
    for (const line of summary.lines) {
      if (line.canAdd) nextSelected.add(line.key);
      nextQty[line.key] = line.quantity;
    }
    setSelectedKeys(nextSelected);
    setQuantities(nextQty);
  }, [open, summary]);

  const toggleLine = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const line of summary.lines) {
      if (!line.canAdd || !selectedKeys.has(line.key) || line.currentUnitPrice === null) continue;
      const q = quantities[line.key] ?? line.quantity;
      total += line.currentUnitPrice * q;
    }
    return total;
  }, [summary.lines, selectedKeys, quantities]);

  const handleAddToCart = () => {
    let addedLines = 0;
    for (const line of summary.lines) {
      if (!line.canAdd || !line.menuItem || !selectedKeys.has(line.key)) continue;
      const q = Math.max(1, Math.min(20, quantities[line.key] ?? line.quantity));
      for (let i = 0; i < q; i += 1) {
        if (line.customization) addItem(line.menuItem, line.customization);
        else addItem(line.menuItem);
      }
      addedLines += 1;
    }
    if (addedLines === 0) {
      toast.error("Select at least one available item to add to your cart.");
      return;
    }
    toast.success("Validated items added to your cart — review before placing your order.");
    onOpenChange(false);
    navigate("/cart");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => onOpenChange(false)}
        className={cn(
          "flex max-h-[min(90dvh,760px)] flex-col rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white shadow-2xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetTitle className="sr-only">Reorder Review</SheetTitle>
        <SheetDescription className="sr-only">
          Review current Butcher Block availability and prices before adding past items to your cart.
        </SheetDescription>

        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-3.5 pt-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-[17px] font-bold text-white">Order Again</h2>
              <p className="text-[12px] text-[#A3A3A3]">
                Revalidated against today&apos;s menu · #{orderNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close reorder preview"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#242424] text-white hover:bg-[#303030]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3">
          {(summary.blockedCount > 0 || summary.hasPriceChanges || summary.hasNotices) && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-[13px] text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
              <p>
                We checked your previous order against today&apos;s Butcher Block menu and live kitchen availability. Review any updates below before adding to your cart.
              </p>
            </div>
          )}

          {summary.lines.map((line) => {
            const checked = selectedKeys.has(line.key);
            const qty = quantities[line.key] ?? line.quantity;
            const modText = [
              line.customization?.weight,
              line.customization?.doneness,
              line.customization?.side ? `Side: ${line.customization.side}` : null,
              line.customization?.sauces?.length ? `Sauce: ${line.customization.sauces.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={line.key}
                className={cn(
                  "rounded-[20px] border p-4 space-y-2",
                  !line.canAdd
                    ? "border-red-500/35 bg-red-950/20"
                    : checked
                      ? "border-[#FF5A1F]/35 bg-[#242424]"
                      : "border-white/10 bg-[#1B1B1B] opacity-65",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {line.canAdd && (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={`Include ${line.originalName}`}
                        onClick={() => toggleLine(line.key)}
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                          checked
                            ? "border-[#FF5A1F] bg-[#FF5A1F] text-white"
                            : "border-white/25 bg-[#181818]",
                        )}
                      >
                        {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      </button>
                    )}
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-white">{line.originalName}</p>
                      {modText && <p className="mt-0.5 text-[12px] text-[#A3A3A3]">{modText}</p>}
                      {line.blockingReason && (
                        <p className="mt-1 text-[12px] font-semibold text-red-300">{line.blockingReason}</p>
                      )}
                      {line.notices.map((n, idx) => (
                        <p key={idx} className="mt-1 text-[12px] text-amber-300">{n}</p>
                      ))}
                    </div>
                  </div>

                  {line.canAdd && line.currentUnitPrice !== null && (
                    <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-[#FF5A1F]">
                      {formatPrice(line.currentUnitPrice * qty)}
                    </span>
                  )}
                </div>

                {line.canAdd && checked && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      aria-label={`Decrease ${line.originalName} quantity`}
                      onClick={() =>
                        setQuantities((prev) => ({ ...prev, [line.key]: Math.max(1, (prev[line.key] ?? qty) - 1) }))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#181818] text-white"
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <span className="min-w-[24px] text-center text-[14px] font-bold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${line.originalName} quantity`}
                      onClick={() =>
                        setQuantities((prev) => ({ ...prev, [line.key]: Math.min(20, (prev[line.key] ?? qty) + 1) }))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#181818] text-white"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#181818] px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] text-[#A3A3A3]">Updated cart addition</span>
            <span className="text-[20px] font-extrabold tabular-nums text-[#FF5A1F]">
              {formatPrice(selectedTotal)}
            </span>
          </div>
          <button
            type="button"
            disabled={selectedKeys.size === 0}
            onClick={handleAddToCart}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#FF5A1F] text-[15px] font-bold text-white transition-colors hover:bg-[#E84D15] disabled:opacity-45"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Add {selectedKeys.size} {selectedKeys.size === 1 ? "Item" : "Items"} to Cart
          </button>
          <p className="text-center text-[11px] text-[#A3A3A3]">
            Nothing is submitted automatically — you&apos;ll confirm everything in your cart.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
