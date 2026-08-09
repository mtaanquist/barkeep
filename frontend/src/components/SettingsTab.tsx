import React, { useState } from "react";
import { Settings, Save } from "lucide-react";
import { useApp } from "../context/AppContext";

const SettingsTab: React.FC = () => {
  const {
    currentBar,
    loading,
    setCurrentBar,
    setLoading,
    setError,
    apiCall,
  } = useApp();
  
  const [skipApproval, setSkipApproval] = useState(
    currentBar?.skip_approval === 1
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    if (!currentBar) return;
    
    setIsSaving(true);
    setLoading(true);
    
    try {
      const updatedBar = await apiCall(`/bars/${currentBar.id}`, {
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Bar Settings
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
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="skip-approval"
                className="font-medium text-gray-900 dark:text-white cursor-pointer"
              >
                Auto-accept drink orders
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                When enabled, new drink orders will be automatically accepted and skip the manual approval step. 
                Customers can still cancel their orders until they are marked as processed.
              </p>
            </div>
          </div>

          {/* Bar Information */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Bar Information
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Bar Name:</span>
                <span className="font-medium text-gray-900 dark:text-white">{currentBar?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Language:</span>
                <span className="font-medium text-gray-900 dark:text-white">
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
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
