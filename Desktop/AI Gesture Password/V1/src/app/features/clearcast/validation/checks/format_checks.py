"""
Container/format validation checks for Clearcast compliance.

Handles file extension validation and advanced format checks (MXF, ProRes).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from ..config import CheckConfig, CheckSeverity
from ..result import CheckResult

logger = logging.getLogger(__name__)


class FormatChecks:
    """
    Container format validation checks.

    Validates file extensions and advanced format properties.
    """

    def run_all(
        self,
        video_path: str,
        configs: Dict[str, CheckConfig],
        video_metadata: Optional[Dict[str, Any]] = None
    ) -> List[CheckResult]:
        """Run all format checks and return results."""
        results = []

        # Container/extension check
        container_config = configs.get("container", CheckConfig(enabled=False))
        if container_config.enabled:
            results.append(self._check_container(video_path, container_config))

        # MXF structure check (Pure mode only)
        mxf_config = configs.get("mxf_structure", CheckConfig(enabled=False))
        if mxf_config.enabled:
            result = self._check_mxf_structure(video_path, mxf_config)
            if result:
                results.append(result)

        # ProRes profile check (Pure mode only)
        prores_config = configs.get("prores_profile", CheckConfig(enabled=False))
        if prores_config.enabled and video_metadata:
            result = self._check_prores_profile(video_metadata, prores_config)
            if result:
                results.append(result)

        return results

    def _check_container(
        self,
        video_path: str,
        config: CheckConfig
    ) -> CheckResult:
        """Check if file extension is in allowed list."""
        _, ext = os.path.splitext(video_path)
        ext = ext.lower()

        allowed = config.custom_params.get("allowed", [".mp4", ".mov", ".webm"])

        if ext in allowed:
            return CheckResult(
                check_id="container",
                passed=True,
                severity="blue",
                message=f"File format '{ext}' is accepted.",
                category="Container Format",
                details={"extension": ext}
            )
        else:
            return CheckResult(
                check_id="container",
                passed=False,
                severity=config.severity.value,
                message=f"File format '{ext}' may not be accepted. Allowed formats: {', '.join(allowed)}.",
                category="Container Format",
                fix_guidance=f"Convert to one of the accepted formats: {', '.join(allowed)}.",
                details={"extension": ext, "allowed": allowed}
            )

    def _check_mxf_structure(
        self,
        video_path: str,
        config: CheckConfig
    ) -> Optional[CheckResult]:
        """Check MXF file structure (OP1a pattern)."""
        _, ext = os.path.splitext(video_path)

        if ext.lower() != ".mxf":
            return None  # Not an MXF file, skip

        # TODO: Implement actual MXF structure validation
        # This would require parsing MXF headers to verify:
        # - OP1a pattern
        # - Essence type
        # - Metadata presence

        logger.info("MXF structure check: Basic validation only (full OP1a check not implemented)")

        return CheckResult(
            check_id="mxf_structure",
            passed=True,
            severity="blue",
            message="MXF file detected. Full OP1a validation not yet implemented.",
            category="Container Format",
            details={"note": "Manual verification of MXF structure recommended"}
        )

    def _check_prores_profile(
        self,
        video_metadata: Dict[str, Any],
        config: CheckConfig
    ) -> Optional[CheckResult]:
        """Check ProRes profile for broadcast compliance."""
        codec = video_metadata.get("codec", "")

        if "prores" not in codec.lower():
            return None  # Not ProRes, skip

        # ProRes profiles for broadcast:
        # - prores_422 (Standard)
        # - prores_422_hq (High Quality)
        # - prores_4444 (Alpha support)

        acceptable_profiles = ["prores", "prores_422", "prores_422_hq", "prores_4444"]

        if codec.lower() in acceptable_profiles or codec == "prores":
            return CheckResult(
                check_id="prores_profile",
                passed=True,
                severity="blue",
                message=f"ProRes profile '{codec}' is broadcast-acceptable.",
                category="Container Format",
                details={"profile": codec}
            )
        else:
            return CheckResult(
                check_id="prores_profile",
                passed=False,
                severity=config.severity.value,
                message=f"ProRes profile '{codec}' may not be accepted. Use ProRes 422 or higher.",
                category="Container Format",
                fix_guidance="Transcode to ProRes 422 HQ for maximum compatibility.",
                details={"profile": codec, "acceptable": acceptable_profiles}
            )
