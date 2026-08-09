import React from "react";

/**
 * A labelled field, stacked. The hint is tied to the control rather than
 * wrapped in the label with it — inside, it becomes part of the field's
 * name, and a screen reader reads the whole sentence as the label.
 */
const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string }>;
}> = ({ label, hint, children }) => {
  const id = React.useId();
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": hint ? hintId : undefined,
      })}
      {hint && (
        <span id={hintId} className="text-body text-text-muted">
          {hint}
        </span>
      )}
    </div>
  );
};

export default Field;
