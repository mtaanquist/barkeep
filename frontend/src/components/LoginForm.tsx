import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useApp } from "../hooks/useApp";
import type { Bar, SignedIn } from "../types";
import { useTranslation } from "../utils/translations";
import { ApiError } from "../utils/api";
import { rememberMe } from "../hooks/useSessionManager";
import ToggleRow from "./ToggleRow";

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
    setAuthenticated,
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

  // Kept on by default: most people at a party are on their own phone.
  const [remember, setRemember] = useState(true);
  // The optional per-name password, kept apart from the bar's shared one above.
  const [accountPassword, setAccountPassword] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [nameClaimed, setNameClaimed] = useState(false);

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

    const accountPw = accountPassword.trim();

    try {
      const endpoint =
        userType === "bartender" ? "/auth/bartender" : "/auth/guest";
      const body = {
        barId,
        password: loginForm.password,
        // Guests give their name, and optionally a password to claim or prove
        // it; the bartender does neither.
        ...(userType === "guest" && {
          customerName: loginForm.name,
          ...(accountPw ? { accountPassword: accountPw } : {}),
        }),
      };

      const response = await apiCall<SignedIn>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Set customer name in context for guests
      if (userType === "guest") {
        setCustomerName(response.customerName ?? loginForm.name);
        setAuthenticated(response.authenticated === true);
        rememberMe(remember);
      }

      navigate(userType === "bartender" ? "/bartender" : "/customer");
    } catch (err) {
      if (err instanceof ApiError && err.code === "name_claimed") {
        setNameClaimed(true);
        setClaiming(false);
        setError(null);
      } else if (err instanceof ApiError && err.code === "password_incorrect") {
        // A wrong bar password and a wrong name password are both a 401; only
        // the name password carries this code, so it's unambiguous here.
        setError(t("wrongPassword"));
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetUserType = () => {
    setUserType(null);
    setLoginForm({ password: "", name: "" });
    setAccountPassword("");
    setClaiming(false);
    setNameClaimed(false);
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
            <>
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

              {/* A claimed name has to be proved with its password. */}
              {nameClaimed && (
                <p className="text-sm text-text-muted">{t("nameClaimedHelp")}</p>
              )}

              {/* Otherwise, an unobtrusive way to make this name yours. */}
              {!nameClaimed && (
                <ToggleRow
                  on={claiming}
                  onChange={setClaiming}
                  title={t("setPassword")}
                  help={t("setPasswordHelp")}
                />
              )}

              {(nameClaimed || claiming) && (
                <input
                  type="password"
                  placeholder={
                    nameClaimed ? t("yourPassword") : t("setAPassword")
                  }
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
                  onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                />
              )}

              <ToggleRow
                on={remember}
                onChange={setRemember}
                title={t("rememberMe")}
                help={t("rememberMeHelp")}
              />
            </>
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
