import React, { useState } from "react";
import { X } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { useCloseOnEscape } from "../../hooks/useCloseOnEscape";
import { useTranslation } from "../../utils/translations";

const PASSWORD_MIN = 4;

interface ClaimNameModalProps {
  onClose: () => void;
}

/**
 * "Make this name yours": a small dialog where a signed-in guest sets a password
 * on their name, claiming it. On success the greeting behind it turns into a
 * "welcome back", so the modal just confirms and closes.
 */
const ClaimNameModal: React.FC<ClaimNameModalProps> = ({ onClose }) => {
  const { customerName, language, apiCall, setAuthenticated } = useApp();
  const t = useTranslation(language);

  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useCloseOnEscape(onClose);

  const submit = async () => {
    if (password.trim().length < PASSWORD_MIN || !again.trim()) return;

    // A slip here locks a guest out of their own name, and they would not
    // find out until the next party.
    if (password.trim() !== again.trim()) {
      setError(t("passwordsDoNotMatch"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await apiCall("/auth/guest/claim", {
        method: "POST",
        body: JSON.stringify({ password: password.trim() }),
      });
      setAuthenticated(true);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("setPasswordHelp"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("setPassword")}
        className="bg-surface-raised border border-border rounded-lg shadow-float w-full max-w-sm"
      >
        <div className="p-5 border-b border-border flex items-start gap-3">
          <h3 className="flex-1 text-heading">
            {t("setPassword")}
            {customerName ? ` — ${customerName}` : ""}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("cancel")}
            className="-m-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-5 flex flex-col gap-4">
            <p className="text-body text-text-muted">{t("nameIsYours")}</p>
            <button
              onClick={onClose}
              className="h-14 rounded-md bg-text text-text-inverse text-label transition-colors hover:bg-neutral-800 cursor-pointer"
            >
              {t("close")}
            </button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <p className="text-body text-text-muted">{t("setPasswordHelp")}</p>
            <input
              type="password"
              placeholder={t("setAPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
              autoFocus
            />
            {/* Behind dots there is nothing to read back, so it is asked for
                twice rather than trusted once. */}
            <input
              type="password"
              placeholder={t("repeatPassword")}
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
                onClick={submit}
                disabled={
                  busy || password.trim().length < PASSWORD_MIN || !again.trim()
                }
                className="w-full sm:flex-1 h-14 rounded-md bg-text text-text-inverse text-label transition-colors hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {t("setPassword")}
              </button>
              <button
                onClick={onClose}
                className="w-full sm:flex-1 h-14 rounded-md border border-border text-label transition-colors hover:bg-surface-sunken cursor-pointer"
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

export default ClaimNameModal;
