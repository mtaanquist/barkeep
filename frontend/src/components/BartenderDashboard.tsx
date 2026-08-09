import React, { useCallback, useEffect, useState } from "react";
import { Plus, QrCode } from "lucide-react";
import { useApp } from "../hooks/useApp";
import type {
  Analytics,
  BarQrCode,
  Drink,
  Order,
} from "../types";
import { useTranslation } from "../utils/translations";
import { useSessionManager } from "../hooks/useSessionManager";
import { useLiveUpdates } from "../hooks/useLiveUpdates";
import { ConnectionLost } from "./ConnectionLost";
import OrdersTab from "./OrdersTab";
import MenuTab from "./MenuTab";
import AnalyticsTab from "./AnalyticsTab";
import CategoriesTab from "./CategoriesTab";
import SettingsTab from "./SettingsTab";

const BartenderDashboard: React.FC = () => {
  const {
    currentBar,
    currentTab,
    language,
    orders,
    setCurrentTab,
    setDrinks,
    setOrders,
    setAnalytics,
    setEditingDrink,
    apiCall,
  } = useApp();

  const t = useTranslation(language);
  const { clearSession } = useSessionManager();
  const { connectionError, reconnect } = useLiveUpdates();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // Show the notice again if updates drop out a second time.
  useEffect(() => {
    if (!connectionError) setNoticeDismissed(false);
  }, [connectionError]);
  
  // QR code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState<{
    qrCode: string;
    url: string;
    barName: string;
  } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const barId = currentBar?.id;

  const fetchDrinks = useCallback(async () => {
    if (!barId) return;
    try {
      setDrinks(await apiCall<Drink[]>(`/drinks/bar/${barId}`));
    } catch (err) {
      console.error("Could not load the drinks:", err);
    }
  }, [barId, apiCall, setDrinks]);

  const fetchOrders = useCallback(async () => {
    if (!barId) return;
    try {
      setOrders(await apiCall<Order[]>(`/orders/bar/${barId}`));
    } catch (err) {
      console.error("Could not load the orders:", err);
    }
  }, [barId, apiCall, setOrders]);

  const fetchAnalytics = useCallback(async () => {
    if (!barId) return;
    try {
      setAnalytics(await apiCall<Analytics>(`/orders/bar/${barId}/analytics`));
    } catch (err) {
      console.error("Could not load the reports:", err);
    }
  }, [barId, apiCall, setAnalytics]);

  // Generate QR code
  const handleGenerateQR = async () => {
    if (!currentBar) return;
    
    setQrLoading(true);
    try {
      const data = await apiCall<BarQrCode>(`/bars/${currentBar.id}/qrcode`);
      setQrData(data);
      setShowQRModal(true);
    } catch (err) {
      console.error("Error generating QR code:", err);
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    fetchDrinks();
    fetchOrders();
    fetchAnalytics();
  }, [fetchDrinks, fetchOrders, fetchAnalytics]);

  const pendingOrders = orders.filter((order) =>
    ["new", "accepted", "ready"].includes(order.status)
  );

  return (
    <div className="min-h-screen bg-surface-sunken transition-colors duration-(--duration-instant)">
      {connectionError && !noticeDismissed && (
        <ConnectionLost
          onRetry={reconnect}
          onDismiss={() => setNoticeDismissed(true)}
        />
      )}
      
      {/* Header */}
      <div className="bg-surface-raised border-b border-border transition-colors duration-(--duration-instant)">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl lg:text-2xl font-bold text-text">
                🍸 {currentBar?.name}
              </h1>
              <span className="hidden sm:inline-block px-3 py-1 bg-surface-sunken text-text text-sm font-medium rounded-full">
                Bartender
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleGenerateQR}
                disabled={qrLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-text text-text-inverse rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">{t("generateQR")}</span>
              </button>
              <button
                onClick={clearSession}
                className="text-text-muted hover:text-text font-medium"
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-surface-raised border-b border-border transition-colors duration-(--duration-instant)">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setCurrentTab("orders")}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-(--duration-instant) ${
                currentTab === "orders"
                  ? "border-border-strong text-text-muted"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {t("pendingOrders")}
              {pendingOrders.length > 0 && (
                <span className="ml-2 bg-status-rejected-bg text-danger text-xs font-bold px-2 py-1 rounded-full">
                  {pendingOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentTab("menu")}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-(--duration-instant) ${
                currentTab === "menu"
                  ? "border-border-strong text-text-muted"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {t("drinkMenu")}
            </button>
            <button
              onClick={() => setCurrentTab("analytics")}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-(--duration-instant) ${
                currentTab === "analytics"
                  ? "border-border-strong text-text-muted"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {t("analytics")}
            </button>
            <button
              onClick={() => setCurrentTab("categories")}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-(--duration-instant) ${
                currentTab === "categories"
                  ? "border-border-strong text-text-muted"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => setCurrentTab("settings")}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-(--duration-instant) ${
                currentTab === "settings"
                  ? "border-border-strong text-text-muted"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {t("settings")}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === "orders" && <OrdersTab />}
        {currentTab === "menu" && <MenuTab />}
        {currentTab === "analytics" && <AnalyticsTab />}
        {currentTab === "categories" && <CategoriesTab />}
        {currentTab === "settings" && <SettingsTab />}
      </div>

      {/* Floating Action Button for Mobile */}
      {currentTab === "menu" && (
        <div className="fixed bottom-6 right-6 lg:hidden">
          <button
            onClick={() => setEditingDrink("new")}
            className="bg-text text-text-inverse p-4 rounded-full shadow-float hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && qrData && (
        <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface-raised border border-border rounded-lg shadow-float p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <h3 className="text-xl font-bold text-text mb-4">
                {t("qrCodeTitle")} {qrData.barName}
              </h3>
              <div className="mb-4 p-4 bg-surface-raised border border-border rounded-md inline-block">
                <img 
                  src={qrData.qrCode} 
                  alt="Bar QR Code" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
              <p className="text-sm text-text-muted mb-4">
                {t("qrCodeInstructions")}
              </p>
              <div className="bg-surface-sunken p-4 rounded-md mb-4">
                <p className="text-sm text-text-muted mb-2">{t("directLink")}</p>
                <div className="bg-surface-raised p-3 rounded border relative">
                  <code className="text-sm text-text break-words block leading-relaxed pr-12">
                    {qrData.url}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(qrData.url).then(() => {
                        // Could show a toast notification here
                      }).catch(() => {
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = qrData.url;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                      });
                    }}
                    className="absolute top-2 right-2 p-1 text-text-muted hover:text-text-muted transition-colors"
                    title="Copy URL"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.download = `${qrData.barName}_QR_Code.png`;
                    link.href = qrData.qrCode;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="flex-1 bg-text text-text-inverse px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors"
                >
                  {t("downloadQR")}
                </button>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="flex-1 bg-surface-sunken text-text px-4 py-2 rounded-md hover:bg-surface-sunken transition-colors"
                >
                  {t("close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BartenderDashboard;
