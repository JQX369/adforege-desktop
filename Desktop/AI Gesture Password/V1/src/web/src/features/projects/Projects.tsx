import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/GlassCard';
import { api, type Project, type QueueJobStatus } from '@lib/services/api';
import { Video, Search, Filter, Trash } from 'lucide-react';
import { JobStatus, queueJobToStatus } from '@shared/components/JobStatus';
import { useToast } from '@shared/components/Toast';
import { PageContainer } from '@shared/components/PageContainer';

export const Projects: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadJob, setUploadJob] = useState<QueueJobStatus | null>(null);
    const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const data = await api.getProjects();
                setProjects(data);
            } catch (error) {
                console.error("Failed to fetch projects", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const filteredProjects = projects.filter(p =>
        p.video_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const clearPoller = () => {
        if (pollerRef.current) {
            clearInterval(pollerRef.current);
            pollerRef.current = null;
        }
    };

    useEffect(() => () => clearPoller(), []);

    const pollQueueJob = useCallback((jobId: string) => {
        const poll = async () => {
            try {
                const job = await api.getQueueJobStatus(jobId);
                setUploadJob(job);
                if (job.status === 'completed') {
                    clearPoller();
                    showToast('Video processing completed successfully.', { type: 'success' });
                } else if (job.status === 'failed') {
                    clearPoller();
                    showToast(job.error_user_message || 'Video processing failed.', { type: 'error' });
                }
            } catch (error) {
                console.error('Failed to poll queue job', error);
            }
        };
        poll();
        clearPoller();
        pollerRef.current = setInterval(poll, 3000);
    }, [showToast]);

    const handleRetryUploadJob = async () => {
        if (!uploadJob) return;
        try {
            const retried = await api.retryQueueJob(uploadJob.job_id);
            setUploadJob(retried);
            showToast('Retrying upload job…', { type: 'info' });
            pollQueueJob(retried.job_id);
        } catch (error) {
            console.error('Failed to retry job', error);
            showToast('Retry failed. Please try uploading again.', { type: 'error' });
        }
    };

    const handleDeleteProject = async (projectId: string, projectName: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click event

        if (!window.confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await api.deleteProject(projectId);
            // Remove project from local state
            setProjects(projects.filter(p => p.id !== projectId));
        } catch (error) {
            console.error("Failed to delete project", error);
            alert("Failed to delete project. Please try again.");
        }
    };

    return (
        <PageContainer>
            <div className="space-y-8">
                <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Projects</h2>
                    <p className="text-text-dim">Manage and analyze your video projects.</p>
                </div>
                <div className="relative">
                    <input
                        type="file"
                        id="video-upload"
                        className="hidden"
                        accept="video/*"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            try {
                                setUploading(true);
                                const response = await api.uploadVideo(file);
                                if (response.analysis_id) {
                                    showToast('Video uploaded successfully. Opening project…', { type: 'success' });
                                    // Navigate immediately to the project page
                                    navigate(`/project/${response.analysis_id}`);
                                    // Start polling in the background (will stop when component unmounts)
                                    if (response.job_id) {
                                    pollQueueJob(response.job_id);
                                    }
                                }
                            } catch (error) {
                                console.error("Upload failed", error);
                                showToast('Failed to upload video. Please try again.', { type: 'error' });
                            } finally {
                                setUploading(false);
                            }
                        }}
                    />
                    <button
                        onClick={() => document.getElementById('video-upload')?.click()}
                        disabled={uploading}
                        className={`px-6 py-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold shadow-lg shadow-neon-blue/20 hover:shadow-neon-blue/40 transition-all flex items-center gap-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {uploading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Video size={20} />
                                Upload New Video
                            </>
                        )}
                    </button>
                </div>
            </header>

            {/* Search and Filter Bar */}
            <GlassCard className="flex items-center gap-4 py-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-dim" size={20} />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-neon-blue transition-colors"
                    />
                </div>
                <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-text-dim hover:text-white transition-colors">
                    <Filter size={20} />
                </button>
            </GlassCard>

            {uploadJob && (
                <JobStatus
                    job={queueJobToStatus(uploadJob)}
                    showRetry={uploadJob.status === 'failed'}
                    onRetry={uploadJob.status === 'failed' ? handleRetryUploadJob : undefined}
                />
            )}

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? (
                    <p className="text-text-dim">Loading projects...</p>
                ) : filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => (
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
                                {/* Delete button overlay */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <button
                                        onClick={(e) => handleDeleteProject(project.id, project.video_name, e)}
                                        className="p-2 rounded-lg bg-red-500/90 hover:bg-red-600 text-white shadow-lg backdrop-blur-sm transition-all hover:scale-110"
                                        title="Delete project"
                                    >
                                        <Trash size={18} />
                                    </button>
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
                        <p className="text-text-dim mb-4">No projects found matching your search</p>
                    </div>
                )}
            </div>
            </div>
        </PageContainer>
    );
};
