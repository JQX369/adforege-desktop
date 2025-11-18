"""Quick diagnostic script to verify PDF generator is using new layout constants"""

import sys
from app.pdf_generator import ClearcastPDFGenerator, AIBreakdownPDFGenerator

print("=" * 60)
print("PDF Generator Layout Constants Diagnostic")
print("=" * 60)

# Test Clearcast generator
print("\n1. Testing ClearcastPDFGenerator:")
clearcast_gen = ClearcastPDFGenerator()
print(f"   PAGE_SIZE: {clearcast_gen.PAGE_SIZE}")
print(f"   MARGIN_LEFT: {clearcast_gen.MARGIN_LEFT} points (~{clearcast_gen.MARGIN_LEFT/72:.2f}\")")
print(f"   MARGIN_RIGHT: {clearcast_gen.MARGIN_RIGHT} points (~{clearcast_gen.MARGIN_RIGHT/72:.2f}\")")
print(f"   MARGIN_TOP: {clearcast_gen.MARGIN_TOP} points (~{clearcast_gen.MARGIN_TOP/72:.2f}\")")
print(f"   MARGIN_BOTTOM: {clearcast_gen.MARGIN_BOTTOM} points (~{clearcast_gen.MARGIN_BOTTOM/72:.2f}\")")
print(f"   content_width: {clearcast_gen.content_width:.1f} points (~{clearcast_gen.content_width/72:.2f}\")")

# Test AI Breakdown generator
print("\n2. Testing AIBreakdownPDFGenerator:")
ai_gen = AIBreakdownPDFGenerator()
print(f"   PAGE_SIZE: {ai_gen.PAGE_SIZE}")
print(f"   MARGIN_LEFT: {ai_gen.MARGIN_LEFT} points (~{ai_gen.MARGIN_LEFT/72:.2f}\")")
print(f"   MARGIN_RIGHT: {ai_gen.MARGIN_RIGHT} points (~{ai_gen.MARGIN_RIGHT/72:.2f}\")")
print(f"   content_width: {ai_gen.content_width:.1f} points (~{ai_gen.content_width/72:.2f}\")")

# Verify they match
print("\n3. Verification:")
if clearcast_gen.MARGIN_LEFT == 72 and clearcast_gen.MARGIN_RIGHT == 72:
    print("   [OK] NEW layout constants detected (72pt = 1.0\" margins)")
elif clearcast_gen.MARGIN_LEFT == 60 and clearcast_gen.MARGIN_RIGHT == 60:
    print("   [OK] Updated layout detected (60pt margins)")
elif clearcast_gen.MARGIN_LEFT == 50 and clearcast_gen.MARGIN_RIGHT == 50:
    print(f"   [ERROR] OLD layout detected! Margins are L={clearcast_gen.MARGIN_LEFT}, R={clearcast_gen.MARGIN_RIGHT}")
    print("   Expected: L=72, R=72 (new layout)")
else:
    print(f"   [WARNING] Unexpected margins: L={clearcast_gen.MARGIN_LEFT}, R={clearcast_gen.MARGIN_RIGHT}")

if clearcast_gen.content_width > 460:  # Should be ~468 points with 72pt margins
    print(f"   [OK] Content width looks correct: {clearcast_gen.content_width:.1f} points (~{clearcast_gen.content_width/72:.2f}\")")
elif clearcast_gen.content_width > 450:  # ~492 points with 60pt margins
    print(f"   [OK] Content width acceptable: {clearcast_gen.content_width:.1f} points (~{clearcast_gen.content_width/72:.2f}\")")
else:
    print(f"   [ERROR] Content width seems wrong: {clearcast_gen.content_width:.1f} points")
    print("   Expected: ~468 points with 72pt margins (or ~492 with 60pt)")

print("\n" + "=" * 60)
print("Current margins: 72pt = 1.0\" (comfortable reading width)")
print("Old margins were: 50pt = ~0.69\"")
print("If margins are 50/50, the app needs to be restarted.")
print("=" * 60)

