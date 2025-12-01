"""
Brand Discovery Agent - Extracts brand context from website.

Scrapes homepage, about page, and products page to extract:
- Brand name and tagline
- Products/services offered
- Brand voice and tone
- Key messaging and values
- Visual identity hints (colors mentioned)
"""

import logging
import re
import asyncio
from typing import TYPE_CHECKING, Optional, Dict, Any, List
from urllib.parse import urljoin, urlparse

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, generate_with_timeout, safe_get_response_text

if TYPE_CHECKING:
    from ..types import AdScriptRun, BrandDiscoveryResult
    from ..config import CreativeModeConfig

logger = logging.getLogger(__name__)

# Try to import httpx for async HTTP requests
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    logger.warning("httpx not installed - brand discovery will be limited")

# Try to import BeautifulSoup for HTML parsing
try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False
    logger.warning("beautifulsoup4 not installed - brand discovery will be limited")


BRAND_ANALYSIS_PROMPT = """You are a brand strategist analyzing a company's website content.

Based on the following website content, extract key brand information:

## Website Content:
{website_content}

---

Analyze this content and provide a structured brand profile. Be specific and quote actual text where relevant.

RESPOND WITH VALID JSON ONLY:
```json
{{
    "brand_name": "The official brand name",
    "tagline": "The brand's tagline or slogan if present",
    "products_services": ["List of main products or services offered"],
    "brand_voice": "Description of the brand's tone and communication style (e.g., professional, playful, authoritative)",
    "key_messages": ["Core messages or value propositions from the content"],
    "target_audience_hints": "Who the brand appears to be targeting based on the content",
    "brand_values": ["Values or principles the brand emphasizes"],
    "visual_identity_hints": {{
        "colors_mentioned": ["Any colors mentioned or implied"],
        "style_descriptors": ["Words describing visual style - modern, classic, bold, etc."]
    }},
    "competitive_positioning": "How the brand positions itself vs competitors if mentioned",
    "call_to_action_style": "How the brand typically asks users to take action"
}}
```
"""


async def fetch_page_content(url: str, timeout: float = 10.0) -> Optional[str]:
    """Fetch and extract text content from a URL."""
    if not HTTPX_AVAILABLE or not BS4_AVAILABLE:
        logger.warning("Required libraries not available for web scraping")
        return None
    
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; AdScriptLab/1.0; +https://adforge.ai)"
            }
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for element in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript']):
                element.decompose()
            
            # Get text content
            text = soup.get_text(separator='\n', strip=True)
            
            # Clean up excessive whitespace
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            text = '\n'.join(lines)
            
            # Limit to reasonable size
            if len(text) > 15000:
                text = text[:15000] + "\n[Content truncated...]"
            
            return text
            
    except Exception as e:
        logger.warning("Failed to fetch %s: %s", url, str(e))
        return None


def find_page_urls(base_url: str, html_content: str) -> Dict[str, Optional[str]]:
    """Find about and products page URLs from homepage HTML."""
    if not BS4_AVAILABLE:
        return {"about": None, "products": None}
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        about_patterns = ['about', 'about-us', 'our-story', 'who-we-are', 'company']
        products_patterns = ['products', 'services', 'solutions', 'what-we-do', 'offerings', 'shop']
        
        about_url = None
        products_url = None
        
        for link in soup.find_all('a', href=True):
            href = link['href'].lower()
            text = link.get_text().lower()
            
            # Check for about page
            if not about_url:
                for pattern in about_patterns:
                    if pattern in href or pattern in text:
                        about_url = urljoin(base_url, link['href'])
                        break
            
            # Check for products page
            if not products_url:
                for pattern in products_patterns:
                    if pattern in href or pattern in text:
                        products_url = urljoin(base_url, link['href'])
                        break
            
            if about_url and products_url:
                break
        
        return {"about": about_url, "products": products_url}
        
    except Exception as e:
        logger.warning("Failed to parse URLs: %s", str(e))
        return {"about": None, "products": None}


async def scrape_website(url: str) -> Dict[str, str]:
    """Scrape homepage, about, and products pages."""
    if not HTTPX_AVAILABLE or not BS4_AVAILABLE:
        return {"error": "Web scraping libraries not available"}
    
    # Normalize URL
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    results = {}
    
    # Fetch homepage
    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; AdScriptLab/1.0; +https://adforge.ai)"
            }
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            homepage_html = response.text
            
            # Extract text from homepage
            soup = BeautifulSoup(homepage_html, 'html.parser')
            for element in soup(['script', 'style', 'nav', 'footer', 'noscript']):
                element.decompose()
            
            homepage_text = soup.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in homepage_text.split('\n') if line.strip()]
            results["homepage"] = '\n'.join(lines[:200])  # First 200 lines
            
            # Find about and products pages
            page_urls = find_page_urls(base_url, homepage_html)
            
    except Exception as e:
        logger.error("Failed to fetch homepage %s: %s", url, str(e))
        return {"error": f"Failed to fetch website: {str(e)}"}
    
    # Fetch about page
    if page_urls.get("about"):
        about_content = await fetch_page_content(page_urls["about"])
        if about_content:
            results["about"] = about_content[:5000]
    
    # Fetch products page
    if page_urls.get("products"):
        products_content = await fetch_page_content(page_urls["products"])
        if products_content:
            results["products"] = products_content[:5000]
    
    return results


async def run_brand_discovery(
    website_url: str,
    config: Optional["CreativeModeConfig"] = None
) -> Dict[str, Any]:
    """
    Discover brand information from a website URL.
    
    Returns a dictionary with brand information extracted from the website.
    """
    logger.info("Starting brand discovery for: %s", website_url)
    
    # Scrape website content
    scraped = await scrape_website(website_url)
    
    if "error" in scraped:
        logger.warning("Web scraping failed: %s", scraped["error"])
        return {
            "success": False,
            "error": scraped["error"],
            "brand_name": "",
            "tagline": "",
            "products_services": [],
            "brand_voice": "",
            "key_messages": [],
            "brand_context": ""
        }
    
    if not scraped:
        return {
            "success": False,
            "error": "No content retrieved from website",
            "brand_name": "",
            "tagline": "",
            "products_services": [],
            "brand_voice": "",
            "key_messages": [],
            "brand_context": ""
        }
    
    # Combine scraped content
    combined_content = []
    if "homepage" in scraped:
        combined_content.append(f"=== HOMEPAGE ===\n{scraped['homepage']}")
    if "about" in scraped:
        combined_content.append(f"=== ABOUT PAGE ===\n{scraped['about']}")
    if "products" in scraped:
        combined_content.append(f"=== PRODUCTS/SERVICES PAGE ===\n{scraped['products']}")
    
    website_content = "\n\n".join(combined_content)
    
    # Use Gemini to analyze the content
    try:
        model = create_gemini_model('flash')  # Use flash for speed
        if not model:
            logger.warning("No Gemini model available for brand analysis")
            return {
                "success": False,
                "error": "AI model not available",
                "brand_name": "",
                "raw_content": website_content[:2000]
            }
        
        prompt = BRAND_ANALYSIS_PROMPT.format(website_content=website_content)

        generation_config = genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=2000,
        )

        # Use timeout wrapper with safety settings to avoid blocks on legitimate content
        text = await generate_with_timeout(model, prompt, generation_config, timeout_seconds=30)
        
        if text:
            # Extract JSON from markdown code blocks if present
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
            if json_match:
                text = json_match.group(1)
            
            import json
            try:
                result = json.loads(text)
                result["success"] = True
                
                # Build brand_context string for use in other agents
                context_parts = []
                if result.get("brand_name"):
                    context_parts.append(f"Brand: {result['brand_name']}")
                if result.get("tagline"):
                    context_parts.append(f"Tagline: {result['tagline']}")
                if result.get("products_services"):
                    context_parts.append(f"Products/Services: {', '.join(result['products_services'][:5])}")
                if result.get("brand_voice"):
                    context_parts.append(f"Brand Voice: {result['brand_voice']}")
                if result.get("key_messages"):
                    context_parts.append(f"Key Messages: {'; '.join(result['key_messages'][:3])}")
                if result.get("target_audience_hints"):
                    context_parts.append(f"Target Audience Hints: {result['target_audience_hints']}")
                if result.get("brand_values"):
                    context_parts.append(f"Brand Values: {', '.join(result['brand_values'][:5])}")
                
                result["brand_context"] = "\n".join(context_parts)
                
                logger.info("Brand discovery complete: %s", result.get("brand_name", "Unknown"))
                return result
                
            except json.JSONDecodeError as e:
                logger.warning("Failed to parse brand analysis JSON: %s", str(e))
                return {
                    "success": False,
                    "error": "Failed to parse AI response",
                    "raw_response": text[:1000]
                }
        else:
            return {
                "success": False,
                "error": "Empty or blocked response from AI"
            }
            
    except Exception as e:
        logger.error("Brand discovery failed: %s", str(e))
        return {
            "success": False,
            "error": str(e)
        }


