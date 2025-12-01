/**
 * Type definitions for Ad Script Lab.
 * 
 * These match the backend Python schema in src/app/features/ad_script_lab/types.py
 */

export type CreativeMode = 'light_think' | 'standard_think' | 'deep_think';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AdScriptBrief {
    // Required inputs
    objective: string;
    target_audience: string;
    single_minded_proposition: string;
    tone_of_voice: string;
    asset_name: string;
    
    // Optional inputs
    length_seconds: number;
    mandatories: string[];
    parent_id?: string | null;
    creative_mode: CreativeMode;
    
    // Context fields
    brand_name: string;
    product_service: string;
    budget_range: string;
    comms_style: string;
    brand_colors: string[];
    
    // Generated context
    brand_context: string;
    research_insights: string;
    compliance_requirements: string;
}

export interface RagNeighbor {
    id: string;
    title: string;
    brand: string;
    category: string;
    year?: number | null;
    description: string;
    script_excerpt: string;
    effectiveness_score?: number | null;
    awards: string[];
    similarity_score: number;
    tags: string[];
}

export interface RetrievalResult {
    neighbors: RagNeighbor[];
    query_embedding_id?: string | null;
    retrieval_time_ms: number;
    tags_used: string[];
}

export interface ScriptIdea {
    id: string;
    title: string;
    hook: string;
    narrative: string;
    key_moments: string[];
    cta: string;
    rationale: string;
    inspired_by: string[];
}

export interface PolishedScript {
    id: string;
    title: string;
    concept_id: string;

    // Script content
    opening: string;
    development: string;
    climax: string;
    resolution: string;
    full_script: string;

    // Production notes
    visual_style: string;
    audio_notes: string;
    talent_notes: string;
    production_considerations: string;

    estimated_duration_seconds: number;

    // Winner flag
    is_winner?: boolean;

    // Per-script scoring (AI analyzer-aligned metrics)
    scores?: ScriptScores | null;

    // Per-script braintrust feedback (3 personas evaluate each script)
    braintrust_feedback?: BraintrustCritique[];

    // Per-script compliance result (after auto-fix applied)
    compliance_result?: ComplianceResult | null;

    // Convenience getter for overall score
    overall_score?: number;
}

export interface BraintrustCritique {
    script_id?: string;           // ID of the script being critiqued
    critic_persona: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    overall_rating: number;
    would_approve: boolean;
    critique?: string;            // Full critique text summary
}

export interface ComplianceIssue {
    category: string;
    severity: string;
    description: string;
    location?: string;
    recommendation?: string;
}

export interface ComplianceCheck {
    passed: boolean;
    risk_level: 'low' | 'medium' | 'high';
    issues: ComplianceIssue[];
    recommendations: string[];
    categories_checked: string[];
    clearcast_notes: string;
    rule?: string;
    notes?: string;
    status?: 'pass' | 'fail' | 'warn';
}

// Compliance solution (auto-fixed issue)
export interface ComplianceSolution {
    original_issue: string;        // The original compliance concern
    category: string;              // BCAP code or regulation category
    fix_applied: string;           // What was changed to resolve it
    location: string;              // Scene/timestamp where fix was applied
    confidence: 'high' | 'medium'; // Confidence in the fix
    original_text?: string;        // Original script text before fix
    fixed_text?: string;           // Fixed script text after change
}

// Final compliance result (after auto-fix)
export interface ComplianceResult {
    all_clear: boolean;            // No unresolved issues remaining
    solutions_applied: ComplianceSolution[];
    categories_checked: string[];
    notes: string;
    market: string;                // Market/jurisdiction checked
}

export interface ScriptScores {
    // Core impact metrics (AI analyzer-aligned)
    overall_impact: number;        // Overall ad effectiveness
    hook_power: number;            // Opening hook strength (first 3s)
    emotional_resonance: number;   // Emotional depth and connection
    clarity_score: number;         // Message clarity and CTA strength
    distinctiveness: number;       // Creative uniqueness
    brand_integration: number;     // How well brand is woven into narrative
    pulse_score: number;           // Immediate engagement potential
    echo_score: number;            // Memorability and recall potential
    overall: number;               // Weighted overall score

    // Per-metric reasoning (optional)
    reasoning?: Record<string, string>;

    // Legacy field aliases (for backward compatibility)
    tv_native?: number;            // Alias for overall_impact
    clarity?: number;              // Alias for clarity_score
    emotional_impact?: number;     // Alias for emotional_resonance
    brand_fit?: number;            // Alias for brand_integration
    memorability?: number;         // Alias for echo_score
    originality?: number;          // Alias for distinctiveness
}

export interface Citation {
    neighbor_id: string;
    neighbor_title: string;
    influence_type: string;
    specific_element: string;
}

export interface Artifacts {
    press_release: string;
    ideas_10: ScriptIdea[];
    viable_3: ScriptIdea[];
    polished_3: PolishedScript[];
    braintrust_feedback: BraintrustCritique[];
    compliance_checks: ComplianceCheck[];
    final_script?: PolishedScript | null;
    final_rationale: string;
    production_notes: string;
    selection_rationale?: string;
}

export interface AdScriptRun {
    run_id: string;
    status: RunStatus;
    created_at: string;
    updated_at: string;
    current_stage: string;
    brief: AdScriptBrief;
    retrieval?: RetrievalResult | null;
    artifacts?: Artifacts | null;
    scores?: ScriptScores | null;
    citations: Citation[];
    error?: string | null;
    // Kept for backwards compatibility if needed, but prefer brief
    form_data?: any;
}

// Request types
export interface AdScriptGenerateRequest {
    // Website URL for brand discovery (optional but recommended)
    website_url?: string;
    
    // Required fields
    objective: string;
    target_audience: string;
    single_minded_proposition: string;
    tone_of_voice: string;
    asset_name: string;
    
    // Optional fields
    length_seconds?: number;
    mandatories?: string[];
    parent_id?: string | null;
    creative_mode?: CreativeMode;
    
    // New fields
    market?: string;
    visual_style?: string;
    briefing_context?: string;  // Extracted from uploaded documents
    
    // Context fields (can be auto-filled from brand discovery)
    brand_name?: string;
    product_service?: string;
    budget_range?: string;
    comms_style?: string;
    brand_colors?: string[];
}

// Edit / Refine Types
export interface RefineScriptRequest {
    run_id: string;
    script_id: string;
    instructions: string;
}

export interface CutdownScriptRequest {
    run_id: string;
    script_id: string;
    target_duration: number;
}

export interface UpdateScriptRequest {
    run_id: string;
    script_id: string;
    content: string;
}

// Budget range options
export const BUDGET_RANGE_OPTIONS = [
    { value: 'no_budget', label: 'No budget specified' },
    { value: 'under_50k', label: 'Under £50k' },
    { value: '50k_100k', label: '£50k - £100k' },
    { value: '100k_250k', label: '£100k - £250k' },
    { value: '250k_500k', label: '£250k - £500k' },
    { value: '500k_1m', label: '£500k - £1m' },
    { value: 'over_1m', label: 'Over £1m' },
] as const;

export type BudgetRange = typeof BUDGET_RANGE_OPTIONS[number]['value'];

// Market/Jurisdiction options
export const MARKET_OPTIONS = [
    { value: 'uk', label: 'United Kingdom', compliance: 'Clearcast' },
    { value: 'usa', label: 'United States', compliance: 'FCC/NAD' },
    { value: 'eu', label: 'European Union', compliance: 'EASA' },
] as const;

export type Market = typeof MARKET_OPTIONS[number]['value'];

// Visual Style options
export const VISUAL_STYLE_OPTIONS = [
    { value: '', label: 'Not specified (AI will suggest)' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: '3d_animation', label: '3D Animation' },
    { value: 'stop_motion', label: 'Stop Motion' },
    { value: 'ugc', label: 'UGC (User Generated Content)' },
    { value: 'wes_anderson', label: 'Wes Anderson Style' },
    { value: 'documentary', label: 'Documentary' },
    { value: 'mixed_media', label: 'Mixed Media' },
] as const;

export type VisualStyle = typeof VISUAL_STYLE_OPTIONS[number]['value'];

// Uploaded briefing document info
export interface BriefingDoc {
    file: File;
    name: string;
    size: number;
    type: string;
}

// Form state for the UI
export interface BriefFormState {
    // New: Website URL for brand discovery
    website_url: string;
    
    // Core brief fields
    objective: string;
    target_audience: string;
    single_minded_proposition: string;
    tone_of_voice: string;
    length_seconds: number;
    budget_range: BudgetRange;
    creative_mode: CreativeMode;
    
    // New fields
    market: Market;
    visual_style: VisualStyle;
    
    // Optional/Advanced fields (collapsed by default)
    mandatories: string;  // Comma-separated in UI
    
    // Legacy fields - kept for backwards compatibility but auto-filled from brand discovery
    asset_name: string;
    brand_name: string;
    product_service: string;
    comms_style: string;
    brand_colors: string;  // Comma-separated in UI
}

export const DEFAULT_BRIEF_FORM: BriefFormState = {
    website_url: '',
    objective: '',
    target_audience: '',
    single_minded_proposition: '',
    tone_of_voice: '',
    length_seconds: 30,
    budget_range: 'no_budget',
    creative_mode: 'standard_think',
    market: 'uk',
    visual_style: '',
    mandatories: '',
    asset_name: '',
    brand_name: '',
    product_service: '',
    comms_style: '',
    brand_colors: '',
};

// Helper to convert budget value to display string
export function budgetValueToLabel(value: BudgetRange): string {
    const option = BUDGET_RANGE_OPTIONS.find(o => o.value === value);
    return option?.label || 'No budget specified';
}

// Helper to convert form state to API request
export function formToRequest(form: BriefFormState, briefingContext?: string): AdScriptGenerateRequest {
    return {
        website_url: form.website_url || undefined,
        objective: form.objective,
        target_audience: form.target_audience,
        single_minded_proposition: form.single_minded_proposition,
        tone_of_voice: form.tone_of_voice,
        asset_name: form.asset_name || `Campaign ${new Date().toLocaleDateString()}`,
        length_seconds: form.length_seconds,
        mandatories: form.mandatories.split(',').map(s => s.trim()).filter(Boolean),
        creative_mode: form.creative_mode,
        market: form.market,
        visual_style: form.visual_style || undefined,
        briefing_context: briefingContext || undefined,
        brand_name: form.brand_name,
        product_service: form.product_service,
        budget_range: budgetValueToLabel(form.budget_range),
        comms_style: form.comms_style,
        brand_colors: form.brand_colors.split(',').map(s => s.trim()).filter(Boolean),
    };
}

// Creative mode labels and descriptions
export const CREATIVE_MODE_INFO: Record<CreativeMode, { label: string; description: string; icon: string }> = {
    light_think: {
        label: 'Light',
        description: 'Fast generation, fewer iterations. Good for quick exploration.',
        icon: '⚡',
    },
    standard_think: {
        label: 'Standard',
        description: 'Balanced depth and speed. Recommended for most briefs.',
        icon: '🎯',
    },
    deep_think: {
        label: 'Deep',
        description: 'Maximum creative depth. More iterations and critiques.',
        icon: '🧠',
    },
};
