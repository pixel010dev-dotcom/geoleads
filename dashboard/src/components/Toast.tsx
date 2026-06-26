"use client";
import { useEffect, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

let toastId = 0;
let addToastFn: ((msg: string, type: ToastType) => void) | null = null;

export function showToast(message: string, type: ToastType = "info") {
  addToastFn?.(message, type);
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 8000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.5)", icon: "✓" },
    error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)", icon: "✕" },
    info: { bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.5)", icon: "ℹ" },
    warning: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.5)", icon: "⚠" },
  };

  return (
    <div style={{
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 99999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      maxWidth: 380,
    }}>
      {toasts.map((t) => {
        const c = colors[t.type];
        return (
          <div key={t.id} style={{
            background: c.bg,
            border: `1px solid ${c.border}`,
            backdropFilter: "blur(16px)",
            borderRadius: 12,
            padding: "12px 16px",
            color: "#fff",
            fontSize: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            animation: "slideUpFade 0.3s ease",
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
