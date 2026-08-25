import React, { useState } from "react";
import { useApp } from "../../hooks/useApp";
import { useTranslation } from "../../utils/translations";
import ChangePasswordModal from "./ChangePasswordModal";

interface ChangePasswordSectionProps {
  /** Told when the dialog opens and closes, so whatever is underneath can
      stand down from Escape while it is up. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * The way in to changing the password on a name. Shows nothing for a
 * one-time guest, whose name nobody has claimed, so the account controls only
 * appear to someone who has an account.
 */
const ChangePasswordSection: React.FC<ChangePasswordSectionProps> = ({
  onOpenChange,
}) => {
  const { authenticated, language } = useApp();
  const t = useTranslation(language);

  const [open, setOpen] = useState(false);

  if (!authenticated) return null;

  const setOpenAndTell = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenAndTell(true)}
        className="h-12 px-3.5 rounded-md border border-border text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
      >
        {t("changePassword")}
      </button>

      {open && <ChangePasswordModal onClose={() => setOpenAndTell(false)} />}
    </>
  );
};

export default ChangePasswordSection;
