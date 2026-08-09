import React, { useState } from "react";
import ImageCropper from "../ImageCropper";
import { translations } from "../../utils/translations";

export interface DrinkImage {
  url: string;
  cropX: number;
  cropY: number;
  zoom: number;
}

interface DrinkImageFieldProps {
  value: DrinkImage;
  onChange: (value: DrinkImage) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  t: (key: keyof typeof translations.en) => string;
}

const MAX_SIZE = 5 * 1024 * 1024;

/** A fresh picture starts uncropped. */
const uncropped = (url: string): DrinkImage => ({
  url,
  cropX: 0,
  cropY: 0,
  zoom: 1,
});

/**
 * Sends the picture and reports how far along it is. A phone on house wifi
 * takes long enough that "how much longer" is a real question, and fetch()
 * cannot answer it — only XHR reports upload progress.
 */
const sendImage = (
  file: File,
  onProgress: (percent: number) => void
): Promise<string> =>
  new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("image", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/drinks/upload-image");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText).imageUrl);
        } catch {
          reject(new Error("Upload failed"));
        }
      } else {
        reject(new Error("Upload failed"));
      }
    };
    request.onerror = () => reject(new Error("Upload failed"));

    request.send(body);
  });

/** The picture for a drink: a thumbnail once there is one, a dashed box until. */
const DrinkImageField: React.FC<DrinkImageFieldProps> = ({
  value,
  onChange,
  loading,
  setLoading,
  t,
}) => {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      setUploadError("File size must be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed");
      return;
    }

    setUploadError(null);
    setPercent(0);
    setLoading(true);

    try {
      const imageUrl = await sendImage(file, setPercent);
      onChange(uncropped(imageUrl));
      // Cropping is the one decision left, so ask it straight away.
      setShowCropper(true);
    } catch {
      setUploadError("Failed to upload image. Please try again.");
    } finally {
      setPercent(null);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label">{t("drinkImage")}</span>

      {percent !== null ? (
        <div className="flex items-center gap-3">
          <span className="w-30 h-21 shrink-0 rounded-md border border-border bg-surface-sunken" />
          <div className="flex-1 flex flex-col gap-2">
            <span className="font-mono text-caption uppercase text-text-muted">
              {t("uploading")} · {percent}%
            </span>
            {/* A rule that fills, never a spinner: it answers "how long". */}
            <span className="block h-1 w-full bg-surface-sunken">
              <span
                className="block h-full bg-text transition-[width] duration-(--duration-quick)"
                style={{ width: `${percent}%` }}
              />
            </span>
          </div>
        </div>
      ) : value.url ? (
        <div className="flex items-center gap-3">
          <span className="w-30 h-21 shrink-0 rounded-md border border-border overflow-hidden bg-surface-sunken">
            <img
              src={value.url}
              alt=""
              className="w-full h-full object-cover"
              style={{
                transform: `translate(${value.cropX}%, ${value.cropY}%) scale(${value.zoom})`,
              }}
            />
          </span>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setShowCropper(true)}
              className="h-14 px-4 rounded-md border border-border-strong bg-surface-raised text-label transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer"
            >
              {t("cropAgain")}
            </button>
            <button
              type="button"
              onClick={() => onChange(uncropped(""))}
              className="h-14 px-4 rounded-md border border-border text-label text-text-muted transition-colors duration-(--duration-instant) hover:text-text cursor-pointer"
            >
              {t("removeImage")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <label className="h-28 flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border-strong transition-colors duration-(--duration-instant) hover:bg-surface-sunken cursor-pointer">
            <span className="font-bold text-base leading-tight tracking-tight">
              {t("chooseImage")}
            </span>
            <span className="font-mono text-caption uppercase text-text-muted">
              {t("imageFormats")}
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={upload}
              disabled={loading}
            />
          </label>

          <label className="flex flex-col gap-1.5 mt-1">
            <span className="text-body text-text-muted">
              {t("orPasteLink")}
            </span>
            <input
              type="url"
              value={value.url}
              onChange={(e) => onChange(uncropped(e.target.value))}
              placeholder="https://…"
              className="h-14 px-3.5 rounded-md border border-border bg-surface-raised text-body focus:outline-none focus:border-border-strong focus:shadow-focus"
            />
          </label>
        </>
      )}

      {uploadError && <p className="text-body text-danger">{uploadError}</p>}

      {showCropper && value.url && (
        <ImageCropper
          imageUrl={value.url}
          initialCrop={{ x: value.cropX, y: value.cropY }}
          initialZoom={value.zoom}
          onSave={(crop, zoom) => {
            onChange({ ...value, cropX: crop.x, cropY: crop.y, zoom });
            setShowCropper(false);
          }}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </div>
  );
};

export default DrinkImageField;
