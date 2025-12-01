import React, { useState, useEffect, useRef } from 'react';
import { Save, CheckCircle } from 'lucide-react';

interface ScriptEditorProps {
    content: string;
    onChange: (content: string) => void;
    onSave: (content: string) => Promise<void>;
    readOnly?: boolean;
    className?: string;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
    content: initialContent, 
    onChange, 
    onSave,
    readOnly = false,
    className 
}) => {
    const [content, setContent] = useState(initialContent);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Sync local state if prop changes (e.g. switching scripts)
    useEffect(() => {
        setContent(initialContent);
    }, [initialContent]);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [content]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        onChange(newContent);

        // Debounced auto-save
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                await onSave(newContent);
                setLastSaved(new Date());
            } catch (error) {
                console.error('Failed to save script:', error);
            } finally {
                setIsSaving(false);
            }
        }, 2000); // 2 second delay
    };

    return (
        <div className={`relative min-h-full bg-[#0B0B0C] ${className}`}>
            {/* Status Indicator */}
            <div className="absolute top-2 right-4 z-10 flex items-center gap-2 text-xs font-medium pointer-events-none transition-opacity duration-300">
                {isSaving ? (
                    <span className="text-white/50 flex items-center gap-1">
                        <Save size={12} className="animate-pulse" /> Saving...
                    </span>
                ) : lastSaved ? (
                    <span className="text-green-400/70 flex items-center gap-1 opacity-50">
                        <CheckCircle size={12} /> Saved
                    </span>
                ) : null}
            </div>

            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                readOnly={readOnly}
                placeholder="Start writing your script..."
                className="w-full min-h-[calc(100vh-12rem)] bg-transparent text-[#E0E0E0] font-mono text-base leading-loose p-12 resize-none focus:outline-none border-none placeholder-white/10 selection:bg-neon-blue/20"
                style={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
                spellCheck={false}
            />
        </div>
    );
};
