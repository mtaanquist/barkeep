import React, { useState } from "react";
import { useApp } from "../../hooks/useApp";
import { useTranslation } from "../../utils/translations";
import { ApiError } from "../../utils/api";

/**
 * Lets a regular change the password on their name. Shows nothing for a
 * one-time guest, whose name nobody has claimed, so the account controls only
 * appear to someone who has an account.
 */
const ChangePasswordSection: React.FC = () => {
  const { authenticated, language, apiCall } = useApp();
  const t = useTranslation(language);

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!authenticated) return null;

  const submit = async () => {
    if (!current.trim() || !next.trim()) return;
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
      setOpen(false);
      setCurrent("");
      setNext("");
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

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="h-12 px-3.5 rounded-md border border-border text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
        >
          {t("changePassword")}
        </button>
        {done && <p className="text-body text-text-muted">{t("passwordChanged")}</p>}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <input
        type="password"
        placeholder={t("currentPassword")}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
      />
      <input
        type="password"
        placeholder={t("newPassword")}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className="w-full p-3 border border-border rounded-md focus:ring-2 focus:border-transparent"
        onKeyPress={(e) => e.key === "Enter" && submit()}
      />
      {error && <p className="text-body text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !current.trim() || !next.trim()}
          className="h-12 px-3.5 rounded-md bg-text text-text-inverse text-label transition-colors hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {t("changePassword")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="h-12 px-3.5 rounded-md border border-border text-label text-text-muted transition-colors hover:text-text cursor-pointer"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
};

export default ChangePasswordSection;
