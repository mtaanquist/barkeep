import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "../../hooks/useApp";
import type { Regular } from "../../types";
import { useTranslation } from "../../utils/translations";
import { ApiError } from "../../utils/api";

const INPUT =
  "h-12 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus";

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
    setEdit({ id: regular.id, mode, value: mode === "rename" ? regular.name : "" });
    setError(null);
    setDoneId(null);
  };

  const cancel = () => {
    setEdit(null);
    setError(null);
  };

  const save = async (regular: Regular) => {
    if (!edit || !barId) return;
    const value = edit.value.trim();

    if (edit.mode === "rename") {
      if (value.length < 2 || value === regular.name) return;
    } else if (value.length < 4) {
      return;
    }

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

  return (
    <div className="max-w-160">
      <div className="bg-surface border border-border rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-heading">{t("regulars")}</h2>
          <p className="text-body text-text-muted mt-1">{t("regularsIntro")}</p>
        </div>

        <div className="px-5 py-4.5 flex flex-col gap-2.5">
          {loading ? (
            <p className="text-body text-text-muted">{t("loading")}</p>
          ) : regulars.length === 0 ? (
            <p className="text-body text-text-muted">{t("noRegulars")}</p>
          ) : (
            regulars.map((regular) => (
              <div
                key={regular.id}
                className="p-3 rounded-md border border-border flex flex-col gap-2"
              >
                <div className="flex items-center gap-3">
                  {editing(regular) ? (
                    <>
                      <input
                        type={edit?.mode === "password" ? "password" : "text"}
                        value={edit?.value ?? ""}
                        placeholder={
                          edit?.mode === "password" ? t("newPassword") : undefined
                        }
                        onChange={(e) =>
                          setEdit((prev) =>
                            prev ? { ...prev, value: e.target.value } : prev
                          )
                        }
                        className={`${INPUT} flex-1 min-w-0`}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && save(regular)}
                      />
                      <button
                        type="button"
                        onClick={() => save(regular)}
                        disabled={busy || edit?.value.trim().length === 0}
                        className="h-12 px-3.5 shrink-0 rounded-md bg-text text-text-inverse text-label transition-colors hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {edit?.mode === "password"
                          ? t("setGuestPassword")
                          : t("rename")}
                      </button>
                      <button
                        type="button"
                        onClick={cancel}
                        className="h-12 px-3.5 shrink-0 rounded-md border border-border text-label text-text-muted transition-colors hover:text-text cursor-pointer"
                      >
                        {t("cancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="font-bold text-[1.0625rem] leading-tight tracking-tight truncate">
                          {regular.name}
                        </span>
                        <span className="text-body text-text-muted truncate">
                          {doneId === regular.id
                            ? t("guestPasswordSet")
                            : `${t("regularSince")} ${new Date(
                                regular.created_at
                              ).toLocaleDateString()}`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => open(regular, "rename")}
                        className="h-12 px-3.5 shrink-0 rounded-md border border-border-strong text-label transition-colors hover:bg-surface-sunken cursor-pointer"
                      >
                        {t("rename")}
                      </button>
                      <button
                        type="button"
                        onClick={() => open(regular, "password")}
                        className="h-12 px-3.5 shrink-0 rounded-md border border-border-strong text-label transition-colors hover:bg-surface-sunken cursor-pointer"
                      >
                        {t("setGuestPassword")}
                      </button>
                    </>
                  )}
                </div>

                {/* Why to reset it, shown only while setting one. */}
                {editing(regular) && edit?.mode === "password" && (
                  <p className="text-body text-text-muted">
                    {t("setGuestPasswordHelp")}
                  </p>
                )}
              </div>
            ))
          )}

          {error && <p className="text-body text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default RegularsTab;
