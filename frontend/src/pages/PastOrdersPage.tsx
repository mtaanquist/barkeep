import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { useGuestMenu } from "../hooks/useGuestMenu";
import type { Drink } from "../types";
import { useTranslation } from "../utils/translations";
import GuestShell from "../components/customer/GuestShell";
import PastOrders from "../components/PastOrders";

const PastOrdersPage: React.FC = () => {
  const {
    orders,
    drinks,
    customerName,
    loading,
    language,
    currentBar,
    setViewingRecipe,
    setLoading,
    setError,
    apiCall,
  } = useApp();
  const t = useTranslation(language);
  const navigate = useNavigate();

  // Loads the menu and the orders. Opening this page directly, or refreshing
  // it, would otherwise show an empty list.
  const { refreshOrders } = useGuestMenu();

  // Compute the current active order for this customer
  const customerOrder = orders.find(
    (order) =>
      order.customer_name === customerName &&
      ["new", "accepted", "ready"].includes(order.status)
  );

  const handleGoBack = () => {
    navigate("/customer");
  };

  // The order in progress is on this screen too now, so cancelling has to
  // work from here as well.
  const handleCancelOrder = async (orderId: number) => {
    if (!currentBar || !customerName) return;
    if (!window.confirm(t("confirmCancelOrder"))) return;

    setLoading(true);
    try {
      await apiCall(`/orders/${orderId}`, {
        method: "DELETE",
        body: JSON.stringify({ barId: currentBar.id, customerName }),
      });
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async (drink: Drink) => {
    if (customerOrder) {
      alert("You can only have one active order at a time");
      return;
    }
    setLoading(true);
    try {
      await apiCall("/orders", {
        method: "POST",
        body: JSON.stringify({
          barId: currentBar!.id,
          customerName,
          drinkId: drink.id,
          drinkTitle: drink.title,
        }),
      });

      await refreshOrders();

      // Navigate back to customer interface to see the new order
      navigate("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GuestShell
      back={{ label: t("backToMenu"), onClick: handleGoBack }}
      onCancelOrder={handleCancelOrder}
      loading={loading}
    >
      <section aria-label={t("pastOrders")} className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-display mb-6">{t("pastOrders")}</h2>
        <PastOrders
          orders={orders}
          drinks={drinks}
          customerName={customerName}
          customerOrder={customerOrder}
          loading={loading}
          t={t}
          handlePlaceOrder={handlePlaceOrder}
          setViewingRecipe={setViewingRecipe}
        />
      </section>
    </GuestShell>
  );
};

export default PastOrdersPage;
