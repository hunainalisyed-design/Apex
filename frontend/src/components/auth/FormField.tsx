"use client";

import { useId, type InputHTMLAttributes } from "react";

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Field-specific error messages (Spec 16 AC-12) — rendered inline below the input and
   * wired via aria-describedby so a screen reader announces them with the field. */
  errors?: string[];
}

/** A labeled input with an inline, accessibly-associated error (Spec 16, AC-12) — this
 * codebase's first form-field primitive; every other input in the app so far has been a
 * single free-text field with no validation state to associate (e.g. ChatWindow's message
 * box). label htmlFor + input id + error <p id> via aria-describedby is the whole contract. */
export function FormField({ label, errors, id, className, ...inputProps }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hasErrors = !!errors?.length;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-xs font-semibold uppercase tracking-wide text-white/70">
        {label}
      </label>
      <input
        id={fieldId}
        aria-describedby={hasErrors ? errorId : undefined}
        aria-invalid={hasErrors || undefined}
        className={`focus-ring rounded-lg border px-3 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-60 ${
          hasErrors ? "border-red-500/50 bg-red-500/10" : "border-white/10 bg-white/5"
        } ${className ?? ""}`}
        {...inputProps}
      />
      {hasErrors && (
        <p id={errorId} className="text-xs text-red-300">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}
