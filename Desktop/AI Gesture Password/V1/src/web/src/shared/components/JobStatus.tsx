import React from 'react';
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import type { JobStatus as QueueStatus, QueueJobStatus } from '@lib/services/api';

interface BaseJobStatus {
    status: QueueStatus;
    queue_job_id?: string | null;
    error?: string | null;
    error_user_message?: string | null;
    retry_count?: number;
    label?: string;
}

interface JobStatusProps {
    job: BaseJobStatus;
    onRetry?: () => void;
    compact?: boolean;
    showRetry?: boolean;
}

const STATUS_COPY: Record<QueueStatus, string> = {
    queued: 'Queued — waiting for worker slot.',
    processing: 'Processing… hang tight.',
    processing_fallback: 'Processing inline (worker restarting)…',
    completed: 'Completed successfully.',
    failed: 'Failed — retry when ready.',
};

const statusIcon: Record<QueueStatus, React.ReactNode> = {
    queued: <Clock className="text-yellow-200" size={18} />,
    processing: <Loader2 className="text-blue-200 animate-spin" size={18} />,
    processing_fallback: <Loader2 className="text-amber-200 animate-spin" size={18} />,
    completed: <CheckCircle className="text-green-300" size={18} />,
    failed: <XCircle className="text-red-300" size={18} />,
};

export const JobStatus: React.FC<JobStatusProps> = ({ job, onRetry, compact = false, showRetry = true }) => {
    const { status, error_user_message, error, queue_job_id, retry_count = 0, label } = job;
    return (
        <div className={`rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 ${compact ? 'flex items-center gap-3' : 'space-y-2'}`}>
            <div className="flex items-center gap-3">
                {statusIcon[status]}
                <div>
                    <div className="font-medium">
                        {label ?? 'Job Status'} • {status.charAt(0).toUpperCase() + status.slice(1)}
                    </div>
                    <div className="text-text-dim text-xs">{STATUS_COPY[status]}</div>
                </div>
            </div>
            {!compact && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-text-dim">
                    {queue_job_id && (
                        <span className="px-2 py-1 rounded-lg bg-black/30 border border-white/5 font-mono text-[11px]">
                            {queue_job_id}
                        </span>
                    )}
                    {retry_count > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                            Retries: {retry_count}
                        </span>
                    )}
                    {status === 'failed' && (error_user_message || error) && (
                        <span className="text-red-300">{error_user_message || error}</span>
                    )}
                </div>
            )}
            {status === 'failed' && showRetry && (
                <button
                    onClick={onRetry}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-400/40 text-red-200 px-3 py-1 text-xs hover:bg-red-500/10 transition-colors"
                >
                    <RefreshCw size={14} />
                    Retry Job
                </button>
            )}
        </div>
    );
};

export const queueJobToStatus = (job: QueueJobStatus): BaseJobStatus => ({
    status: job.status,
    queue_job_id: job.job_id,
    error: job.error || undefined,
    error_user_message: job.error_user_message || undefined,
    retry_count: job.retry_count,
    label: job.job_type === 'reaction' ? 'Reaction Processing' : 'Video Analysis',
});


