import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, RotateCcw } from "lucide-react";

import { useApp } from "../../hooks/useApp";
import { useTranslation } from "../../utils/translations";
import type { OperatorBar } from "../../types";

const PRIMARY =
  "h-14 px-5 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer";
const DANGER =
  "h-12 px-4 rounded-md bg-danger text-danger-contrast text-label transition-colors duration-(--duration-instant) hover:bg-danger-hover disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer";
const INPUT =
  "h-14 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus";

/** SQLite keeps times as "YYYY-MM-DD HH:MM:SS" in UTC; show just the day. */
const asDay = (value: string | null): string | null =>
  value ? new Date(`${value.replace(" ", "T")}Z`).toLocaleDateString() : null;

const OperatorPanel: React.FC = () => {
  const { language, apiCall } = useApp();
  const t = useTranslation(language);
  const navigate = useNavigate();

  const [status, setStatus] = useState<"checking" | "out" | "in">("checking");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState(false);
  const [busy, setBusy] = useState(false);

  const [bars, setBars] = useState<OperatorBar[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [confirming, setConfirming] = useState<OperatorBar | null>(null);

  const loadBars = useCallback(async () => {
    try {
      setBars(await apiCall<OperatorBar[]>("/operator/bars"));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [apiCall]);

  // Ask the server, on load, whether this browser already holds an operator
  // cookie. A 401 just means "show the sign-in".
  useEffect(() => {
    let live = true;
    apiCall("/operator/me")
      .then(() => live && setStatus("in"))
      .catch(() => live && setStatus("out"));
    return () => {
      live = false;
    };
  }, [apiCall]);

  useEffect(() => {
    if (status === "in") void loadBars();
  }, [status, loadBars]);

  const signIn = async () => {
    if (!password) return;
    setBusy(true);
    setSignInError(false);
    try {
      await apiCall("/operator/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setStatus("in");
    } catch {
      setSignInError(true);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await apiCall("/operator/logout", { method: "POST" }).catch(() => {});
    navigate("/");
  };

  const remove = async (bar: OperatorBar, confirmationName: string) => {
    setBusy(true);
    try {
      await apiCall(`/operator/bars/${bar.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmationName }),
      });
      setConfirming(null);
      await loadBars();
    } finally {
      setBusy(false);
    }
  };

  const restore = async (bar: OperatorBar) => {
    setBusy(true);
    try {
      await apiCall(`/operator/bars/${bar.id}/restore`, { method: "POST" });
      await loadBars();
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-body text-text-muted">{t("loading")}</p>
      </div>
    );
  }

  if (status === "out") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-display">{t("operatorTitle")}</h1>
            <p className="text-body text-text-muted mt-1">{t("operatorIntro")}</p>
          </div>

          <input
            type="password"
            autoFocus
            value={password}
            placeholder={t("operatorPasswordPlaceholder")}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            className={`w-full ${INPUT}`}
          />

          {signInError && (
            <p className="text-body text-danger">{t("operatorWrongPassword")}</p>
          )}

          <button
            type="button"
            onClick={signIn}
            disabled={busy || !password}
            className={`w-full ${PRIMARY}`}
          >
            {t("operatorSignIn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-6 py-8 lg:px-10 lg:py-9">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-display">{t("operatorTitle")}</h1>
            <p className="text-body text-text-muted mt-1">{t("operatorIntro")}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="h-12 px-4 rounded-md border border-border text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
          >
            {t("operatorSignOut")}
          </button>
        </div>

        {loadError ? (
          <p className="text-body text-danger">{t("operatorLoadError")}</p>
        ) : bars.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-10 px-5 bg-surface-raised border border-border rounded-md text-center">
            <p className="text-body text-text-muted max-w-[44ch]">
              {t("operatorNoBars")}
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-md overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-heading">{t("operatorBars")}</h2>
            </div>

            <ul>
              {bars.map((bar) => {
                const retired = bar.deletedAt !== null;
                const lastUsed = asDay(bar.lastUsed);
                return (
                  <li
                    key={bar.id}
                    className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-label truncate ${retired ? "text-text-muted line-through" : "text-text"}`}
                      >
                        {bar.name}
                      </p>
                      <p className="font-mono text-caption uppercase text-text-muted mt-0.5">
                        {t("operatorCreated")} {asDay(bar.created_at)}
                        {" · "}
                        {t("operatorLastUsed")}{" "}
                        {lastUsed ?? t("operatorNeverUsed")}
                        {" · "}
                        {bar.drinkCount} {t("operatorDrinks")}
                        {" · "}
                        {bar.orderCount} {t("operatorOrders")}
                        {retired && (
                          <>
                            {" · "}
                            {t("operatorRemovedOnPrefix")} {asDay(bar.deletedAt)}
                          </>
                        )}
                      </p>
                    </div>

                    {retired ? (
                      <button
                        type="button"
                        onClick={() => restore(bar)}
                        disabled={busy}
                        className="h-12 px-4 shrink-0 flex items-center gap-1.5 rounded-md border border-border text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken disabled:cursor-not-allowed cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {t("operatorRestore")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`${t("operatorRemove")} ${bar.name}`}
                        onClick={() => setConfirming(bar)}
                        className="h-12 w-12 shrink-0 flex items-center justify-center rounded-md border border-border text-danger transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {confirming && (
        <ConfirmRemoval
          bar={confirming}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={(name) => remove(confirming, name)}
        />
      )}
    </div>
  );
};

interface ConfirmRemovalProps {
  bar: OperatorBar;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (confirmationName: string) => void;
}

/** Type-the-name before a bar is retired, so it can't happen by a stray tap. */
const ConfirmRemoval: React.FC<ConfirmRemovalProps> = ({
  bar,
  busy,
  onCancel,
  onConfirm,
}) => {
  const { language } = useApp();
  const t = useTranslation(language);
  const [typed, setTyped] = useState("");
  const matches = typed === bar.name;

  return (
    <div className="fixed inset-0 z-50 bg-overlay flex items-start justify-center p-4 pt-24 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("operatorConfirmTitle")}
        className="w-full max-w-md bg-surface-raised border border-border rounded-lg shadow-float overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-display">{t("operatorConfirmTitle")}</h2>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-body text-text-muted">{t("operatorConfirmBody")}</p>
          <input
            type="text"
            autoFocus
            value={typed}
            placeholder={bar.name}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && matches && onConfirm(typed)}
            className={`w-full ${INPUT}`}
          />
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 px-4 rounded-md border border-border text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(typed)}
            disabled={busy || !matches}
            className={DANGER}
          >
            {t("operatorConfirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperatorPanel;
