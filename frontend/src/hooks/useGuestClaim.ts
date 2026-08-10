import { useState } from "react";
import { useApp } from "./useApp";
import { useTranslation } from "../utils/translations";
import { ApiError } from "../utils/api";

/**
 * Proving a claimed name at the guest login. Registering a name happens inside
 * the bar, not here — so the login only ever asks for a password when the name
 * is already someone's. Both doors (the QR scan and the shared-password form)
 * share this, so a fix to it lands in both.
 */
export function useGuestClaim() {
  const { language } = useApp();
  const t = useTranslation(language);

  const [accountPassword, setAccountPassword] = useState("");
  // On once the server says the name is already claimed, so we ask for its
  // password as a second step.
  const [nameClaimed, setNameClaimed] = useState(false);

  /** Back to the quick path — for a cancel, or switching who is signing in. */
  const reset = () => {
    setAccountPassword("");
    setNameClaimed(false);
  };

  /** A different name is a different question: drop a stale "that name is
   * registered" prompt when the guest edits their name. */
  const onNameChange = () => {
    if (nameClaimed) setNameClaimed(false);
  };

  /**
   * Turns a failed sign-in into the message to show. A claimed name reveals the
   * password field and returns null (nothing to say beyond the field itself); a
   * wrong password says so; anything else passes its own message through.
   */
  const classify = (err: unknown, fallback: string): string | null => {
    if (err instanceof ApiError && err.code === "name_claimed") {
      setNameClaimed(true);
      return null;
    }
    if (err instanceof ApiError && err.code === "password_incorrect") {
      return t("wrongPassword");
    }
    return err instanceof Error ? err.message : fallback;
  };

  return {
    accountPassword,
    setAccountPassword,
    /** True once the name turned out to be claimed: show a password field. */
    nameClaimed,
    passwordVisible: nameClaimed,
    /** The password to send, trimmed, or undefined when there is none. */
    password: accountPassword.trim() || undefined,
    onNameChange,
    classify,
    reset,
  };
}
