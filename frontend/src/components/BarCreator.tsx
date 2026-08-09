import React from "react";
import { useApp } from "../hooks/useApp";
import type { Bar } from "../types";
import { useTranslation } from "../utils/translations";

interface BarCreatorProps {
  onBack: () => void;
  onSuccess: () => void;
}

const BarCreator: React.FC<BarCreatorProps> = ({ onBack, onSuccess }) => {
  const {
    language,
    loading,
    barForm,
    setBarForm,
    setCurrentBar,
    setLanguage,
    setUserType,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const t = useTranslation(language);

  const handleCreateBar = async () => {
    if (!barForm.name || !barForm.bartenderPassword || !barForm.guestPassword) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiCall<Bar>("/bars", {
        method: "POST",
        body: JSON.stringify({
          name: barForm.name,
          bartenderPassword: barForm.bartenderPassword,
          guestPassword: barForm.guestPassword,
          language: barForm.language,
        }),
      });

      setCurrentBar(data);
      setLanguage(data.language);
      setUserType("bartender");

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-text">{t("createBar")}</h4>
        <button
          onClick={onBack}
          className="text-sm text-text-muted hover:text-text"
        >
          ← Back
        </button>
      </div>

      <input
        type="text"
        placeholder={t("barName")}
        value={barForm.name}
        onChange={(e) =>
          setBarForm((prev) => ({ ...prev, name: e.target.value }))
        }
        className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
      />

      <input
        type="password"
        placeholder={t("bartenderPassword")}
        value={barForm.bartenderPassword}
        onChange={(e) =>
          setBarForm((prev) => ({ ...prev, bartenderPassword: e.target.value }))
        }
        className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
      />

      <input
        type="password"
        placeholder={t("guestPassword")}
        value={barForm.guestPassword}
        onChange={(e) =>
          setBarForm((prev) => ({ ...prev, guestPassword: e.target.value }))
        }
        className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
      />

      <button
        onClick={handleCreateBar}
        disabled={loading}
        className="w-full bg-text text-text-inverse py-3 rounded-md hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50"
      >
        {loading ? t("loading") : t("create")}
      </button>
    </div>
  );
};

export default BarCreator;
