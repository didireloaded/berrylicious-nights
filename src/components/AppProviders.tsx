import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CartProvider, useCart } from "@/context/CartContext";
import { AppProvider } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCustomerOrderStatusNotifications } from "@/hooks/useCustomerOrderStatusNotifications";
import { AboutSheetProvider } from "@/context/AboutSheetContext";
import { RestaurantAssistantProvider } from "@/context/RestaurantAssistantContext";
import { NotificationCenterProvider } from "@/context/NotificationCenterContext";
import { TableSessionProvider } from "@/context/TableSessionContext";
import { NotificationCenterSheet } from "@/components/NotificationCenterSheet";
import { WaiterServiceSheet } from "@/components/WaiterServiceSheet";
import { TableContextBar } from "@/components/TableContextBar";
import BottomNav from "@/components/BottomNav";
import SiteHeader from "@/components/SiteHeader";
import { FloatingCartBar } from "@/components/FloatingCartBar";
import PageLoader from "@/components/PageLoader";
import { ScrollToTop } from "@/components/ScrollToTop";

function retryImport<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch(() => fn());
}

const WelcomePage = lazy(() => retryImport(() => import("@/pages/HomePageEditorial")));
const DashboardHomePage = lazy(() => retryImport(() => import("@/pages/DashboardHomePage")));
const MenuPage = lazy(() => retryImport(() => import("@/pages/MenuPage")));
const DrinksPage = lazy(() => retryImport(() => import("@/pages/DrinksPage")));
const EventsPage = lazy(() => retryImport(() => import("@/pages/EventsPage")));
const MenuItemPage = lazy(() => retryImport(() => import("@/pages/MenuItemPage")));
const PromoSpotlightPage = lazy(() => retryImport(() => import("@/pages/PromoSpotlightPage")));
const AboutRouteRedirect = lazy(() => retryImport(() => import("@/pages/AboutRouteRedirect")));
const BookingPage = lazy(() => retryImport(() => import("@/pages/BookingPage")));
const BookingSuccessPage = lazy(() => retryImport(() => import("@/pages/BookingSuccessPage")));
const CartPage = lazy(() => retryImport(() => import("@/pages/CartPage")));
const ProfilePage = lazy(() => retryImport(() => import("@/pages/ProfilePage")));
const AuthPage = lazy(() => retryImport(() => import("@/pages/AuthPage")));
const AdminPage = lazy(() => retryImport(() => import("@/pages/AdminPage")));
const OrderTrackingPage = lazy(() => retryImport(() => import("@/pages/OrderTrackingPage")));
const TableEntryPage = lazy(() => retryImport(() => import("@/pages/TableEntryPage")));
const MessagesPage = lazy(() => retryImport(() => import("@/pages/MessagesPage")));
const NotFound = lazy(() => retryImport(() => import("@/pages/NotFound")));

function OrderNotificationEffects() {
  const { user } = useAuth();
  useCustomerOrderStatusNotifications(user?.id ?? null);
  return null;
}

function BottomSpacing() {
  const { totalItems } = useCart();
  useEffect(() => {
    document.documentElement.style.setProperty("--pb-bottom-chrome", totalItems > 0 ? "11rem" : "6.25rem");
    return () => {
      document.documentElement.style.removeProperty("--pb-bottom-chrome");
    };
  }, [totalItems]);
  return null;
}

function ChromeWrapper() {
  const { pathname } = useLocation();
  const noNav = pathname === "/" || pathname === "/admin" || pathname.startsWith("/menu/");
  return noNav ? null : (
    <>
      <FloatingCartBar />
      <BottomNav />
    </>
  );
}

export default function AppProviders() {
  return (
    <CartProvider>
      <AppProvider>
        <BottomSpacing />
        <BrowserRouter>
          <NotificationCenterProvider>
            <TableSessionProvider>
              <AboutSheetProvider>
                <RestaurantAssistantProvider>
                  <ScrollToTop />
                  <OrderNotificationEffects />
                  <SiteHeader />
                  <TableContextBar />
                  <main id="main-content" tabIndex={-1} className="min-h-dvh bg-[#121212] outline-none focus:outline-none">
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<WelcomePage />} />
                        <Route path="/home" element={<DashboardHomePage />} />
                        <Route path="/menu" element={<MenuPage />} />
                        <Route path="/food" element={<Navigate to="/menu" replace />} />
                        <Route path="/drinks" element={<DrinksPage />} />
                        <Route path="/events" element={<EventsPage />} />
                        <Route path="/menu/:id" element={<MenuItemPage />} />
                        <Route path="/promo" element={<PromoSpotlightPage />} />
                        <Route path="/about" element={<AboutRouteRedirect />} />
                        <Route path="/booking" element={<BookingPage />} />
                        <Route path="/booking/success" element={<BookingSuccessPage />} />
                        <Route path="/cart" element={<CartPage />} />
                        <Route path="/plan" element={<Navigate to="/booking" replace />} />
                        <Route path="/plan-my-night" element={<Navigate to="/booking" replace />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/messages" element={<MessagesPage />} />
                        <Route path="/auth" element={<AuthPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/order/:id" element={<OrderTrackingPage />} />
                        <Route path="/table/:tableCode" element={<TableEntryPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </main>
                  <NotificationCenterSheet />
                  <WaiterServiceSheet />
                  <ChromeWrapper />
                </RestaurantAssistantProvider>
              </AboutSheetProvider>
            </TableSessionProvider>
          </NotificationCenterProvider>
        </BrowserRouter>
      </AppProvider>
    </CartProvider>
  );
}
