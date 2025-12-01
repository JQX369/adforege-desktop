"""
Test script for Clearcast Knowledge Base (RAG).
"""
import sys
import os
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from app.features.clearcast.clearcast_knowledge_base import get_knowledge_base

def test_rag():
    print("Initializing Knowledge Base...")
    kb = get_knowledge_base()
    
    if not kb.full_text:
        print("ERROR: PDF not loaded.")
        return
        
    print(f"PDF loaded. Total characters: {len(kb.full_text)}")
    
    # Test keywords
    keywords = ["alcohol", "children"]
    print(f"\nQuerying for keywords: {keywords}")
    
    result = kb.get_relevant_rules(keywords)
    
    print("\n--- Result Excerpt ---")
    print(result[:500] + "...")
    print("----------------------")
    
    if "alcohol" in result.lower() or "children" in result.lower():
        print("\nSUCCESS: Retrieved relevant content.")
    else:
        print("\nFAILURE: Did not retrieve expected keywords.")

if __name__ == "__main__":
    test_rag()
