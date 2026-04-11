import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CartProvider, useCart } from "@/context/CartContext";
import { AppProvider } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCustomerOrderStatusNotifications } from "@/hooks/useCustomerOrderStatusNotifications";
import BottomNav from "@/components/BottomNav";
import CartBar from "@/components/CartBar";
import PageLoader from "@/components/PageLoader";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AboutSheetProvider } from "@/context/AboutSheetContext";

/** Auto-retry dynamic imports once on failure (stale cache after rebuild). */
function retryImport<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch(() => {
    // Force reload from server on stale chunk hash
    return fn();
  });
}

const HomePage = lazy(() => retryImport(() => import("@/pages/HomePage")));
const MenuPage = lazy(() => retryImport(() => import("@/pages/MenuPage")));
const MenuItemPage = lazy(() => retryImport(() => import("@/pages/MenuItemPage")));
const PromoSpotlightPage = lazy(() => retryImport(() => import("@/pages/PromoSpotlightPage")));
const AboutRouteRedirect = lazy(() => retryImport(() => import("@/pages/AboutRouteRedirect")));
const BookingPage = lazy(() => retryImport(() => import("@/pages/BookingPage")));
const BookingSuccessPage = lazy(() => retryImport(() => import("@/pages/BookingSuccessPage")));
const CartPage = lazy(() => retryImport(() => import("@/pages/CartPage")));
const PlanMyNightPage = lazy(() => retryImport(() => import("@/pages/PlanMyNightPage")));
const ProfilePage = lazy(() => retryImport(() => import("@/pages/ProfilePage")));
const AuthPage = lazy(() => retryImport(() => import("@/pages/AuthPage")));
const AdminPage = lazy(() => retryImport(() => import("@/pages/AdminPage")));
const OrderTrackingPage = lazy(() => retryImport(() => import("@/pages/OrderTrackingPage")));
const MessagesPage = lazy(() => retryImport(() => import("@/pages/MessagesPage")));
const NotFound = lazy(() => retryImport(() => import("@/pages/NotFound")));

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

/** Hide bottom chrome on admin page */
function ChromeWrapper() {
  const { pathname } = useLocation();
  if (pathname === "/admin") return null;
  return (
    <>
      <CartBar />
      <BottomNav />
    </>
  );
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
        <ChromeWrapper />
        </AboutSheetProvider>
      </BrowserRouter>
      </AppProvider>
    </CartProvider>
  );
};

export default AppProviders;
