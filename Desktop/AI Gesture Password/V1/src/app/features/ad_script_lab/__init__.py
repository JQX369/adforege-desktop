"""
Ad Script Lab - Multi-agent UK TV Ad Script Generator

This module provides a multi-agent protocol for generating UK TV ad scripts
using RAG-based retrieval from a TV ads archive.
"""

from .types import (
    AdScriptBrief,
    AdScriptRun,
    CreativeMode,
    ScriptScores,
    PolishedScript,
    BraintrustCritique,
    ComplianceCheck,
    ComplianceIssue,
    ComplianceSolution,
    ComplianceResult,
)
from .orchestrator import run_ad_script_protocol

__all__ = [
    "AdScriptBrief",
    "AdScriptRun",
    "CreativeMode",
    "ScriptScores",
    "PolishedScript",
    "BraintrustCritique",
    "ComplianceCheck",
    "ComplianceIssue",
    "ComplianceSolution",
    "ComplianceResult",
    "run_ad_script_protocol",
]








