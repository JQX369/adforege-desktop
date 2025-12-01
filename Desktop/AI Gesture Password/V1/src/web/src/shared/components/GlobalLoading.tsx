import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLoading } from '@shared/context/LoadingContext';

export const GlobalLoading: React.FC = () => {
    const { isLoading } = useLoading();

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-neon-blue blur-xl opacity-20 rounded-full"></div>
                    <Loader2 className="w-16 h-16 text-neon-blue animate-spin relative z-10" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-wider animate-pulse">LOADING</h3>
            </div>
        </div>
    );
};
