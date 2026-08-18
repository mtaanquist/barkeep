import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { useGuestClaim } from "../hooks/useGuestClaim";
import type { Bar, SignedIn } from "../types";
import { useTranslation } from "../utils/translations";
import LoginForm from "./LoginForm";
import { ACTIVITY_KEY, rememberMe } from "../hooks/useSessionManager";
import ToggleRow from "./ToggleRow";

const QRRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    language,
    setCurrentBar,
    setLanguage,
    setCustomerName,
    setUserType,
    setAuthenticated,
    apiCall,
  } = useApp();
  const t = useTranslation(language);
  const claim = useGuestClaim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  // Kept on by default: someone scanning a code is on their own phone.
  const [remember, setRemember] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    const fetchBarInfo = async () => {
      if (!id) {
        navigate("/");
        return;
      }

      // Prevent multiple calls
      if (hasFetched.current) {
        return;
      }
      hasFetched.current = true;

      // Check if there's a guest token in the URL
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      try {
        setLoading(true);
        const bar = await apiCall<Bar>(`/bars/${id}`);
        
        // Set the bar and language in context
        setCurrentBar(bar);
        setLanguage(bar.language);
        
        if (token) {
          // If there's a token, this is a QR code access - show guest name form
          setHasToken(true);
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching bar:", err);
        setError(t("errorBarNotFoundQr"));
      } finally {
        setLoading(false);
      }
    };

    fetchBarInfo();
  }, [id, navigate, apiCall, setCurrentBar, setLanguage, t]);

  // Handle guest login with token
  const handleGuestLogin = async () => {
    if (!guestName.trim() || guestName.trim().length < 2) {
      setError(t("errorEnterName"));
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      setError(t("errorBadQrCode"));
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const response = await apiCall<SignedIn>(
        `/bars/${id}/guest-token-login`,
        {
          method: "POST",
          body: JSON.stringify({
            token,
            customerName: guestName.trim(),
            // Only when there is one: proving a claimed name, or claiming a new.
            ...(claim.password ? { accountPassword: claim.password } : {}),
          }),
        }
      );

      // Update app context with authentication info. The server hands back the
      // stored spelling of a claimed name, so use that when it does.
      setCustomerName(response.customerName ?? guestName.trim());
      setAuthenticated(response.authenticated === true);
      setUserType("guest");

      // Update session activity timestamp
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
      rememberMe(remember);

      // The current bar should already be set from the earlier fetchBarInfo call,
      // but let's make sure it has the latest info
      if (response.bar) {
        setCurrentBar(response.bar);
        setLanguage(response.bar.language);
      }

      // Navigate to customer interface
      navigate("/customer");
    } catch (err) {
      // A claimed name reveals the password field; anything else is a message.
      setError(claim.classify(err, "Failed to login"));
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sign flex items-center justify-center">
        <div className="bg-surface-raised rounded-md p-8 shadow-float max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-text mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-text mb-2">{t("loadingBar")}</h2>
            <p className="text-text-muted">{t("loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-sign flex items-center justify-center">
        <div className="bg-surface-raised rounded-md p-8 shadow-float max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-status-rejected-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text mb-2">{t("barNotFound")}</h2>
            <p className="text-text-muted mb-4">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="bg-text text-text-inverse px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors"
            >
              {t("goHome")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show different UI based on whether we have a token (QR scan) or not
  if (hasToken) {
    // QR code scanned - show simple name entry form
    return (
      <div className="min-h-screen bg-sign flex">
        {/* Left Side - Welcome Message */}
        <div className="hidden md:flex md:w-1/2 lg:w-3/5 p-8 lg:p-12 items-center">
          <div className="text-sign-fg max-w-lg">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              {t("welcomeToBar")}
            </h1>
            <p className="text-xl opacity-90">{t("qrArrival")}</p>
          </div>
        </div>

        {/* Right Side - Name Entry Form */}
        <div className="w-full md:w-1/2 lg:w-2/5 bg-surface-raised flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h4 className="text-2xl font-bold text-text mb-2">{t("enterName")}</h4>
              </div>

              <input
                type="text"
                placeholder={t("yourName")}
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value);
                  if (claim.nameClaimed) setError(null);
                  claim.onNameChange();
                }}
                className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
                onKeyPress={(e) => e.key === "Enter" && handleGuestLogin()}
                autoFocus
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
                    onKeyPress={(e) => e.key === "Enter" && handleGuestLogin()}
                    autoFocus
                  />
                </>
              )}

              <ToggleRow
                on={remember}
                onChange={setRemember}
                title={t("rememberMe")}
                help={t("rememberMeHelp")}
              />

              {error && (
                <div className="text-danger text-sm text-center">{error}</div>
              )}

              <button
                onClick={handleGuestLogin}
                disabled={isLoggingIn || !guestName.trim() || guestName.trim().length < 2}
                className="w-full bg-text text-text-inverse py-3 rounded-md hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? t("loading") : t("startOrdering")}
              </button>

              <button
                onClick={() => navigate("/")}
                className="w-full text-text-muted py-2 hover:text-text transition-colors"
              >
                {t("goHome")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No token - show regular login form (fallback)
  return (
    <div className="min-h-screen bg-sign flex">
      {/* Left Side - Welcome Message */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 p-8 lg:p-12 items-center">
        <div className="text-sign-fg max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            {t("welcomeToBar")}
          </h1>
          <p className="text-xl opacity-90">{t("landingIntro")}</p>
        </div>
      </div>

      {/* Right Side - Guest Login Form */}
      <div className="w-full md:w-1/2 lg:w-2/5 bg-surface-raised flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <LoginForm 
            mode="guest"
            prefilledBarId={id}
            onBack={() => navigate("/")}
          />
        </div>
      </div>
    </div>
  );
};

export default QRRedirect;
