import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ScriptReaderProps {
    content: string;
    className?: string;
}

export const ScriptReader: React.FC<ScriptReaderProps> = ({ content, className }) => {
    const lines = useMemo(() => content.split('\n'), [content]);

    const getLineType = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return 'empty';
        if (trimmed.startsWith('INT.') || trimmed.startsWith('EXT.') || trimmed.startsWith('INT/') || trimmed.startsWith('EXT/')) return 'scene-heading';
        if (trimmed === trimmed.toUpperCase() && trimmed.length < 50 && !trimmed.endsWith(':')) return 'character'; // Heuristic for character names
        if (trimmed.endsWith(':') && trimmed === trimmed.toUpperCase()) return 'transition'; // CUT TO:
        return 'action'; // Default to action/dialogue depending on context, but strictly separating without more parsing is hard. 
        // For a "Writer's Room" feel, we can try to detect dialogue blocks (Character -> Dialogue).
    };

    // Improved parsing to handle Dialogue blocks better
    const formattedLines = useMemo(() => {
        const result: { type: string; text: string }[] = [];
        let lastType = 'empty';

        lines.forEach((line) => {
            const trimmed = line.trim();
            let type = 'action';

            if (!trimmed) {
                type = 'empty';
            } else if (trimmed.match(/^(INT\.|EXT\.|INT\/|EXT\/|I\/E)/)) {
                type = 'scene-heading';
            } else if (trimmed.match(/^(CUT TO:|FADE TO:|DISSOLVE TO:|SMASH CUT TO:)/)) {
                type = 'transition';
            } else if (trimmed === trimmed.toUpperCase() && trimmed.length < 40 && !trimmed.endsWith(':') && lastType !== 'character') {
                // Likely a character name if previous line wasn't a character name
                type = 'character';
            } else if (lastType === 'character' || lastType === 'parenthetical') {
                if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                    type = 'parenthetical';
                } else {
                    type = 'dialogue';
                }
            } else {
                type = 'action';
            }

            result.push({ type, text: line }); // Keep original whitespace for some indentation? Usually screenplays are strictly formatted.
            if (type !== 'empty') lastType = type;
        });
        return result;
    }, [lines]);

    return (
        <div className={`bg-[#111114] text-[#E0E0E0] font-mono text-[15px] leading-relaxed p-12 min-h-full shadow-2xl ${className}`}>
            <div className="max-w-3xl mx-auto space-y-4">
                {formattedLines.map((line, idx) => {
                    if (line.type === 'empty') return <div key={idx} className="h-4" />;
                    
                    if (line.type === 'scene-heading') {
                        return (
                            <h3 key={idx} className="font-bold text-white uppercase tracking-wider mt-6 mb-2">
                                {line.text}
                            </h3>
                        );
                    }

                    if (line.type === 'character') {
                        return (
                            <div key={idx} className="text-center w-1/2 mx-auto mt-4 mb-0 font-bold tracking-wide">
                                {line.text}
                            </div>
                        );
                    }

                    if (line.type === 'parenthetical') {
                        return (
                            <div key={idx} className="text-center w-1/3 mx-auto -mt-1 mb-0 text-white/70 italic">
                                {line.text}
                            </div>
                        );
                    }

                    if (line.type === 'dialogue') {
                        return (
                            <div key={idx} className="text-center w-2/3 mx-auto mb-2">
                                {line.text}
                            </div>
                        );
                    }

                    if (line.type === 'transition') {
                        return (
                            <div key={idx} className="text-right font-bold mt-4 mb-4 uppercase">
                                {line.text}
                            </div>
                        );
                    }

                    // Action
                    return (
                        <p key={idx} className="mb-2 text-white/90">
                            {line.text}
                        </p>
                    );
                })}
            </div>
        </div>
    );
};




