import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import BartenderDashboard from "./components/BartenderDashboard";
import CustomerInterface from "./components/CustomerInterface";
import DrinkForm from "./components/DrinkForm";
import RecipeView from "./components/RecipeView";
import ErrorDisplay from "./components/ErrorDisplay";
import QRRedirect from "./components/QRRedirect";
import { AppProvider } from "./context/AppContext";
import { useApp } from "./hooks/useApp";
import { LiveUpdatesProvider } from "./context/LiveUpdatesContext";
import PastOrdersPage from "./pages/PastOrdersPage";

const AppContent: React.FC = () => {
  const {
    error,
    editingDrink,
    viewingRecipe,
    setError,
    setEditingDrink,
    setViewingRecipe,
    userType,
    currentBar,
    customerName,
  } = useApp();

  // Protected route logic
  const isAuthenticated = userType && currentBar;
  const isCustomerAuthenticated =
    isAuthenticated && userType === "guest" && customerName;
  const isBartenderAuthenticated = isAuthenticated && userType === "bartender";

  // The recipe, the drink form and an error all sit OVER the app rather than
  // replacing it. They were built as dialogs all along, but were returned in
  // place of everything else, so opening one took away the header, the menu
  // and — the reason this matters — the live order.
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
        <Route
          path="/customer/past-orders"
          element={
            isCustomerAuthenticated ? (
              <PastOrdersPage />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/bartender"
          element={
            isBartenderAuthenticated ? (
              <BartenderDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {viewingRecipe && (
        <RecipeView
          drink={viewingRecipe}
          onClose={() => setViewingRecipe(null)}
        />
      )}

      {editingDrink !== null && (
        <DrinkForm
          drink={editingDrink === "new" ? null : editingDrink}
          onClose={() => setEditingDrink(null)}
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
