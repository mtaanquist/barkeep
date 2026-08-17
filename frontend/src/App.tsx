import React, { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import LandingPage from "./components/LandingPage";
import BartenderShell from "./components/bartender/BartenderShell";
import OrdersTab from "./components/OrdersTab";
import MenuTab from "./components/MenuTab";
import CategoriesTab from "./components/CategoriesTab";
import RegularsTab from "./components/bartender/RegularsTab";
import AnalyticsTab from "./components/AnalyticsTab";
import SettingsTab from "./components/SettingsTab";
import CustomerInterface from "./components/CustomerInterface";
import DrinkForm from "./components/DrinkForm";
import RecipeView from "./components/RecipeView";
import ErrorDisplay from "./components/ErrorDisplay";
import QRRedirect from "./components/QRRedirect";
import OperatorPanel from "./components/operator/OperatorPanel";
import { AppProvider } from "./context/AppContext";
import { useApp } from "./hooks/useApp";
import { LiveUpdatesProvider } from "./context/LiveUpdatesContext";

const AppContent: React.FC = () => {
  const {
    error,
    viewingRecipe,
    drinks,
    setError,
    setViewingRecipe,
    userType,
    currentBar,
    customerName,
  } = useApp();

  const navigate = useNavigate();
  const location = useLocation();

  // A drink never outlives the screen it was opened from. Leaving that screen
  // by any route — a link, the back button, signing out — takes it with it,
  // rather than leaving it sitting over whatever comes next.
  useEffect(() => setViewingRecipe(null), [location.pathname, setViewingRecipe]);

  // Protected route logic
  const isAuthenticated = userType && currentBar;
  const isCustomerAuthenticated =
    isAuthenticated && userType === "guest" && customerName;
  const isBartenderAuthenticated = isAuthenticated && userType === "bartender";

  // The recipe and an error sit OVER the app rather than replacing it. They
  // were built as dialogs all along, but were returned in place of everything
  // else, so opening one took away the header, the menu and — the reason this
  // matters — the live order.
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* The operator panel. Reached only by the hidden gesture on the
            landing sign; it gates itself on the operator cookie. */}
        <Route path="/operator" element={<OperatorPanel />} />
        <Route path="/bar/:id" element={<QRRedirect />} />
        <Route
          path="/customer"
          element={
            isCustomerAuthenticated ? (
              <CustomerInterface />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        {/* History is a panel over the menu, so the menu is what renders
            here too — it opens the panel when this is the address. */}
        <Route
          path="/customer/past-orders"
          element={
            isCustomerAuthenticated ? (
              <CustomerInterface />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        {/* The bartender's screens are addresses now, not remembered state,
            so the back button works and a screen can be linked to. */}
        <Route
          path="/bartender"
          element={
            isBartenderAuthenticated ? (
              <BartenderShell />
            ) : (
              <Navigate to="/" replace />
            )
          }
        >
          <Route index element={<Navigate to="queue" replace />} />
          <Route path="queue" element={<OrdersTab />} />
          <Route path="menu" element={<MenuTab />} />
          {/* Adding and editing a drink are screens, not a dialog over one. */}
          <Route path="menu/:drinkId" element={<DrinkForm />} />
          <Route path="categories" element={<CategoriesTab />} />
          <Route path="regulars" element={<RegularsTab />} />
          <Route path="analytics" element={<AnalyticsTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {viewingRecipe && (
        <RecipeView
          // The menu arrives a moment after the queue does, so a drink tapped
          // in between is whatever the order remembered. Read it from the menu
          // once that lands, or the recipe on screen stays the old one.
          drink={
            drinks.find((drink) => drink.id === viewingRecipe.id) ??
            viewingRecipe
          }
          onClose={() => setViewingRecipe(null)}
          // Who may change a drink is decided here, once, rather than by each
          // screen that opens one. A drink taken off the menu can still be
          // read from an order that was already placed, but there is no longer
          // a form to open for it.
          onEdit={
            isBartenderAuthenticated &&
            drinks.some((drink) => drink.id === viewingRecipe.id)
              ? () => {
                  const { id } = viewingRecipe;
                  setViewingRecipe(null);
                  navigate(`/bartender/menu/${id}`);
                }
              : undefined
          }
        />
      )}

      {error && <ErrorDisplay error={error} onRetry={() => setError(null)} />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <LiveUpdatesProvider>
          <AppContent />
        </LiveUpdatesProvider>
      </AppProvider>
    </BrowserRouter>
  );
};

export default App;
