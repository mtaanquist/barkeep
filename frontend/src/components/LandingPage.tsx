import React, { useState } from "react";
import { useApp } from "../hooks/useApp";
import type { Bar, Language } from "../types";
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
        return "Set up your bar";
      case "login":
        return "Choose your login type";
      default:
        return "Choose a bar or create a new one";
    }
  };

  const languageOption = (value: Language, label: string) => (
    <button
      onClick={() => setLanguage(value)}
      aria-pressed={language === value}
      className={`h-11 px-4 text-label transition-colors duration-(--duration-instant) cursor-pointer ${
        language === value
          ? "bg-text text-text-inverse"
          : "text-text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-surface lg:flex">
      {/* The sign above the door. Ink in both schemes — it is the one
          deliberate block of colour in the product. */}
      <div className="lg:w-[44%] shrink-0 bg-sign text-sign-fg px-6 py-8 lg:px-10 lg:py-11 flex flex-col min-h-50 lg:min-h-screen">
        <span className="font-mono text-caption uppercase opacity-65">
          Barkeep
        </span>
        <span className="flex-1" />
        <p className="font-bold text-4xl lg:text-[4.75rem] leading-[0.95] tracking-[-0.035em]">
          {t("barIsOpen")}
        </p>
        <span className="h-px bg-current opacity-28 my-5 lg:my-6" />
        <p className="text-body lg:text-[1.0625rem] opacity-75 max-w-[38ch]">
          {t("landingIntro")}
        </p>
      </div>

      {/* The work. */}
      <div className="flex-1 min-w-0 px-6 py-8 lg:px-10 lg:py-9">
        {/* Fills the panel on a wide screen; centred and held narrow on a
            phone, where the sign sits above rather than beside it. */}
        <div className="max-w-md mx-auto lg:max-w-none lg:mx-0 space-y-5">
          <div className="flex justify-end">
            <div className="inline-flex border border-border rounded-md overflow-hidden divide-x divide-border">
              {languageOption("da", "Dansk")}
              {languageOption("en", "English")}
            </div>
          </div>

          <div>
            <h1 className="text-display">{getTitle()}</h1>
            <p className="text-body text-text-muted mt-1">{getSubtitle()}</p>
          </div>

          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
