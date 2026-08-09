import React from "react";

export interface Ranked {
  label: string;
  value: number;
}

interface RankedBarsProps {
  icon: React.ReactNode;
  heading: string;
  rows: Ranked[];
  /** Shown instead of the bars when there is nothing to count yet. */
  emptyIcon: React.ReactNode;
  emptyMessage: string;
  barColour: string;
}

/** A short league table with a bar behind each number. */
const RankedBars: React.FC<RankedBarsProps> = ({
  icon,
  heading,
  rows,
  emptyIcon,
  emptyMessage,
  barColour,
}) => {
  const top = rows.slice(0, 5);
  const most = Math.max(0, ...top.map((row) => row.value));

  return (
    <div className="bg-surface-raised rounded-md border p-6">
      <div className="flex items-center mb-6">
        {icon}
        <h3 className="text-lg font-semibold text-text">{heading}</h3>
      </div>

      {top.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          {emptyIcon}
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {top.map((row, index) => (
            <div key={row.label} className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-sm font-medium text-text-muted w-6">
                  #{index + 1}
                </span>
                <span className="font-medium text-text truncate">
                  {row.label}
                </span>
              </div>
              <div className="flex items-center space-x-3 ml-4">
                <div className="w-24 bg-surface-sunken rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColour}`}
                    style={{
                      width: `${most > 0 ? (row.value / most) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-text-muted w-8 text-right">
                  {row.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RankedBars;
