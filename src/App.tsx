import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import BottomNav from "@/components/BottomNav";
import CartBar from "@/components/CartBar";
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import BookingPage from "@/pages/BookingPage";
import BookingSuccessPage from "@/pages/BookingSuccessPage";
import CartPage from "@/pages/CartPage";
import PlanMyNightPage from "@/pages/PlanMyNightPage";
import ProfilePage from "@/pages/ProfilePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/booking/success" element={<BookingSuccessPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/plan" element={<PlanMyNightPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CartBar />
          <BottomNav />
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
