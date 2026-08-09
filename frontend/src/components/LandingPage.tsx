import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import type { Bar } from "../types";
import { useTranslation } from "../utils/translations";
import BarSelector from "./BarSelector";
import BarCreator from "./BarCreator";
import LoginForm from "./LoginForm";

const LandingPage: React.FC = () => {
  const { currentBar, language, setLanguage, setCurrentBar, setLoginForm } =
    useApp();
  const t = useTranslation(language);

  const [mode, setMode] = useState<"select" | "create" | "login">("select");
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null);

  const handleSelectBar = (bar: Bar) => {
    setSelectedBar(bar);
    setCurrentBar(bar);
    setLanguage(bar.language);
    setMode("login");
  };

  const resetToBarSelection = () => {
    setSelectedBar(null);
    setCurrentBar(null);
    setLoginForm({ password: "", name: "" }); // Clear login form fields
    setMode("select");
  };

  const handleCreateBarSuccess = () => {
    // Creation automatically logs in as bartender
    // No need to change mode, user goes directly to dashboard
  };

  const renderContent = () => {
    switch (mode) {
      case "create":
        return (
          <BarCreator
            onBack={() => setMode("select")}
            onSuccess={handleCreateBarSuccess}
          />
        );

      case "login": {
        const barToUse = selectedBar || currentBar;
        return barToUse ? (
          <LoginForm bar={barToUse} onBack={resetToBarSelection} />
        ) : null;
      }

      default:
        return (
          <BarSelector
            onSelectBar={handleSelectBar}
            onCreateBar={() => setMode("create")}
          />
        );
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "create":
        return "Create Your Bar";
      case "login": {
        const barToUse = selectedBar || currentBar;
        return barToUse ? `${t("welcome")} ${barToUse.name}` : "Login";
      }
      default:
        return "Get Started";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "create":
        return "Set up your home bar system";
      case "login":
        return "Choose your login type";
      default:
        return "Choose a bar or create a new one";
    }
  };

  return (
    <div className="landing-page-container min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-gray-900 dark:via-gray-800 dark:to-black transition-colors duration-300">
      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Hero Section */}
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="max-w-lg text-center text-white">
            <h1 className="text-6xl font-bold mb-6">🍸</h1>
            <h2 className="text-4xl font-bold mb-4">Home Bar System</h2>
            <p className="text-xl opacity-90 mb-8">
              A modern ordering system for your home bar. Create drinks, manage
              orders, and serve your guests with style.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <h3 className="font-semibold mb-2">For Bartenders</h3>
                <p className="opacity-80">
                  Manage your drink menu, process orders, and view analytics
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <h3 className="font-semibold mb-2">For Guests</h3>
                <p className="opacity-80">
                  Browse drinks, place orders, and track your order status
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="landing-form-container w-96 bg-white dark:bg-gray-800 flex items-center justify-center p-8 transition-colors duration-300">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center">
              <h3 className="landing-text text-2xl font-bold text-gray-800 dark:text-white mb-2">
                {getTitle()}
              </h3>
              <p className="landing-text text-gray-600 dark:text-gray-300">{getSubtitle()}</p>
            </div>

            <div className="space-y-6">
              {/* Controls Row */}
              <div className="flex gap-3">
                {/* Language Selector */}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as "en" | "da")}
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white transition-colors duration-200"
                >
                  <option value="en">English</option>
                  <option value="da">Dansk</option>
                </select>
              </div>

              {/* Dynamic Content */}
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md transition-colors duration-300">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              🍸 Home Bar
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{getSubtitle()}</p>
          </div>

          <div className="space-y-4">
            {/* Controls Row */}
            <div className="flex gap-3">
              {/* Language Selector */}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "da")}
                className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white transition-colors duration-200"
              >
                <option value="en">English</option>
                <option value="da">Dansk</option>
              </select>
            </div>

            {/* Dynamic Content */}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
