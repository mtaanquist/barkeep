import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import LoginForm from "./LoginForm";
import { ACTIVITY_KEY } from "../hooks/useSessionManager";

const QRRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setCurrentBar, setLanguage, setCustomerName, setUserType, apiCall } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
        const bar = await apiCall(`/bars/${id}`);
        
        // Set the bar and language in context
        setCurrentBar(bar);
        setLanguage(bar.language as "en" | "da");
        
        if (token) {
          // If there's a token, this is a QR code access - show guest name form
          setHasToken(true);
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching bar:", err);
        setError("Bar not found. Please check the QR code or try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchBarInfo();
  }, [id, navigate, apiCall, setCurrentBar, setLanguage]);

  // Handle guest login with token
  const handleGuestLogin = async () => {
    if (!guestName.trim() || guestName.trim().length < 2) {
      setError("Please enter your name (at least 2 characters)");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      setError("Invalid access token");
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const response = await apiCall(`/bars/${id}/guest-token-login`, {
        method: "POST",
        body: JSON.stringify({
          token,
          customerName: guestName.trim(),
        }),
      });

      // Update app context with authentication info
      setCustomerName(guestName.trim());
      setUserType("guest");
      
      // Update session activity timestamp
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
      
      // The current bar should already be set from the earlier fetchBarInfo call,
      // but let's make sure it has the latest info
      if (response.barId && response.barName && response.language) {
        setCurrentBar({
          id: response.barId,
          name: response.barName,
          language: response.language
        });
        setLanguage(response.language as "en" | "da");
      }

      // Navigate to customer interface
      navigate("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to login");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Loading Bar...</h2>
            <p className="text-gray-600">Please wait while we load the bar information.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Bar Not Found</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Home Page
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
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex">
        {/* Left Side - Welcome Message */}
        <div className="hidden md:flex md:w-1/2 lg:w-3/5 p-8 lg:p-12 items-center">
          <div className="text-white max-w-lg">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Welcome to the Bar! 🍸
            </h1>
            <p className="text-xl opacity-90 mb-8">
              You've scanned a QR code to access this bar. Just enter your name below to start browsing drinks and placing orders.
            </p>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <h3 className="font-semibold mb-2">Quick Access</h3>
              <p className="opacity-80">
                No password needed! The QR code has already authenticated you as a guest.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Name Entry Form */}
        <div className="w-full md:w-1/2 lg:w-2/5 bg-white flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h4 className="text-2xl font-bold text-gray-800 mb-2">Enter Your Name</h4>
                <p className="text-gray-600">To get started with your order</p>
              </div>

              <input
                type="text"
                placeholder="Your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === "Enter" && handleGuestLogin()}
                autoFocus
              />

              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}

              <button
                onClick={handleGuestLogin}
                disabled={isLoggingIn || !guestName.trim() || guestName.trim().length < 2}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? "Logging in..." : "Start Ordering"}
              </button>

              <button
                onClick={() => navigate("/")}
                className="w-full text-gray-600 py-2 hover:text-gray-800 transition-colors"
              >
                Go to Home Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No token - show regular login form (fallback)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex">
      {/* Left Side - Welcome Message */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 p-8 lg:p-12 items-center">
        <div className="text-white max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            Welcome to the Bar! 🍸
          </h1>
          <p className="text-xl opacity-90 mb-8">
            You've scanned a QR code to access this bar. Please enter the guest password to start browsing drinks and placing orders.
          </p>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <h3 className="font-semibold mb-2">For Guests</h3>
            <p className="opacity-80">
              Browse drinks, place orders, and track your order status in real-time
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Guest Login Form */}
      <div className="w-full md:w-1/2 lg:w-2/5 bg-white flex items-center justify-center p-8">
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
