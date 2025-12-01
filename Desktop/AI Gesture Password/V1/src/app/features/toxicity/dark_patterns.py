"""
Dark Pattern Detection for Psychological Manipulation Scoring

Detects manipulative language patterns in ad transcripts using:
1. Regex patterns for common dark patterns
2. Categories: False Scarcity, Shaming, Forced Continuity

Each category adds points to the psychological manipulation score.
"""

import re
import logging
from dataclasses import dataclass, field
from typing import List, Set, Tuple, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class DarkPatternMatch:
    """A detected dark pattern in the transcript."""
    category: str
    pattern_name: str
    matched_text: str
    confidence: float = 1.0
    source: str = "regex"  # "regex" or "ai"
    reasoning: Optional[str] = None


# Pattern categories and their regex patterns
DARK_PATTERN_CATEGORIES: Dict[str, List[Tuple[str, str]]] = {
    "false_scarcity": [
        (r"only\s+\d+\s+left", "limited quantity"),
        (r"selling\s+out\s*(fast)?", "selling out"),
        (r"limited\s+time\s+(offer|only|deal)?", "limited time"),
        (r"act\s+now", "urgency"),
        (r"hurry\s+(up)?", "urgency"),
        (r"expires?\s+soon", "expiration pressure"),
        (r"while\s+supplies?\s+last", "supply pressure"),
        (r"don'?t\s+miss\s+(out|this)", "FOMO"),
        (r"last\s+chance", "finality pressure"),
        (r"before\s+it'?s?\s+(too\s+)?late", "deadline pressure"),
        (r"running\s+out", "scarcity"),
        (r"almost\s+gone", "scarcity"),
        (r"for\s+a\s+limited\s+time", "time pressure"),
        (r"ending\s+soon", "deadline"),
        (r"today\s+only", "daily deadline"),
        (r"one\s+day\s+only", "daily deadline"),
        (r"flash\s+sale", "urgency sale"),
    ],
    
    "shaming": [
        (r"don'?t\s+be\s+(stupid|dumb|foolish|an?\s+idiot)", "intelligence shaming"),
        (r"if\s+you\s+(really\s+)?care\s+about", "guilt trip"),
        (r"you\s+deserve\s+(better|more|this)", "entitlement appeal"),
        (r"aren'?t\s+you\s+tired\s+of", "frustration exploitation"),
        (r"stop\s+(being\s+)?(a\s+)?(loser|failure|broke)", "status shaming"),
        (r"real\s+(men|women|adults)\s+(do|use|buy)", "gender shaming"),
        (r"don'?t\s+you\s+want\s+to\s+be", "aspiration pressure"),
        (r"what\s+are\s+you\s+waiting\s+for", "inaction shaming"),
        (r"you'?re\s+missing\s+out", "FOMO shaming"),
        (r"everyone\s+(else\s+)?is\s+(doing|using|buying)", "social proof pressure"),
        (r"why\s+haven'?t\s+you", "delay shaming"),
        (r"you'?re\s+(still|already)\s+(not|using)", "status quo shaming"),
    ],
    
    "forced_continuity": [
        (r"free\s+trial\s*\*?", "hidden subscription"),
        (r"auto[-\s]?ship", "automatic shipping"),
        (r"cancel\s+any\s*time\s*\*?", "cancellation downplay"),
        (r"no\s+commitment\s*\*?", "commitment downplay"),
        (r"subscribe\s+and\s+save", "subscription push"),
        (r"membership\s+(required|included)", "forced membership"),
        (r"recurring\s+(billing|payment|charge)", "recurring charge"),
        (r"automatically\s+(renew|bill|charge)", "auto-renewal"),
        (r"continuous\s+(service|delivery)", "continuous billing"),
        (r"easy\s+to\s+cancel\s*\*?", "cancellation downplay"),
        (r"no\s+strings\s+attached\s*\*?", "hidden terms downplay"),
    ],
    
    "fear_appeal": [
        (r"before\s+it'?s\s+too\s+late", "urgency fear"),
        (r"protect\s+(yourself|your\s+family)", "safety fear"),
        (r"don'?t\s+(let|risk|wait)", "negative consequence"),
        (r"what\s+if\s+(something\s+)?happens?", "hypothetical fear"),
        (r"you\s+could\s+(lose|miss|fail)", "loss aversion"),
        (r"the\s+clock\s+is\s+ticking", "time pressure"),
        (r"you'?re\s+at\s+risk", "risk fear"),
        (r"dangerous", "danger appeal"),
        (r"deadly", "extreme fear"),
        (r"threat", "threat language"),
    ],
    
    "emotional_manipulation": [
        (r"your\s+(kids?|children|family)\s+(need|deserve)", "family guilt"),
        (r"for\s+(the\s+sake\s+of|your)\s+(kids?|children|family)", "family leverage"),
        (r"don'?t\s+(disappoint|let\s+down)", "disappointment fear"),
        (r"make\s+(them|her|him)\s+proud", "approval seeking"),
        (r"they'?ll\s+(love|thank)\s+you", "reward promise"),
        (r"show\s+(them|her|him)\s+(you\s+care|how\s+much)", "proof of love"),
        (r"because\s+you'?re\s+worth\s+it", "self-worth appeal"),
        (r"you'?ve\s+earned\s+(this|it)", "entitlement"),
        (r"treat\s+yourself", "self-indulgence"),
    ],
}

# Points per category (capped at 3 categories = 30 points)
POINTS_PER_CATEGORY = 10
MAX_CATEGORY_POINTS = 30


def detect_dark_patterns(
    transcript: str,
    include_all_matches: bool = False
) -> Tuple[List[DarkPatternMatch], Set[str], int]:
    """
    Detect dark patterns in a transcript using regex matching.
    
    Args:
        transcript: The ad transcript text to analyze
        include_all_matches: If True, return all matches; if False, return unique categories only
        
    Returns:
        Tuple of:
        - List of DarkPatternMatch objects
        - Set of unique categories detected
        - Score contribution (points)
    """
    if not transcript:
        return [], set(), 0
    
    # Normalize text for matching
    text = transcript.lower()
    
    matches: List[DarkPatternMatch] = []
    categories_found: Set[str] = set()
    
    for category, patterns in DARK_PATTERN_CATEGORIES.items():
        category_matches = []
        
        for pattern_regex, pattern_name in patterns:
            try:
                regex_matches = re.finditer(pattern_regex, text, re.IGNORECASE)
                
                for match in regex_matches:
                    matched_text = match.group().strip()
                    
                    category_matches.append(DarkPatternMatch(
                        category=category,
                        pattern_name=pattern_name,
                        matched_text=matched_text,
                        confidence=1.0,
                        source="regex",
                    ))
                    categories_found.add(category)
                    
            except re.error as e:
                logger.warning(f"Invalid regex pattern '{pattern_regex}': {e}")
        
        if include_all_matches:
            matches.extend(category_matches)
        elif category_matches:
            # Just include first match per category
            matches.append(category_matches[0])
    
    # Calculate score (capped at 3 categories)
    num_categories = len(categories_found)
    score = min(num_categories * POINTS_PER_CATEGORY, MAX_CATEGORY_POINTS)
    
    logger.info(
        f"Dark pattern detection: {len(matches)} matches, "
        f"{num_categories} categories, score={score}"
    )
    
    return matches, categories_found, score


def get_category_display_name(category: str) -> str:
    """Get human-readable display name for a category."""
    display_names = {
        "false_scarcity": "False Scarcity",
        "shaming": "Shaming",
        "forced_continuity": "Forced Continuity",
        "fear_appeal": "Fear Appeal",
        "emotional_manipulation": "Emotional Manipulation",
    }
    return display_names.get(category, category.replace("_", " ").title())


def format_dark_pattern_flags(matches: List[DarkPatternMatch]) -> List[str]:
    """Format dark pattern matches as flag strings."""
    flags = []
    
    # Group by category
    by_category: Dict[str, List[DarkPatternMatch]] = {}
    for match in matches:
        if match.category not in by_category:
            by_category[match.category] = []
        by_category[match.category].append(match)
    
    for category, category_matches in by_category.items():
        display_name = get_category_display_name(category)
        source = category_matches[0].source.upper()
        examples = [m.matched_text for m in category_matches[:2]]
        
        if examples:
            flags.append(f"{display_name} Detected ({source}): \"{examples[0]}\"")
        else:
            flags.append(f"{display_name} Detected ({source})")
    
    return flags

