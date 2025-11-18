## Custom Stories PDF Layout

### Title and header
- **Title**: `Custom Stories Report — <video display name> (<brand>)`  
  - `video display name` comes from `resolve_ad_name(results, video_name)`  
  - `brand` comes from `resolve_brand_name(results)`
- **Subheading (AI Breakdown)**: `Creative Performance View`
- **Subheading (Clearcast)**: `Compliance & Risk View`
- **Header on each page**: `Custom Stories — <view name>`

### Section order – AI Breakdown (Creative Performance View)
1. **Title + metadata**
   - Title + subheading
   - Ad/brand metadata (ad name, brand, identification confidence, alternatives)
   - Video metadata (file name, duration, thumbnail)
2. **Content breakdown**
   - What’s being advertised
   - Product/brand details table
   - Narrative structure
   - CTA clarity + suggested CTA
   - Key messages
3. **Estimated outcome**
   - Effectiveness score + tier bar
   - Tier definition (overall, engagement, conversion, memorability)
   - Optional benchmark table (score ranges 0–20 … 80–100)
   - Reasoning and “why this score” bullet points
   - Expected metrics (with tier labels)
4. **Highlights & risks cluster**
   - What’s working well (green cards)
   - Areas for improvement (yellow cards)
   - Soft risks & watchpoints (orange cards)
   - Simulated audience reactions (blue cards)
5. **Summary**
   - Full-page written summary of the creative performance

### Section order – Clearcast (Compliance & Risk View)
1. **Title + metadata**
   - Title + subheading
   - Ad/brand metadata and micro “Key takeaway”
   - Video metadata (file name, duration, thumbnail)
2. **Summary & clearance prediction**
   - Summary paragraph
   - Clearance prediction badge
3. **Flag cards**
   - Red flags – must-fix issues (clearance blockers)
   - Yellow flags – review needed / may affect clearance
   - Blue flags – technical/quality issues
4. **Compliant elements**
   - Bullet list of items that are fully compliant
5. **Recommendations**
   - Ordered list of recommended next steps/edits

### Layout, spacing, and separators
- **Page size**: Letter, margins 72pt (1.0") on all sides.
- **Typography**:
  - Title: 28pt, bold
  - Section headers: 18pt
  - Subsections: 13–14pt
  - Body text: 11pt with ~16pt leading
- **Cards**:
  - Background colours aligned with UI (green/yellow/orange/blue)
  - Inner padding: ~14pt left/right, 10pt top/bottom
  - Subtle 0.5pt border in a related tint
- **Spacing**:
  - Section headers: ~0.15" below
  - Between cards in a section: ~0.15"
  - Short intra-section gaps use 0.05–0.10" spacers
- **Separators**:
  - A thin horizontal rule (`_add_section_divider`) is inserted between the Estimated Outcome section and the highlights/risks cluster for visual separation without forcing new pages.

### Page breaks (deliberate)
- AI Breakdown:
  - Forced page break **before** the “Estimated Outcome” section.
  - Forced page break **before** the final “Summary” section.
- Clearcast:
  - No page breaks between red/yellow/blue flags – they can flow together.
  - Forced page break **before** the “Recommendations” section only.

### Modularity and configuration
- **Layout config**:
  - `AIBreakdownLayoutConfig` controls:
    - `include_benchmarks`
    - `include_highlights`
    - `include_soft_risks`
    - `include_audience_reactions`
    - `include_summary`
  - `ClearcastLayoutConfig` controls:
    - `include_red_flags`
    - `include_yellow_flags`
    - `include_blue_flags`
    - `include_compliant_elements`
    - `include_recommendations`
- **Usage**:
  - Both `generate_pdf` methods accept an optional `layout_config` argument; when omitted, a sensible default is used.
  - Future changes (e.g. hiding a section or reordering groups) should be implemented by:
    - Updating the relevant layout config, and
    - Adjusting the section-building logic in `app/pdf_generator.py`, rather than inlining control flow into the GUI layer.


