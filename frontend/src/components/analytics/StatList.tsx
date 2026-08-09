import React from "react";

interface StatListProps {
  heading: string;
  rows: Array<{ label: string; value: React.ReactNode }>;
}

/** A short list of label-and-number pairs. */
const StatList: React.FC<StatListProps> = ({ heading, rows }) => (
  <div>
    <h4 className="font-medium text-gray-700 mb-3">{heading}</h4>
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between">
          <span className="text-sm text-gray-600">{row.label}</span>
          <span className="text-sm font-medium truncate max-w-32">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default StatList;
