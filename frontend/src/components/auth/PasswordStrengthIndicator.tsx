import { validatePassword } from "@/lib/auth/validation";

const MIN_LENGTH = 8;

function strengthLevel(password: string): { label: string; className: string; ratio: number } {
  if (!password) return { label: "", className: "bg-white/10", ratio: 0 };

  const meetsPolicy = validatePassword(password) === null;
  const isLong = password.length >= MIN_LENGTH + 4;
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  if (!meetsPolicy) return { label: "Too weak", className: "bg-red-400", ratio: 1 / 3 };
  if (isLong && hasSymbol) return { label: "Strong", className: "bg-emerald-400", ratio: 1 };
  return { label: "Okay", className: "bg-amber-400", ratio: 2 / 3 };
}

/** Lightweight strength feedback (SRS §36.2) reacting to the same client-side policy check
 * the form already runs — purely advisory; the server remains the actual authority on
 * whether a password is accepted. */
export function PasswordStrengthIndicator({ password }: { password: string }) {
  if (!password) return null;
  const { label, className, ratio } = strengthLevel(password);

  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-white/50">{label}</span>
    </div>
  );
}
