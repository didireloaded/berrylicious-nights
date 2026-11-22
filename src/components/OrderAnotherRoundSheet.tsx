import { useMemo } from "react";
import { ReorderPreviewSheet } from "@/components/ReorderPreviewSheet";
import { extractDrinkLinesFromOrder } from "@/lib/anotherRound";

type OrderAnotherRoundSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  orderItems: unknown;
};

/**
 * Revalidates ONLY the drinks from the customer's current or recent order so they
 * can order another round to their table in one tap with live price & availability checks.
 */
export function OrderAnotherRoundSheet({
  open,
  onOpenChange,
  orderNumber,
  orderItems,
}: OrderAnotherRoundSheetProps) {
  const drinkLines = useMemo(() => extractDrinkLinesFromOrder(orderItems), [orderItems]);

  return (
    <ReorderPreviewSheet
      open={open}
      onOpenChange={onOpenChange}
      orderNumber={`ROUND · ${orderNumber}`}
      orderItems={drinkLines}
    />
  );
}
