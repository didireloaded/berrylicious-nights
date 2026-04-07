import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AboutSheet } from "@/components/AboutSheet";

type AboutSheetContextValue = {
  openAbout: () => void;
};

const AboutSheetContext = createContext<AboutSheetContextValue | null>(null);

export function AboutSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openAbout = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openAbout }), [openAbout]);

  return (
    <AboutSheetContext.Provider value={value}>
      {children}
      <AboutSheet open={open} onOpenChange={setOpen} />
    </AboutSheetContext.Provider>
  );
}

export function useAboutSheet() {
  const ctx = useContext(AboutSheetContext);
  if (!ctx) {
    throw new Error("useAboutSheet must be used within AboutSheetProvider");
  }
  return ctx;
}
