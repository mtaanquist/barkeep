import React from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useApp } from "../hooks/useApp";
import type { Bar } from "../types";
import { useTranslation } from "../utils/translations";

interface LoginFormProps {
  bar?: Bar;
  onBack: () => void;
  mode?: "bartender" | "guest";
  prefilledBarId?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ 
  bar, 
  onBack, 
  mode, 
  prefilledBarId 
}) => {
  const {
    userType,
    currentBar,
    language,
    loading,
    loginForm,
    showPassword,
    setUserType,
    setLoginForm,
    setShowPassword,
    setCustomerName,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const navigate = useNavigate();
  const t = useTranslation(language);

  // Use the provided bar or the current bar from context
  const targetBar = bar || currentBar;
  const barId = prefilledBarId || targetBar?.id;

  // Set the mode if provided
  React.useEffect(() => {
    if (mode && !userType) {
      setUserType(mode);
    }
  }, [mode, userType, setUserType]);

  const handleLogin = async () => {
    if (!loginForm.password) {
      setError("Password is required");
      return;
    }

    if (userType === "guest" && !loginForm.name) {
      setError("Name is required for guests");
      return;
    }

    if (!barId) {
      setError("Bar information is missing");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint =
        userType === "bartender" ? "/auth/bartender" : "/auth/guest";
      const body = {
        barId,
        password: loginForm.password,
        // Guests give their name; the bartender does not.
        ...(userType === "guest" && { customerName: loginForm.name }),
      };

      await apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Set customer name in context for guests
      if (userType === "guest") {
        setCustomerName(loginForm.name);
      }

      navigate(userType === "bartender" ? "/bartender" : "/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const resetUserType = () => {
    setUserType(null);
    setLoginForm({ password: "", name: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-text">
          {targetBar ? `Login to ${targetBar.name}` : 'Bar Login'}
        </h4>
        <button
          onClick={onBack}
          className="text-sm text-text-muted hover:text-text"
        >
          ← {targetBar ? 'Change Bar' : 'Back'}
        </button>
      </div>

      {/* User Type Selection - only show if not in QR redirect mode */}
      {!mode && (
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => setUserType("bartender")}
            className={`w-full py-3 rounded-md transition-colors font-medium flex items-center justify-center space-x-2 ${
              userType === "bartender"
                ? "bg-text text-text-inverse"
                : "bg-surface-sunken text-text hover:bg-border"
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{t("bartenderLogin")}</span>
          </button>
          <button
            onClick={() => setUserType("guest")}
            className={`w-full py-3 rounded-md transition-colors font-medium flex items-center justify-center space-x-2 ${
              userType === "guest"
                ? "bg-text text-text-inverse"
                : "bg-surface-sunken text-text hover:bg-border"
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{t("guestLogin")}</span>
          </button>
        </div>
      )}

      {/* Login Form */}
      {userType && (
        <div className="space-y-4 border-t pt-4">
          {/* Password Field */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t("enterPassword")}
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((prev) => ({ ...prev, password: e.target.value }))
              }
              className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent pr-10"
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-text-muted hover:text-text"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Guest Name Field */}
          {userType === "guest" && (
            <input
              type="text"
              placeholder={t("enterName")}
              value={loginForm.name}
              onChange={(e) =>
                setLoginForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={
              loading ||
              !loginForm.password ||
              (userType === "guest" && !loginForm.name)
            }
            className="w-full bg-text text-text-inverse py-3 rounded-md hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("loading") : t("login")}
          </button>

          {/* Cancel Button */}
          <button
            onClick={resetUserType}
            className="w-full text-text-muted py-2 hover:text-text transition-colors"
          >
            {t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginForm;
