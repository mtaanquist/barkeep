import React, { useState } from "react";
import { Crop, Upload } from "lucide-react";
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

/** Picking the photo for a drink: upload one, or paste an address. */
const DrinkImageField: React.FC<DrinkImageFieldProps> = ({
  value,
  onChange,
  loading,
  setLoading,
  t,
}) => {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);

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
    const body = new FormData();
    body.append("image", file);

    try {
      setLoading(true);
      const response = await fetch("/api/drinks/upload-image", {
        method: "POST",
        body,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { imageUrl } = await response.json();
      onChange(uncropped(imageUrl));
    } catch {
      setUploadError("Failed to upload image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t("drinkImage")}
      </label>

      <div className="space-y-4">
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-2 text-gray-500" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">{t("uploadImage")}</span>
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={upload}
              disabled={loading}
            />
          </label>
        </div>

        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

        <div className="text-center text-gray-500 text-sm">{t("or")}</div>

        <input
          type="url"
          value={value.url}
          onChange={(e) => onChange(uncropped(e.target.value))}
          placeholder="https://example.com/image.jpg"
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {value.url && (
          <div className="mt-4 space-y-2">
            <div
              className="relative w-full rounded-lg overflow-hidden bg-gray-100"
              style={{ aspectRatio: "16/9" }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={value.url}
                  alt="Preview"
                  className="w-full h-full object-contain"
                  style={{
                    transform: `translate(${value.cropX}%, ${value.cropY}%) scale(${value.zoom})`,
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCropper(true)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Crop className="w-4 h-4" />
              <span>Crop &amp; Position</span>
            </button>
          </div>
        )}
      </div>

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
