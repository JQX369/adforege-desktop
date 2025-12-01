"""Utility functions for Gemini API model management"""

import asyncio
import logging
import google.generativeai as genai
from typing import Optional, Any

logger = logging.getLogger(__name__)


def safe_get_response_text(response: Any) -> Optional[str]:
    """
    Safely extract text from a Gemini response, handling safety blocks.
    
    When Gemini returns a safety-blocked response (finish_reason=2), accessing
    response.text throws an exception. This function handles that gracefully.
    
    Args:
        response: The Gemini GenerateContentResponse object
        
    Returns:
        The response text if available, None if blocked or empty
    """
    if not response:
        return None
    
    try:
        # First check if there are any candidates
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            
            # Check finish_reason - 2 means SAFETY block
            if hasattr(candidate, 'finish_reason'):
                finish_reason = candidate.finish_reason
                # finish_reason values: 1=STOP (normal), 2=SAFETY, 3=RECITATION, etc.
                if finish_reason == 2:
                    logger.warning("Gemini response blocked due to safety filters")
                    return None
                elif finish_reason not in (0, 1):  # 0=UNSPECIFIED, 1=STOP
                    logger.warning(f"Gemini response has unusual finish_reason: {finish_reason}")
        
        # Try to get the text
        if response.text:
            return response.text.strip()
            
    except ValueError as e:
        # This catches the "Invalid operation: response.text requires valid Part" error
        error_msg = str(e)
        if 'finish_reason' in error_msg:
            logger.warning(f"Gemini response blocked: {error_msg}")
        else:
            logger.warning(f"Failed to extract response text: {error_msg}")
        return None
    except Exception as e:
        logger.warning(f"Unexpected error extracting response text: {e}")
        return None
    
    return None

# Model preferences in order of preference
# Use latest available models from the API
# Note: Model names should NOT include 'models/' prefix - the library handles it
MODEL_PREFERENCES = {
    'pro': ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-pro-latest', 'gemini-2.0-pro-exp'],
    'flash': ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash']
}

def get_available_model(model_type: str = 'pro', api_key: Optional[str] = None) -> Optional[str]:
    """
    Get an available Gemini model name, trying preferred models in order.
    
    Args:
        model_type: 'pro' for high-quality models, 'flash' for faster models
        api_key: Optional API key (if None, uses configured key)
        
    Returns:
        Model name string if available, None otherwise
    """
    if api_key:
        genai.configure(api_key=api_key)
    
    models_to_try = MODEL_PREFERENCES.get(model_type, MODEL_PREFERENCES['pro'])
    
    # First, try to get available models from API
    try:
        available_models = genai.list_models()
        available_model_names = {m.name.replace('models/', '') for m in available_models 
                                 if 'generateContent' in m.supported_generation_methods}
        
        # Try preferred models in order
        for model_name in models_to_try:
            if model_name in available_model_names:
                logger.info(f"Found available Gemini model: {model_name}")
                return model_name
        
        # If preferred models not found, try to find any matching model
        for model_name in models_to_try:
            # Try partial matches (e.g., 'gemini-2.5-pro' matches 'gemini-2.5-pro-preview-03-25')
            matching = [m for m in available_model_names if model_name in m or m.startswith(model_name.split('-')[0])]
            if matching:
                # Prefer non-preview versions
                stable = [m for m in matching if 'preview' not in m and 'exp' not in m]
                if stable:
                    selected = stable[0]
                else:
                    selected = matching[0]
                logger.info(f"Found matching Gemini model: {selected} (preferred: {model_name})")
                return selected
    except Exception as e:
        logger.warning(f"Could not list available models: {e}. Falling back to direct instantiation.")
    
    # Fallback: try direct instantiation
    for model_name in models_to_try:
        try:
            test_model = genai.GenerativeModel(model_name)
            logger.info(f"Found available Gemini model: {model_name}")
            return model_name
        except Exception as e:
            error_str = str(e).lower()
            if 'not found' in error_str or '404' in error_str or 'not supported' in error_str:
                logger.debug(f"Model {model_name} not available: {e}")
                continue
    
    logger.warning(f"No available {model_type} model found. Tried: {models_to_try}")
    return None

def create_gemini_model(model_type: str = 'pro', api_key: Optional[str] = None, fallback_to_pro: bool = True):
    """
    Create a Gemini model instance with automatic fallback.
    
    Args:
        model_type: 'pro' for high-quality models, 'flash' for faster models
        api_key: Optional API key (if None, uses configured key)
        fallback_to_pro: If True, fallback to 'pro' if 'flash' not available
        
    Returns:
        GenerativeModel instance or None if no models available
    """
    if api_key:
        genai.configure(api_key=api_key)
    
    model_name = get_available_model(model_type, api_key)
    
    # Fallback logic
    if not model_name and model_type == 'flash' and fallback_to_pro:
        logger.info("Flash model not available, falling back to pro model")
        model_name = get_available_model('pro', api_key)
    
    if model_name:
        try:
            return genai.GenerativeModel(model_name)
        except Exception as e:
            logger.error(f"Failed to create model {model_name}: {e}")
            return None
    
    return None


# Safety settings to reduce false positive blocks on advertising content
# Using BLOCK_ONLY_HIGH allows most legitimate content through while still blocking harmful content
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
]


async def generate_with_timeout(
    model,
    prompt: str,
    generation_config: Any,
    timeout_seconds: float = 60.0,
    safety_settings: list = None
) -> Optional[str]:
    """
    Async Gemini call with timeout enforcement.

    Wraps the synchronous generate_content() call in asyncio.to_thread()
    and applies a timeout to prevent indefinite hangs.

    Args:
        model: The Gemini GenerativeModel instance
        prompt: The prompt string to send
        generation_config: Gemini GenerationConfig object
        timeout_seconds: Maximum time to wait for response (default 60s)
        safety_settings: Optional safety settings (defaults to BLOCK_ONLY_HIGH)

    Returns:
        The response text if successful, None if timed out or blocked
    """
    if not model:
        logger.warning("generate_with_timeout called with None model")
        return None

    # Use default safety settings if not provided
    if safety_settings is None:
        safety_settings = SAFETY_SETTINGS

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(
                model.generate_content,
                prompt,
                generation_config=generation_config,
                safety_settings=safety_settings
            ),
            timeout=timeout_seconds
        )
        return safe_get_response_text(response)
    except asyncio.TimeoutError:
        logger.error(f"Gemini API call timed out after {timeout_seconds}s")
        return None
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        return None

