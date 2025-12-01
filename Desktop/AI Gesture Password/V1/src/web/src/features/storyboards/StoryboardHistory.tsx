import React from 'react';
import { Film, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { StoryboardJob } from '@lib/services/api';
import { GlassCard } from '@shared/components/GlassCard';

interface StoryboardHistoryProps {
    jobs: StoryboardJob[];
    onSelect: (job: StoryboardJob) => void;
    isLoading: boolean;
}

export const StoryboardHistory: React.FC<StoryboardHistoryProps> = ({ 
    jobs, 
    onSelect,
    isLoading 
}) => {
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.storyboard);

    if (isLoading) {
        return (
            <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-neon-purple" />
                    Previous Storyboards
                </h3>
                <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-neon-purple" size={32} />
                </div>
            </div>
        );
    }

    if (completedJobs.length === 0) {
        return null; // Don't show section if no previous storyboards
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle size={16} className="text-neon-green" />;
            case 'failed':
                return <XCircle size={16} className="text-red-400" />;
            case 'processing':
                return <Loader2 size={16} className="text-neon-blue animate-spin" />;
            default:
                return <Clock size={16} className="text-text-dim" />;
        }
    };

    return (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={20} className="text-neon-purple" />
                Previous Storyboards
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedJobs.map(job => (
                    <GlassCard 
                        key={job.job_id}
                        className="p-4 cursor-pointer hover:border-neon-purple/50 hover:bg-white/5 transition-all group"
                        onClick={() => onSelect(job)}
                    >
                        <div className="flex items-start gap-3">
                            {/* Thumbnail */}
                            <div className="w-20 h-14 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
                                {job.storyboard?.scenes?.[0]?.image_url ? (
                                    <img 
                                        src={job.storyboard.scenes[0].image_url} 
                                        alt="Scene 1"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Film size={20} className="text-text-dim" />
                                    </div>
                                )}
                            </div>
                            
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    {getStatusIcon(job.status)}
                                    <h4 className="font-medium text-white truncate">
                                        {job.storyboard?.title || 'Untitled Storyboard'}
                                    </h4>
                                </div>
                                <p className="text-xs text-text-dim">
                                    {new Date(job.created_at).toLocaleDateString()} • {job.storyboard?.scenes?.length || 0} scenes
                                </p>
                                <p className="text-xs text-text-dim/70 mt-1">
                                    {job.storyboard?.characters?.length || 0} characters
                                </p>
                            </div>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    );
};




