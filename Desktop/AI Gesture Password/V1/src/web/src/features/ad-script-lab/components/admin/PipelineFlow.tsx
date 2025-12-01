import React from 'react';
import {
    Globe,
    FileText,
    Database,
    Lightbulb,
    Filter,
    Sparkles,
    Users,
    Shield,
    Wrench,
    Trophy,
    ChevronRight,
    CheckCircle,
    AlertTriangle
} from 'lucide-react';

interface PipelineStage {
    id: string;
    name: string;
    optional: boolean;
    success_rate: number;
    runs_through: number;
    failures: number;
}

interface PipelineFlowProps {
    stages: PipelineStage[];
}

const STAGE_ICONS: Record<string, React.ElementType> = {
    brand_discovery: Globe,
    synthesizer: FileText,
    retriever: Database,
    amazon_start: Lightbulb,
    ideate: Lightbulb,
    selector: Filter,
    polish: Sparkles,
    braintrust: Users,
    compliance: Shield,
    compliance_fix: Wrench,
    finalize: Trophy,
};

export const PipelineFlow: React.FC<PipelineFlowProps> = ({ stages }) => {
    if (!stages || stages.length === 0) {
        return (
            <div className="text-center py-8 text-white/40">
                No pipeline data available
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Pipeline stages */}
            <div className="flex items-center justify-between overflow-x-auto pb-4">
                {stages.map((stage, index) => {
                    const Icon = STAGE_ICONS[stage.id] || Lightbulb;
                    const isHealthy = stage.success_rate >= 90;
                    const isWarning = stage.success_rate >= 70 && stage.success_rate < 90;
                    const isDanger = stage.success_rate < 70;

                    return (
                        <React.Fragment key={stage.id}>
                            <div className="flex flex-col items-center min-w-[100px]">
                                {/* Stage Node */}
                                <div
                                    className={`
                                        relative w-14 h-14 rounded-xl flex items-center justify-center
                                        transition-all duration-300 group
                                        ${stage.optional ? 'border-dashed' : 'border-solid'}
                                        ${isHealthy ? 'bg-green-500/10 border-2 border-green-500/30' :
                                          isWarning ? 'bg-yellow-500/10 border-2 border-yellow-500/30' :
                                          isDanger ? 'bg-red-500/10 border-2 border-red-500/30' :
                                          'bg-white/5 border-2 border-white/10'}
                                    `}
                                >
                                    <Icon
                                        size={24}
                                        className={
                                            isHealthy ? 'text-green-400' :
                                            isWarning ? 'text-yellow-400' :
                                            isDanger ? 'text-red-400' :
                                            'text-white/50'
                                        }
                                    />

                                    {/* Status indicator */}
                                    <div className="absolute -top-1 -right-1">
                                        {isHealthy ? (
                                            <CheckCircle size={14} className="text-green-400 bg-[#1A1A1F] rounded-full" />
                                        ) : stage.failures > 0 ? (
                                            <AlertTriangle size={14} className="text-yellow-400 bg-[#1A1A1F] rounded-full" />
                                        ) : null}
                                    </div>

                                    {/* Hover tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        <div className="bg-black/90 rounded-lg px-3 py-2 text-xs whitespace-nowrap border border-white/10">
                                            <div className="font-medium text-white mb-1">{stage.name}</div>
                                            <div className="text-white/60">
                                                {stage.runs_through} runs • {stage.success_rate.toFixed(0)}% success
                                            </div>
                                            {stage.failures > 0 && (
                                                <div className="text-red-400">{stage.failures} failures</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stage label */}
                                <div className="mt-2 text-center">
                                    <div className="text-xs font-medium text-white/80">{stage.name}</div>
                                    <div className="text-[10px] text-white/40">
                                        {stage.success_rate.toFixed(0)}%
                                    </div>
                                </div>

                                {/* Optional badge */}
                                {stage.optional && (
                                    <div className="text-[8px] text-white/30 uppercase mt-1">optional</div>
                                )}
                            </div>

                            {/* Connector arrow */}
                            {index < stages.length - 1 && (
                                <div className="flex-shrink-0 mx-1">
                                    <ChevronRight size={20} className="text-white/20" />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500/50" />
                    <span className="text-white/50">90%+ success</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-yellow-500/30 border border-yellow-500/50" />
                    <span className="text-white/50">70-90% success</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50" />
                    <span className="text-white/50">&lt;70% success</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded border border-dashed border-white/30" />
                    <span className="text-white/50">Optional stage</span>
                </div>
            </div>
        </div>
    );
};
