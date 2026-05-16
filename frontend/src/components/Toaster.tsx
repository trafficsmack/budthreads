"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within Toaster");
  return ctx;
}

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-gold" />,
};

const toastStyles: Record<ToastType, string> = {
  success: "border-green-200 bg-white",
  error: "border-red/20 bg-white",
  info: "border-blue-200 bg-white",
  warning: "border-gold/30 bg-white",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 4500);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full animate-in slide-in-from-right-2",
        toastStyles[toast.type]
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{toastIcons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-navy">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-navy/60 mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-navy/30 hover:text-navy/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose globally
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__addToast = addToast;
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Global helper to trigger toasts from anywhere
export function toast(type: ToastType, title: string, message?: string) {
  if (typeof window !== "undefined") {
    const addToast = (window as unknown as Record<string, unknown>).__addToast as
      | ((t: Omit<Toast, "id">) => void)
      | undefined;
    addToast?.({ type, title, message });
  }
}
