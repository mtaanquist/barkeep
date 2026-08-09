import React, { useState } from "react";
import { useApp } from "../hooks/useApp";
import type { Bar, Language } from "../types";
import { useTranslation } from "../utils/translations";
import Field from "./Field";
import Switch from "./bartender/Switch";

const INPUT =
  "h-14 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus";

const SettingsTab: React.FC = () => {
  const {
    currentBar,
    language,
    loading,
    setCurrentBar,
    setLanguage,
    setLoading,
    setError,
    apiCall,
  } = useApp();

  const t = useTranslation(language);

  const [form, setForm] = useState({
    name: currentBar?.name ?? "",
    language: (currentBar?.language ?? "en") as Language,
    skipApproval: currentBar?.skip_approval === 1,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBar) return;

    setSaving(true);
    setLoading(true);

    try {
      const bar = await apiCall<Bar>(`/bars/${currentBar.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(),
          language: form.language,
          skipApproval: form.skipApproval,
        }),
      });

      setCurrentBar(bar);
      // The app reads in whatever the bar is set to, so this takes effect
      // on the screen you are looking at.
      setLanguage(bar.language);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-160">
      <div className="bg-surface border border-border rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-heading">{t("barSettings")}</h2>
        </div>

        <div className="px-5 py-4.5 flex flex-col gap-4">
          <span className="font-mono text-caption uppercase text-text-muted">
            {t("sectionTheBar")}
          </span>

          <Field label={t("barName")} hint={t("barNameHelp")}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              className={INPUT}
              required
              minLength={2}
            />
          </Field>

          <Field label={t("language")}>
            <select
              value={form.language}
              onChange={(e) => update({ language: e.target.value as Language })}
              className={INPUT}
            >
              <option value="en">{t("englishName")}</option>
              <option value="da">{t("danishName")}</option>
            </select>
          </Field>

          <label className="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={form.skipApproval}
              onChange={(e) => update({ skipApproval: e.target.checked })}
              className="sr-only"
            />
            <Switch on={form.skipApproval} />
            <span className="flex-1 flex flex-col gap-0.5">
              <span className="text-label">{t("autoAccept")}</span>
              <span className="text-body text-text-muted">
                {t("autoAcceptHelp")}
              </span>
            </span>
          </label>
        </div>

        <div className="px-5 py-3 border-t border-border bg-surface-sunken flex items-center gap-3">
          {saved && (
            <p
              role="status"
              className="font-mono text-caption uppercase text-text-muted"
            >
              {t("settingsSaved")}
            </p>
          )}
          <span className="flex-1" />
          <button
            type="submit"
            disabled={saving || loading || form.name.trim().length < 2}
            className="h-14 px-5 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 disabled:bg-disabled-bg disabled:text-disabled-fg disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? t("savingSettings") : t("saveSettings")}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SettingsTab;
