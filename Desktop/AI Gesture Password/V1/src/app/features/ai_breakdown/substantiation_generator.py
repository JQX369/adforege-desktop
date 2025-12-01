"""
Substantiation Pack Generator
Generates a list of required evidence for various types of advertising claims.
"""

import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

class SubstantiationGenerator:
    """
    Maps claim types to required evidence.
    """
    
    EVIDENCE_MAP = {
        "comparative": [
            "Head-to-head clinical trial or independent test report (with published protocol)",
            "Statistical significance data (typically p-value < 0.05)",
            "Verification that products were tested under normal use conditions",
            "Signed affidavit from R&D Director may be requested"
        ],
        "superlative": [
            "Market share data (e.g., Nielsen, Kantar) covering the last 12 months",
            "Full definition of the category and market sector",
            "Audit of all competitors in the defined market"
        ],
        "testimonal": [
            "Signed affidavit from the actor/person confirming these are their genuine views",
            "Proof that the person has used the product for a meaningful period",
            "If an expert, proof of qualifications (e.g., medical license)"
        ],
        "environmental": [
            "Full lifecycle analysis (LCA) according to ISO 14040 often required",
            "Evidence that the benefit is not a legal requirement (not 'greenwashing')",
            "Proof that the claim applies to the full product (packaging + contents)"
        ],
        "price": [
            "Pricing audit from independent retailer data",
            "Proof that the 'was' price was charged for 28 consecutive days (standard guidance)",
            "Date of price check"
        ],
        "new": [
            "Launch date verification",
            "Confirmation that product has not been improved/modified before"
        ]
    }

    def get_evidence_requirements(self, claim_type: str) -> List[str]:
        """Get requirements for a specific claim type."""
        return self.EVIDENCE_MAP.get(claim_type.lower(), ["General substantiation for this claim"])

    def generate_pack(self, detected_claims: List[Dict]) -> List[Dict]:
        """
        Generate a full substantiation pack for a list of claims.
        
        Args:
            detected_claims: List of dicts with 'claim_text' and 'claim_type'
            
        Returns:
            List of dicts with 'claim', 'type', 'requirements'
        """
        pack = []
        for claim in detected_claims:
            c_text = claim.get("claim_text", "Unknown Claim")
            c_type = claim.get("claim_type", "general")
            
            reqs = self.get_evidence_requirements(c_type)
            
            pack.append({
                "claim": c_text,
                "type": c_type,
                "requirements": reqs,
                "note": "These are likely requirements based on industry standards. Final clearance depends on Clearcast review."
            })
            
        return pack
