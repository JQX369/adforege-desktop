"""Guardrails and metadata for Clearcast auto-fix operations."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(frozen=True)
class AutoFixCategory:
    id: str
    label: str
    description: str
    auto_apply: bool
    human_review_required: bool = False
    examples: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class AutoFixAction:
    id: str
    category: str
    label: str
    description: str
    default_enabled: bool = False
    manual_only: bool = False
    requires_metadata: bool = False


AUTO_FIX_CATEGORIES: Dict[str, AutoFixCategory] = {
    "script_language": AutoFixCategory(
        id="script_language",
        label="Script & Voiceover",
        description="Creative copy, VO wording, and on-screen narrative changes must be reviewed manually. "
        "The tool can only provide suggestions—never rewrite creative copy automatically.",
        auto_apply=False,
        human_review_required=True,
        examples=[
            "Softening bold claims",
            "Reordering story beats",
            "Altering dialogue or VO tone",
        ],
    ),
    "disclaimers": AutoFixCategory(
        id="disclaimers",
        label="Legal Copy & Disclaimers",
        description="Adding or editing legal disclaimers, price footers, or health warnings must always be a manual step. "
        "The tool can highlight required text but must not inject or remove legal copy on its own.",
        auto_apply=False,
        human_review_required=True,
        examples=[
            "APR disclaimers",
            "DSA loan warnings",
            "Health/safety supers",
        ],
    ),
    "technical_audio": AutoFixCategory(
        id="technical_audio",
        label="Audio Processing",
        description="Safe, reversible loudness and clarity adjustments.",
        auto_apply=True,
    ),
    "technical_video": AutoFixCategory(
        id="technical_video",
        label="Video Color & Exposure",
        description="Adjustments that do not alter creative intent (levels, broadcast-safe conversions).",
        auto_apply=True,
    ),
    "technical_format": AutoFixCategory(
        id="technical_format",
        label="Format & Frame Rate",
        description="Mechanical conversions (resolution, frame-rate, deinterlace) required for broadcast delivery.",
        auto_apply=True,
    ),
    "broadcast_delivery": AutoFixCategory(
        id="broadcast_delivery",
        label="Broadcast Delivery",
        description="Clock, countdown, padding, file container, and slate metadata generation.",
        auto_apply=True,
        human_review_required=True,
        examples=[
            "Clock leader + countdown",
            "Black/silence padding",
            "Slate metadata population",
        ],
    ),
}

# Order used in UI
AUTO_FIX_CATEGORY_ORDER: List[str] = [
    "technical_audio",
    "technical_video",
    "technical_format",
    "broadcast_delivery",
    "disclaimers",
    "script_language",
]

AUTO_FIX_ACTIONS: List[AutoFixAction] = [
    AutoFixAction(
        id="normalize_audio",
        category="technical_audio",
        label="Normalize to -23 LUFS (broadcast standard)",
        description="Adjust overall loudness to EBU R128 (-23 LUFS) without altering content.",
        default_enabled=True,
    ),
    AutoFixAction(
        id="remove_noise",
        category="technical_audio",
        label="Remove background noise",
        description="Apply gentle broadband noise reduction.",
        default_enabled=False,
    ),
    AutoFixAction(
        id="enhance_voice",
        category="technical_audio",
        label="Enhance dialogue clarity",
        description="Increase dialogue presence without re-recording.",
        default_enabled=False,
    ),
    AutoFixAction(
        id="broadcast_safe",
        category="technical_video",
        label="Apply broadcast-safe colors (16-235)",
        description="Clamp luminance/chroma to broadcast range.",
        default_enabled=True,
    ),
    AutoFixAction(
        id="auto_levels",
        category="technical_video",
        label="Auto brightness / contrast correction",
        description="Balance exposure without altering creative intent.",
        default_enabled=True,
    ),
    AutoFixAction(
        id="denoise",
        category="technical_video",
        label="Reduce video noise / grain",
        description="Apply mild spatial denoising.",
        default_enabled=False,
    ),
    AutoFixAction(
        id="scale_hd",
        category="technical_format",
        label="Convert to 1920x1080 HD",
        description="Resize to full HD canvas with pillar/letterbox as needed.",
        default_enabled=True,
    ),
    AutoFixAction(
        id="convert_fps",
        category="technical_format",
        label="Convert to 25fps (PAL)",
        description="Transcode to 25fps broadcast delivery frame rate.",
        default_enabled=True,
    ),
    AutoFixAction(
        id="deinterlace",
        category="technical_format",
        label="Remove interlacing artifacts",
        description="Apply deinterlace for progressive delivery.",
        default_enabled=True,
    ),
    AutoFixAction(
        id="add_padding",
        category="broadcast_delivery",
        label="Add black & silence padding at head/tail",
        description="Append 2s black/silence head & tail per Clearcast spec.",
        default_enabled=False,
    ),
    AutoFixAction(
        id="add_slate",
        category="broadcast_delivery",
        label="Add clock slate with countdown",
        description="Generate slate + countdown. Requires manual metadata input.",
        default_enabled=False,
        requires_metadata=True,
    ),
    # Manual-only guidance actions (no auto application)
    AutoFixAction(
        id="rewrite_voiceover",
        category="script_language",
        label="Rewrite or re-record voiceover",
        description="Must remain a manual creative change; provide suggestions only.",
        manual_only=True,
    ),
    AutoFixAction(
        id="adjust_on_screen_price",
        category="script_language",
        label="Adjust on-screen price/super copy",
        description="Price/offer supers require manual edit and legal approval.",
        manual_only=True,
    ),
    AutoFixAction(
        id="add_disclaimer_super",
        category="disclaimers",
        label="Add/modify legal disclaimers",
        description="Legal disclaimers must be authored/reviewed manually.",
        manual_only=True,
    ),
    AutoFixAction(
        id="add_health_warning",
        category="disclaimers",
        label="Add health/safety warning supers",
        description="Health and safety supers cannot be auto-inserted without counsel.",
        manual_only=True,
    ),
]

ACTION_MAP: Dict[str, AutoFixAction] = {action.id: action for action in AUTO_FIX_ACTIONS}
CATEGORY_MAP: Dict[str, AutoFixCategory] = {cat_id: cat for cat_id, cat in AUTO_FIX_CATEGORIES.items()}


def can_auto_apply_action(action_id: str) -> bool:
    """Return True if the action may be auto-applied."""
    action = ACTION_MAP[action_id]
    category = CATEGORY_MAP[action.category]
    return category.auto_apply and not action.manual_only


def validate_auto_fix_plan(plan: Dict[str, bool]) -> None:
    """Ensure a plan does not attempt to auto-apply disallowed actions."""
    violations = [
        action_id
        for action_id, enabled in plan.items()
        if enabled and action_id in ACTION_MAP and not can_auto_apply_action(action_id)
    ]
    if violations:
        labels = [ACTION_MAP[action_id].label for action_id in violations]
        raise ValueError(
            "The following actions require manual review and cannot be auto-applied: "
            + ", ".join(labels)
        )


def actions_by_category() -> Dict[str, List[AutoFixAction]]:
    grouped: Dict[str, List[AutoFixAction]] = {cat_id: [] for cat_id in AUTO_FIX_CATEGORIES}
    for action in AUTO_FIX_ACTIONS:
        grouped.setdefault(action.category, []).append(action)
    return grouped

