import React from "react";
import { Copy, X } from "lucide-react";
import type { BarQrCode } from "../../types";
import { translations } from "../../utils/translations";

interface QrCodeDialogProps {
  data: BarQrCode;
  onClose: () => void;
  t: (key: keyof typeof translations.en) => string;
}

const copyUrl = (url: string) => {
  navigator.clipboard.writeText(url).catch(() => {
    // Older browsers, and anything served without a secure connection.
    const field = document.createElement("textarea");
    field.value = url;
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    document.body.removeChild(field);
  });
};

const download = (data: BarQrCode) => {
  const link = document.createElement("a");
  link.download = `${data.barName}_QR_Code.png`;
  link.href = data.qrCode;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const QrCodeDialog: React.FC<QrCodeDialogProps> = ({ data, onClose, t }) => (
  <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t("qrCodeTitle")} ${data.barName}`}
      className="bg-surface-raised border border-border rounded-lg shadow-float w-full max-w-lg max-h-[90vh] overflow-y-auto"
    >
      <div className="p-5 border-b border-border flex items-start gap-3">
        <h3 className="flex-1 text-display">
          {t("qrCodeTitle")} {data.barName}
        </h3>
        <button
          onClick={onClose}
          aria-label={t("close")}
          className="-m-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Held on a white plate in both schemes. A dark surface behind a
            code with a see-through background will not scan. */}
        <div className="self-center p-4 bg-sign-fg border border-border rounded-md">
          <img src={data.qrCode} alt="" className="w-64 h-64" />
        </div>

        <p className="text-body text-text-muted text-center">
          {t("qrCodeInstructions")}
        </p>

        <div>
          <p className="font-mono text-caption uppercase text-text-muted mb-2">
            {t("directLink")}
          </p>
          <div className="flex items-center gap-2 p-3 bg-surface-sunken border border-border rounded-md">
            <code className="flex-1 min-w-0 text-body break-all">
              {data.url}
            </code>
            <button
              onClick={() => copyUrl(data.url)}
              aria-label={t("copyLink")}
              title={t("copyLink")}
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 pt-0 flex flex-col sm:flex-row gap-2.5">
        <button
          onClick={() => download(data)}
          className="flex-1 h-14 rounded-md bg-text text-text-inverse text-label transition-colors duration-(--duration-instant) hover:bg-neutral-800 cursor-pointer"
        >
          {t("downloadQR")}
        </button>
        <button
          onClick={onClose}
          className="flex-1 h-14 rounded-md border border-border text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
        >
          {t("close")}
        </button>
      </div>
    </div>
  </div>
);

export default QrCodeDialog;
