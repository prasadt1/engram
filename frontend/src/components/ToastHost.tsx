import React, { createContext, useCallback, useContext, useState } from 'react';
import { Toast, type ToastVariant } from './Toast';

interface ToastInput {
  title?: string;
  message?: React.ReactNode;
  variant?: ToastVariant;
  icon?: React.ReactNode;
  /** Auto-dismiss ms. Default 4000. Pass null to make it sticky. */
  duration?: number | null;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/** Fire a toast from anywhere under <ToastHost>: const toast = useToast(); toast({ ... }). */
export const useToast = () => useContext(ToastContext);

/**
 * ToastHost — wrap the app once (e.g. around <App/>'s return, or in main.tsx).
 * Renders a bottom-right stack and exposes useToast(). Iris has no toast system
 * today (only inline banners), so this is the missing transient-notice layer.
 */
export const ToastHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback(
    (id: number) => setItems((xs) => xs.filter((x) => x.id !== id)),
    [],
  );

  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { ...t, id }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="fixed z-[100] bottom-4 right-4 flex flex-col gap-3 pointer-events-none"
        aria-live="polite"
      >
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast
              title={t.title}
              message={t.message}
              variant={t.variant}
              icon={t.icon}
              duration={t.duration === undefined ? 4000 : t.duration}
              onDismiss={() => remove(t.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
