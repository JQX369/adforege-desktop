"""
Unit test for SubstantiationGenerator.
"""
import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from app.features.ai_breakdown.substantiation_generator import SubstantiationGenerator

def test_substantiation():
    gen = SubstantiationGenerator()
    
    print("Testing Evidence Generation...")
    
    claims = [
        {"claim_text": "No. 1 in the UK", "claim_type": "superlative"},
        {"claim_text": "Cheaper than leading brand", "claim_type": "comparative"},
        {"claim_text": "New Formula", "claim_type": "new"}
    ]
    
    pack = gen.generate_pack(claims)
    
    assert len(pack) == 3
    
    print("\n--- Generated Pack ---")
    for item in pack:
        print(f"\nClaim: {item['claim']}")
        print(f"Type: {item['type']}")
        print("Requirements:")
        for req in item['requirements']:
            print(f"  - {req}")
            
    # Verify specific requirements
    assert "Market share data" in pack[0]['requirements'][0]
    assert "Head-to-head clinical trial" in pack[1]['requirements'][0]
    assert "Launch date verification" in pack[2]['requirements'][0]
    
    print("\nSUCCESS: All requirements generated correctly.")

if __name__ == "__main__":
    test_substantiation()
