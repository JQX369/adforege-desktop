"""Utility functions for Gemini API model management"""

import logging
import google.generativeai as genai
from typing import Optional

logger = logging.getLogger(__name__)

# Model preferences in order of preference
# Use latest available models from the API
# Note: Model names should NOT include 'models/' prefix - the library handles it
MODEL_PREFERENCES = {
    'pro': ['gemini-2.5-pro', 'gemini-pro-latest', 'gemini-2.0-pro-exp'],
    'flash': ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash']
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

