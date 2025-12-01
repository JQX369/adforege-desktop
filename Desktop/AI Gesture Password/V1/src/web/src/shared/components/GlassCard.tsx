import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, type HTMLMotionProps } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className,
    hoverEffect = false,
    ...props
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={hoverEffect ? { scale: 1.01, backgroundColor: "rgba(30, 41, 59, 0.8)" } : {}}
            className={cn(
                "rounded-2xl border border-glass-border bg-glass-surface backdrop-blur-md p-6 shadow-xl hover:shadow-2xl transition-all duration-300",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
};
