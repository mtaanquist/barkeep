import React, { useState } from "react";
import { X } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { useCloseOnEscape } from "../../hooks/useCloseOnEscape";
import { useTranslation } from "../../utils/translations";
import { ApiError } from "../../utils/api";

interface ChangePasswordModalProps {
  onClose: () => void;
}

/**
 * A regular changing the password on their name. It is a dialog rather than
 * a form in the panel: two fields and a keyboard need the room, and the
 * history behind it is what the guest came for.
 */
const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  onClose,
}) => {
  const { language, apiCall } = useApp();
  const t = useTranslation(language);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useCloseOnEscape(onClose);

  const submit = async () => {
    if (!current.trim() || !next.trim() || !again.trim()) return;

    // Typed behind dots, so a slip would only turn up the next time they
    // tried to use the name — by which point they cannot fix it themselves.
    if (next.trim() !== again.trim()) {
      setError(t("passwordsDoNotMatch"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await apiCall("/auth/guest/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next.trim(),
        }),
      });
      setDone(true);
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "password_incorrect"
          ? t("wrongPassword")
          : err instanceof Error
            ? err.message
            : t("wrongPassword")
      );
    } finally {
      setBusy(false);
    }
  };

  // No way out by tapping beside it: half a typed password is easy to lose
  // and hard to notice losing.
  return (
    <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("changePassword")}
        className="w-full max-w-sm bg-surface-raised border border-border rounded-lg shadow-float"
      >
        <div className="p-5 border-b border-border flex items-start gap-3">
          <h3 className="flex-1 text-heading">{t("changePassword")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="-m-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-5 flex flex-col gap-4">
            <p className="text-body text-text-muted">{t("passwordChanged")}</p>
            <button
              type="button"
              onClick={onClose}
              className="h-14 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 cursor-pointer"
            >
              {t("close")}
            </button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <input
              type="password"
              placeholder={t("currentPassword")}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
              autoFocus
            />
            <input
              type="password"
              placeholder={t("newPassword")}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
            />
            {/* Behind dots there is nothing to read back, so it is asked for
                twice rather than trusted once. */}
            <input
              type="password"
              placeholder={t("repeatNewPassword")}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
              onKeyPress={(e) => e.key === "Enter" && submit()}
            />
            {error && <p className="text-body text-danger">{error}</p>}
            {/* Full width while they are stacked: sharing the space is only
                a row's job, and flex-1 in a column eats the height. */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={submit}
                disabled={busy || !current.trim() || !next.trim() || !again.trim()}
                className="w-full sm:flex-1 h-14 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {t("changePassword")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:flex-1 h-14 rounded-md border border-border text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordModal;
