import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    MessageCircle,
    Send,
    Loader2,
    Lightbulb,
    TrendingUp,
    Sparkles,
    BarChart3,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Copy,
    Check,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@lib/services/api';

// Mode definitions
const QA_MODES = {
    general: {
        label: 'General',
        icon: MessageCircle,
        color: 'from-blue-500 to-cyan-500',
        description: 'Ask anything about this ad',
    },
    compare: {
        label: 'Compare',
        icon: BarChart3,
        color: 'from-purple-500 to-pink-500',
        description: 'Compare to similar ads',
    },
    improve: {
        label: 'Improve',
        icon: TrendingUp,
        color: 'from-green-500 to-emerald-500',
        description: 'Get improvement suggestions',
    },
    brainstorm: {
        label: 'Brainstorm',
        icon: Sparkles,
        color: 'from-amber-500 to-orange-500',
        description: 'Creative ideas and variations',
    },
} as const;

type QAMode = keyof typeof QA_MODES;

interface SimilarAdRef {
    title?: string;
    brand?: string;
    category?: string;
    [key: string]: unknown;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    mode?: QAMode;
    similarAds?: SimilarAdRef[];
    suggestions?: string[];
}

interface AdQAPanelProps {
    analysisId: string;
    onClose?: () => void;
    isExpanded?: boolean;
}

export const AdQAPanel: React.FC<AdQAPanelProps> = ({
    analysisId,
    onClose: _onClose,
    isExpanded: initialExpanded = true
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<QAMode>('general');
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load suggested questions when mode changes
    useEffect(() => {
        const loadSuggestions = async () => {
            try {
                const data = await api.getQASuggestions(analysisId, mode);
                setSuggestedQuestions(data.suggestions || []);
            } catch (error) {
                console.error('Failed to load suggestions:', error);
                // Fallback suggestions
                setSuggestedQuestions([
                    "What is the main strength of this ad?",
                    "How effective is the call-to-action?",
                    "What emotions does this ad evoke?",
                ]);
            }
        };

        loadSuggestions();
    }, [analysisId, mode]);

    const sendMessage = useCallback(async (question: string) => {
        if (!question.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: question,
            timestamp: new Date(),
            mode,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const data = await api.askAdQuestion(analysisId, {
                question,
                mode,
                include_similar_ads: true,
                max_similar_ads: 3,
            });

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.answer || "Response received but content was empty. Please try again.",
                timestamp: new Date(),
                mode,
                similarAds: data.similar_ads_referenced as SimilarAdRef[],
                suggestions: data.suggestions,
            };

            setMessages(prev => [...prev, assistantMessage]);
            
            // Update suggestions with the new ones from the response
            if (data.suggestions?.length > 0) {
                setSuggestedQuestions(data.suggestions);
            }

        } catch (error: any) {
            console.error('Q&A error:', error);
            
            // Check for API key / service unavailable errors
            const errorDetail = error.response?.data?.detail || error.message || '';
            const status = error.response?.status;
            const isApiKeyError = errorDetail.includes('API key') || 
                                  errorDetail.includes('OPENAI_API_KEY') || 
                                  status === 503;
            
            if (isApiKeyError) {
                setApiError('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file and restart the server.');
            }
            
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: isApiKeyError 
                    ? 'The AI service is not available. Please ensure the OpenAI API key is configured in the server settings.'
                    : 'Sorry, I encountered an error processing your question. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    }, [analysisId, mode, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputValue);
    };

    const handleSuggestionClick = (suggestion: string) => {
        sendMessage(suggestion);
    };

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    const ModeIcon = QA_MODES[mode].icon;

    return (
        <div className="bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-2xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div 
                className="flex items-center justify-between p-4 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${QA_MODES[mode].color}`}>
                        <ModeIcon size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Ad Q&A Assistant</h3>
                        <p className="text-text-dim text-sm">Powered by GPT-5 Mini</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                clearChat();
                            }}
                            className="p-2 rounded-lg hover:bg-white/10 text-text-dim hover:text-white transition-colors"
                            title="Clear chat"
                        >
                            <RefreshCw size={16} />
                        </button>
                    )}
                    {isExpanded ? (
                        <ChevronUp size={20} className="text-text-dim" />
                    ) : (
                        <ChevronDown size={20} className="text-text-dim" />
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* API Error Banner */}
                        {apiError && (
                            <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-amber-200 text-xs font-medium">AI Service Unavailable</p>
                                    <p className="text-amber-200/70 text-[10px]">{apiError}</p>
                                </div>
                            </div>
                        )}

                        {/* Mode Selector */}
                        <div className="p-3 border-b border-white/5">
                            <div className="flex gap-2">
                                {(Object.keys(QA_MODES) as QAMode[]).map((modeKey) => {
                                    const modeConfig = QA_MODES[modeKey];
                                    const Icon = modeConfig.icon;
                                    const isActive = mode === modeKey;
                                    
                                    return (
                                        <button
                                            key={modeKey}
                                            onClick={() => setMode(modeKey)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                isActive 
                                                    ? `bg-gradient-to-r ${modeConfig.color} text-white shadow-lg` 
                                                    : 'bg-white/5 text-text-dim hover:bg-white/10 hover:text-white'
                                            }`}
                                            title={modeConfig.description}
                                        >
                                            <Icon size={16} />
                                            {modeConfig.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="text-center py-8">
                                    <Lightbulb className="w-12 h-12 text-text-dim mx-auto mb-4 opacity-50" />
                                    <p className="text-text-dim mb-4">
                                        Ask questions about this ad, compare it to similar ads, or brainstorm improvements.
                                    </p>
                                    
                                    {/* Suggested Questions */}
                                    {suggestedQuestions.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-text-dim/60 uppercase tracking-wider">
                                                Suggested Questions
                                            </p>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {suggestedQuestions.slice(0, 4).map((question, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSuggestionClick(question)}
                                                        className="px-3 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-text-dim hover:text-white transition-colors text-left"
                                                    >
                                                        {question}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) => (
                                        <motion.div
                                            key={message.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-2xl p-4 ${
                                                    message.role === 'user'
                                                        ? `bg-gradient-to-r ${QA_MODES[message.mode || 'general'].color} text-white`
                                                        : 'bg-white/5 border border-white/10 text-white'
                                                }`}
                                            >
                                                <div className="whitespace-pre-wrap text-sm">
                                                    {message.content}
                                                </div>
                                                
                                                {/* Similar Ads Referenced */}
                                                {message.similarAds && message.similarAds.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-white/10">
                                                        <p className="text-xs text-text-dim/60 uppercase tracking-wider mb-2">
                                                            Similar Ads Referenced
                                                        </p>
                                                        <div className="space-y-1">
                                                            {message.similarAds.map((ad, idx) => (
                                                                <div key={idx} className="flex items-center gap-2 text-xs text-text-dim">
                                                                    <ExternalLink size={12} />
                                                                    <span>{ad.brand || 'Unknown'} - {ad.title || 'Untitled'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Copy Button for Assistant Messages */}
                                                {message.role === 'assistant' && (
                                                    <button
                                                        onClick={() => copyToClipboard(message.content, message.id)}
                                                        className="mt-2 flex items-center gap-1 text-xs text-text-dim hover:text-white transition-colors"
                                                    >
                                                        {copiedId === message.id ? (
                                                            <>
                                                                <Check size={12} />
                                                                Copied
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={12} />
                                                                Copy
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                    
                                    {/* Loading Indicator */}
                                    {isLoading && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex justify-start"
                                        >
                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                                <div className="flex items-center gap-2 text-text-dim">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    <span className="text-sm">Analyzing...</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Quick Suggestions (when there are messages) */}
                        {messages.length > 0 && suggestedQuestions.length > 0 && !isLoading && (
                            <div className="px-4 pb-2">
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {suggestedQuestions.slice(0, 3).map((question, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSuggestionClick(question)}
                                            className="flex-shrink-0 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-text-dim hover:text-white transition-colors"
                                        >
                                            {question.length > 50 ? question.slice(0, 50) + '...' : question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="p-4 border-t border-white/5">
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={`Ask about this ad (${QA_MODES[mode].label} mode)...`}
                                    disabled={isLoading}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-text-dim focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isLoading}
                                    className={`p-3 rounded-xl font-medium transition-all ${
                                        inputValue.trim() && !isLoading
                                            ? `bg-gradient-to-r ${QA_MODES[mode].color} text-white hover:opacity-90`
                                            : 'bg-white/5 text-text-dim cursor-not-allowed'
                                    }`}
                                >
                                    {isLoading ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <Send size={20} />
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdQAPanel;

