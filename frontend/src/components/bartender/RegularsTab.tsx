import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "../../hooks/useApp";
import type { Regular } from "../../types";
import { useTranslation } from "../../utils/translations";
import { ApiError } from "../../utils/api";

const INPUT =
  "h-12 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus";

/** The regulars who have claimed a name at this bar, with a way to rename one. */
const RegularsTab: React.FC = () => {
  const { currentBar, language, apiCall } = useApp();
  const t = useTranslation(language);
  const barId = currentBar?.id;

  const [regulars, setRegulars] = useState<Regular[]>([]);
  const [loading, setLoading] = useState(true);
  // The regular being renamed, and the name being typed for them.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const startRename = (regular: Regular) => {
    setEditingId(regular.id);
    setDraft(regular.name);
    setError(null);
  };

  const cancel = () => {
    setEditingId(null);
    setDraft("");
    setError(null);
  };

  const save = async (regular: Regular) => {
    const name = draft.trim();
    if (name.length < 2 || name === regular.name || !barId) return;

    setBusy(true);
    setError(null);
    try {
      await apiCall(`/bars/${barId}/regulars/${regular.id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      cancel();
      await refresh();
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
                className="flex items-center gap-3 p-3 rounded-md border border-border"
              >
                {editingId === regular.id ? (
                  <>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className={`${INPUT} flex-1 min-w-0`}
                      minLength={2}
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && save(regular)}
                    />
                    <button
                      type="button"
                      onClick={() => save(regular)}
                      disabled={
                        busy ||
                        draft.trim().length < 2 ||
                        draft.trim() === regular.name
                      }
                      className="h-12 px-3.5 shrink-0 rounded-md bg-text text-text-inverse text-label transition-colors hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {t("rename")}
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
                        {t("regularSince")}{" "}
                        {new Date(regular.created_at).toLocaleDateString()}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => startRename(regular)}
                      className="h-12 px-3.5 shrink-0 rounded-md border border-border-strong text-label transition-colors hover:bg-surface-sunken cursor-pointer"
                    >
                      {t("rename")}
                    </button>
                  </>
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
