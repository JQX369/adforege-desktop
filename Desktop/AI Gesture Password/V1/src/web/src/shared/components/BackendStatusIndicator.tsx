import React from 'react';
import { useBackendStatus } from '../context/BackendStatusContext';
import { Wifi, WifiOff, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface BackendStatusIndicatorProps {
    showLabel?: boolean;
    className?: string;
}

type StatusType = 'connected' | 'connecting' | 'disconnected' | 'error';

const statusConfig: Record<StatusType, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
    connected: {
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        icon: <Wifi size={14} />,
        label: 'Connected',
    },
    connecting: {
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        icon: <Loader2 size={14} className="animate-spin" />,
        label: 'Connecting...',
    },
    disconnected: {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        icon: <WifiOff size={14} />,
        label: 'Disconnected',
    },
    error: {
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        icon: <AlertCircle size={14} />,
        label: 'Error',
    },
};

export const BackendStatusIndicator: React.FC<BackendStatusIndicatorProps> = ({ 
    showLabel = true, 
    className = '' 
}) => {
    const { status, lastError, checkNow } = useBackendStatus();
    const config = statusConfig[status];

    return (
        <div 
            className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${className}`}
            title={lastError || config.label}
        >
            {config.icon}
            {showLabel && <span>{config.label}</span>}
            {(status === 'disconnected' || status === 'error') && (
                <button
                    onClick={checkNow}
                    className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
                    title="Retry connection"
                >
                    <RefreshCw size={12} />
                </button>
            )}
        </div>
    );
};

// Full-screen overlay for when backend is disconnected
export const BackendDisconnectedOverlay: React.FC = () => {
    const { status, lastError, checkNow } = useBackendStatus();

    if (status === 'connected' || status === 'connecting') {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md text-center shadow-2xl">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <WifiOff size={32} className="text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Backend Disconnected</h2>
                <p className="text-white/60 mb-4">
                    {lastError || 'Unable to connect to the backend server.'}
                </p>
                <p className="text-white/40 text-sm mb-6">
                    Make sure the backend is running on port 8000.
                </p>
                <button
                    onClick={checkNow}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
                >
                    <RefreshCw size={16} />
                    Retry Connection
                </button>
            </div>
        </div>
    );
};
