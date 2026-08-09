import React, { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import { X, RotateCcw } from "lucide-react";
import { Area } from "react-easy-crop";
import { useApp } from "../hooks/useApp";
import { useTranslation } from "../utils/translations";

interface ImageCropperProps {
  imageUrl: string;
  initialCrop?: { x: number; y: number };
  initialZoom?: number;
  onSave: (crop: { x: number; y: number }, zoom: number) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageUrl,
  initialCrop = { x: 0, y: 0 },
  initialZoom = 1,
  onSave,
  onCancel,
}) => {
  const { language } = useApp();
  const t = useTranslation(language);

  const [crop, setCrop] = useState(initialCrop);
  const [zoom, setZoom] = useState(initialZoom);

  // Taken apart, because the caller passes a fresh object every render and
  // watching that would reset the crop while it is being dragged.
  const { x: startX, y: startY } = initialCrop;

  useEffect(() => {
    setCrop({ x: startX, y: startY });
    setZoom(initialZoom);
  }, [startX, startY, initialZoom]);

  const onCropComplete = useCallback((_croppedArea: Area, _croppedAreaPixels: Area) => {
    // Crop area is tracked internally by react-easy-crop
    // We use the crop position and zoom values directly
  }, []);

  const handleSave = () => {
    onSave(crop, zoom);
  };

  const handleReset = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent any form submission
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-surface-raised border border-border rounded-lg shadow-float w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-text">{t("cropImage")}</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-surface-sunken rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative flex-1 bg-surface-sunken" style={{ minHeight: '400px' }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-t bg-surface-sunken space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Zoom: {zoom.toFixed(2)}x
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-surface-sunken rounded-md appearance-none cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 text-text bg-surface-raised border border-border rounded-md hover:bg-surface-sunken transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t("reset")}</span>
            </button>
            <div className="flex space-x-2 w-full sm:w-auto">
              <button
                onClick={onCancel}
                className="flex-1 sm:flex-none px-6 py-2 text-text bg-surface-raised border border-border rounded-md hover:bg-surface-sunken transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 sm:flex-none px-6 py-2 bg-text text-text-inverse rounded-md hover:bg-neutral-800 transition-colors"
              >
                {t("apply")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
