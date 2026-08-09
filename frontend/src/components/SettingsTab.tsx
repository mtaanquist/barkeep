import React, { useState } from "react";
import { useApp } from "../hooks/useApp";
import type { Bar, Language } from "../types";
import { useTranslation } from "../utils/translations";
import Field from "./Field";
import ToggleRow from "./ToggleRow";

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
    ordersClosed: currentBar?.orders_closed === 1,
    maxActiveOrders: currentBar?.max_active_orders ?? 1,
    newGuestPassword: "",
    newBartenderPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [linkRotated, setLinkRotated] = useState(false);

  const update = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  // Everyone still holding the old QR code is out, so it asks first.
  const rotateLink = async () => {
    if (!currentBar || !confirm(t("confirmRotateGuestLink"))) return;

    setSaving(true);
    try {
      await apiCall(`/bars/${currentBar.id}/rotate-guest-link`, {
        method: "POST",
      });
      setLinkRotated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to make a link");
    } finally {
      setSaving(false);
    }
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
          ordersClosed: form.ordersClosed,
          maxActiveOrders: form.maxActiveOrders,
          // Left out entirely when blank, so a code is never cleared by
          // saving something else on the page.
          ...(form.newGuestPassword
            ? { newGuestPassword: form.newGuestPassword }
            : {}),
          ...(form.newBartenderPassword
            ? { newBartenderPassword: form.newBartenderPassword }
            : {}),
        }),
      });

      setCurrentBar(bar);
      setForm((prev) => ({
        ...prev,
        newGuestPassword: "",
        newBartenderPassword: "",
      }));
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
    <form onSubmit={save} className="max-w-160 xl:max-w-none">
      <div className="bg-surface border border-border rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-heading">{t("barSettings")}</h2>
        </div>

        {/* Two columns where there is room: what the bar is on the left,
            how it is run and who gets in on the right. */}
        <div className="xl:flex xl:items-stretch">
          <div className="xl:w-160 xl:shrink-0 xl:border-r xl:border-border">
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
                  onChange={(e) =>
                    update({ language: e.target.value as Language })
                  }
                  className={INPUT}
                >
                  <option value="en">{t("englishName")}</option>
                  <option value="da">{t("danishName")}</option>
                </select>
              </Field>

              <ToggleRow
                on={form.skipApproval}
                onChange={(skipApproval) => update({ skipApproval })}
                title={t("autoAccept")}
                help={t("autoAcceptHelp")}
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 border-t border-border xl:border-t-0">
            {/* The one group here that gets used during the party. */}
            <div className="px-5 py-4.5 flex flex-col gap-4">
              <span className="font-mono text-caption uppercase text-text-muted">
                {t("queue")}
              </span>

              <ToggleRow
                on={form.ordersClosed}
                onChange={(ordersClosed) => update({ ordersClosed })}
                title={t("ordersClosedLabel")}
                help={t("ordersClosedHelp")}
              />

              <Field
                label={t("maxActiveOrders")}
                hint={t("maxActiveOrdersHelp")}
              >
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.maxActiveOrders}
                  onChange={(e) =>
                    update({ maxActiveOrders: Number(e.target.value) })
                  }
                  className={`${INPUT} w-24`}
                />
              </Field>
            </div>

            <div className="h-px bg-border" />

            <div className="px-5 py-4.5 flex flex-col gap-4">
              <span className="font-mono text-caption uppercase text-text-muted">
                {t("sectionAccess")}
              </span>

              {/* Only ever a new one: the codes are stored hashed, so there is
              nothing to show and nothing to reveal. */}
              <Field label={t("guestCode")} hint={t("guestCodeHelp")}>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.newGuestPassword}
                  onChange={(e) => update({ newGuestPassword: e.target.value })}
                  placeholder={t("codeUnchanged")}
                  className={INPUT}
                />
              </Field>

              <Field label={t("bartenderCode")} hint={t("codeUnchanged")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.newBartenderPassword}
                  onChange={(e) =>
                    update({ newBartenderPassword: e.target.value })
                  }
                  className={INPUT}
                />
              </Field>

              <div className="flex flex-col gap-1.5">
                <span className="text-label">{t("guestLink")}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={rotateLink}
                    disabled={saving || loading}
                    className="h-14 px-4 shrink-0 rounded-md border border-border-strong bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t("rotateGuestLink")}
                  </button>
                  {linkRotated && (
                    <p role="status" className="text-body text-text-muted">
                      {t("guestLinkRotated")}
                    </p>
                  )}
                </div>
                <span className="text-body text-text-muted">
                  {t("rotateGuestLinkHelp")}
                </span>
              </div>
            </div>
          </div>
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
