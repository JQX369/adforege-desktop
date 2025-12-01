import React from 'react';
import type { QueueJobStatus } from '@lib/services/api';
import { JobStatus, queueJobToStatus } from './JobStatus';

interface BatchQueueProps {
    jobs: QueueJobStatus[];
    onRetry?: (jobId: string) => void;
}

export const BatchQueue: React.FC<BatchQueueProps> = ({ jobs, onRetry }) => {
    if (!jobs.length) return null;
    const completed = jobs.filter((job) => job.status === 'completed').length;
    const percent = Math.round((completed / jobs.length) * 100);

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-white font-semibold">Processing Queue</h3>
                    <p className="text-xs text-text-dim">{jobs.length} job{jobs.length === 1 ? '' : 's'} in progress</p>
                </div>
                <div className="text-sm text-white/70">{percent}% complete</div>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-neon-blue to-neon-purple transition-all" style={{ width: `${percent}%` }} />
            </div>
            <div className="space-y-3">
                {jobs.map((job) => (
                    <JobStatus
                        key={job.job_id}
                        job={queueJobToStatus(job)}
                        compact
                        showRetry={job.status === 'failed'}
                        onRetry={job.status === 'failed' ? () => onRetry?.(job.job_id) : undefined}
                    />
                ))}
            </div>
        </div>
    );
};









