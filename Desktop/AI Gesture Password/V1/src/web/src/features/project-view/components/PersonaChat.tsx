import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, X, User, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@lib/services/api';

interface Persona {
    full_name?: string;
    persona: string;
    fit: 'HIGH' | 'MEDIUM' | 'LOW';
    age_range: string;
    gender: string;
    location: string;
    occupation?: string;
    background_story?: string;
    interests?: string[];
    reaction: string;
    engagement_drivers: string[];
    conversion_blockers: string[];
}

interface PersonaChatProps {
    persona: Persona;
    adElements: any;
    onClose: () => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export const PersonaChat: React.FC<PersonaChatProps> = ({ persona, adElements, onClose }) => {
    const personaName = persona.full_name?.split(' ')[0] || persona.persona.split(' ')[0];
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Hey! I'm ${persona.full_name || persona.persona}. ${persona.occupation ? `I work as ${persona.occupation.split(' at ')[0].toLowerCase()}.` : ''} Just watched that ad - happy to chat about it! What do you want to know?`,
            timestamp: Date.now()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Construct context for the backend
            const context = {
                persona: persona,
                ad_elements: adElements,
                chat_history: messages.map(m => ({ role: m.role, content: m.content }))
            };

            const response = await api.chatWithPersona(context, userMsg.content);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.reply || "I'm not sure how to respond to that. Could you rephrase?",
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            console.error('Chat error:', error);
            const errorDetail = error.response?.data?.detail || '';
            const isApiKeyError = errorDetail.includes('API key') || 
                                  errorDetail.includes('OPENAI_API_KEY') || 
                                  error.response?.status === 503;
            
            if (isApiKeyError) {
                setApiError('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file and restart the server.');
            }
            
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: isApiKeyError 
                    ? "I can't respond right now - the AI service isn't configured. Please ask your admin to set up the OpenAI API key."
                    : "Sorry, I'm having trouble connecting right now. Please try again.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/95 backdrop-blur-xl border-l border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${persona.fit === 'HIGH' ? 'bg-green-500/20' :
                        persona.fit === 'LOW' ? 'bg-red-500/20' : 'bg-blue-500/20'
                        }`}>
                        <User size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-sm">{persona.full_name || persona.persona}</h3>
                        <p className="text-text-dim text-xs">{persona.occupation?.split(' at ')[0] || persona.persona} • {persona.location}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-white/10 text-white/70 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* API Error Banner */}
            {apiError && (
                <div className="mx-4 mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-amber-200 text-xs font-medium">AI Service Unavailable</p>
                        <p className="text-amber-200/70 text-[10px]">{apiError}</p>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user'
                            ? 'bg-cyan-600 text-white rounded-tr-none'
                            : 'bg-white/10 text-white/90 rounded-tl-none'
                            }`}>
                            {msg.content}
                        </div>
                    </motion.div>
                ))}
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="bg-white/10 rounded-2xl rounded-tl-none p-3 flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin text-white/50" />
                            <span className="text-xs text-white/50">Typing...</span>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/10">
                <div className="relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about their reaction..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-cyan-500 text-white disabled:opacity-50 disabled:bg-white/10 transition-all hover:bg-cyan-400"
                    >
                        <Send size={16} />
                    </button>
                </div>
                <p className="text-[10px] text-center text-white/20 mt-2">
                    AI responses are simulated based on persona profile.
                </p>
            </div>
        </div>
    );
};
