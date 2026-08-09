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

  // Error display
  if (error) {
    return <ErrorDisplay error={error} onRetry={() => setError(null)} />;
  }

  // Recipe view modal
  if (viewingRecipe) {
    return (
      <RecipeView
        drink={viewingRecipe}
        onClose={() => setViewingRecipe(null)}
      />
    );
  }

  // Drink form modal
  if (editingDrink !== null) {
    return (
      <DrinkForm
        drink={editingDrink === "new" ? null : editingDrink}
        onClose={() => setEditingDrink(null)}
      />
    );
  }

  // Protected route logic
  const isAuthenticated = userType && currentBar;
  const isCustomerAuthenticated =
    isAuthenticated && userType === "guest" && customerName;
  const isBartenderAuthenticated = isAuthenticated && userType === "bartender";

  return (
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
