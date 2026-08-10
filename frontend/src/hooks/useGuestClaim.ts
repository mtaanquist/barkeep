import { useState } from "react";
import { useApp } from "./useApp";
import { useTranslation } from "../utils/translations";
import { ApiError } from "../utils/api";

/**
 * The optional password on the guest login: setting one to claim a name, or
 * typing one to prove a claimed name. Both doors — the QR scan and the
 * shared-password form — share this, so the flow lives in one place and a fix
 * to it lands in both.
 */
export function useGuestClaim() {
  const { language } = useApp();
  const t = useTranslation(language);

  const [accountPassword, setAccountPassword] = useState("");
  // On when the guest wants to make this name theirs (set a password).
  const [claiming, setClaiming] = useState(false);
  // On once the server says the name is already claimed, so we ask for its
  // password rather than offering to set one.
  const [nameClaimed, setNameClaimed] = useState(false);

  /** Back to the quick path — for a cancel, or switching who is signing in. */
  const reset = () => {
    setAccountPassword("");
    setClaiming(false);
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
      setClaiming(false);
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
    claiming,
    setClaiming,
    nameClaimed,
    /** Show a password field: to prove a claimed name, or to set a new one. */
    passwordVisible: nameClaimed || claiming,
    /** The password to send, trimmed, or undefined when there is none. */
    password: accountPassword.trim() || undefined,
    onNameChange,
    classify,
    reset,
  };
}
