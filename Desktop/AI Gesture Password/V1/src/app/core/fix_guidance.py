"""
Centralized Fix Guidance Database

Contains all remediation text and actionable guidance for common issues
found during compliance checks and AI analysis.
"""

from typing import Dict, Optional


# Technical/Compliance Fix Guidance
COMPLIANCE_FIX_GUIDANCE: Dict[str, str] = {
    # Safe Area
    "safe_area": (
        "Move important content inward by ~5% to stay within the 90% title-safe zone. "
        "Avoid placing text, logos, or critical visual elements near the edges of the frame. "
        "Standard title-safe is 10% inset from each edge."
    ),
    
    # PSE/Flash
    "pse_flash": (
        "Reduce the frequency of rapid luminance changes (flashing) to below 3 flashes per second. "
        "Consider using slower transitions, reducing contrast between flashing elements, "
        "or adding motion blur to rapid cuts. All content must pass the Harding PSE test."
    ),
    
    # Audio
    "audio_loudness": (
        "Normalize the audio to -23 LUFS (EBU R128 standard) with a true peak of -1 dBTP or lower. "
        "Use the 'Fix Issues' button to automatically apply broadcast-standard normalization."
    ),
    
    "audio_silence": (
        "Ensure silent frames at the head (before content) and tail (after content) of the video. "
        "For slated masters, maintain silence during the countdown period. "
        "Head/tail silence helps with broadcast playout timing."
    ),
    
    # Format
    "video_format": (
        "Re-encode the video to meet UK Clearcast specifications: 1920x1080 resolution, 25fps, "
        "ProRes or H.264 codec. Use the 'Fix Issues' button to automatically transcode to the correct format."
    ),
    
    # Clock/Metadata
    "clock_number_format": (
        "Correct the clock number to match the format AAA/BBBB123/030 (e.g. ABC/PROD001/030). "
        "The first 3 letters are the agency code, followed by 4-7 alphanumeric product code, "
        "and the last 3 digits should match the content duration in seconds."
    ),
    
    "duration_mismatch": (
        "Trim or adjust the video duration to match the clock number specification. "
        "For slated masters, ensure the content duration (excluding slate) matches the clock suffix."
    ),
    
    # Legal Text
    "legal_text_height": (
        "Increase text size to meet the minimum 30 HD scan-line height requirement. "
        "Supers must be clearly legible on a standard TV viewing distance."
    ),
    
    "legal_text_duration": (
        "Extend the on-screen duration of the text to meet the minimum hold time requirement "
        "(0.2s per word + 2-3s buffer depending on complexity). "
        "Viewers need adequate time to read all legal text."
    ),
    
    "legal_text_visibility": (
        "Improve text contrast or move it to a less busy area of the frame to improve visibility. "
        "Consider adding a subtle drop shadow or semi-transparent background panel."
    ),
    
    # Slate
    "slate_removal": (
        "For transmission copies, the slate/countdown should typically be removed. "
        "For approval copies sent to Clearcast, slates are expected and should be retained."
    ),
}


# AI Breakdown Fix Guidance
AI_FIX_GUIDANCE: Dict[str, str] = {
    # CTA Issues
    "cta_weak": (
        "Make the call-to-action more prominent and specific. Use action verbs like 'Shop Now', "
        "'Get Started', or 'Learn More'. Ensure the CTA is visible for at least 2-3 seconds "
        "and contrasts with the background."
    ),
    
    "cta_timing": (
        "Move the CTA earlier in the ad or repeat it. Research shows CTAs in the last 3 seconds "
        "often get missed. Consider a mid-roll CTA reminder."
    ),
    
    "cta_clarity": (
        "Simplify the CTA message. Remove jargon and ensure the desired action is immediately clear. "
        "Test with someone unfamiliar with your product to verify comprehension."
    ),
    
    # Branding
    "branding_visibility": (
        "Ensure brand logo is visible for minimum 2 seconds, ideally in the first and last 3 seconds. "
        "Logo should be in a consistent position and sized appropriately (typically 5-10% of frame)."
    ),
    
    "branding_consistency": (
        "Maintain consistent brand colors, fonts, and visual style throughout the ad. "
        "Inconsistent branding reduces recall and trust."
    ),
    
    "branding_early": (
        "Introduce brand identity earlier in the ad. Studies show viewers who skip after 5 seconds "
        "should still recognize the brand. Front-load brand exposure."
    ),
    
    # Messaging
    "message_clarity": (
        "Simplify your key message to one main takeaway. Viewers remember at most 1-2 points. "
        "Use the 'say it, show it, repeat it' principle."
    ),
    
    "message_relevance": (
        "Connect your message more directly to the target audience's needs. "
        "Lead with benefits rather than features."
    ),
    
    "message_proof": (
        "Add supporting evidence for claims (testimonials, statistics, demonstrations). "
        "Unsubstantiated claims reduce credibility and may face compliance issues."
    ),
    
    # Production
    "production_audio": (
        "Improve audio quality - ensure dialogue is clear and well-balanced with music/effects. "
        "Viewers tolerate poor video more than poor audio."
    ),
    
    "production_pacing": (
        "Adjust pacing to match content type. For :30 spots, aim for 3-4 key scenes. "
        "Too many cuts (>15) or too few (<3) can hurt engagement."
    ),
    
    "production_lighting": (
        "Improve lighting consistency and quality. Uneven or poor lighting signals low production value "
        "and can negatively impact brand perception."
    ),
    
    # Audience Fit
    "audience_mismatch": (
        "Consider adjusting tone, visuals, or messaging to better match your target demographic. "
        "Current creative may resonate better with a different audience segment."
    ),
    
    "audience_diversity": (
        "Consider more inclusive representation in casting and scenarios. "
        "Broader representation can expand appeal without alienating core audience."
    ),
    
    # Engagement
    "engagement_hook": (
        "Strengthen the opening hook. The first 3 seconds determine whether viewers continue watching. "
        "Start with action, emotion, or a compelling question rather than logo cards."
    ),
    
    "engagement_emotional": (
        "Add more emotional resonance. Ads that evoke emotions (humor, warmth, surprise) "
        "are remembered 2x better than purely informational content."
    ),
    
    "engagement_story": (
        "Consider adding a narrative arc even in short form. A simple problem-solution structure "
        "or character journey increases engagement and recall."
    ),
}


# Claim Substantiation Guidance
SUBSTANTIATION_GUIDANCE: Dict[str, str] = {
    "comparative": (
        "Comparative claims require head-to-head test data from an independent source. "
        "Prepare: test methodology, sample size, statistical significance (p<0.05), "
        "and confirmation products were tested under normal use conditions."
    ),
    
    "superlative": (
        "Superlative claims ('No.1', 'Best', 'Most') require market data verification. "
        "Prepare: Nielsen/Kantar data for last 12 months, clear category definition, "
        "and audit of all competitors in the defined market."
    ),
    
    "testimonial": (
        "Testimonial claims require verification of genuine experience. "
        "Prepare: signed affidavit confirming genuine views, proof of product use, "
        "and for experts, proof of qualifications."
    ),
    
    "environmental": (
        "Environmental claims require lifecycle analysis. "
        "Prepare: ISO 14040 LCA if possible, proof benefit isn't a legal requirement, "
        "and evidence claim applies to full product (not just packaging)."
    ),
    
    "price": (
        "Price comparison claims require independent verification. "
        "Prepare: pricing audit from retailers, proof 'was' price was charged for 28+ days, "
        "and date of price check."
    ),
    
    "new": (
        "Claims about product being 'new' require timing verification. "
        "Prepare: launch date documentation and confirmation product hasn't been modified/relaunched before."
    ),
    
    "health": (
        "Health claims require regulatory compliance verification. "
        "Prepare: EU/EFSA approved health claims list reference, evidence of proper dosage/format, "
        "and any required advisory text."
    ),
}


def get_fix_guidance(issue_type: str, category: str = "compliance") -> Optional[str]:
    """
    Get fix guidance for a specific issue type.
    
    Args:
        issue_type: The type of issue (e.g., 'safe_area', 'cta_weak')
        category: Either 'compliance', 'ai', or 'substantiation'
        
    Returns:
        Fix guidance text or None if not found
    """
    if category == "compliance":
        return COMPLIANCE_FIX_GUIDANCE.get(issue_type)
    elif category == "ai":
        return AI_FIX_GUIDANCE.get(issue_type)
    elif category == "substantiation":
        return SUBSTANTIATION_GUIDANCE.get(issue_type)
    return None


def get_guidance_for_keyword(keyword: str) -> Optional[str]:
    """
    Search all guidance databases for a matching keyword.
    
    Args:
        keyword: A keyword to search for (case-insensitive)
        
    Returns:
        First matching guidance or None
    """
    keyword_lower = keyword.lower()
    
    # Check all databases
    all_guidance = {
        **COMPLIANCE_FIX_GUIDANCE,
        **AI_FIX_GUIDANCE,
        **SUBSTANTIATION_GUIDANCE,
    }
    
    # Exact match first
    for key, guidance in all_guidance.items():
        if keyword_lower in key.lower():
            return guidance
    
    # Partial match in guidance text
    for key, guidance in all_guidance.items():
        if keyword_lower in guidance.lower():
            return guidance
    
    return None


def get_all_guidance_keys() -> Dict[str, list]:
    """
    Get all available guidance keys organized by category.
    
    Returns:
        Dictionary with category names as keys and lists of issue types as values
    """
    return {
        "compliance": list(COMPLIANCE_FIX_GUIDANCE.keys()),
        "ai": list(AI_FIX_GUIDANCE.keys()),
        "substantiation": list(SUBSTANTIATION_GUIDANCE.keys()),
    }


__all__ = [
    "COMPLIANCE_FIX_GUIDANCE",
    "AI_FIX_GUIDANCE",
    "SUBSTANTIATION_GUIDANCE",
    "get_fix_guidance",
    "get_guidance_for_keyword",
    "get_all_guidance_keys",
]








