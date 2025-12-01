import React, { useRef, useEffect, useMemo } from 'react';
import type { CreativeMode } from './types';

interface Neuron {
    x: number;
    y: number;
    z: number;
    connections: number[];
    activity: number;
    hue: number;
    size: number;
    region: 'frontal' | 'parietal' | 'temporal' | 'occipital' | 'central';
}

interface NeuralBrainProps {
    isActive: boolean;
    mode?: CreativeMode;
    className?: string;
}

const REGION_COLORS: Record<string, number> = {
    frontal: 280,    // Purple - creativity, planning
    parietal: 200,   // Cyan - spatial, attention
    temporal: 40,    // Orange - memory, language
    occipital: 160,  // Teal - visual processing
    central: 320,    // Pink - integration
};

export const NeuralBrain: React.FC<NeuralBrainProps> = ({ isActive, mode = 'standard_think', className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const neuronsRef = useRef<Neuron[]>([]);
    const rotationRef = useRef({ x: 0, y: 0 });
    const firingQueueRef = useRef<{ neuronIdx: number; time: number; intensity: number }[]>([]);
    
    // Generate brain-shaped neuron network
    const neurons = useMemo(() => {
        const result: Neuron[] = [];
        
        // Adjust parameters based on mode
        let neuronCount = 120;
        let connectionChance = 0.3;
        
        if (mode === 'light_think') {
            neuronCount = 80;
            connectionChance = 0.2;
        } else if (mode === 'deep_think') {
            neuronCount = 200;
            connectionChance = 0.4;
        }
        
        for (let i = 0; i < neuronCount; i++) {
            // Create brain-like ellipsoid distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            // Asymmetric brain shape
            const radiusX = 0.8 + Math.random() * 0.2;
            const radiusY = 0.6 + Math.random() * 0.2;
            const radiusZ = 0.7 + Math.random() * 0.2;
            
            let x = radiusX * Math.sin(phi) * Math.cos(theta);
            let y = radiusY * Math.sin(phi) * Math.sin(theta) * 0.8; // Flatter top
            let z = radiusZ * Math.cos(phi);
            
            // Add some surface variation for brain folds
            const foldNoise = Math.sin(theta * 8) * Math.cos(phi * 6) * 0.08;
            x += foldNoise;
            y += foldNoise * 0.5;
            
            // Determine brain region based on position
            let region: Neuron['region'] = 'central';
            if (z > 0.3) region = 'frontal';
            else if (z < -0.3) region = 'occipital';
            else if (y > 0.2) region = 'parietal';
            else if (y < -0.2) region = 'temporal';
            
            result.push({
                x,
                y,
                z,
                connections: [],
                activity: 0,
                hue: REGION_COLORS[region] + (Math.random() - 0.5) * 30,
                size: 2 + Math.random() * 2,
                region,
            });
        }
        
        // Create connections (synapses) - neurons connect to nearby neurons
        for (let i = 0; i < result.length; i++) {
            const connections: number[] = [];
            for (let j = 0; j < result.length; j++) {
                if (i !== j) {
                    const dx = result[i].x - result[j].x;
                    const dy = result[i].y - result[j].y;
                    const dz = result[i].z - result[j].z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    // Connect to nearby neurons with probability based on distance
                    if (dist < 0.4 && Math.random() < connectionChance) {
                        connections.push(j);
                    }
                }
            }
            result[i].connections = connections.slice(0, mode === 'deep_think' ? 8 : 5); // Max connections
        }
        
        return result;
    }, [mode]);
    
    useEffect(() => {
        neuronsRef.current = neurons.map(n => ({ ...n }));
    }, [neurons]);
    
    // Fire neurons when active
    useEffect(() => {
        if (!isActive) return;
        
        const fireRandomNeurons = () => {
            const now = Date.now();
            // Fire random neurons based on mode
            let min = 3;
            let range = 6;
            
            if (mode === 'light_think') {
                min = 2;
                range = 4;
            } else if (mode === 'deep_think') {
                min = 5;
                range = 10;
            }
            
            const count = min + Math.floor(Math.random() * range);
            for (let i = 0; i < count; i++) {
                const idx = Math.floor(Math.random() * neuronsRef.current.length);
                firingQueueRef.current.push({
                    neuronIdx: idx,
                    time: now + Math.random() * 200,
                    intensity: 0.7 + Math.random() * 0.3,
                });
            }
        };
        
        const interval = setInterval(fireRandomNeurons, mode === 'deep_think' ? 100 : 150);
        fireRandomNeurons(); // Fire immediately
        
        return () => clearInterval(interval);
    }, [isActive, mode]);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const resize = () => {
            const parent = canvas.parentElement;
            if (!parent) return;
            
            const rect = parent.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            // Only update if dimensions actually changed (avoid unnecessary clears)
            const targetWidth = Math.floor(rect.width * dpr);
            const targetHeight = Math.floor(rect.height * dpr);
            
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                ctx.scale(dpr, dpr);
            }
        };
        
        // Initial resize
        resize();
        
        // Use ResizeObserver to watch for container size changes
        const resizeObserver = new ResizeObserver(() => {
            resize();
        });
        
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }
        
        // Keep window listener as backup
        window.addEventListener('resize', resize);
        
        const animate = () => {
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const centerX = width / 2;
            const centerY = height / 2;
            const scale = Math.min(width, height) * 0.35;
            
            // Clear with fade effect for trails
            ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
            ctx.fillRect(0, 0, width, height);
            
            // Update rotation
            const rotationSpeed = mode === 'deep_think' ? 0.012 : mode === 'light_think' ? 0.005 : 0.008;
            rotationRef.current.y += isActive ? rotationSpeed : 0.003;
            rotationRef.current.x = Math.sin(Date.now() * 0.0003) * 0.2;
            
            const cosY = Math.cos(rotationRef.current.y);
            const sinY = Math.sin(rotationRef.current.y);
            const cosX = Math.cos(rotationRef.current.x);
            const sinX = Math.sin(rotationRef.current.x);
            
            // Process firing queue
            const now = Date.now();
            const newFirings: typeof firingQueueRef.current = [];
            
            for (const firing of firingQueueRef.current) {
                if (firing.time <= now) {
                    const neuron = neuronsRef.current[firing.neuronIdx];
                    if (neuron) {
                        neuron.activity = Math.max(neuron.activity, firing.intensity);
                        
                        // Propagate to connected neurons with delay - prevent explosion with intensity check and lower prob
                        // Only propagate if signal is strong enough
                        if (firing.intensity > 0.1) {
                            for (const connIdx of neuron.connections) {
                                // Dynamic probability based on queue size to prevent explosion
                                const queueSize = firingQueueRef.current.length + newFirings.length;
                                const baseProb = mode === 'deep_think' ? 0.4 : 0.3;
                                const dampening = Math.max(0.1, 1 - (queueSize / 2000)); // Dampen as queue grows
                                
                                if (Math.random() < baseProb * dampening) {
                                    newFirings.push({
                                        neuronIdx: connIdx,
                                        time: now + 50 + Math.random() * 100,
                                        intensity: firing.intensity * (0.6 + Math.random() * 0.3), // Decay
                                    });
                                }
                            }
                        }
                    }
                } else {
                    newFirings.push(firing);
                }
            }
            firingQueueRef.current = newFirings;
            
            // Project and sort neurons by depth
            const projected = neuronsRef.current.map((neuron, idx) => {
                // Rotate around Y axis
                const x1 = neuron.x * cosY - neuron.z * sinY;
                const z1 = neuron.x * sinY + neuron.z * cosY;
                
                // Rotate around X axis
                const y1 = neuron.y * cosX - z1 * sinX;
                const z2 = neuron.y * sinX + z1 * cosX;
                
                // Perspective projection
                const perspective = 2 / (2 - z2);
                
                return {
                    idx,
                    screenX: centerX + x1 * scale * perspective,
                    screenY: centerY + y1 * scale * perspective,
                    z: z2,
                    perspective,
                    neuron,
                };
            }).sort((a, b) => a.z - b.z);
            
            // Draw connections first (behind neurons)
            ctx.lineWidth = 0.5;
            for (const proj of projected) {
                const neuron = proj.neuron;
                
                for (const connIdx of neuron.connections) {
                    const connProj = projected.find(p => p.idx === connIdx);
                    if (!connProj || connProj.z > proj.z) continue; // Only draw to neurons behind
                    
                    const activity = Math.max(neuron.activity, connProj.neuron.activity);
                    const alpha = 0.1 + activity * 0.5;
                    
                    if (activity > 0.1) {
                        // Active connection - colorful
                        const gradient = ctx.createLinearGradient(
                            proj.screenX, proj.screenY,
                            connProj.screenX, connProj.screenY
                        );
                        gradient.addColorStop(0, `hsla(${neuron.hue}, 100%, 60%, ${alpha})`);
                        gradient.addColorStop(1, `hsla(${connProj.neuron.hue}, 100%, 60%, ${alpha * 0.5})`);
                        ctx.strokeStyle = gradient;
                        ctx.lineWidth = 1 + activity * 2;
                    } else {
                        // Dormant connection
                        ctx.strokeStyle = `rgba(100, 130, 180, ${0.08 * proj.perspective})`;
                        ctx.lineWidth = 0.5;
                    }
                    
                    ctx.beginPath();
                    ctx.moveTo(proj.screenX, proj.screenY);
                    ctx.lineTo(connProj.screenX, connProj.screenY);
                    ctx.stroke();
                }
            }
            
            // Draw neurons
            for (const proj of projected) {
                const neuron = proj.neuron;
                const size = neuron.size * proj.perspective;
                
                // Decay activity
                neuron.activity *= 0.92;
                
                if (neuron.activity > 0.05) {
                    // Active neuron - glowing
                    const glowSize = size * (2 + neuron.activity * 4);
                    const gradient = ctx.createRadialGradient(
                        proj.screenX, proj.screenY, 0,
                        proj.screenX, proj.screenY, glowSize
                    );
                    gradient.addColorStop(0, `hsla(${neuron.hue}, 100%, 70%, ${neuron.activity})`);
                    gradient.addColorStop(0.3, `hsla(${neuron.hue}, 100%, 60%, ${neuron.activity * 0.5})`);
                    gradient.addColorStop(1, `hsla(${neuron.hue}, 100%, 50%, 0)`);
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(proj.screenX, proj.screenY, glowSize, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Bright core
                    ctx.fillStyle = `hsla(${neuron.hue}, 100%, 90%, ${0.8 + neuron.activity * 0.2})`;
                    ctx.beginPath();
                    ctx.arc(proj.screenX, proj.screenY, size * (1 + neuron.activity), 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Dormant neuron
                    const alpha = 0.3 + proj.perspective * 0.3;
                    ctx.fillStyle = `hsla(${neuron.hue}, 30%, 50%, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(proj.screenX, proj.screenY, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            animationRef.current = requestAnimationFrame(animate);
        };
        
        animate();
        
        return () => {
            window.removeEventListener('resize', resize);
            resizeObserver.disconnect();
            cancelAnimationFrame(animationRef.current);
        };
    }, [isActive, mode]);
    
    return (
        <div className={`relative ${className}`} style={{ width: '100%', height: '100%', minHeight: 0 }}>
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ background: 'transparent', display: 'block' }}
            />
            
            {/* Subtle labels */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                <div className="text-xs text-text-dim/50 tracking-widest uppercase">
                    {isActive ? 'Neural Activity' : 'Awaiting Input'}
                </div>
            </div>
            
            {/* Region indicators when active */}
            {isActive && (
                <div className="absolute top-4 right-4 space-y-1 text-[10px]">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(280, 100%, 60%)' }} />
                        <span className="text-text-dim/60">Creativity</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(40, 100%, 60%)' }} />
                        <span className="text-text-dim/60">Memory</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(200, 100%, 60%)' }} />
                        <span className="text-text-dim/60">Attention</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(160, 100%, 60%)' }} />
                        <span className="text-text-dim/60">Vision</span>
                    </div>
                </div>
            )}
        </div>
    );
};


