import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

import { AppContext, type AppContextType } from "../hooks/useApp";
import { apiCall } from "../utils/api";
import { clearStoredState, useStoredState } from "../hooks/useStoredState";

import type {
  Analytics,
  Bar,
  Category,
  Drink,
  Language,
  Order,
  SignedIn,
  UserType,
  DrinkToRead,
} from "../types";

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [userType, setUserType] = useStoredState<UserType | null>(
    "userType",
    null
  );
  const [currentBar, setCurrentBar] = useStoredState<Bar | null>(
    "currentBar",
    null
  );
  const [customerName, setCustomerName] = useStoredState("customerName", "");
  // Whether the guest proved a password for their name — a "regular". Kept
  // alongside the name so a reload knows to offer the things only a regular
  // gets (changing their own password).
  const [authenticated, setAuthenticated] = useStoredState<boolean>(
    "authenticated",
    false
  );
  const [language, setLanguage] = useStoredState<Language>("language", "en");
  // Whether the guest picked a language by hand. Once they have, picking a bar
  // must not quietly switch it back to the bar's default.
  const [languageChosen, setLanguageChosen] = useStoredState<boolean>(
    "languageChosen",
    false
  );

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [barForm, setBarForm] = useState({
    name: "",
    bartenderPassword: "",
    guestPassword: "",
    language: "en" as Language,
  });
  const [loginForm, setLoginForm] = useState({ password: "", name: "" });

  // Data states
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // UI states
  const [viewingRecipe, setViewingRecipe] = useState<DrinkToRead | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  /** Puts everything back as it was before anyone signed in. */
  const clearAllData = useCallback(() => {
    setUserType(null);
    setCurrentBar(null);
    setCustomerName("");
    setAuthenticated(false);
    setLanguage("en");
    setLanguageChosen(false);
    setBarForm({
      name: "",
      bartenderPassword: "",
      guestPassword: "",
      language: "en",
    });
    setLoginForm({ password: "", name: "" });

    clearStoredState();
  }, [
    setUserType,
    setCurrentBar,
    setCustomerName,
    setAuthenticated,
    setLanguage,
    setLanguageChosen,
  ]);

  // Reconcile the remembered sign-in with the real one. The cookie is the
  // session now; the stored bar and name are only for showing something while
  // we ask. If the server says we are not signed in, forget it here too — so a
  // stale localStorage without a live cookie can't look signed in.
  const reconciled = useRef(false);
  useEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;
    // Nothing to reconcile for someone who was never signed in.
    if (!userType) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          clearAllData();
          return;
        }
        // A blip rather than a sign-out — keep showing what we remembered.
        if (!res.ok) return;

        const me = (await res.json()) as SignedIn;
        setUserType(me.userType);
        setCurrentBar(me.bar);
        if (me.userType === "guest") {
          setCustomerName(me.customerName ?? "");
          setAuthenticated(me.authenticated === true);
        }
      } catch {
        // Offline or unreachable: leave the remembered state be.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    userType,
    clearAllData,
    setUserType,
    setCurrentBar,
    setCustomerName,
    setAuthenticated,
  ]);

  const value: AppContextType = {
    // App state
    userType,
    currentBar,
    customerName,
    authenticated,
    language,
    languageChosen,

    // Loading and error states
    loading,
    error,

    // Form states
    barForm,
    loginForm,

    // Data states
    drinks,
    orders,
    analytics,
    categories,

    // UI states
    viewingRecipe,
    showPassword,

    // Setters
    setUserType,
    setCurrentBar,
    setCustomerName,
    setAuthenticated,
    setLanguage,
    setLanguageChosen,
    setLoading,
    setError,
    setBarForm,
    setLoginForm,
    setDrinks,
    setOrders,
    setAnalytics,
    setCategories,
    setViewingRecipe,
    setShowPassword,

    // API helper
    apiCall,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
