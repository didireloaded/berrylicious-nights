import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RestaurantChatSheet } from "@/components/RestaurantChatSheet";

type AssistantContextValue = {
  openAssistant: () => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

/** One real assistant entry point, shared by navigation and the dish screen. */
export function RestaurantAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openAssistant = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openAssistant }), [openAssistant]);

  return (
    <AssistantContext.Provider value={value}>
      {children}
      <RestaurantChatSheet open={open} onOpenChange={setOpen} />
    </AssistantContext.Provider>
  );
}

export function useRestaurantAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error("useRestaurantAssistant requires RestaurantAssistantProvider");
  return context;
}
