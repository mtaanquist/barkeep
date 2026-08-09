import React, { useState } from "react";
import { Settings, Save } from "lucide-react";
import { useApp } from "../hooks/useApp";
import type { Bar } from "../types";
import { useTranslation } from "../utils/translations";

const SettingsTab: React.FC = () => {
  const {
    currentBar,
    language,
    loading,
    setCurrentBar,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const t = useTranslation(language);
  
  const [skipApproval, setSkipApproval] = useState(
    currentBar?.skip_approval === 1
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    if (!currentBar) return;
    
    setIsSaving(true);
    setLoading(true);
    
    try {
      const updatedBar = await apiCall<Bar>(`/bars/${currentBar.id}`, {
        method: "PUT",
        body: JSON.stringify({
          skipApproval,
        }),
      });
      
      // Update the current bar in the context
      setCurrentBar(updatedBar);
      setSkipApproval(updatedBar.skip_approval === 1);
      
      // Show success message (you could add a toast notification here)
      alert("Settings saved successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-raised rounded-md border border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-text-muted" />
            <h3 className="text-lg font-semibold text-text">
              {t("barSettings")}
            </h3>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Skip Approval Setting */}
          <div className="flex items-start space-x-3">
            <div className="flex items-center h-6">
              <input
                id="skip-approval"
                type="checkbox"
                checked={skipApproval}
                onChange={(e) => setSkipApproval(e.target.checked)}
                className="w-4 h-4 text-text-muted bg-surface-sunken border-border rounded focus:ring-2"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="skip-approval"
                className="font-medium text-text cursor-pointer"
              >
                {t("autoAccept")}
              </label>
              <p className="text-sm text-text-muted mt-1">
                When enabled, new drink orders will be automatically accepted and skip the manual approval step. 
                Customers can still cancel their orders until they are marked as processed.
              </p>
            </div>
          </div>

          {/* {t("barInformation")} */}
          <div className="pt-6 border-t border-border">
            <h4 className="text-sm font-semibold text-text mb-3">
              {t("barInformation")}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">{t("barName")}</span>
                <span className="font-medium text-text">{currentBar?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t("language")}</span>
                <span className="font-medium text-text">
                  {currentBar?.language === "en" ? "English" : "Danish"}
                </span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving || loading}
              className="flex items-center space-x-2 px-6 py-2 bg-text text-text-inverse rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
