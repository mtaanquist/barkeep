import React, { useState } from "react";
import { useApp } from "../../hooks/useApp";
import type { Order } from "../../types";
import { useTranslation } from "../../utils/translations";
import ClaimNameModal from "./ClaimNameModal";

/** The date of the guest's most recent visit before today, or null. Read off
 * their own orders — created_at is a fixed "YYYY-MM-DD …", so it sorts as text. */
function lastVisitBeforeToday(orders: Order[], name: string): string | null {
  const today = new Date().toDateString();
  const prior = orders
    .filter(
      (o) =>
        o.customer_name === name &&
        new Date(o.created_at).toDateString() !== today
    )
    .map((o) => o.created_at)
    .sort();
  const latest = prior[prior.length - 1];
  return latest ? new Date(latest).toLocaleDateString() : null;
}

/**
 * The header greeting. A regular is welcomed back with their last visit; a
 * one-time guest is invited — on a quiet second line — to make the name theirs,
 * which opens the claim dialog. This is the one place registering is offered.
 */
const GuestGreeting: React.FC = () => {
  const { authenticated, customerName, orders, language } = useApp();
  const t = useTranslation(language);
  const [claiming, setClaiming] = useState(false);

  const lastVisit = authenticated
    ? lastVisitBeforeToday(orders, customerName)
    : null;

  return (
    <div className="sm:flex-1 min-w-0 flex flex-col gap-0.5">
      <p className="text-body text-text-muted truncate">
        {authenticated ? t("greetingBack") : t("greeting")}, {customerName}
      </p>

      {!authenticated ? (
        <button
          type="button"
          onClick={() => setClaiming(true)}
          className="self-start text-caption text-text-muted underline decoration-dotted underline-offset-2 transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
        >
          {t("setPassword")}
        </button>
      ) : (
        lastVisit && (
          <p className="text-caption text-text-muted truncate">
            {t("lastVisited")} {lastVisit}
          </p>
        )
      )}

      {claiming && <ClaimNameModal onClose={() => setClaiming(false)} />}
    </div>
  );
};

export default GuestGreeting;
