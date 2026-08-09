import React, { createContext, useContext } from "react";

import type {
  Analytics,
  Bar,
  Category,
  Drink,
  Language,
  Order,
  UserType,
} from "../types";

/** The two sign-in forms hold the same handful of fields throughout. */
type BarForm = {
  name: string;
  bartenderPassword: string;
  guestPassword: string;
  language: Language;
};

type LoginForm = { password: string; name: string };

export interface AppContextType {
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

  // API helper
  apiCall: <T = unknown>(
    endpoint: string,
    options?: RequestInit
  ) => Promise<T>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

/** Everything the pages share: who is signed in, what is on, and the API. */
export function useApp(): AppContextType {
  const context = useContext(AppContext);

  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }

  return context;
}
