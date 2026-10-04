import { createElement, useEffect, useState, type ReactElement } from 'react';

const SHORT_MS = 2000;
const LONG_MS = 3500;

type ToastState = {
  key: number;
  text: string;
  long: boolean;
};

type ToastFn = (text: string, duration?: 0 | 1) => void;

export function usePageToast(): ReactElement | null {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let key = 0;
    const toastFn: ToastFn = (text, duration) => {
      key += 1;
      setToast({ key, text: String(text ?? ''), long: Number(duration) === 1 });
    };
    const host = globalThis as { $toast?: ToastFn };
    host.$toast = toastFn;
    return () => {
      if (host.$toast === toastFn) {
        delete host.$toast;
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(null), toast.long ? LONG_MS : SHORT_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) {
    return null;
  }
  return createElement(
    'div',
    {
      key: toast.key,
      className: 'lowcode-toast',
      style: {
        position: 'fixed',
        left: '50%',
        top: '46%',
        zIndex: 10000,
        maxWidth: '70%',
        padding: '10px 16px',
        borderRadius: 8,
        background: 'rgba(0, 0, 0, 0.75)',
        color: '#fff',
        fontSize: 14,
        lineHeight: 1.4,
        textAlign: 'center',
        wordBreak: 'break-word',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      },
    },
    toast.text,
  );
}
