import { useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../hooks/useApp";

const A_DAY = 24 * 60 * 60 * 1000;

/** How long a session lasts without being used. */
const SESSION_TIMEOUT = A_DAY;

/** And how long when the guest asked to be remembered. */
const REMEMBERED_TIMEOUT = 60 * A_DAY;

// Kept under the old name for the same reason as STORAGE_PREFIX.
export const ACTIVITY_KEY = "homeBarSystem_lastActivity";
export const REMEMBER_KEY = "homeBarSystem_remember";

/** Remembers this guest on this browser for the next two months. */
export function rememberMe(remember: boolean): void {
  if (remember) localStorage.setItem(REMEMBER_KEY, "true");
  else localStorage.removeItem(REMEMBER_KEY);
}

const isRemembered = () => localStorage.getItem(REMEMBER_KEY) === "true";

export const useSessionManager = () => {
  const {
    setUserType,
    setCurrentBar,
    setCustomerName,
    setLoginForm,
    setViewingRecipe,
    apiCall,
  } =
    useApp();

  const navigate = useNavigate();
  const location = useLocation();

  const updateActivity = useCallback(() => {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  }, []);

  const hasTimedOut = useCallback(() => {
    const lastActivity = localStorage.getItem(ACTIVITY_KEY);
    if (!lastActivity) return false;

    const allowed = isRemembered() ? REMEMBERED_TIMEOUT : SESSION_TIMEOUT;
    return Date.now() - parseInt(lastActivity) > allowed;
  }, []);

  const clearSession = useCallback(() => {
    // Drop the cookie on the server too, or the next visit would just sign
    // back in from it. Fire and forget — signing out here happens regardless.
    void apiCall("/auth/logout", { method: "POST" }).catch(() => {});
    navigate("/");
    setUserType(null);
    setCurrentBar(null);
    setCustomerName("");
    setLoginForm({ password: "", name: "" });
    // An open recipe would otherwise sit over the sign-in page for whoever
    // picks the tablet up next.
    setViewingRecipe(null);
    localStorage.removeItem(ACTIVITY_KEY);
    // Signing out is the guest saying it is not them, so forget them too.
    localStorage.removeItem(REMEMBER_KEY);
  }, [
    apiCall,
    navigate,
    setUserType,
    setCurrentBar,
    setCustomerName,
    setLoginForm,
    setViewingRecipe,
  ]);

  useEffect(() => {
    const isOnLandingPage = location.pathname === "/";

    // Check for expired session on mount
    if (!isOnLandingPage && hasTimedOut()) {
      console.log("Session expired, clearing...");
      clearSession();
      return;
    }

    // Update activity timestamp when component mounts
    if (!isOnLandingPage) {
      updateActivity();
    }

    // Set up activity listeners
    const handleActivity = () => {
      if (!isOnLandingPage) {
        updateActivity();
      }
    };

    // Listen for user activity
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [location.pathname, hasTimedOut, clearSession, updateActivity]);

  return { clearSession, updateActivity };
};
