import React, { useState, useEffect } from 'react';
import { Film, Loader2 } from 'lucide-react';

import { api } from '@lib/services/api';
import type {
    ScriptInput,
    StoryboardAnalysisResult,
    ClarificationResponse,
    StoryboardJob,
    Storyboard,
    ScriptSource
} from '@lib/services/api';
import { useToast } from '@shared/components/Toast';
import { PageContainer } from '@shared/components/PageContainer';
import { ScriptSelector } from './ScriptSelector';
import { ClarificationModal } from './ClarificationModal';
import { StoryboardDisplay } from './StoryboardDisplay';
import { StoryboardHistory } from './StoryboardHistory';

export const StoryboardView: React.FC = () => {
    const { showToast } = useToast();
    const [step, setStep] = useState<'select' | 'clarify' | 'generating' | 'view'>('select');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<StoryboardAnalysisResult | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [storyboard, setStoryboard] = useState<Storyboard | null>(null);

    // History state
    const [previousJobs, setPreviousJobs] = useState<StoryboardJob[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Load previous storyboards on mount
    useEffect(() => {
        loadPreviousStoryboards();
    }, []);

    const loadPreviousStoryboards = async () => {
        try {
            setLoadingHistory(true);
            const jobs = await api.listStoryboards(20);
            setPreviousJobs(jobs);
        } catch (error) {
            console.error('Failed to load previous storyboards:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Polling for job completion
    useEffect(() => {
        let pollInterval: any;

        if (step === 'generating' && jobId) {
            pollInterval = setInterval(async () => {
                try {
                    const job = await api.getStoryboardJob(jobId);
                    if (job.status === 'completed' && job.storyboard) {
                        setStoryboard(job.storyboard);
                        setStep('view');
                        showToast('Storyboard generated successfully!', { type: 'success' });
                        clearInterval(pollInterval);
                        // Refresh history to include new storyboard
                        loadPreviousStoryboards();
                    } else if (job.status === 'failed') {
                        setStep('select');
                        showToast(`Generation failed: ${job.error}`, { type: 'error' });
                        clearInterval(pollInterval);
                    }
                } catch (error) {
                    console.error('Error polling job:', error);
                }
            }, 3000);
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [step, jobId, showToast]);

    const handleSelectPreviousStoryboard = (job: StoryboardJob) => {
        if (job.storyboard) {
            setStoryboard(job.storyboard);
            setStep('view');
        }
    };

    const handleAnalyze = async (input: ScriptInput, file?: File) => {
        setIsAnalyzing(true);
        try {
            let result: StoryboardAnalysisResult;

            if (input.source === 'upload' && file) {
                // Technically we should check if file exists, handled by wrapper
                // For now, assume ScriptSelector passes 'upload' only if file exists
                // Note: ScriptSelector passed `file` separately? 
                // We need to update ScriptSelector to pass the File object.
                // But wait, the ScriptInput logic in ScriptSelector needs revisit.
                // I will update ScriptSelector to pass (input, file) 
                // and here I consume it.
                // See fix below for ScriptSelector invocation.

                // Oops, I didn't update ScriptSelector prop type yet.
                // I'll do a quick fix in handleAnalyze there or here. 
                // Wait, I updated ScriptSelector.tsx to call onAnalyze.
                // But I need to update the prop definition in ScriptSelector to accept file.
                // The current implementation of ScriptSelector.tsx passed `as any`...
                // Ideally I fix the type in `ScriptInput` or the callback signature.
                // Let's assume input has file_name, and if source is upload, 
                // I need the File object which is NOT in ScriptInput.
                // I will rely on ScriptSelector passing the file as second arg?
                // The interface in ScriptSelectorProps was `onAnalyze: (input: ScriptInput) => void;`
                // I should change it to `onAnalyze: (input: ScriptInput, file?: File) => void;`

                // Let's assume I fix ScriptSelector in next step or use a workaround.
                // Workaround: I can't easily get the file here if not passed.
                // I will just use `api.analyzeStoryboardScript` if text content is present,
                // OR `api.uploadStoryboardScript` if I have the file.

                // Since I implemented `ScriptSelector` to pass `onAnalyze({ source: 'upload', file_name: file.name } as any)`, 
                // I need the file.

                // I will update this function signature to match what I *will* update ScriptSelector to be.
                // `handleAnalyze = (input: ScriptInput, file?: File)`

                // But for now, let's assume `input` contains the text if it was a text file upload?
                // No, I want to use the upload endpoint.

                result = await api.uploadStoryboardScript(file!);
            } else {
                result = await api.analyzeStoryboardScript(input);
            }

            setAnalysisResult(result);
            setStep('clarify');
        } catch (error: any) {
            console.error('Analysis failed:', error);
            showToast(error.response?.data?.detail || 'Failed to analyze script', { type: 'error' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirmClarification = async (response: ClarificationResponse) => {
        try {
            setStep('generating'); // Show loading state immediately
            const job = await api.generateStoryboard(response);
            setJobId(job.job_id);
        } catch (error: any) {
            console.error('Generation start failed:', error);
            showToast('Failed to start generation', { type: 'error' });
            setStep('clarify');
        }
    };

    return (
        <PageContainer>
            <div className="w-full max-w-7xl mx-auto space-y-8 pb-12">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Film className="text-neon-pink" size={32} />
                            AI Storyboards
                        </h1>
                        <p className="text-text-dim mt-2">
                            Visualize your script with Nano Banana Pro™
                        </p>
                    </div>
                </div>

                {/* Content */}
                {step === 'select' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ScriptSelector
                            onAnalyze={handleAnalyze}
                            isAnalyzing={isAnalyzing}
                        />

                        {/* Previous Storyboards */}
                        <StoryboardHistory
                            jobs={previousJobs}
                            onSelect={handleSelectPreviousStoryboard}
                            isLoading={loadingHistory}
                        />
                    </div>
                )}

                {step === 'clarify' && analysisResult && (
                    <ClarificationModal
                        questions={analysisResult.clarification_questions}
                        assetRequests={analysisResult.asset_requests}
                        analysisId={analysisResult.analysis_id}
                        onConfirm={handleConfirmClarification}
                        onCancel={() => setStep('select')}
                        isSubmitting={false}
                    />
                )}

                {step === 'generating' && (
                    <div className="h-[500px] flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 bg-neon-purple/20 blur-xl rounded-full animate-pulse"></div>
                            <Loader2 className="relative text-neon-purple animate-spin" size={64} />
                        </div>
                        <h2 className="mt-8 text-2xl font-bold text-white">Visualizing Your Story</h2>
                        <p className="text-text-dim mt-2 max-w-md">
                            Our AI is directing scenes, casting characters, and generating
                            storyboard frames with Nano Banana Pro...
                        </p>
                    </div>
                )}

                {step === 'view' && storyboard && (
                    <div className="relative">
                        <button
                            onClick={() => setStep('select')}
                            className="absolute top-0 right-0 -mt-16 text-text-dim hover:text-white underline"
                        >
                            Start Over
                        </button>
                        <StoryboardDisplay storyboard={storyboard} />
                    </div>
                )}
            </div>
        </PageContainer>
    );
};

