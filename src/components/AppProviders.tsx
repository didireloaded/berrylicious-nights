import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CartProvider, useCart } from "@/context/CartContext";
import { AppProvider } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCustomerOrderStatusNotifications } from "@/hooks/useCustomerOrderStatusNotifications";
import BottomNav from "@/components/BottomNav";
import CartBar from "@/components/CartBar";
import PageLoader from "@/components/PageLoader";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AboutSheetProvider } from "@/context/AboutSheetContext";

const HomePage = lazy(() => import("@/pages/HomePage"));
const MenuPage = lazy(() => import("@/pages/MenuPage"));
const MenuItemPage = lazy(() => import("@/pages/MenuItemPage"));
const PromoSpotlightPage = lazy(() => import("@/pages/PromoSpotlightPage"));
const AboutRouteRedirect = lazy(() => import("@/pages/AboutRouteRedirect"));
const BookingPage = lazy(() => import("@/pages/BookingPage"));
const BookingSuccessPage = lazy(() => import("@/pages/BookingSuccessPage"));
const CartPage = lazy(() => import("@/pages/CartPage"));
const PlanMyNightPage = lazy(() => import("@/pages/PlanMyNightPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const OrderTrackingPage = lazy(() => import("@/pages/OrderTrackingPage"));
const MessagesPage = lazy(() => import("@/pages/MessagesPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

/** In-app order toasts + browser Notification API (web). */
function OrderNotificationEffects() {
  const { user } = useAuth();
  useCustomerOrderStatusNotifications(user?.id ?? null);
  return null;
}

/** Tight bottom padding when cart is empty; extra space when CartBar is visible (avoids overlap). */
function BottomChromePaddingSync() {
  const { totalItems } = useCart();
  useEffect(() => {
    const chrome = totalItems > 0 ? "7.75rem" : "4rem";
    document.documentElement.style.setProperty("--pb-bottom-chrome", chrome);
    return () => {
      document.documentElement.style.removeProperty("--pb-bottom-chrome");
    };
  }, [totalItems]);
  return null;
}

const AppProviders = () => {
  return (
    <CartProvider>
      <AppProvider>
      <BottomChromePaddingSync />
      <BrowserRouter>
        <AboutSheetProvider>
        <ScrollToTop />
        <OrderNotificationEffects />
        <main id="main-content" tabIndex={-1} className="block min-h-dvh outline-none focus:outline-none">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/menu/:id" element={<MenuItemPage />} />
              <Route path="/promo" element={<PromoSpotlightPage />} />
              <Route path="/about" element={<AboutRouteRedirect />} />
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/booking/success" element={<BookingSuccessPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/plan" element={<PlanMyNightPage />} />
              <Route path="/plan-my-night" element={<Navigate to="/plan" replace />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/order/:id" element={<OrderTrackingPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <CartBar />
        <BottomNav />
        </AboutSheetProvider>
      </BrowserRouter>
      </AppProvider>
    </CartProvider>
  );
};

export default AppProviders;
