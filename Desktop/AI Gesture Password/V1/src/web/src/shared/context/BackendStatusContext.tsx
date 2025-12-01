import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type BackendStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface BackendStatusContextType {
    status: BackendStatus;
    lastError: string | null;
    lastChecked: Date | null;
    checkNow: () => Promise<void>;
}

const BackendStatusContext = createContext<BackendStatusContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const HEALTH_CHECK_TIMEOUT = 15000; // 15 seconds - increased to tolerate heavy backend processing
const MAX_CONSECUTIVE_FAILURES = 2; // Only show disconnected after 2 consecutive failures

export const BackendStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<BackendStatus>('connecting');
    const [lastError, setLastError] = useState<string | null>(null);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [consecutiveFailures, setConsecutiveFailures] = useState(0);

    const checkHealth = useCallback(async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

            const response = await fetch(`${API_URL}/health`, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                setStatus('connected');
                setLastError(null);
                setConsecutiveFailures(0); // Reset on success
            } else {
                setConsecutiveFailures(prev => prev + 1);
                if (consecutiveFailures + 1 >= MAX_CONSECUTIVE_FAILURES) {
                    setStatus('error');
                    setLastError(`Backend returned status ${response.status}`);
                }
            }
        } catch (error: any) {
            setConsecutiveFailures(prev => prev + 1);

            // Only show disconnected after multiple consecutive failures
            // This prevents false alarms when backend is just busy processing
            if (consecutiveFailures + 1 >= MAX_CONSECUTIVE_FAILURES) {
                if (error.name === 'AbortError') {
                    setStatus('disconnected');
                    setLastError('Backend health check timed out');
                } else if (error.message?.includes('fetch')) {
                    setStatus('disconnected');
                    setLastError('Cannot connect to backend server');
                } else {
                    setStatus('error');
                    setLastError(error.message || 'Unknown error');
                }
            }
            // If only first failure, keep showing connected (backend might just be busy)
        } finally {
            setLastChecked(new Date());
        }
    }, [consecutiveFailures]);

    // Initial check and periodic polling
    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);
        return () => clearInterval(interval);
    }, [checkHealth]);

    return (
        <BackendStatusContext.Provider value={{ status, lastError, lastChecked, checkNow: checkHealth }}>
            {children}
        </BackendStatusContext.Provider>
    );
};

export const useBackendStatus = () => {
    const context = useContext(BackendStatusContext);
    if (context === undefined) {
        throw new Error('useBackendStatus must be used within a BackendStatusProvider');
    }
    return context;
};




