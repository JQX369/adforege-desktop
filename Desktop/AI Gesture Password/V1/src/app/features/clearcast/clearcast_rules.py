"""
Industry-Specific Clearcast Rule Profiles

Pre-defined rule sets for common advertising categories to enable
faster, more targeted compliance checking.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass


@dataclass
class ClearcastRulesSnapshot:
    """Snapshot of Clearcast rules for prompt building."""
    version_id: str
    last_checked: Optional[str]
    source_document: Optional[str]
    rules: List[Dict[str, Any]]
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ClearcastRulesSnapshot":
        """Create from dictionary (e.g., loaded from JSON)."""
        snapshot = data.get("snapshot", {})
        return cls(
            version_id=snapshot.get("version_id", "v1.0.0"),
            last_checked=snapshot.get("last_checked"),
            source_document=snapshot.get("source_document"),
            rules=snapshot.get("rules", []),
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "version_id": self.version_id,
            "last_checked": self.last_checked,
            "source_document": self.source_document,
            "rules": self.rules,
        }


@dataclass
class IndustryProfile:
    """Profile for an industry with its specific rules and keywords."""
    name: str
    bcap_codes: List[str]
    keywords: List[str]
    high_risk_areas: List[str]
    common_issues: List[str]
    required_disclaimers: List[str]


# Industry profile definitions
INDUSTRY_PROFILES: Dict[str, IndustryProfile] = {
    "alcohol": IndustryProfile(
        name="Alcohol",
        bcap_codes=["BCAP 19.1", "BCAP 19.2", "BCAP 19.3", "BCAP 19.4", "BCAP 19.5", 
                    "BCAP 19.6", "BCAP 19.7", "BCAP 19.8", "BCAP 19.9", "BCAP 19.10",
                    "BCAP 19.11", "BCAP 19.12", "BCAP 19.13", "BCAP 19.14", "BCAP 19.15"],
        keywords=["alcohol", "beer", "wine", "spirits", "vodka", "gin", "whisky", "rum",
                  "champagne", "cocktail", "drink", "pub", "bar", "brewery", "distillery",
                  "ABV", "units", "drunk", "intoxicated"],
        high_risk_areas=[
            "Appeal to under-18s",
            "Association with social/sexual success",
            "Encouraging immoderate consumption",
            "Linking to driving or machinery",
            "Therapeutic or energising claims",
            "Featuring people who appear under 25"
        ],
        common_issues=[
            "Actors appearing under 25 (must be 25+)",
            "Implying alcohol enhances mood/performance",
            "Showing excessive drinking",
            "Missing Drinkaware URL"
        ],
        required_disclaimers=["drinkaware.co.uk"]
    ),
    
    "gambling": IndustryProfile(
        name="Gambling",
        bcap_codes=["BCAP 17.1", "BCAP 17.2", "BCAP 17.3", "BCAP 17.4", "BCAP 17.5",
                    "BCAP 17.6", "BCAP 17.7", "BCAP 17.8", "BCAP 17.9", "BCAP 17.10"],
        keywords=["bet", "betting", "gamble", "gambling", "casino", "odds", "bookie",
                  "wager", "stake", "jackpot", "lottery", "slots", "poker", "roulette",
                  "sports betting", "free bet", "bonus"],
        high_risk_areas=[
            "Appeal to under-18s",
            "Suggesting gambling can solve problems",
            "Featuring celebrities/sports stars",
            "Trivialising gambling",
            "Peer pressure to gamble",
            "Missing responsible gambling messaging"
        ],
        common_issues=[
            "Missing BeGambleAware.org",
            "Implying skill where luck is involved",
            "Portraying urgency unduly",
            "Using complex T&Cs"
        ],
        required_disclaimers=["BeGambleAware.org", "18+", "T&Cs apply"]
    ),
    
    "food_supplements": IndustryProfile(
        name="Food & Supplements",
        bcap_codes=["BCAP 13.1", "BCAP 13.2", "BCAP 13.3", "BCAP 13.4", "BCAP 13.5",
                    "BCAP 13.6", "BCAP 13.7", "BCAP 15.1", "BCAP 15.2"],
        keywords=["food", "nutrition", "vitamin", "supplement", "healthy", "diet",
                  "weight loss", "slimming", "low fat", "sugar free", "organic",
                  "natural", "superfood", "protein", "calories"],
        high_risk_areas=[
            "Unsubstantiated health claims",
            "Claims requiring EFSA approval",
            "Weight loss miracle claims",
            "HFSS product restrictions",
            "Misleading 'natural' claims"
        ],
        common_issues=[
            "Health claims not on EU register",
            "Before/after weight loss imagery",
            "Implying medicinal benefits",
            "Targeting children with HFSS"
        ],
        required_disclaimers=[]
    ),
    
    "financial": IndustryProfile(
        name="Financial Services",
        bcap_codes=["BCAP 14.1", "BCAP 14.2", "BCAP 14.3", "BCAP 14.4", "BCAP 14.5",
                    "BCAP 14.6", "BCAP 14.7", "BCAP 14.8"],
        keywords=["loan", "credit", "mortgage", "APR", "interest", "bank", "invest",
                  "savings", "insurance", "pension", "ISA", "debt", "borrow",
                  "repayment", "finance", "crypto", "trading"],
        high_risk_areas=[
            "Misleading representative APR",
            "Hiding risk warnings",
            "Unclear terms and conditions",
            "Targeting vulnerable consumers",
            "Crypto/trading risk warnings"
        ],
        common_issues=[
            "APR not prominent enough",
            "Risk warnings too small/fast",
            "Capital at risk messaging missing",
            "Comparison claims unsubstantiated"
        ],
        required_disclaimers=["FCA regulated", "Capital at risk (investments)", 
                              "Representative APR (credit)"]
    ),
    
    "automotive": IndustryProfile(
        name="Automotive",
        bcap_codes=["BCAP 20.1", "BCAP 20.2", "BCAP 20.3", "BCAP 20.4"],
        keywords=["car", "vehicle", "drive", "driving", "road", "speed", "mph",
                  "acceleration", "performance", "engine", "fuel", "electric",
                  "EV", "hybrid", "emissions", "safety"],
        high_risk_areas=[
            "Encouraging unsafe driving",
            "Misleading environmental claims",
            "Glorifying speed",
            "Showing illegal driving behaviour"
        ],
        common_issues=[
            "Showing unsafe driving",
            "Misleading range/efficiency claims",
            "Environmental greenwashing",
            "Missing safety disclaimers for stunts"
        ],
        required_disclaimers=["Professional driver on closed road (if applicable)",
                              "WLTP range figures"]
    ),
    
    "children_products": IndustryProfile(
        name="Children's Products",
        bcap_codes=["BCAP 5.1", "BCAP 5.2", "BCAP 5.3", "BCAP 5.4", "BCAP 5.5",
                    "BCAP 5.6", "BCAP 5.7", "BCAP 5.8"],
        keywords=["children", "kids", "toys", "games", "play", "school",
                  "parents", "family", "educational", "learning", "fun"],
        high_risk_areas=[
            "Exploiting children's credulity",
            "Pester power encouragement",
            "Inappropriate content for age",
            "Unsafe behaviour portrayal",
            "HFSS food targeting"
        ],
        common_issues=[
            "Exaggerating toy capabilities",
            "Encouraging anti-social behaviour",
            "Inappropriate influencer content",
            "Missing age recommendations"
        ],
        required_disclaimers=["Age recommendations where applicable",
                              "Batteries not included (if applicable)"]
    ),
    
    "cosmetics_beauty": IndustryProfile(
        name="Cosmetics & Beauty",
        bcap_codes=["BCAP 12.1", "BCAP 12.2", "BCAP 12.3"],
        keywords=["beauty", "cosmetic", "skin", "skincare", "makeup", "anti-aging",
                  "wrinkles", "moisturiser", "serum", "hair", "shampoo", "perfume",
                  "fragrance", "clinically proven"],
        high_risk_areas=[
            "Medicinal claims (requires license)",
            "Digitally enhanced imagery",
            "Unsubstantiated efficacy claims",
            "Misleading 'clinical' claims"
        ],
        common_issues=[
            "Before/after digitally altered",
            "Medicinal claims without evidence",
            "Exaggerated transformation claims",
            "Missing 'results may vary'"
        ],
        required_disclaimers=["Enhanced in post-production (if digitally altered)"]
    ),
    
    "pharmaceutical_healthcare": IndustryProfile(
        name="Pharmaceutical & Healthcare",
        bcap_codes=["BCAP 11.1", "BCAP 11.2", "BCAP 11.3", "BCAP 11.4", "BCAP 11.5",
                    "BCAP 11.6", "BCAP 11.7", "BCAP 11.8"],
        keywords=["medicine", "drug", "treatment", "cure", "remedy", "symptom",
                  "disease", "illness", "pain relief", "pharmacy", "prescription",
                  "over the counter", "OTC"],
        high_risk_areas=[
            "Claims requiring medical evidence",
            "Targeting children inappropriately",
            "Encouraging self-diagnosis",
            "Prescription-only products"
        ],
        common_issues=[
            "Unsubstantiated efficacy claims",
            "Missing 'always read the label'",
            "Inappropriate celebrity endorsement",
            "Suggesting rapid/guaranteed results"
        ],
        required_disclaimers=["Always read the label", 
                              "Contains [active ingredient]",
                              "If symptoms persist, see your doctor"]
    ),
    
    "telecoms_broadband": IndustryProfile(
        name="Telecoms & Broadband",
        bcap_codes=["BCAP 3.1", "BCAP 3.2", "BCAP 3.3"],
        keywords=["broadband", "wifi", "internet", "mobile", "5G", "4G", "data",
                  "unlimited", "speed", "Mbps", "download", "coverage", "signal",
                  "contract", "SIM"],
        high_risk_areas=[
            "Misleading speed claims",
            "Coverage exaggeration",
            "'Unlimited' with fair use limits",
            "Hidden costs in contracts"
        ],
        common_issues=[
            "Average speed vs headline speed",
            "Geographic coverage limitations",
            "Contract terms not prominent",
            "Price increases hidden"
        ],
        required_disclaimers=["Average speeds", "Fair usage policy applies"]
    ),
    
    "environmental_eco": IndustryProfile(
        name="Environmental/Eco Claims",
        bcap_codes=["BCAP 9.1", "BCAP 9.2", "BCAP 9.3", "BCAP 9.4", "BCAP 9.5"],
        keywords=["eco", "green", "sustainable", "carbon neutral", "net zero",
                  "recyclable", "recycled", "biodegradable", "plastic free",
                  "organic", "natural", "environment", "climate"],
        high_risk_areas=[
            "Greenwashing",
            "Unsubstantiated eco claims",
            "Misleading 'carbon neutral'",
            "Partial lifecycle claims"
        ],
        common_issues=[
            "Claims applying to packaging not product",
            "Missing evidence for environmental benefit",
            "Vague 'eco-friendly' claims",
            "Carbon offset vs actual reduction"
        ],
        required_disclaimers=[]
    ),
}


def detect_industry(
    product_name: Optional[str] = None,
    brand_name: Optional[str] = None,
    script_text: Optional[str] = None,
    ai_breakdown: Optional[Dict] = None
) -> List[str]:
    """
    Auto-detect relevant industries based on available information.
    
    Args:
        product_name: Detected product name
        brand_name: Detected brand name
        script_text: Transcript of the ad
        ai_breakdown: AI breakdown result with detected categories
        
    Returns:
        List of industry profile keys that may apply
    """
    detected = []
    
    # Combine all text for keyword matching
    search_text = " ".join([
        product_name or "",
        brand_name or "",
        script_text or "",
        str(ai_breakdown.get("breakdown", {}).get("key_messages", [])) if ai_breakdown else "",
        str(ai_breakdown.get("summary", "")) if ai_breakdown else ""
    ]).lower()
    
    # Score each industry by keyword matches
    scores: Dict[str, int] = {}
    
    for industry_key, profile in INDUSTRY_PROFILES.items():
        score = 0
        for keyword in profile.keywords:
            if keyword.lower() in search_text:
                score += 1
        
        if score > 0:
            scores[industry_key] = score
    
    # Return industries with at least 2 keyword matches, sorted by score
    detected = [k for k, v in sorted(scores.items(), key=lambda x: x[1], reverse=True) if v >= 2]
    
    return detected


def get_profile(industry_key: str) -> Optional[IndustryProfile]:
    """Get a specific industry profile."""
    return INDUSTRY_PROFILES.get(industry_key)


def get_combined_keywords(industries: List[str]) -> List[str]:
    """Get combined keywords for multiple industries."""
    keywords = set()
    for industry_key in industries:
        profile = INDUSTRY_PROFILES.get(industry_key)
        if profile:
            keywords.update(profile.keywords)
    return list(keywords)


def get_relevant_bcap_codes(industries: List[str]) -> List[str]:
    """Get all relevant BCAP codes for detected industries."""
    codes = set()
    for industry_key in industries:
        profile = INDUSTRY_PROFILES.get(industry_key)
        if profile:
            codes.update(profile.bcap_codes)
    return sorted(codes)


def get_high_risk_summary(industries: List[str]) -> str:
    """Generate a summary of high-risk areas for the prompt."""
    areas = []
    for industry_key in industries:
        profile = INDUSTRY_PROFILES.get(industry_key)
        if profile:
            areas.append(f"\n{profile.name}:")
            for area in profile.high_risk_areas:
                areas.append(f"  - {area}")
    
    if not areas:
        return ""
    
    return "HIGH-RISK AREAS FOR THIS AD:\n" + "\n".join(areas)


__all__ = [
    "INDUSTRY_PROFILES",
    "IndustryProfile",
    "ClearcastRulesSnapshot",
    "detect_industry",
    "get_profile",
    "get_combined_keywords",
    "get_relevant_bcap_codes",
    "get_high_risk_summary",
]
