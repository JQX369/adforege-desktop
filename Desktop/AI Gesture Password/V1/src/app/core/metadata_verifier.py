"""
Metadata Verifier for Clearcast Compliance
Verifies Clock Number syntax, duration matching, and slate consistency.
"""

import re
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

class MetadataVerifier:
    """
    Verifies metadata compliance for broadcast delivery.
    """
    
    # Clock Number Regex: AAA/BBBB123/030
    # AAA: 3 letters (Agency Code)
    # /: Separator
    # BBBB123: 4-7 alphanumeric (Product/Item)
    # /: Separator
    # 030: 3 digits (Duration)
    CLOCK_REGEX = r"^[A-Z]{3}/[A-Z0-9]{4,7}/[0-9]{3}$"
    
    def verify_clock_syntax(self, clock_number: str) -> Tuple[bool, str]:
        """
        Verify if the clock number matches the strict AAA/BBBB123/030 format.
        """
        if not clock_number:
            return False, "Clock number is missing"
            
        clock_number = clock_number.strip().upper()
        
        if not re.match(self.CLOCK_REGEX, clock_number):
            return False, f"Invalid Clock Number format: {clock_number}. Expected format: AAA/BBBB123/030 (e.g. ABC/PROD001/030)"
            
        return True, "Clock Number format is valid"

    def verify_duration_match(self, clock_number: str, actual_duration_sec: float, tolerance: float = 0.5, allow_slate: bool = True) -> Tuple[bool, str]:
        """
        Verify if the clock number suffix matches the actual file duration.
        
        For slated masters, the file duration is typically:
        - clock_duration + 10s (standard slate)
        - clock_duration + 13s (slate + 3s black)
        - clock_duration + 20s (extended slate)
        - clock_duration + 30s (full countdown)
        
        This is VALID and should not be flagged as a mismatch.
        """
        if not clock_number:
            return False, "Clock number is missing"
            
        # Extract last 3 digits
        try:
            suffix = clock_number.split('/')[-1]
            target_duration = int(suffix)
        except (IndexError, ValueError):
            return False, "Could not extract duration from Clock Number"
            
        # Check exact match first
        diff = abs(actual_duration_sec - target_duration)
        
        if diff <= tolerance:
            return True, f"Duration matches Clock Number ({target_duration}s)"
        
        # Check if it's a slated master (file_duration = clock_duration + slate)
        # Common slate durations: 10s, 13s, 20s, 30s
        if allow_slate:
            common_slate_durations = [10, 13, 20, 30]
            for slate_dur in common_slate_durations:
                expected_slated_duration = target_duration + slate_dur
                if abs(actual_duration_sec - expected_slated_duration) <= tolerance:
                    return True, f"Duration matches Clock Number ({target_duration}s) with {slate_dur}s slate"
        
        # Also check if file is shorter but within acceptable range (e.g., trimmed)
        # Allow up to 1 second short
        if actual_duration_sec >= target_duration - 1.0 and actual_duration_sec <= target_duration + 1.0:
            return True, f"Duration approximately matches Clock Number ({target_duration}s)"
            
        return False, f"Duration mismatch: File is {actual_duration_sec:.2f}s, Clock Number implies {target_duration}s"

    def is_slated_master(self, duration_sec: float, clock_duration: Optional[int] = None) -> bool:
        """
        Heuristic to determine if a file is a slated master.
        Usually duration > clock_duration + 10s.
        """
        if not clock_duration:
            return False
            
        # Typical slate is 10s countdown + 3s black + content
        # So total ~ content + 13s
        if duration_sec >= clock_duration + 10:
            return True
            
        return False

    def extract_clock_duration(self, clock_number: str) -> Optional[int]:
        """Extract duration integer from clock number"""
        try:
            return int(clock_number.split('/')[-1])
        except (AttributeError, IndexError, ValueError):
            return None
