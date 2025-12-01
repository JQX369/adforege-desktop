import React, { useState, useEffect } from 'react';
import {
    Lock,
    Shield,
    Activity,
    Database,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    AlertTriangle,
    RefreshCw,
    ChevronRight,
    Zap
} from 'lucide-react';
import { PipelineFlow } from './PipelineFlow';

interface AdminStats {
    total_runs: number;
    completed_runs: number;
    failed_runs: number;
    running_runs: number;
    success_rate: number;
    avg_duration_seconds: number;
    rag_status: {
        healthy: boolean;
        client_type: string;
        using_real_db: boolean;
    };
    runs_by_day: Record<string, number>;
}

interface PipelineStage {
    id: string;
    name: string;
    optional: boolean;
    success_rate: number;
    runs_through: number;
    failures: number;
}

interface RecentRun {
    run_id: string;
    asset_name: string;
    brand_name: string;
    status: string;
    current_stage: string;
    creative_mode: string;
    created_at: string | null;
    updated_at: string | null;
    duration_seconds: number | null;
    error: string | null;
    scripts_generated: number;
    has_final_script: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const AdminDashboard: React.FC = () => {
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
    const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const handleAuth = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE}/ad-script/admin/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                setAuthenticated(true);
                localStorage.setItem('admin_password', password);
                await loadAllData();
            } else {
                setError('Invalid password');
            }
        } catch (e) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const loadAllData = async () => {
        const storedPassword = localStorage.getItem('admin_password') || password;
        setLoading(true);

        try {
            const [statsRes, flowRes, runsRes] = await Promise.all([
                fetch(`${API_BASE}/ad-script/admin/stats?password=${encodeURIComponent(storedPassword)}`),
                fetch(`${API_BASE}/ad-script/admin/pipeline-flow?password=${encodeURIComponent(storedPassword)}`),
                fetch(`${API_BASE}/ad-script/admin/recent-runs?password=${encodeURIComponent(storedPassword)}&limit=20`)
            ]);

            if (statsRes.ok) {
                setStats(await statsRes.json());
            }

            if (flowRes.ok) {
                const flowData = await flowRes.json();
                setPipelineStages(flowData.stages);
            }

            if (runsRes.ok) {
                setRecentRuns(await runsRes.json());
            }

            setLastRefresh(new Date());
        } catch (e) {
            console.error('Failed to load admin data', e);
        } finally {
            setLoading(false);
        }
    };

    // Check for stored password on mount
    useEffect(() => {
        const storedPassword = localStorage.getItem('admin_password');
        if (storedPassword) {
            setPassword(storedPassword);
            setAuthenticated(true);
            loadAllData();
        }
    }, []);

    // Auto-refresh every 30 seconds when authenticated
    useEffect(() => {
        if (!authenticated) return;
        const interval = setInterval(loadAllData, 30000);
        return () => clearInterval(interval);
    }, [authenticated]);

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center">
                <div className="bg-[#1A1A1F] rounded-2xl p-8 border border-white/10 w-full max-w-md">
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-blue/20 to-purple-500/20 flex items-center justify-center">
                            <Lock size={32} className="text-neon-blue" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-white text-center mb-2">Admin Dashboard</h1>
                    <p className="text-white/50 text-center mb-6">Enter password to access pipeline monitoring</p>

                    <div className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                            placeholder="Password"
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-neon-blue"
                        />

                        {error && (
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        )}

                        <button
                            onClick={handleAuth}
                            disabled={loading || !password}
                            className="w-full py-3 bg-neon-blue/20 border border-neon-blue/50 rounded-lg text-neon-blue font-medium hover:bg-neon-blue/30 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Authenticating...' : 'Access Dashboard'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B0B0C] text-white p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Shield className="text-neon-blue" />
                        Ad Script Lab Admin
                    </h1>
                    <p className="text-white/50 mt-1">Pipeline monitoring and system health</p>
                </div>

                <div className="flex items-center gap-4">
                    {lastRefresh && (
                        <span className="text-xs text-white/40">
                            Last refresh: {lastRefresh.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={loadAllData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={() => {
                            localStorage.removeItem('admin_password');
                            setAuthenticated(false);
                            setPassword('');
                        }}
                        className="px-4 py-2 text-white/50 hover:text-white transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <StatCard
                        label="Total Runs"
                        value={stats.total_runs}
                        icon={Activity}
                        color="blue"
                    />
                    <StatCard
                        label="Success Rate"
                        value={`${stats.success_rate.toFixed(1)}%`}
                        icon={TrendingUp}
                        color="green"
                        subtext={`${stats.completed_runs} completed`}
                    />
                    <StatCard
                        label="Avg Duration"
                        value={formatDuration(stats.avg_duration_seconds)}
                        icon={Clock}
                        color="purple"
                    />
                    <StatCard
                        label="RAG Status"
                        value={stats.rag_status.healthy ? 'Healthy' : 'Degraded'}
                        icon={Database}
                        color={stats.rag_status.healthy ? 'green' : 'red'}
                        subtext={stats.rag_status.using_real_db ? 'Supabase' : 'Stub'}
                    />
                </div>
            )}

            {/* Pipeline Flow Visualization */}
            <div className="bg-[#1A1A1F] rounded-2xl p-6 border border-white/5 mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Zap className="text-neon-blue" />
                    Pipeline Flow
                </h2>
                <PipelineFlow stages={pipelineStages} />
            </div>

            {/* Recent Runs Table */}
            <div className="bg-[#1A1A1F] rounded-2xl p-6 border border-white/5">
                <h2 className="text-lg font-semibold mb-4">Recent Runs</h2>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-white/40 text-xs uppercase border-b border-white/5">
                                <th className="pb-3 pr-4">Asset</th>
                                <th className="pb-3 pr-4">Brand</th>
                                <th className="pb-3 pr-4">Status</th>
                                <th className="pb-3 pr-4">Stage</th>
                                <th className="pb-3 pr-4">Mode</th>
                                <th className="pb-3 pr-4">Duration</th>
                                <th className="pb-3 pr-4">Scripts</th>
                                <th className="pb-3">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentRuns.map((run) => (
                                <tr key={run.run_id} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="py-3 pr-4 text-sm">{run.asset_name || 'Untitled'}</td>
                                    <td className="py-3 pr-4 text-sm text-white/70">{run.brand_name || '-'}</td>
                                    <td className="py-3 pr-4">
                                        <StatusBadge status={run.status} />
                                    </td>
                                    <td className="py-3 pr-4 text-sm text-white/70">{run.current_stage}</td>
                                    <td className="py-3 pr-4">
                                        <span className="text-xs px-2 py-1 rounded bg-white/10">{run.creative_mode}</span>
                                    </td>
                                    <td className="py-3 pr-4 text-sm text-white/70">
                                        {run.duration_seconds ? formatDuration(run.duration_seconds) : '-'}
                                    </td>
                                    <td className="py-3 pr-4 text-sm">
                                        {run.scripts_generated > 0 && (
                                            <span className={run.has_final_script ? 'text-green-400' : 'text-white/70'}>
                                                {run.scripts_generated} {run.has_final_script && '✓'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 text-sm text-white/50">
                                        {run.created_at ? new Date(run.created_at).toLocaleString() : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: 'blue' | 'green' | 'purple' | 'red';
    subtext?: string;
}> = ({ label, value, icon: Icon, color, subtext }) => {
    const colors = {
        blue: 'from-neon-blue/20 to-neon-blue/5 border-neon-blue/30',
        green: 'from-green-500/20 to-green-500/5 border-green-500/30',
        purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
        red: 'from-red-500/20 to-red-500/5 border-red-500/30',
    };

    const iconColors = {
        blue: 'text-neon-blue',
        green: 'text-green-400',
        purple: 'text-purple-400',
        red: 'text-red-400',
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-5 border`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/50">{label}</span>
                <Icon size={20} className={iconColors[color]} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            {subtext && <div className="text-xs text-white/40 mt-1">{subtext}</div>}
        </div>
    );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles = {
        completed: 'bg-green-500/20 text-green-400 border-green-500/30',
        failed: 'bg-red-500/20 text-red-400 border-red-500/30',
        running: 'bg-neon-blue/20 text-neon-blue border-neon-blue/30',
        pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };

    return (
        <span className={`text-xs px-2 py-1 rounded border ${styles[status as keyof typeof styles] || styles.pending}`}>
            {status}
        </span>
    );
};

const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
};
