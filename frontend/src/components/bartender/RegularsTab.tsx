import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "../../hooks/useApp";
import type { Regular } from "../../types";
import { useTranslation } from "../../utils/translations";
import { ApiError } from "../../utils/api";

const INPUT =
  "h-14 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus";

// Mirrors the server's minimum, so the button doesn't invite a password the
// server will only reject.
const PASSWORD_MIN = 4;

/** The row being edited, and which of its two actions is open. */
type Edit = { id: number; mode: "rename" | "password"; value: string };

/** The regulars who have claimed a name at this bar, with a way to rename one
 * or reset their password. */
const RegularsTab: React.FC = () => {
  const { currentBar, language, apiCall } = useApp();
  const t = useTranslation(language);
  const barId = currentBar?.id;

  const [regulars, setRegulars] = useState<Regular[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A quiet confirmation after a password reset, shown against its row.
  const [doneId, setDoneId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      setRegulars(await apiCall<Regular[]>(`/bars/${barId}/regulars`));
    } catch (err) {
      console.error("Could not load the regulars:", err);
    } finally {
      setLoading(false);
    }
  }, [barId, apiCall]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = (regular: Regular, mode: Edit["mode"]) => {
    setEdit({
      id: regular.id,
      mode,
      value: mode === "rename" ? regular.name : "",
    });
    setError(null);
    setDoneId(null);
  };

  const cancel = () => {
    setEdit(null);
    setError(null);
  };

  // What makes a save worth sending: a real new name, or a long-enough password.
  const canSave = (regular: Regular): boolean => {
    if (!edit) return false;
    const value = edit.value.trim();
    return edit.mode === "rename"
      ? value.length >= 2 && value !== regular.name
      : value.length >= PASSWORD_MIN;
  };

  const save = async (regular: Regular) => {
    if (!edit || !barId || !canSave(regular)) return;
    const value = edit.value.trim();

    setBusy(true);
    setError(null);
    try {
      if (edit.mode === "rename") {
        await apiCall(`/bars/${barId}/regulars/${regular.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: value }),
        });
        cancel();
        await refresh();
      } else {
        await apiCall(`/bars/${barId}/regulars/${regular.id}/password`, {
          method: "PUT",
          body: JSON.stringify({ newPassword: value }),
        });
        cancel();
        setDoneId(regular.id);
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? t("nameTaken")
          : err instanceof Error
            ? err.message
            : t("nameTaken")
      );
    } finally {
      setBusy(false);
    }
  };

  const editing = (regular: Regular) => edit?.id === regular.id;

  const sinceDate = (regular: Regular) =>
    new Date(regular.created_at).toLocaleDateString();

  // On a phone there is no column header to say what the date is.
  const since = (regular: Regular) =>
    `${t("regularSince")} ${sinceDate(regular)}`;

  // Laid out like the drinks and ingredients lists, so the three read alike.
  return (
    <div className="bg-surface border border-border rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-5 py-4 border-b border-border">
        <h2 className="text-display">{t("regulars")}</h2>
        {!loading && regulars.length > 0 && (
          <p className="font-mono text-caption uppercase text-text-muted">
            {regulars.length} {t("inTotal")}
          </p>
        )}
        <p className="basis-full text-body text-text-muted">
          {t("regularsIntro")}
        </p>
      </div>

      {loading ? (
        <p className="px-5 py-10 text-center text-body text-text-muted">
          {t("loading")}
        </p>
      ) : regulars.length === 0 ? (
        <p className="px-5 py-10 text-center text-body text-text-muted">
          {t("noRegulars")}
        </p>
      ) : (
        <>
          <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 border-b border-border bg-surface-sunken font-mono text-caption text-text-muted">
            <span className="flex-1 uppercase">{t("ingredientName")}</span>
            <span className="w-38 shrink-0 uppercase">{t("regularSince")}</span>
            <span className="w-72 shrink-0" />
          </div>

          <ul>
            {regulars.map((regular) => (
              <li
                key={regular.id}
                className="flex flex-wrap items-center gap-4 px-4 lg:px-5 py-3 border-b border-border last:border-b-0 transition-colors duration-(--duration-instant) hover:bg-surface-sunken"
              >
                {editing(regular) ? (
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type={edit?.mode === "password" ? "password" : "text"}
                        value={edit?.value ?? ""}
                        placeholder={
                          edit?.mode === "password"
                            ? t("newPassword")
                            : undefined
                        }
                        onChange={(e) =>
                          setEdit((prev) =>
                            prev ? { ...prev, value: e.target.value } : prev
                          )
                        }
                        className={`${INPUT} flex-1 min-w-40`}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && save(regular)}
                      />
                      <button
                        type="button"
                        onClick={() => save(regular)}
                        disabled={busy || !canSave(regular)}
                        className="h-14 px-5 shrink-0 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
                      >
                        {edit?.mode === "password"
                          ? t("setGuestPassword")
                          : t("rename")}
                      </button>
                      <button
                        type="button"
                        onClick={cancel}
                        className="h-14 px-4 shrink-0 rounded-md text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
                      >
                        {t("cancel")}
                      </button>
                    </div>

                    {/* Why to reset it, shown only while setting one. */}
                    {edit?.mode === "password" && (
                      <p className="text-body text-text-muted">
                        {t("setGuestPasswordHelp")}
                      </p>
                    )}
                    {error && <p className="text-body text-danger">{error}</p>}
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-heading truncate">
                        {regular.name}
                      </span>
                      <span className="text-body text-text-muted truncate">
                        {doneId === regular.id ? (
                          t("guestPasswordSet")
                        ) : (
                          <span className="lg:hidden">{since(regular)}</span>
                        )}
                      </span>
                    </div>

                    <span className="hidden lg:block w-38 shrink-0 text-body text-text-muted truncate">
                      {sinceDate(regular)}
                    </span>

                    <span className="flex gap-2.5 shrink-0 lg:w-72 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => open(regular, "rename")}
                        className="h-14 px-4 rounded-md border border-border bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
                      >
                        {t("rename")}
                      </button>
                      <button
                        type="button"
                        onClick={() => open(regular, "password")}
                        className="h-14 px-4 rounded-md border border-border bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
                      >
                        {t("setGuestPassword")}
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default RegularsTab;
