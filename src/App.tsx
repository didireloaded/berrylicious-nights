import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import AppProviders from "@/components/AppProviders";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] translate-y-[-200%] rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg outline-none ring-2 ring-transparent ring-offset-2 ring-offset-background transition-transform focus-visible:translate-y-0 focus-visible:ring-primary"
        >
          Skip to main content
        </a>
        <Sonner />
        <AppProviders />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
