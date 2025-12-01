import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Settings, LogOut, Activity, Sparkles, Film } from 'lucide-react';
import { BackendStatusIndicator } from './BackendStatusIndicator';


interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="flex h-screen w-full bg-gradient-to-br from-background-start to-background-end text-text-main overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-glass-border bg-glass-surface/30 backdrop-blur-xl flex flex-col flex-shrink-0 shadow-2xl z-10">
                <div className="p-8 flex items-center gap-3">
                    <img src="/logo.svg" alt="One-Shot Logo" className="h-10 w-10 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]" />
                    <div className="flex flex-col">
                        <h1 className="text-xl font-semibold tracking-tight">One-Shot</h1>
                        <span className="text-xs text-text-dim">By Customstories</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
                    <NavItem to="/projects" icon={<FolderOpen size={20} />} label="Projects" />
                    <NavItem to="/storyboards" icon={<Film size={20} />} label="Storyboards" />
                    <NavItem to="/ad-script-lab" icon={<Sparkles size={20} />} label="Ad Script Lab" />
                    <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" />
                </nav>

                <div className="p-4 border-t border-glass-border/50 space-y-3">
                    {/* Backend Status Indicator */}
                    <div className="flex justify-center">
                        <BackendStatusIndicator showLabel={true} />
                    </div>

                    <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-text-dim hover:text-white hover:bg-white/5 active:scale-95 transition-all duration-200">
                        <LogOut size={20} />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 overflow-y-auto">
                {children}
            </main>
        </div>
    );
};

const NavItem = ({ icon, label, to }: { icon: React.ReactNode, label: string, to: string }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-all duration-200 active:scale-95 ${isActive
            ? 'bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 text-white border border-neon-blue/30 shadow-lg shadow-neon-blue/10'
            : 'text-text-dim hover:text-white hover:bg-white/5'
            }`}
    >
        {icon}
        <span className="font-medium">{label}</span>
    </NavLink>
);
