"""
Result structures for the Shared Validation Engine.

Provides dataclasses for individual check results and overall validation results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .config import CheckSeverity


@dataclass
class CheckResult:
    """Result from a single validation check."""
    check_id: str
    passed: bool
    severity: str  # "red", "yellow", "blue"
    message: str
    category: str = "General"
    timestamp: Optional[str] = None
    frame_indices: List[int] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    fix_guidance: Optional[str] = None
    subjective: bool = False
    original_severity: Optional[str] = None  # For tracking downgrades

    def to_flag_dict(self) -> Dict[str, Any]:
        """Convert to the flag format used by existing Clearcast code."""
        flag = {
            "issue": self.message,
            "severity": self.severity.upper(),
            "timestamp": self.timestamp or "Full video",
            "category": self.category,
            "fix_required": not self.passed,
            "check_id": self.check_id,
            "subjective": self.subjective,
        }

        if self.fix_guidance:
            flag["fix_guidance"] = self.fix_guidance

        if self.frame_indices:
            flag["frame_indices"] = self.frame_indices

        if self.original_severity and self.original_severity != self.severity:
            flag["downgraded_from"] = self.original_severity.upper()

        # Merge extra details
        flag.update(self.details)

        return flag

    def downgrade_severity(self, new_severity: str) -> None:
        """Downgrade the severity (e.g., red -> yellow for subjective issues)."""
        if self.original_severity is None:
            self.original_severity = self.severity
        self.severity = new_severity


@dataclass
class ValidationResult:
    """Complete validation result from the engine."""
    mode: str
    compliance_status: str = "PENDING"  # "PASS", "FAIL", "REVIEW_NEEDED", "ERROR"
    overall_risk: str = "UNKNOWN"       # "LOW", "MEDIUM", "HIGH", "UNKNOWN"
    red_flags: List[Dict[str, Any]] = field(default_factory=list)
    yellow_flags: List[Dict[str, Any]] = field(default_factory=list)
    blue_flags: List[Dict[str, Any]] = field(default_factory=list)
    check_results: Dict[str, CheckResult] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)

    def add_check_result(self, result: CheckResult) -> None:
        """Add a check result to the appropriate flag list."""
        self.check_results[result.check_id] = result

        if not result.passed:
            flag = result.to_flag_dict()
            if result.severity == "red":
                self.red_flags.append(flag)
            elif result.severity == "yellow":
                self.yellow_flags.append(flag)
            else:
                self.blue_flags.append(flag)

    def merge_flags(
        self,
        red_flags: List[Dict[str, Any]],
        yellow_flags: List[Dict[str, Any]],
        blue_flags: List[Dict[str, Any]]
    ) -> None:
        """Merge external flags (e.g., from AI analysis) into results."""
        self.red_flags.extend(red_flags)
        self.yellow_flags.extend(yellow_flags)
        self.blue_flags.extend(blue_flags)

    def compute_status(self) -> None:
        """Compute overall compliance status from flags."""
        if self.errors:
            self.compliance_status = "ERROR"
            self.overall_risk = "UNKNOWN"
        elif self.red_flags:
            self.compliance_status = "FAIL"
            self.overall_risk = "HIGH"
        elif self.yellow_flags:
            self.compliance_status = "REVIEW_NEEDED"
            self.overall_risk = "MEDIUM"
        else:
            self.compliance_status = "PASS"
            self.overall_risk = "LOW"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "mode": self.mode,
            "compliance_status": self.compliance_status,
            "overall_risk": self.overall_risk,
            "red_flags": self.red_flags,
            "yellow_flags": self.yellow_flags,
            "blue_flags": self.blue_flags,
            "metadata": self.metadata,
            "errors": self.errors if self.errors else None,
        }

    def get_flag_count(self) -> Dict[str, int]:
        """Get count of flags by severity."""
        return {
            "red": len(self.red_flags),
            "yellow": len(self.yellow_flags),
            "blue": len(self.blue_flags),
            "total": len(self.red_flags) + len(self.yellow_flags) + len(self.blue_flags),
        }

    def has_blocking_issues(self) -> bool:
        """Check if there are any blocking (red flag) issues."""
        return len(self.red_flags) > 0
