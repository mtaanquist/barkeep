import React, { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import { X, RotateCcw } from "lucide-react";
import { Area } from "react-easy-crop";

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
  const [crop, setCrop] = useState(initialCrop);
  const [zoom, setZoom] = useState(initialZoom);

  // Sync state with props when they change
  useEffect(() => {
    setCrop(initialCrop);
    setZoom(initialZoom);
  }, [initialCrop.x, initialCrop.y, initialZoom]);

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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Crop & Position Image</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative flex-1 bg-gray-900" style={{ minHeight: '400px' }}>
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
        <div className="p-4 border-t bg-gray-50 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zoom: {zoom.toFixed(2)}x
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
            <div className="flex space-x-2 w-full sm:w-auto">
              <button
                onClick={onCancel}
                className="flex-1 sm:flex-none px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
