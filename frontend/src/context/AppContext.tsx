import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

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
  editingDrink: Drink | {} | null;
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
  setEditingDrink: (drink: Drink | {} | null) => void;
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

const API_BASE = "/api";

// Everything this app saves in the browser starts with this, so signing out
// can clear its own things without touching anything else on the site.
export const STORAGE_PREFIX = "homeBarSystem_";

const STORAGE_KEYS = {
  userType: "homeBarSystem_userType",
  currentBar: "homeBarSystem_currentBar",
  customerName: "homeBarSystem_customerName",
  language: "homeBarSystem_language",
  currentTab: "homeBarSystem_currentTab",
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Initialize state from localStorage if available
  const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  };

  const saveToStorage = <T,>(key: string, value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage`, error);
    }
  };

  // App state with initial values from localStorage
  const [userType, setUserTypeState] = useState<UserType | null>(
    () => loadFromStorage(STORAGE_KEYS.userType, null)
  );

  const [currentBar, setCurrentBarState] = useState<Bar | null>(() =>
    loadFromStorage(STORAGE_KEYS.currentBar, null)
  );

  const [customerName, setCustomerNameState] = useState(() =>
    loadFromStorage(STORAGE_KEYS.customerName, "")
  );

  const [language, setLanguageState] = useState<Language>(() =>
    loadFromStorage(STORAGE_KEYS.language, "en")
  );

  const [currentTab, setCurrentTabState] = useState<Tab>(() =>
    loadFromStorage(STORAGE_KEYS.currentTab, "orders")
  );

  // Wrapper functions that save to storage
  const setUserType = (type: UserType | null) => {
    setUserTypeState(type);
    if (type === null) {
      localStorage.removeItem(STORAGE_KEYS.userType);
    } else {
      saveToStorage(STORAGE_KEYS.userType, type);
    }
  };

  const setCurrentBar = (bar: Bar | null) => {
    setCurrentBarState(bar);
    if (bar === null) {
      localStorage.removeItem(STORAGE_KEYS.currentBar);
    } else {
      saveToStorage(STORAGE_KEYS.currentBar, bar);
    }
  };

  const setCustomerName = (name: string) => {
    setCustomerNameState(name);
    if (name === "") {
      localStorage.removeItem(STORAGE_KEYS.customerName);
    } else {
      saveToStorage(STORAGE_KEYS.customerName, name);
    }
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveToStorage(STORAGE_KEYS.language, lang);
  };

  const setCurrentTab = (tab: Tab) => {
    setCurrentTabState(tab);
    saveToStorage(STORAGE_KEYS.currentTab, tab);
  };

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
  const [editingDrink, setEditingDrink] = useState<Drink | {} | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Drink | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Clear all data function
  const clearAllData = () => {
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

    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  };

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
  }, [userType, currentBar, customerName]);

  // Talks to the API. It keeps the same identity for the life of the app,
  // because anything that reloads when this changes would otherwise reload on
  // every single render.
  const apiCall = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    []
  );

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
