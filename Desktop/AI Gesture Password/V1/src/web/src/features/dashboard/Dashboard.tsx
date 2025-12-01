import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/GlassCard';
import { api, type Project, type QueueJobStatus } from '@lib/services/api';
import { Video, Loader2, FileText, Clapperboard, Shield, AlertOctagon } from 'lucide-react';
import { BatchQueue } from '@shared/components/BatchQueue';
import { useToast } from '@shared/components/Toast';
import { PageContainer } from '@shared/components/PageContainer';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [queueJobs, setQueueJobs] = useState<QueueJobStatus[]>([]);
    const { showToast } = useToast();
    const retryTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchProjects = async (attempt: number = 0) => {
            if (cancelled) return;

            setError(null);

            // Show connecting state during retries
            if (attempt > 0) {
                setConnecting(true);
                setRetryCount(attempt);
            }

            try {
                console.log(`[Dashboard] Fetching projects... (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
                const data = await api.getProjects();
                if (cancelled) return;

                console.log('[Dashboard] Projects received:', data);
                setProjects(data || []);
                setConnecting(false);
                setRetryCount(0);
            } catch (error: any) {
                if (cancelled) return;

                console.error("[Dashboard] Failed to fetch projects:", error);
                const isConnectionError = error.code === 'ECONNREFUSED' ||
                    error.message?.includes('Network Error') ||
                    error.code === 'ERR_NETWORK';

                // Retry on connection errors
                if (isConnectionError && attempt < MAX_RETRIES) {
                    console.log(`[Dashboard] Connection failed, retrying in ${RETRY_DELAY_MS}ms...`);
                    setConnecting(true);
                    setRetryCount(attempt + 1);
                    retryTimeoutRef.current = window.setTimeout(() => {
                        fetchProjects(attempt + 1);
                    }, RETRY_DELAY_MS);
                    return;
                }

                // Show error after all retries exhausted
                setConnecting(false);
                if (isConnectionError) {
                    setError("Cannot connect to backend API. Please ensure the backend server is running on http://127.0.0.1:8000");
                } else if (error.response) {
                    setError(`API Error: ${error.response.status} - ${error.response.data?.detail || error.response.statusText}`);
                } else {
                    setError(`Failed to load projects: ${error.message || 'Unknown error'}`);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchProjects();

        return () => {
            cancelled = true;
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const fetchQueueJobs = async () => {
            try {
                const jobs = await api.listQueueJobs({ status: 'queued' });
                if (!cancelled) {
                    setQueueJobs(jobs);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('[Dashboard] Failed to fetch queue jobs', err);
                }
            }
        };
        fetchQueueJobs();
        const interval = setInterval(fetchQueueJobs, 5000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const handleRetryQueueJob = useCallback(async (jobId: string) => {
        try {
            await api.retryQueueJob(jobId);
            showToast('Retry scheduled.', { type: 'info' });
        } catch (err) {
            console.error('Failed to retry queue job', err);
            showToast('Retry failed. Please try again.', { type: 'error' });
        }
    }, [showToast]);

    const mainTools = [
        { label: 'Projects', icon: <Video className="text-neon-blue" size={24} />, path: '/projects' },
        { label: 'Storyboards', icon: <Clapperboard className="text-neon-purple" size={24} />, path: '/storyboards' },
        { label: 'Ad Script Lab', icon: <FileText className="text-neon-green" size={24} />, path: '/ad-script-lab' },
    ];

    const miniAgents = [
        {
            label: 'Report Consolidator',
            description: 'Consolidate media reports',
            icon: <FileText className="text-neon-pink" size={20} />,
            path: '/report-consolidator',
            status: 'active' as const
        },
        {
            label: '360 Compliance Check',
            description: 'Full DPP AS-11 validation',
            icon: <Shield className="text-blue-400" size={20} />,
            path: '/compliance-check',
            status: 'active' as const
        },
        {
            label: 'Toxic Ad Report',
            description: 'Analyze harmful content',
            icon: <AlertOctagon className="text-red-400" size={20} />,
            path: null,
            status: 'coming-soon' as const
        },
    ];

    return (
        <PageContainer>
            <div className="space-y-8">
                <header>
                    <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
                    <p className="text-text-dim">Welcome back, Admin. Here's what's happening today.</p>
                </header>

                {/* Main Tools Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {mainTools.map((tool, index) => (
                        <GlassCard
                            key={index}
                            hoverEffect
                            className="flex flex-col justify-center items-center h-32 cursor-pointer group transition-all hover:scale-[1.02]"
                            onClick={() => navigate(tool.path)}
                        >
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors mb-3">
                                {tool.icon}
                            </div>
                            <h3 className="text-lg font-bold text-white">{tool.label}</h3>
                        </GlassCard>
                    ))}
                </div>

                {queueJobs.length > 0 && (
                    <BatchQueue jobs={queueJobs} onRetry={handleRetryQueueJob} />
                )}

                {/* Mini Agents & Tools */}
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-lg font-bold text-white">Mini Agents & Tools</h3>
                        <span className="text-xs text-text-dim">Quick utilities</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {miniAgents.map((agent) => (
                            <GlassCard
                                key={agent.label}
                                hoverEffect={agent.status !== 'coming-soon'}
                                className={`h-24 ${agent.status === 'coming-soon' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                onClick={() => agent.path && navigate(agent.path)}
                            >
                                <div className="flex items-center gap-4 h-full">
                                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                                        {agent.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-white truncate">{agent.label}</h4>
                                            {agent.status === 'coming-soon' && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-text-dim whitespace-nowrap">
                                                    Coming Soon
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-text-dim truncate">{agent.description}</p>
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </section>

                {/* Recent Projects */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Recent Projects</h3>
                        <button className="px-4 py-2 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 transition-colors text-sm font-medium">
                            View All
                        </button>
                    </div>

                    {connecting && (
                        <div className="mb-6 p-4 rounded-xl bg-neon-blue/10 border border-neon-blue/20 text-neon-blue flex items-center gap-3">
                            <Loader2 className="animate-spin" size={20} />
                            <div>
                                <p className="font-medium">Connecting to server...</p>
                                <p className="text-sm text-neon-blue/70">
                                    {retryCount > 0 ? `Retry ${retryCount}/${MAX_RETRIES}...` : 'Please wait while the backend starts up'}
                                </p>
                            </div>
                        </div>
                    )}

                    {error && !connecting && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                            <p className="font-medium mb-1">Connection Error</p>
                            <p className="text-sm text-red-300/80">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? (
                            <p className="text-text-dim">Loading projects...</p>
                        ) : projects.length > 0 ? (
                            projects.map((project) => (
                                <GlassCard
                                    key={project.id}
                                    hoverEffect
                                    className="group cursor-pointer"
                                    onClick={() => navigate(`/project/${project.id}`)}
                                >
                                    <div className="aspect-video rounded-lg bg-black/50 mb-4 overflow-hidden relative">
                                        {project.thumbnail ? (
                                            <img src={`data:image/jpeg;base64,${project.thumbnail}`} alt={project.video_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-text-dim">
                                                <Video size={32} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                                            <span className="text-white font-medium">View Analysis</span>
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-bold text-white truncate">{project.video_name}</h4>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-sm text-text-dim">{new Date(project.created_at).toLocaleDateString()}</span>
                                        <span className={`text-sm font-medium ${project.status === 'completed' ? 'text-neon-green' : 'text-neon-blue'}`}>
                                            {project.status}
                                        </span>
                                    </div>
                                </GlassCard>
                            ))
                        ) : (
                            <div className="col-span-full py-12 text-center border border-dashed border-glass-border rounded-2xl">
                                <p className="text-text-dim mb-4">No projects found</p>
                                <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold shadow-lg shadow-neon-blue/20 hover:shadow-neon-blue/40 transition-all">
                                    Upload New Video
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </PageContainer>
    );
};
