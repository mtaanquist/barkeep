import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useApp } from "../hooks/useApp";
import { useGuestClaim } from "../hooks/useGuestClaim";
import type { Bar, SignedIn } from "../types";
import { useTranslation } from "../utils/translations";
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
  const claim = useGuestClaim();

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

  const handleLogin = async () => {
    if (!loginForm.password) {
      setError(t("errorPasswordRequired"));
      return;
    }

    if (userType === "guest" && !loginForm.name) {
      setError(t("errorNameRequired"));
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
        // Guests give their name, and optionally a password to claim or prove
        // it; the bartender does neither.
        ...(userType === "guest" && {
          customerName: loginForm.name,
          ...(claim.password ? { accountPassword: claim.password } : {}),
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
      // A claimed name reveals the password field; a wrong one says so. A wrong
      // bar password and a wrong name password are both a 401, but only the
      // name password carries a code, so classify tells them apart.
      setError(claim.classify(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const resetUserType = () => {
    setUserType(null);
    setLoginForm({ password: "", name: "" });
    claim.reset();
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
                onChange={(e) => {
                  setLoginForm((prev) => ({ ...prev, name: e.target.value }));
                  if (claim.nameClaimed) setError(null);
                  claim.onNameChange();
                }}
                className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              />

              {/* A claimed name has to be proved with its password — the only
                  time the door asks for one. Registering happens inside. */}
              {claim.nameClaimed && (
                <>
                  <p className="text-sm text-text-muted">
                    {t("nameClaimedHelp")}
                  </p>
                  <input
                    type="password"
                    placeholder={t("yourPassword")}
                    value={claim.accountPassword}
                    onChange={(e) => claim.setAccountPassword(e.target.value)}
                    className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
                    onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                  />
                </>
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
