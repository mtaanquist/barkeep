import React, { useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { useSessionManager } from "../hooks/useSessionManager";
import type { Drink } from "../types";
import { useTranslation } from "../utils/translations";
import { useGuestMenu } from "../hooks/useGuestMenu";
import RandomDrinkModal from "./RandomDrinkModal";
import DrinkGrid from "./customer/DrinkGrid";
import GuestShell from "./customer/GuestShell";
import OrderPlacedModal from "./customer/OrderPlacedModal";
import PastOrdersPanel from "./customer/PastOrdersPanel";
import { MenuFilterSelect, MenuSidebar } from "./customer/MenuFilters";

/** Statuses that mean a guest still has a drink on the go. */
const IN_PROGRESS = ["new", "accepted", "ready"];

const CustomerInterface: React.FC = () => {
  const {
    currentBar,
    customerName,
    drinks,
    language,
    loading,
    orders,
    setViewingRecipe,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const t = useTranslation(language);
  const { clearSession } = useSessionManager();
  const navigate = useNavigate();
  const location = useLocation();

  const menu = useGuestMenu();

  // History is a panel over the menu rather than a screen instead of it, but
  // it still has an address, so it can be linked to and backed out of.
  const historyOpen = location.pathname.endsWith("/past-orders");

  const [showOrderPlaced, setShowOrderPlaced] = useState(false);
  const [randomDrink, setRandomDrink] = useState<Drink | null>(null);

  // Escape closes the surprise-me pick.
  useEffect(() => {
    if (!randomDrink) return;

    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRandomDrink(null);
    };

    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [randomDrink]);

  const currentOrder = orders.find(
    (order) =>
      order.customer_name === customerName && IN_PROGRESS.includes(order.status)
  );

  const placeOrder = async (drink: Drink) => {
    if (currentOrder) {
      alert(t("oneOrderLimit"));
      return false;
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
      setShowOrderPlaced(true);
      await menu.refreshOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Ordering again closes the history, because what matters next is the
  // drink coming, which the dock is carrying.
  const orderAgain = async (drink: Drink) => {
    if (await placeOrder(drink)) navigate("/customer");
  };

  const toggleFavourite = async (drink: Drink) => {
    if (!currentBar || !customerName) return;

    try {
      await apiCall(`/drinks/bar/${currentBar.id}/favourites`, {
        method: drink.is_favourite ? "DELETE" : "POST",
        body: JSON.stringify({ customerName, drinkId: drink.id }),
      });

      await Promise.all([menu.refreshDrinks(), menu.refreshFavourites()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update favourites"
      );
    }
  };

  const cancelOrder = async (orderId: number) => {
    if (!currentBar || !customerName) return;
    if (!window.confirm(t("confirmCancelOrder"))) return;

    setLoading(true);
    try {
      await apiCall(`/orders/${orderId}`, {
        method: "DELETE",
        body: JSON.stringify({ barId: currentBar.id, customerName }),
      });
      await menu.refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setLoading(false);
    }
  };

  /** Any drink but the one already showing, so a second go feels like one. */
  const pickRandom = () => {
    const pool =
      menu.inStock.length > 1 && randomDrink
        ? menu.inStock.filter((d) => d.id !== randomDrink.id)
        : menu.inStock;

    if (pool.length === 0) return;
    setRandomDrink(pool[Math.floor(Math.random() * pool.length)]);
  };

  // The same handful of props go to every section of the menu.
  const cardActions = {
    onViewRecipe: setViewingRecipe,
    onOrder: placeOrder,
    onToggleFavourite: toggleFavourite,
    disabled: !!currentOrder || loading,
    loading,
    t,
  };

  const filters = {
    categories: menu.categories,
    spirits: menu.spirits,
    byCategory: menu.byCategory,
    bySpirit: menu.bySpirit,
    filter: menu.filter,
    onFilter: menu.setFilter,
    t,
  };

  const nothingToShow =
    menu.spirits.length === 0 &&
    menu.categories.length === 0 &&
    menu.favourites.length === 0;

  return (
    <GuestShell onCancelOrder={cancelOrder} loading={loading}>
      {showOrderPlaced && (
        <OrderPlacedModal onClose={() => setShowOrderPlaced(false)} t={t} />
      )}

      {historyOpen && (
        <PastOrdersPanel
          orders={orders}
          drinks={drinks}
          customerName={customerName}
          currentOrder={currentOrder}
          loading={loading}
          t={t}
          onClose={() => navigate("/customer")}
          onOrderAgain={orderAgain}
          onNotMe={clearSession}
        />
      )}

      {randomDrink && (
        <RandomDrinkModal
          drink={randomDrink}
          visible
          onOrder={() => {
            const chosen = randomDrink;
            setRandomDrink(null);
            placeOrder(chosen);
          }}
          onTryAnother={pickRandom}
          onCancel={() => setRandomDrink(null)}
          loading={loading}
          hasOrderInProgress={!!currentOrder}
          t={t}
        />
      )}

      <div className="max-w-7xl mx-auto flex">
        <MenuSidebar
          {...filters}
          favouriteCount={menu.favourites.length}
          totalCount={menu.inStock.length}
          canSurprise={menu.inStock.length > 0 && !currentOrder && !loading}
          onSurpriseMe={pickRandom}
        />

        <div className="flex-1 min-w-0 px-4 lg:px-6 py-6 space-y-8">
          <MenuFilterSelect {...filters} />

          {nothingToShow ? (
            <div className="p-8 text-center text-text-muted">
              <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-body">{t("noDrinksAvailable")}</p>
            </div>
          ) : (
            <>
              {menu.favourites.length > 0 && (
                <DrinkGrid
                  id="favourites"
                  className="mb-8"
                  heading={t("favourites")}
                  drinks={menu.favourites}
                  {...cardActions}
                />
              )}

              {menu.filter.type === "category" && (
                <DrinkGrid
                  heading={menu.filter.value}
                  drinks={menu.filtered}
                  {...cardActions}
                />
              )}

              {menu.filter.type === "spirit" && (
                <DrinkGrid
                  heading={menu.filter.value}
                  drinks={menu.filtered}
                  {...cardActions}
                />
              )}

              {menu.filter.type === "all" && (
                <>
                  {menu.categories.map((category) => (
                    <DrinkGrid
                      key={category}
                      id={`category-${category.replace(/[^a-zA-Z0-9]/g, "")}`}
                      heading={category}
                      drinks={menu.byCategory[category]}
                      {...cardActions}
                    />
                  ))}

                  {menu.spirits.map((spirit) => (
                    <DrinkGrid
                      key={spirit}
                      id={`spirit-${spirit.replace(/[^a-zA-Z0-9]/g, "")}`}
                      heading={spirit}
                      drinks={menu.bySpirit[spirit]}
                      {...cardActions}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </GuestShell>
  );
};

export default CustomerInterface;
