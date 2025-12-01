import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Zap, MessageSquare, Music, Eye, Target, Heart, Smile, ShoppingBag, X, ChevronRight, AlertTriangle, MessageCircle, Briefcase, BookOpen, Sparkles, HelpCircle, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { PersonaChat } from './PersonaChat';

// Types
interface AdElement {
    description: string;
    strength: number;
}

interface Persona {
    full_name?: string;
    persona: string;
    profile: string;
    gender: string;
    age_range: string;
    race_ethnicity: string;
    location: string;
    occupation?: string;
    background_story?: string;
    interests?: string[];
    daily_routine?: string;
    pain_points?: string[];
    suggested_questions?: string[];
    reaction: string;
    engagement_level: string;
    likely_action: string;
    key_concern: string;
    fit: 'HIGH' | 'MEDIUM' | 'LOW';
    resonance_elements: string[];
    engagement_drivers: string[];
    conversion_blockers: string[];
}

interface PersonaNetworkGraphProps {
    personas: Persona[];
    adElements: Record<string, AdElement>;
    adThumbnail?: string;
    onPersonaSelect?: (persona: Persona | null) => void;
}

// Element icons mapping
const elementIcons: Record<string, React.ElementType> = {
    hook: Zap,
    message: MessageSquare,
    cta: Target,
    music: Music,
    visuals: Eye,
    product_shot: ShoppingBag,
    emotion: Heart,
    humor: Smile,
};

// Colors for fit levels
const fitColors = {
    HIGH: { bg: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', text: '#34d399' },
    MEDIUM: { bg: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa' },
    LOW: { bg: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', text: '#f87171' },
};

// Calculate node positions in a circular layout
const calculatePositions = (count: number, centerX: number, centerY: number, radius: number) => {
    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        return {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
        };
    });
};

export const PersonaNetworkGraph: React.FC<PersonaNetworkGraphProps> = (props) => {
    // Defensive prop extraction - handle undefined/null props
    const personas = useMemo(() => Array.isArray(props.personas) ? props.personas : [], [props.personas]);
    const adElements = useMemo(() => props.adElements && typeof props.adElements === 'object' ? props.adElements : {}, [props.adElements]);
    const { adThumbnail, onPersonaSelect } = props;

    const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
    const [hoveredPersona, setHoveredPersona] = useState<Persona | null>(null);
    const [hoveredElement, setHoveredElement] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);
    
    // Pan and zoom state
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const svgRef = useRef<SVGSVGElement>(null);

    // SVG dimensions - increased for more spread
    const width = 1000;
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Pan/Zoom handlers
    const handleZoomIn = useCallback(() => {
        setTransform(prev => ({ ...prev, scale: Math.min(2, prev.scale + 0.2) }));
    }, []);
    
    const handleZoomOut = useCallback(() => {
        setTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.2) }));
    }, []);
    
    const handleReset = useCallback(() => {
        setTransform({ x: 0, y: 0, scale: 1 });
    }, []);
    
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only start panning if clicking on the background
        if ((e.target as HTMLElement).tagName === 'svg' || 
            (e.target as HTMLElement).classList.contains('pan-area')) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        }
    }, [transform]);
    
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setTransform(prev => ({
            ...prev,
            x: e.clientX - panStart.x,
            y: e.clientY - panStart.y
        }));
    }, [isPanning, panStart]);
    
    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);
    
    // Add mouseup listener to window for when mouse leaves the SVG
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsPanning(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);
    
    // Add a ref for the container to attach native wheel listener with passive: false
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Native wheel event listener to properly prevent page scrolling
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        const handleNativeWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setTransform(prev => ({
                ...prev,
                scale: Math.max(0.5, Math.min(2, prev.scale + delta))
            }));
        };
        
        // Use passive: false to allow preventDefault()
        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        
        return () => {
            container.removeEventListener('wheel', handleNativeWheel);
        };
    }, []);

    // Safe personas and elements arrays
    const safePersonas = personas || [];
    const safeAdElements = adElements;
    const elementKeys = useMemo(() => Object.keys(safeAdElements), [safeAdElements]);

    // Calculate positions - always call hooks unconditionally
    const elementPositions = useMemo(() =>
        elementKeys.length > 0 ? calculatePositions(elementKeys.length, centerX, centerY, 120) : [],
        [elementKeys.length, centerX, centerY]
    );

    const personaPositions = useMemo(() =>
        safePersonas.length > 0 ? calculatePositions(safePersonas.length, centerX, centerY, 320) : [],
        [safePersonas.length, centerX, centerY]
    );

    // Handle persona click
    const handlePersonaClick = useCallback((persona: Persona) => {
        setSelectedPersona(persona);
        onPersonaSelect?.(persona);
    }, [onPersonaSelect]);

    // Get connections between persona and elements
    const getConnections = useCallback((persona: Persona) => {
        const connections: { element: string; type: 'positive' | 'negative'; strength: number }[] = [];

        const resonanceElements = persona.resonance_elements || [];
        const conversionBlockers = persona.conversion_blockers || [];

        resonanceElements.forEach(el => {
            const elementData = safeAdElements[el];
            if (elementData) {
                connections.push({
                    element: el,
                    type: 'positive',
                    strength: elementData.strength
                });
            }
        });

        conversionBlockers.forEach(el => {
            const elementData = safeAdElements[el];
            if (elementData) {
                connections.push({
                    element: el,
                    type: 'negative',
                    strength: elementData.strength
                });
            }
        });

        return connections;
    }, [safeAdElements]);

    // Early return if no data - MUST be after all hooks
    if (!safePersonas || safePersonas.length === 0) {
        return (
            <div className="flex items-center justify-center h-[400px] text-text-dim">
                <div className="text-center">
                    <Users size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No persona data available</p>
                    <p className="text-xs mt-2">Run AI Analysis to generate audience personas</p>
                </div>
            </div>
        );
    }

    // Render connection lines
    const renderConnections = () => {
        const lines: JSX.Element[] = [];

        safePersonas.forEach((persona, pIdx) => {
            const personaPos = personaPositions[pIdx];
            const connections = getConnections(persona);
            const isHighlighted = hoveredPersona?.persona === persona.persona ||
                selectedPersona?.persona === persona.persona;

            connections.forEach(conn => {
                const elementIdx = elementKeys.indexOf(conn.element);
                if (elementIdx === -1) return;

                const elementPos = elementPositions[elementIdx];
                const isElementHovered = hoveredElement === conn.element;
                const showLine = isHighlighted || isElementHovered || (!hoveredPersona && !hoveredElement);

                if (!showLine) return;

                const opacity = isHighlighted || isElementHovered ? 0.8 : 0.15;
                const strokeColor = conn.type === 'positive' ? '#10b981' : '#ef4444';
                const strokeWidth = isHighlighted || isElementHovered ? 2 + conn.strength / 3 : 1;

                lines.push(
                    <motion.line
                        key={`${persona.persona}-${conn.element}`}
                        x1={personaPos.x}
                        y1={personaPos.y}
                        x2={elementPos.x}
                        y2={elementPos.y}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeOpacity={opacity}
                        strokeDasharray={conn.type === 'negative' ? '4 2' : undefined}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    />
                );
            });
        });

        return lines;
    };

    // Render element nodes (inner ring)
    const renderElementNodes = () => {
        return elementKeys.map((key, idx) => {
            const pos = elementPositions[idx];
            const element = safeAdElements[key];
            const Icon = elementIcons[key] || Target;
            const isHovered = hoveredElement === key;

            return (
                <g
                    key={key}
                    onMouseEnter={() => setHoveredElement(key)}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{ cursor: 'pointer' }}
                >
                    <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isHovered ? 32 : 28}
                        fill="rgba(30, 30, 40, 0.9)"
                        stroke={`rgba(${Math.round(element.strength * 25)}, ${Math.round(150 + element.strength * 10)}, 255, ${0.5 + element.strength / 20})`}
                        strokeWidth={2}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: idx * 0.05 }}
                    />
                    <foreignObject
                        x={pos.x - 12}
                        y={pos.y - 12}
                        width={24}
                        height={24}
                    >
                        <div className="flex items-center justify-center w-full h-full text-cyan-400">
                            <Icon size={18} />
                        </div>
                    </foreignObject>
                    {isHovered && (
                        <foreignObject
                            x={pos.x - 60}
                            y={pos.y + 35}
                            width={120}
                            height={50}
                        >
                            <div className="text-center">
                                <p className="text-xs text-white font-medium capitalize">{key.replace('_', ' ')}</p>
                                <p className="text-[10px] text-cyan-400">Strength: {element.strength}/10</p>
                            </div>
                        </foreignObject>
                    )}
                </g>
            );
        });
    };

    // Render persona nodes (outer ring)
    const renderPersonaNodes = () => {
        return safePersonas.map((persona, idx) => {
            const pos = personaPositions[idx];
            const colors = fitColors[persona.fit];
            const isHovered = hoveredPersona?.persona === persona.persona;
            const isSelected = selectedPersona?.persona === persona.persona;

            return (
                <g
                    key={persona.persona}
                    onClick={() => handlePersonaClick(persona)}
                    onMouseEnter={() => setHoveredPersona(persona)}
                    onMouseLeave={() => setHoveredPersona(null)}
                    style={{ cursor: 'pointer' }}
                >
                    {/* Glow effect */}
                    {(isHovered || isSelected) && (
                        <motion.circle
                            cx={pos.x}
                            cy={pos.y}
                            r={38}
                            fill="none"
                            stroke={colors.glow}
                            strokeWidth={8}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                        />
                    )}

                    {/* Main circle */}
                    <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isHovered || isSelected ? 32 : 28}
                        fill="rgba(20, 20, 30, 0.95)"
                        stroke={colors.bg}
                        strokeWidth={isSelected ? 4 : 2}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.3 + idx * 0.03 }}
                    />

                    {/* Fit indicator */}
                    <circle
                        cx={pos.x + 20}
                        cy={pos.y - 20}
                        r={8}
                        fill={colors.bg}
                    />

                    {/* Avatar placeholder */}
                    <foreignObject
                        x={pos.x - 14}
                        y={pos.y - 14}
                        width={28}
                        height={28}
                    >
                        <div className="flex items-center justify-center w-full h-full">
                            <Users size={18} className="text-white/80" />
                        </div>
                    </foreignObject>

                    {/* Label */}
                    <foreignObject
                        x={pos.x - 50}
                        y={pos.y + 32}
                        width={100}
                        height={40}
                    >
                        <div className="text-center">
                            <p className="text-[10px] text-white font-medium truncate px-1">
                                {persona.full_name?.split(' ')[0] || persona.persona}
                            </p>
                            <p className="text-[8px] text-text-dim">{persona.persona}</p>
                        </div>
                    </foreignObject>
                </g>
            );
        });
    };

    // Render center node (the ad)
    const renderCenterNode = () => (
        <g>
            <motion.circle
                cx={centerX}
                cy={centerY}
                r={50}
                fill="rgba(20, 20, 30, 0.95)"
                stroke="url(#centerGradient)"
                strokeWidth={3}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 100 }}
            />
            <defs>
                <linearGradient id="centerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
            </defs>
            {adThumbnail ? (
                <clipPath id="centerClip">
                    <circle cx={centerX} cy={centerY} r={45} />
                </clipPath>
            ) : null}
            <foreignObject
                x={centerX - 30}
                y={centerY - 30}
                width={60}
                height={60}
            >
                <div className="flex items-center justify-center w-full h-full">
                    {adThumbnail ? (
                        <img src={adThumbnail} alt="Ad" className="w-full h-full object-cover rounded-full" />
                    ) : (
                        <div className="text-center">
                            <Target size={24} className="text-cyan-400 mx-auto" />
                            <p className="text-[8px] text-white mt-1">YOUR AD</p>
                        </div>
                    )}
                </div>
            </foreignObject>
        </g>
    );

    return (
        <div 
            ref={containerRef}
            className="relative w-full h-full"
            style={{ 
                touchAction: 'none', 
                overscrollBehavior: 'contain',
                isolation: 'isolate' 
            }}
        >
            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 flex gap-4 text-[10px]">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-white/70">High Fit</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-white/70">Medium Fit</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-white/70">Low Fit</span>
                </div>
                <div className="flex items-center gap-1.5 ml-4">
                    <div className="w-6 h-0.5 bg-green-500" />
                    <span className="text-white/70">Resonates</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-0.5 bg-red-500 border-dashed" style={{ borderStyle: 'dashed' }} />
                    <span className="text-white/70">Blocks</span>
                </div>
            </div>

            {/* Pan/Zoom Controls */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-1 border border-white/10">
                <button
                    onClick={handleZoomIn}
                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/70 hover:text-white"
                    title="Zoom In"
                >
                    <ZoomIn size={16} />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/70 hover:text-white"
                    title="Zoom Out"
                >
                    <ZoomOut size={16} />
                </button>
                <div className="w-px h-4 bg-white/20 mx-1" />
                <button
                    onClick={handleReset}
                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/70 hover:text-white"
                    title="Reset View"
                >
                    <RotateCcw size={16} />
                </button>
                <span className="text-[10px] text-white/50 ml-1 px-1">{Math.round(transform.scale * 100)}%</span>
            </div>
            
            {/* Pan hint */}
            {transform.scale !== 1 && (
                <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 text-[10px] text-white/40">
                    <Move size={12} />
                    <span>Drag to pan</span>
                </div>
            )}

            {/* SVG Network Graph */}
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ maxHeight: '600px', overscrollBehavior: 'contain' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Transparent rect for pan handling */}
                <rect 
                    x="0" y="0" 
                    width={width} height={height} 
                    fill="transparent" 
                    className="pan-area"
                />
                
                {/* Transformable content group */}
                <g transform={`translate(${transform.x + width * (1 - transform.scale) / 2}, ${transform.y + height * (1 - transform.scale) / 2}) scale(${transform.scale})`}>
                    {/* Connection lines */}
                    {renderConnections()}

                    {/* Center node */}
                    {renderCenterNode()}

                    {/* Element nodes */}
                    {renderElementNodes()}

                    {/* Persona nodes */}
                    {renderPersonaNodes()}
                </g>
            </svg>

            {/* Selected Persona Detail Panel */}
            <AnimatePresence>
                {selectedPersona && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="absolute top-0 right-0 w-80 h-full bg-black/80 backdrop-blur-xl border-l border-white/10 overflow-hidden"
                    >
                        {showChat ? (
                            <PersonaChat
                                persona={selectedPersona}
                                adElements={safeAdElements}
                                onClose={() => setShowChat(false)}
                            />
                        ) : (
                            <div className="h-full overflow-y-auto p-4">
                                <button
                                    onClick={() => {
                                        setSelectedPersona(null);
                                        onPersonaSelect?.(null);
                                    }}
                                    className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 z-10"
                                >
                                    <X size={18} className="text-white/70" />
                                </button>

                                <div className="space-y-4">
                                    {/* Header with Name */}
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedPersona.fit === 'HIGH' ? 'bg-green-500/20' :
                                            selectedPersona.fit === 'LOW' ? 'bg-red-500/20' : 'bg-blue-500/20'
                                            }`}>
                                            <Users size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-semibold">
                                                {selectedPersona.full_name || selectedPersona.persona}
                                            </h3>
                                            <p className="text-text-dim text-xs">
                                                {selectedPersona.age_range} • {selectedPersona.gender} • {selectedPersona.location}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Fit Badge & Occupation */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${selectedPersona.fit === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                                            selectedPersona.fit === 'LOW' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {selectedPersona.fit} FIT
                                        </div>
                                        {selectedPersona.occupation && (
                                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                                                <Briefcase size={12} />
                                                <span className="truncate max-w-[150px]">{selectedPersona.occupation.split(' at ')[0]}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Background Story */}
                                    {selectedPersona.background_story && (
                                        <div className="p-3 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg border border-white/10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BookOpen size={14} className="text-purple-400" />
                                                <span className="text-xs text-purple-400 font-medium">Background</span>
                                            </div>
                                            <p className="text-white/80 text-sm leading-relaxed">{selectedPersona.background_story}</p>
                                        </div>
                                    )}

                                    {/* Interests */}
                                    {selectedPersona.interests && selectedPersona.interests.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-medium text-cyan-400 mb-2 flex items-center gap-1">
                                                <Sparkles size={12} /> Interests
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedPersona.interests.map((interest, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px]">
                                                        {interest}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Daily Routine */}
                                    {selectedPersona.daily_routine && (
                                        <div className="text-sm">
                                            <h4 className="text-xs font-medium text-white/50 mb-1">Daily Life</h4>
                                            <p className="text-white/70 text-xs leading-relaxed">{selectedPersona.daily_routine}</p>
                                        </div>
                                    )}

                                    {/* Pain Points */}
                                    {selectedPersona.pain_points && selectedPersona.pain_points.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                                                <AlertTriangle size={12} /> Pain Points
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedPersona.pain_points.map((point, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]">
                                                        {point}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Reaction */}
                                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MessageSquare size={14} className="text-white/50" />
                                            <span className="text-xs text-white/50 font-medium">Their Reaction</span>
                                        </div>
                                        <p className="text-white/80 text-sm italic">"{selectedPersona.reaction}"</p>
                                    </div>

                                    {/* Engagement Drivers */}
                                    {selectedPersona.engagement_drivers?.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
                                                <ChevronRight size={12} /> What Resonated
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedPersona.engagement_drivers.map((driver, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">
                                                        {driver}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Conversion Blockers */}
                                    {selectedPersona.conversion_blockers?.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                                                <AlertTriangle size={12} /> Turn-offs
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedPersona.conversion_blockers.map((blocker, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] capitalize">
                                                        {blocker.replace('_', ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Key Concern */}
                                    {selectedPersona.key_concern && (
                                        <div className="text-sm">
                                            <h4 className="text-xs font-medium text-yellow-400 mb-1">Key Concern</h4>
                                            <p className="text-white/80 text-xs">{selectedPersona.key_concern}</p>
                                        </div>
                                    )}

                                    {/* Suggested Questions */}
                                    {selectedPersona.suggested_questions && selectedPersona.suggested_questions.length > 0 && (
                                        <div className="pt-3 border-t border-white/10">
                                            <h4 className="text-xs font-medium text-white/70 mb-2 flex items-center gap-1">
                                                <HelpCircle size={12} /> Ask {selectedPersona.full_name?.split(' ')[0] || 'Them'}
                                            </h4>
                                            <div className="space-y-1.5">
                                                {selectedPersona.suggested_questions.slice(0, 4).map((question, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setShowChat(true)}
                                                        className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 text-xs text-white/70 hover:text-white transition-all"
                                                    >
                                                        "{question}"
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Chat Button */}
                                <div className="mt-6 pt-4 border-t border-white/10">
                                    <button
                                        onClick={() => setShowChat(true)}
                                        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/20 transition-all active:scale-95"
                                    >
                                        <MessageCircle size={16} />
                                        Chat with {selectedPersona.full_name?.split(' ')[0] || selectedPersona.persona.split(' ')[0]}
                                    </button>
                                    <p className="text-center text-[10px] text-text-dim mt-2">
                                        Powered by GPT-5.1 Persona Engine
                                    </p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PersonaNetworkGraph;

