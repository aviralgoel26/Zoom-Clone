"use client";

/**
 * Toast.tsx
 * ----------
 * Zoom-styled floating toast notification system.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast("Title", "Body message", "coming-soon");
 *
 * Types: info | success | warning | coming-soon
 * Auto-dismisses after 3500ms with slide-in / fade-out animation.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { X, CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ToastType = "info" | "success" | "warning" | "coming-soon";

interface Toast {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  /** true once the auto-dismiss timer fires — triggers fade-out CSS */
  leaving: boolean;
}

interface ToastContextValue {
  showToast: (title: string, message?: string, type?: ToastType) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
const DISMISS_MS = 3500;
const LEAVE_ANIMATION_MS = 350;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Mark as leaving (triggers CSS fade-out), then remove from state
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, LEAVE_ANIMATION_MS);
  }, []);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = "info") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, message, type, leaving: false }]);

      const timer = setTimeout(() => removeToast(id), DISMISS_MS);
      timers.current.set(id, timer);
    },
    [removeToast]
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach((v) => clearTimeout(v)); };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack — bottom-right */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Individual Toast Card
// ---------------------------------------------------------------------------
function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const config = TOAST_CONFIGS[toast.type];

  return (
    <div
      role="alert"
      className={`
        pointer-events-auto
        flex items-start gap-3
        min-w-[300px] max-w-[380px]
        bg-[#1C1C1E]/95 backdrop-blur-md
        border border-white/10
        rounded-2xl shadow-2xl
        p-4
        transition-all duration-300 ease-out
        ${toast.leaving
          ? "opacity-0 translate-x-4 scale-95"
          : "opacity-100 translate-x-0 scale-100"
        }
      `}
      style={{
        animation: toast.leaving ? undefined : "toastSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${config.iconBg}`}>
        {config.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-white text-sm font-semibold leading-tight">{toast.title}</p>
        {toast.message && (
          <p className="text-[#8E8E93] text-xs mt-0.5 leading-snug">{toast.message}</p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-[#636366] hover:text-white transition-colors mt-0.5 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-type config
// ---------------------------------------------------------------------------
const TOAST_CONFIGS: Record<
  ToastType,
  { icon: ReactNode; iconBg: string }
> = {
  "coming-soon": {
    icon: <Sparkles className="w-4.5 h-4.5 text-white" />,
    iconBg: "bg-gradient-to-br from-[#0E71EB] to-[#7C3AED]",
  },
  info: {
    icon: <Info className="w-4.5 h-4.5 text-white" />,
    iconBg: "bg-[#0E71EB]",
  },
  success: {
    icon: <CheckCircle2 className="w-4.5 h-4.5 text-white" />,
    iconBg: "bg-[#34C759]",
  },
  warning: {
    icon: <AlertTriangle className="w-4.5 h-4.5 text-white" />,
    iconBg: "bg-[#FF9500]",
  },
};
