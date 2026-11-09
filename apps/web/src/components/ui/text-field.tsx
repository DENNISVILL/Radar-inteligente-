import { useId } from "react";
import type { InputHTMLAttributes } from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, id, className = "", ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="rc-field">
      <label className="rc-field__label" htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        className={["rc-input", error ? "rc-input--error" : "", className].filter(Boolean).join(" ")}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {hint ? <p className="rc-field__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="rc-field__error" id={errorId}>{error}</p> : null}
    </div>
  );
}
