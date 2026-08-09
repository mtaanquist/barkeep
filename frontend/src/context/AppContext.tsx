import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { apiCall } from "../utils/api";
import { clearStoredState, useStoredState } from "../hooks/useStoredState";

import type {
  Analytics,
  Bar,
  Category,
  Drink,
  Language,
  Order,
  UserType,
} from "../types";

/** The bartender's tabs, in the order they appear. */
export type Tab =
  | "orders"
  | "menu"
  | "analytics"
  | "categories"
  | "settings";

/** The two sign-in forms hold the same handful of fields throughout. */
type BarForm = {
  name: string;
  bartenderPassword: string;
  guestPassword: string;
  language: Language;
};

type LoginForm = { password: string; name: string };

interface AppContextType {
  // App state
  userType: UserType | null;
  currentBar: Bar | null;
  customerName: string;
  language: Language;

  // Loading and error states
  loading: boolean;
  error: string | null;

  // Form states
  barForm: BarForm;
  loginForm: LoginForm;

  // Data states
  drinks: Drink[];
  orders: Order[];
  analytics: Analytics | null;
  categories: Category[];

  // UI states
  editingDrink: Drink | "new" | null;
  viewingRecipe: Drink | null;
  showPassword: boolean;
  currentTab: Tab;

  // Setters
  setUserType: (type: UserType | null) => void;
  setCurrentBar: (bar: Bar | null) => void;
  setCustomerName: (name: string) => void;
  setLanguage: (lang: Language) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setBarForm: React.Dispatch<React.SetStateAction<BarForm>>;
  setLoginForm: React.Dispatch<React.SetStateAction<LoginForm>>;
  setDrinks: React.Dispatch<React.SetStateAction<Drink[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setAnalytics: React.Dispatch<React.SetStateAction<Analytics | null>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setEditingDrink: (drink: Drink | "new" | null) => void;
  setViewingRecipe: (drink: Drink | null) => void;
  setShowPassword: (show: boolean) => void;
  setCurrentTab: (tab: Tab) => void;

  // API helper
  apiCall: (endpoint: string, options?: RequestInit) => Promise<any>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

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
  const [language, setLanguage] = useStoredState<Language>("language", "en");
  const [currentTab, setCurrentTab] = useStoredState<Tab>(
    "currentTab",
    "orders"
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
  const [editingDrink, setEditingDrink] = useState<Drink | "new" | null>(
    null
  );
  const [viewingRecipe, setViewingRecipe] = useState<Drink | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  /** Puts everything back as it was before anyone signed in. */
  const clearAllData = useCallback(() => {
    setUserType(null);
    setCurrentBar(null);
    setCustomerName("");
    setLanguage("en");
    setCurrentTab("menu");
    setBarForm({
      name: "",
      bartenderPassword: "",
      guestPassword: "",
      language: "en",
    });
    setLoginForm({ password: "", name: "" });

    clearStoredState();
  }, [setUserType, setCurrentBar, setCustomerName, setLanguage, setCurrentTab]);

  // Session validation effect
  useEffect(() => {
    const validateSession = () => {
      // Only validate sessions that should be fully authenticated
      // This means checking routes that require authentication, not just the presence of userType/currentBar
      const currentPath = window.location.pathname;
      const isOnProtectedRoute =
        currentPath.startsWith("/customer") ||
        currentPath.startsWith("/bartender");

      // Only validate if user is on a protected route
      if (isOnProtectedRoute) {
        // If on customer route but missing authentication requirements
        if (currentPath.startsWith("/customer")) {
          if (
            !userType ||
            !currentBar ||
            userType !== "guest" ||
            !customerName
          ) {
            console.log(
              "Invalid customer session on protected route, resetting..."
            );
            clearAllData();
            return;
          }
        }

        // If on bartender route but missing authentication requirements
        if (currentPath.startsWith("/bartender")) {
          if (!userType || !currentBar || userType !== "bartender") {
            console.log(
              "Invalid bartender session on protected route, resetting..."
            );
            clearAllData();
            return;
          }
        }
      }
    };

    validateSession();
  }, [userType, currentBar, customerName, clearAllData]);

  const value: AppContextType = {
    // App state
    userType,
    currentBar,
    customerName,
    language,

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
    editingDrink,
    viewingRecipe,
    showPassword,
    currentTab,

    // Setters
    setUserType,
    setCurrentBar,
    setCustomerName,
    setLanguage,
    setLoading,
    setError,
    setBarForm,
    setLoginForm,
    setDrinks,
    setOrders,
    setAnalytics,
    setCategories,
    setEditingDrink,
    setViewingRecipe,
    setShowPassword,
    setCurrentTab,

    // API helper
    apiCall,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
