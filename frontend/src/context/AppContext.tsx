import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// Types
export interface Bar {
  id: number;
  name: string;
  language: string;
}

export interface Category {
  id: number;
  bar_id: number;
  name: string;
  created_at: string;
}

export interface Drink {
  id: number;
  bar_id: number;
  title: string;
  image_url?: string;
  recipe: string;
  in_stock: boolean;
  created_at: string;
  base_spirit?: string;
  guest_description?: string;
  show_recipe_to_guests?: boolean;
  is_favourite?: boolean; // Added for favourite status
  category_id?: number;
  category_name?: string;
}

export interface Order {
  id: number;
  bar_id: number;
  customer_name: string;
  drink_id: number;
  drink_title: string;
  drink_recipe?: string; // Recipe from drinks table, available for bartenders
  status: "new" | "accepted" | "rejected" | "ready" | "processed";
  created_at: string;
  updated_at: string;
}

export interface Analytics {
  totalOrders: number;
  ordersToday: number;
  popularDrinks: Array<{ drink_title: string; order_count: number }>;
  peakHours: Array<{ hour: string; count: number }>;
}

interface AppContextType {
  // App state
  userType: "bartender" | "guest" | null;
  currentBar: Bar | null;
  customerName: string;
  language: "en" | "da";

  // Loading and error states
  loading: boolean;
  error: string | null;

  // Form states
  barForm: {
    name: string;
    bartenderPassword: string;
    guestPassword: string;
    language: "en" | "da";
  };
  loginForm: { password: string; name: string };

  // Data states
  drinks: Drink[];
  orders: Order[];
  analytics: Analytics | null;
  categories: Category[];

  // UI states
  editingDrink: Drink | {} | null;
  viewingRecipe: Drink | null;
  showPassword: boolean;
  currentTab: "orders" | "menu" | "analytics" | "categories";

  // Setters
  setUserType: (type: "bartender" | "guest" | null) => void;
  setCurrentBar: (bar: Bar | null) => void;
  setCustomerName: (name: string) => void;
  setLanguage: (lang: "en" | "da") => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setBarForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      bartenderPassword: string;
      guestPassword: string;
      language: "en" | "da";
    }>
  >;
  setLoginForm: React.Dispatch<
    React.SetStateAction<{ password: string; name: string }>
  >;
  setDrinks: React.Dispatch<React.SetStateAction<Drink[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setAnalytics: React.Dispatch<React.SetStateAction<Analytics | null>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setEditingDrink: (drink: Drink | {} | null) => void;
  setViewingRecipe: (drink: Drink | null) => void;
  setShowPassword: (show: boolean) => void;
  setCurrentTab: (tab: "orders" | "menu" | "analytics" | "categories") => void;

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
  const [userType, setUserTypeState] = useState<"bartender" | "guest" | null>(
    () => loadFromStorage(STORAGE_KEYS.userType, null)
  );

  const [currentBar, setCurrentBarState] = useState<Bar | null>(() =>
    loadFromStorage(STORAGE_KEYS.currentBar, null)
  );

  const [customerName, setCustomerNameState] = useState(() =>
    loadFromStorage(STORAGE_KEYS.customerName, "")
  );

  const [language, setLanguageState] = useState<"en" | "da">(() =>
    loadFromStorage(STORAGE_KEYS.language, "en")
  );

  const [currentTab, setCurrentTabState] = useState<
    "orders" | "menu" | "analytics" | "categories"
  >(() => loadFromStorage(STORAGE_KEYS.currentTab, "orders"));

  // Wrapper functions that save to storage
  const setUserType = (type: "bartender" | "guest" | null) => {
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

  const setLanguage = (lang: "en" | "da") => {
    setLanguageState(lang);
    saveToStorage(STORAGE_KEYS.language, lang);
  };

  const setCurrentTab = (tab: "orders" | "menu" | "analytics" | "categories") => {
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
    language: "en" as "en" | "da",
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
    localStorage.clear();
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

  // API helper function
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
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
  };

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
