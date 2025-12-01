"""
Configuration for Ad Script Lab multi-agent protocol.

Defines creative mode parameters and agent configurations.
"""

from dataclasses import dataclass
from typing import Dict, Any
from .types import CreativeMode


@dataclass
class CreativeModeConfig:
    """Configuration for a creative mode setting."""
    # LLM parameters
    temperature_ideation: float  # Temperature for ideation agents
    temperature_analysis: float  # Temperature for selector/compliance agents
    
    # Retrieval parameters
    neighbors: int  # Number of RAG neighbors to retrieve
    
    # Iteration parameters
    ideas_count: int  # Number of initial ideas to generate
    braintrust_loops: int  # Number of Braintrust critique iterations
    
    # Quality thresholds
    min_similarity_score: float  # Minimum RAG similarity score
    compliance_strictness: str  # 'lenient', 'standard', 'strict'


# Creative mode configurations
CREATIVE_MODE_CONFIGS: Dict[str, CreativeModeConfig] = {
    CreativeMode.LIGHT.value: CreativeModeConfig(
        temperature_ideation=0.9,
        temperature_analysis=0.3,
        neighbors=8,
        ideas_count=5,
        braintrust_loops=1,
        min_similarity_score=0.5,
        compliance_strictness="lenient"
    ),
    CreativeMode.STANDARD.value: CreativeModeConfig(
        temperature_ideation=1.0,
        temperature_analysis=0.3,
        neighbors=10,
        ideas_count=10,
        braintrust_loops=1,
        min_similarity_score=0.4,
        compliance_strictness="standard"
    ),
    CreativeMode.DEEP.value: CreativeModeConfig(
        temperature_ideation=1.1,
        temperature_analysis=0.2,
        neighbors=16,
        ideas_count=10,
        braintrust_loops=2,
        min_similarity_score=0.35,
        compliance_strictness="strict"
    ),
}


def get_mode_config(mode: str) -> CreativeModeConfig:
    """Get configuration for a creative mode."""
    return CREATIVE_MODE_CONFIGS.get(mode, CREATIVE_MODE_CONFIGS[CreativeMode.STANDARD.value])


# Agent-specific configurations
AGENT_CONFIGS: Dict[str, Dict[str, Any]] = {
    "retriever": {
        "timeout_seconds": 30,
        "retry_count": 2,
    },
    "amazon_start": {
        "max_tokens": 2000,
        "timeout_seconds": 60,
    },
    "ideate": {
        "max_tokens": 4000,
        "timeout_seconds": 120,
    },
    "selector": {
        "max_tokens": 2000,
        "timeout_seconds": 60,
    },
    "polish": {
        "max_tokens": 3000,
        "per_script_timeout_seconds": 90,
    },
    "braintrust": {
        "max_tokens": 2500,
        "personas": [
            {
                "name": "The Craft Purist",
                "focus": "storytelling, emotional truth, craft excellence",
                "style": "demanding but constructive"
            },
            {
                "name": "The Strategist",
                "focus": "brand strategy, audience insight, commercial effectiveness",
                "style": "analytical and pragmatic"
            },
            {
                "name": "The Disruptor",
                "focus": "visual metaphor clarity, dot connection speed, mute-test pass rate, breakthrough potential",
                "style": "provocative and challenging"
            }
        ],
        "timeout_seconds": 90,
    },
    "compliance": {
        "max_tokens": 2000,
        "timeout_seconds": 60,
        "uk_specific_checks": [
            "clearcast_supers",
            "bcap_code",
            "ofcom_rules",
            "asa_guidelines"
        ],
        "sensitive_categories": [
            "alcohol",
            "gambling",
            "health",
            "finance",
            "children",
            "food",
            "environment"
        ]
    },
    "compliance_fix": {
        "max_tokens": 1500,
        "timeout_seconds": 90,
        "per_issue_timeout_seconds": 30,
    },
    "finalize": {
        "max_tokens": 3000,
        "timeout_seconds": 90,
    }
}


# Prompts configuration
SYSTEM_PROMPTS = {
    "base": """You are a senior creative director at a top UK advertising agency, 
specializing in TV commercials. You have won multiple awards including D&AD Pencils, 
Cannes Lions, and British Arrows. You understand both the creative craft and the 
commercial realities of TV advertising.""",

    "amazon_start": """Using Amazon's "Working Backwards" methodology, create a press release 
for this TV ad campaign as if it has already been completed and won awards. This should 
clarify the vision and success criteria before creative development begins.""",

    "ideate": """Generate distinct, original TV ad concepts. Each concept should have a 
clear narrative hook, emotional journey, and memorable payoff. Think cinematically - 
these are 30-second films, not just product demos. Draw inspiration from the provided 
reference ads but create something genuinely new.""",

    "selector": """As a senior ECD, evaluate the submitted concepts against the brief. 
Select the top 3 that best balance: brand fit, creative ambition, producibility within 
budget, and potential for effectiveness. Explain your reasoning.""",

    "polish": """Develop the selected concepts into production-ready scripts. Include 
precise timing, visual descriptions, audio direction, and talent notes. These scripts 
should be ready to share with a director for quoting.""",

    "braintrust": """You are part of a creative review panel. Provide honest, constructive 
feedback on the script from your specific perspective. Be specific about what works and 
what doesn't. Your goal is to make the work better, not just critique it.""",

    "compliance": """Review the script for UK TV advertising compliance. Check against 
Clearcast requirements, BCAP Code, and Ofcom broadcasting rules. Flag any potential 
issues with claims, visual treatments, or content that may need substantiation or 
modification for broadcast approval.""",

    "finalize": """Based on all feedback and compliance checks, produce the final 
recommended script with production notes. Explain why this is the winning concept 
and provide guidance for the production team."""
}


# Default values for missing brief fields
BRIEF_DEFAULTS = {
    "budget_range": "£100k-250k",
    "length_seconds": 30,
    "compliance_requirements": "compliance categories: none explicitly specified"
}








