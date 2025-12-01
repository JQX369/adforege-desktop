"""
Unified Error Handling for Analysis Services

Provides consistent error responses across ClearcastChecker and AIVideoBreakdown.
"""

import logging
import traceback
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ErrorCode(str, Enum):
    """Standardized error codes for analysis failures."""
    
    # API/Service errors
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    API_KEY_INVALID = "API_KEY_INVALID"
    API_RATE_LIMITED = "API_RATE_LIMITED"
    API_UNAVAILABLE = "API_UNAVAILABLE"
    
    # Input errors
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    INVALID_FORMAT = "INVALID_FORMAT"
    VIDEO_TOO_LONG = "VIDEO_TOO_LONG"
    VIDEO_TOO_SHORT = "VIDEO_TOO_SHORT"
    UNSUPPORTED_CODEC = "UNSUPPORTED_CODEC"
    
    # Processing errors
    FRAME_EXTRACTION_FAILED = "FRAME_EXTRACTION_FAILED"
    AUDIO_EXTRACTION_FAILED = "AUDIO_EXTRACTION_FAILED"
    OCR_FAILED = "OCR_FAILED"
    
    # Analysis errors
    ANALYSIS_FAILED = "ANALYSIS_FAILED"
    PARSE_FAILED = "PARSE_FAILED"
    TIMEOUT = "TIMEOUT"
    
    # General
    UNKNOWN = "UNKNOWN"


# Retry suggestions by error code
RETRY_SUGGESTIONS: Dict[ErrorCode, Dict[str, Any]] = {
    ErrorCode.QUOTA_EXCEEDED: {
        "retry_after": 3600,  # 1 hour
        "message": "API quota exceeded. Please wait before retrying.",
        "recoverable": True,
    },
    ErrorCode.API_RATE_LIMITED: {
        "retry_after": 60,  # 1 minute
        "message": "Rate limited. Please wait a moment before retrying.",
        "recoverable": True,
    },
    ErrorCode.API_UNAVAILABLE: {
        "retry_after": 300,  # 5 minutes
        "message": "Service temporarily unavailable. Please try again later.",
        "recoverable": True,
    },
    ErrorCode.TIMEOUT: {
        "retry_after": 30,
        "message": "Request timed out. Please try again.",
        "recoverable": True,
    },
}


@dataclass
class AnalysisError:
    """Structured error response for analysis failures."""
    
    error: str
    error_code: ErrorCode
    retry_after: Optional[int] = None
    partial_results: Optional[Dict[str, Any]] = None
    debug_info: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response."""
        result = {
            "error": self.error,
            "error_code": self.error_code.value,
            "compliance_status": "ERROR",
            "overall_risk": "UNKNOWN",
        }
        
        if self.retry_after is not None:
            result["retry_after"] = self.retry_after
        
        if self.partial_results:
            result["partial_results"] = self.partial_results
            # Include any flags that were generated before error
            for field in ["red_flags", "yellow_flags", "blue_flags", "green_flags"]:
                if field in self.partial_results:
                    result[field] = self.partial_results[field]
        
        # Include empty flag lists if not present
        result.setdefault("red_flags", [])
        result.setdefault("yellow_flags", [])
        result.setdefault("blue_flags", [])
        result.setdefault("green_flags", [])
        result.setdefault("summary", f"Analysis failed: {self.error}")
        
        return result
    
    @classmethod
    def from_exception(
        cls, 
        exception: Exception, 
        partial_results: Optional[Dict[str, Any]] = None
    ) -> "AnalysisError":
        """Create an AnalysisError from an exception."""
        error_code = ErrorCode.UNKNOWN
        retry_after = None
        error_msg = str(exception)
        
        # Detect error type from exception message
        error_lower = error_msg.lower()
        
        if "quota" in error_lower:
            error_code = ErrorCode.QUOTA_EXCEEDED
            retry_after = 3600
        elif "rate" in error_lower and "limit" in error_lower:
            error_code = ErrorCode.API_RATE_LIMITED
            retry_after = 60
        elif "api key" in error_lower or "invalid key" in error_lower or "authentication" in error_lower:
            error_code = ErrorCode.API_KEY_INVALID
        elif "not found" in error_lower or "does not exist" in error_lower:
            error_code = ErrorCode.FILE_NOT_FOUND
        elif "timeout" in error_lower:
            error_code = ErrorCode.TIMEOUT
            retry_after = 30
        elif "unavailable" in error_lower or "503" in error_lower:
            error_code = ErrorCode.API_UNAVAILABLE
            retry_after = 300
        elif "codec" in error_lower or "format" in error_lower:
            error_code = ErrorCode.INVALID_FORMAT
        
        return cls(
            error=error_msg,
            error_code=error_code,
            retry_after=retry_after,
            partial_results=partial_results,
            debug_info={"traceback": traceback.format_exc()} if logger.isEnabledFor(logging.DEBUG) else None
        )


def handle_analysis_error(
    exception: Exception,
    analysis_type: str = "analysis",
    partial_results: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Handle an exception during analysis and return a structured error response.
    
    Args:
        exception: The caught exception
        analysis_type: Type of analysis for error message (e.g., "compliance", "AI breakdown")
        partial_results: Any results gathered before the error
        
    Returns:
        Dictionary suitable for JSON response
    """
    logger.error(f"Error during {analysis_type}: {exception}")
    
    error = AnalysisError.from_exception(exception, partial_results)
    error.error = f"Failed to complete {analysis_type}: {error.error}"
    
    return error.to_dict()


def create_error_response(
    message: str,
    error_code: ErrorCode = ErrorCode.ANALYSIS_FAILED,
    retry_after: Optional[int] = None,
    partial_results: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a structured error response.
    
    Args:
        message: Human-readable error message
        error_code: Standardized error code
        retry_after: Seconds until retry is allowed (if applicable)
        partial_results: Any results gathered before the error
        
    Returns:
        Dictionary suitable for JSON response
    """
    error = AnalysisError(
        error=message,
        error_code=error_code,
        retry_after=retry_after,
        partial_results=partial_results
    )
    return error.to_dict()


def is_retryable_error(error_code: ErrorCode) -> bool:
    """Check if an error is potentially recoverable with retry."""
    suggestion = RETRY_SUGGESTIONS.get(error_code)
    return suggestion.get("recoverable", False) if suggestion else False


def get_retry_after(error_code: ErrorCode) -> Optional[int]:
    """Get recommended retry delay for an error code."""
    suggestion = RETRY_SUGGESTIONS.get(error_code)
    return suggestion.get("retry_after") if suggestion else None


def classify_error(exc: Exception) -> Dict[str, Any]:
    """
    Classify an exception for job queue error handling.
    
    Returns a dictionary with:
    - category: The error category (quota, rate_limit, api, validation, unknown)
    - user_message: Human-readable message for UI
    - technical_details: Full error details for logging
    - retryable: Whether the job can be retried
    - retry_after: Suggested retry delay in seconds
    """
    error_msg = str(exc)
    error_lower = error_msg.lower()
    
    if "quota" in error_lower:
        return {
            "category": "quota",
            "user_message": "API quota exceeded. The job will be retried later.",
            "technical_details": error_msg,
            "retryable": True,
            "retry_after": 3600,
        }
    elif "rate" in error_lower and "limit" in error_lower:
        return {
            "category": "rate_limit",
            "user_message": "Rate limited. The job will be retried shortly.",
            "technical_details": error_msg,
            "retryable": True,
            "retry_after": 60,
        }
    elif "api key" in error_lower or "authentication" in error_lower:
        return {
            "category": "api",
            "user_message": "API authentication failed. Please check configuration.",
            "technical_details": error_msg,
            "retryable": False,
            "retry_after": None,
        }
    elif "not found" in error_lower or "does not exist" in error_lower:
        return {
            "category": "validation",
            "user_message": "The requested resource was not found.",
            "technical_details": error_msg,
            "retryable": False,
            "retry_after": None,
        }
    elif "timeout" in error_lower:
        return {
            "category": "timeout",
            "user_message": "Processing timed out. Please try again.",
            "technical_details": error_msg,
            "retryable": True,
            "retry_after": 30,
        }
    else:
        return {
            "category": "unknown",
            "user_message": "An unexpected error occurred during processing.",
            "technical_details": error_msg,
            "retryable": True,
            "retry_after": 60,
        }


__all__ = [
    "ErrorCode",
    "AnalysisError",
    "handle_analysis_error",
    "create_error_response",
    "is_retryable_error",
    "get_retry_after",
    "classify_error",
]
