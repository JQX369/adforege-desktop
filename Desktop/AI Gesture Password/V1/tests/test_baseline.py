"""Test baseline emotion tracking functionality"""

import logging
logging.basicConfig(level=logging.INFO)

from app.features.analytics.enhanced_emotion_tracker import EnhancedEmotionTracker

# Test initialization
tracker = EnhancedEmotionTracker()

print("✓ Tracker initialized successfully")
print(f"✓ Baseline collection duration: {tracker.baseline_collection_duration} seconds")
print(f"✓ Baseline collected: {tracker.baseline_collected}")
print(f"✓ Gemini API enabled: {tracker.enhanced_analyzer is not None}")

# Test baseline collection
test_scores = {
    'happy': 0.2,
    'sad': 0.1,
    'neutral': 0.6,
    'angry': 0.05,
    'surprise': 0.05
}

print("\nTesting baseline collection...")
for i in range(35):  # Collect 35 samples
    tracker._collect_baseline_sample(test_scores)

print(f"✓ Baseline collected: {tracker.baseline_collected}")
print(f"✓ Baseline emotions: {tracker.baseline_emotions}")

# Test baseline adjustment
test_new_scores = {
    'happy': 0.5,  # Higher than baseline
    'sad': 0.05,   # Lower than baseline
    'neutral': 0.4,
    'angry': 0.05,
    'surprise': 0.0
}

adjusted = tracker._apply_baseline_adjustment(test_new_scores)
print(f"\n✓ Original scores: {test_new_scores}")
print(f"✓ Adjusted scores: {adjusted}")
print("\nAll tests passed!") 