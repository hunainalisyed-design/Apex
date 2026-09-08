"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastTone = "polite" | "assertive";

interface ToastEntry {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2500;

function ToastBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="glass-panel pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 text-xs text-white/80"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="focus-ring text-white/50 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Shared confirmation/error notifications (Spec 12, AC-8) — one provider replacing the
 * local toast SaveSharePanel (Spec 10) built ad hoc before this spec existed. Two separate
 * aria-live regions (polite for confirmations, assertive for errors — screen readers
 * announce them differently), each toast auto-dismisses and is also manually dismissible
 * (a capability the earlier local toast never had).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const timeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timeout = timeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "polite") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone }]);
      timeouts.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
    },
    [dismiss],
  );

  const politeToasts = toasts.filter((t) => t.tone === "polite");
  const assertiveToasts = toasts.filter((t) => t.tone === "assertive");

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
        <div aria-live="polite" className="flex flex-col items-center gap-2">
          {politeToasts.map((toast) => (
            <ToastBanner key={toast.id} message={toast.message} onDismiss={() => dismiss(toast.id)} />
          ))}
        </div>
        <div aria-live="assertive" className="flex flex-col items-center gap-2">
          {assertiveToasts.map((toast) => (
            <ToastBanner key={toast.id} message={toast.message} onDismiss={() => dismiss(toast.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
