import React from "react";

interface StatCardProps {
  icon: React.ReactNode;
  /** Tailwind classes for the tinted circle behind the icon. */
  tint: string;
  label: string;
  value: React.ReactNode;
  /** Long values, such as a drink name, get the smaller size. */
  small?: boolean;
}

/** One of the boxes along the top of the reports. */
const StatCard: React.FC<StatCardProps> = ({
  icon,
  tint,
  label,
  value,
  small = false,
}) => (
  <div className="bg-surface-raised rounded-md border p-6">
    <div className="flex items-center">
      <div className={`p-3 rounded-md ${tint}`}>{icon}</div>
      <div className="ml-4 min-w-0">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        <p
          className={`font-bold text-text ${
            small ? "text-lg truncate" : "text-2xl"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  </div>
);

export default StatCard;
