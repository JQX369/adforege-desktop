import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastConfig {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
}

interface ToastContextValue {
    showToast: (message: string, options?: { type?: ToastType; duration?: number }) => string;
    showLoadingToast: (message: string) => string;
    dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastConfig[]>([]);

    const dismissToast = useCallback((id: string) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(
        (message: string, options?: { type?: ToastType; duration?: number }) => {
            const id = crypto.randomUUID();
            const toast: ToastConfig = {
                id,
                message,
                type: options?.type ?? 'info',
                duration: options?.duration ?? 3200,
            };
            setToasts((current) => [...current, toast]);
            if (toast.duration > 0) {
                setTimeout(() => dismissToast(id), toast.duration);
            }
            return id;
        },
        [dismissToast],
    );

    const showLoadingToast = useCallback(
        (message: string) => {
            const id = crypto.randomUUID();
            const toast: ToastConfig = {
                id,
                message,
                type: 'loading',
                duration: 0, // Persist until manually dismissed
            };
            setToasts((current) => [...current, toast]);
            return id;
        },
        [],
    );

    const value = useMemo(() => ({ showToast, showLoadingToast, dismissToast }), [showToast, showLoadingToast, dismissToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastViewport toasts={toasts} onDismiss={dismissToast} />
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return ctx;
};

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={18} />,
    error: <AlertTriangle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
    loading: <Loader2 size={18} className="animate-spin" />,
};

const baseColor: Record<ToastType, string> = {
    success: 'text-green-300 border-green-400/40 bg-green-400/10',
    error: 'text-red-300 border-red-400/40 bg-red-400/10',
    warning: 'text-yellow-200 border-yellow-300/40 bg-yellow-300/10',
    info: 'text-blue-200 border-blue-300/40 bg-blue-300/10',
    loading: 'text-neon-blue border-neon-blue/40 bg-neon-blue/10',
};

const ToastViewport: React.FC<{ toasts: ToastConfig[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => (
    <div className="fixed bottom-6 right-6 z-[1200] flex flex-col gap-3 max-w-sm">
        <AnimatePresence>
            {toasts.map((toast) => (
                <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, translateY: 16 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: 16 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={`border backdrop-blur-md rounded-xl px-4 py-3 shadow-xl shadow-black/40 flex items-start gap-3 ${baseColor[toast.type]}`}
                >
                    <span className="mt-0.5">{iconMap[toast.type]}</span>
                    <span className="flex-1 text-white/90 text-sm">{toast.message}</span>
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="text-white/60 hover:text-white transition-colors p-1 rounded"
                        aria-label="Dismiss toast"
                    >
                        <X size={16} />
                    </button>
                </motion.div>
            ))}
        </AnimatePresence>
    </div>
);


