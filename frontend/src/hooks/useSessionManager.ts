import { useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../hooks/useApp";

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const ACTIVITY_KEY = "homeBarSystem_lastActivity";

export const useSessionManager = () => {
  const { setUserType, setCurrentBar, setCustomerName, setLoginForm } =
    useApp();

  const navigate = useNavigate();
  const location = useLocation();

  const updateActivity = useCallback(() => {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  }, []);

  const hasTimedOut = useCallback(() => {
    const lastActivity = localStorage.getItem(ACTIVITY_KEY);
    if (!lastActivity) return false;

    return Date.now() - parseInt(lastActivity) > SESSION_TIMEOUT;
  }, []);

  const clearSession = useCallback(() => {
    navigate("/");
    setUserType(null);
    setCurrentBar(null);
    setCustomerName("");
    setLoginForm({ password: "", name: "" });
    localStorage.removeItem(ACTIVITY_KEY);
  }, [navigate, setUserType, setCurrentBar, setCustomerName, setLoginForm]);

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
