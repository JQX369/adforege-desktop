"""
Shared Validation Engine for Clearcast Compliance.

Provides configurable validation with two modes:
- WEB_COMPLIANCE: Tolerant, auto-downgrade for subjective issues
- PURE_CLEARCAST: Strict DPP AS-11 style, no auto-downgrade
"""

from .config import (
    ValidationMode,
    CheckSeverity,
    CheckConfig,
    ModeConfig,
    WEB_COMPLIANCE_CONFIG,
    PURE_CLEARCAST_CONFIG,
)
from .result import CheckResult, ValidationResult
from .engine import SharedValidationEngine

__all__ = [
    "ValidationMode",
    "CheckSeverity",
    "CheckConfig",
    "ModeConfig",
    "WEB_COMPLIANCE_CONFIG",
    "PURE_CLEARCAST_CONFIG",
    "CheckResult",
    "ValidationResult",
    "SharedValidationEngine",
]
