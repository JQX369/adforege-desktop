"""
Configuration for the Shared Validation Engine.

Defines modes, check configs, and presets for Web Compliance vs Pure Clearcast.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class ValidationMode(Enum):
    """Validation strictness modes."""
    WEB_COMPLIANCE = "web"      # Tolerant, auto-downgrade allowed
    PURE_CLEARCAST = "pure"     # Strict DPP AS-11 style


class CheckSeverity(Enum):
    """How a failed check is classified."""
    RED = "red"        # Blocking - ad will not clear
    YELLOW = "yellow"  # Warning - may clear with modifications
    BLUE = "blue"      # Technical info - informational


@dataclass
class CheckConfig:
    """Configuration for an individual validation check."""
    enabled: bool = True
    severity: CheckSeverity = CheckSeverity.YELLOW
    strict: bool = False           # Strict mode (no tolerance)
    tolerance: Optional[float] = None
    required: bool = False         # If True, missing data = fail
    auto_downgrade: bool = True    # Allow AI to downgrade severity
    custom_params: Dict[str, Any] = field(default_factory=dict)

    def with_overrides(self, **kwargs) -> "CheckConfig":
        """Create a new CheckConfig with overridden values."""
        return CheckConfig(
            enabled=kwargs.get("enabled", self.enabled),
            severity=kwargs.get("severity", self.severity),
            strict=kwargs.get("strict", self.strict),
            tolerance=kwargs.get("tolerance", self.tolerance),
            required=kwargs.get("required", self.required),
            auto_downgrade=kwargs.get("auto_downgrade", self.auto_downgrade),
            custom_params={**self.custom_params, **kwargs.get("custom_params", {})},
        )


@dataclass
class ModeConfig:
    """Complete configuration for a validation mode."""
    mode: ValidationMode
    checks: Dict[str, CheckConfig]
    accepted_formats: List[str]
    allow_auto_downgrade: bool
    require_clock_number: bool
    ai_prediction_enabled: bool

    def get_check(self, check_id: str) -> CheckConfig:
        """Get check config by ID, returns disabled config if not found."""
        return self.checks.get(check_id, CheckConfig(enabled=False))


# =============================================================================
# WEB COMPLIANCE PRESET - Tolerant, web-friendly
# =============================================================================
WEB_COMPLIANCE_CONFIG = ModeConfig(
    mode=ValidationMode.WEB_COMPLIANCE,
    checks={
        # Audio - TOLERANT (Blue flags)
        "lufs": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            tolerance=1.0,
            custom_params={"target": -23.0}
        ),
        "true_peak": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            tolerance=0.5,
            custom_params={"max": -1.0}
        ),
        "silence_head": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            strict=False
        ),
        "silence_tail": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            strict=False
        ),

        # Video - WARN ONLY (Blue flags)
        "resolution": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            strict=False,
            custom_params={"width": 1920, "height": 1080}
        ),
        "fps": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            strict=False,
            tolerance=0.1,
            custom_params={"target": 25.0}
        ),
        "codec": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            strict=False,
            custom_params={"preferred": ["prores", "h264"], "web_allowed": ["vp9", "av1", "hevc"]}
        ),

        # Format - WEB FRIENDLY
        "container": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            custom_params={"allowed": [".mp4", ".mov", ".webm"]}
        ),

        # Metadata - OPTIONAL
        "clock_number": CheckConfig(
            enabled=False,  # Not required for web
            required=False
        ),
        "duration_match": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            tolerance=1.0,
            custom_params={"allow_slate": True}
        ),

        # Safety - WARN
        "safe_area": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE,
            custom_params={"threshold": 0.01, "margin_title": 0.9}
        ),
        "pse": CheckConfig(
            enabled=True,
            severity=CheckSeverity.YELLOW,
            custom_params={"flash_threshold": 3}
        ),

        # Legal Text - WARN
        "legal_text_size": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE
        ),
        "legal_text_duration": CheckConfig(
            enabled=True,
            severity=CheckSeverity.BLUE
        ),

        # AI Content - AUTO DOWNGRADE ALLOWED
        "ai_content": CheckConfig(
            enabled=True,
            auto_downgrade=True
        ),
    },
    accepted_formats=[".mp4", ".mov", ".webm"],
    allow_auto_downgrade=True,
    require_clock_number=False,
    ai_prediction_enabled=True,
)


# =============================================================================
# PURE CLEARCAST PRESET - Strict DPP AS-11 style
# =============================================================================
PURE_CLEARCAST_CONFIG = ModeConfig(
    mode=ValidationMode.PURE_CLEARCAST,
    checks={
        # Audio - STRICT (Red flags)
        "lufs": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            tolerance=0.5,
            custom_params={"target": -23.0}
        ),
        "true_peak": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            tolerance=0.0,
            custom_params={"max": -1.0}
        ),
        "silence_head": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            required=True,
            custom_params={"duration_sec": 0.24, "threshold_db": -60.0}
        ),
        "silence_tail": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            required=True,
            custom_params={"duration_sec": 0.24, "threshold_db": -60.0}
        ),

        # Video - STRICT (Red flags)
        "resolution": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            custom_params={"width": 1920, "height": 1080}
        ),
        "fps": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            tolerance=0.01,
            custom_params={"target": 25.0}
        ),
        "codec": CheckConfig(
            enabled=True,
            severity=CheckSeverity.YELLOW,
            strict=True,
            custom_params={"preferred": ["prores", "h264"], "rejected": ["vp9", "av1"]}
        ),

        # Format - EXPANDED
        "container": CheckConfig(
            enabled=True,
            severity=CheckSeverity.YELLOW,
            custom_params={"allowed": [".mov", ".mp4", ".mxf", ".avi"]}
        ),
        "mxf_structure": CheckConfig(
            enabled=True,
            severity=CheckSeverity.YELLOW
        ),
        "prores_profile": CheckConfig(
            enabled=True,
            severity=CheckSeverity.YELLOW
        ),

        # Metadata - REQUIRED
        "clock_number": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            required=True
        ),
        "duration_match": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            tolerance=0.5,
            custom_params={"allow_slate": True}
        ),
        "as11_metadata": CheckConfig(
            enabled=True,
            severity=CheckSeverity.YELLOW
        ),

        # Safety - AGGRESSIVE (Red flags)
        "safe_area": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            custom_params={"threshold": 0.005, "margin_title": 0.9}
        ),
        "pse": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True,
            custom_params={"flash_threshold": 2.5}
        ),

        # Legal Text - STRICT (Red flags)
        "legal_text_size": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True
        ),
        "legal_text_duration": CheckConfig(
            enabled=True,
            severity=CheckSeverity.RED,
            strict=True
        ),

        # AI Content - NO AUTO DOWNGRADE
        "ai_content": CheckConfig(
            enabled=True,
            auto_downgrade=False
        ),
    },
    accepted_formats=[".mov", ".mp4", ".mxf", ".avi"],
    allow_auto_downgrade=False,
    require_clock_number=True,
    ai_prediction_enabled=False,
)


def get_preset(mode: ValidationMode) -> ModeConfig:
    """Get the preset config for a validation mode."""
    presets = {
        ValidationMode.WEB_COMPLIANCE: WEB_COMPLIANCE_CONFIG,
        ValidationMode.PURE_CLEARCAST: PURE_CLEARCAST_CONFIG,
    }
    return presets[mode]
