"""PDF Report Generator for Clearcast and AI Breakdown Reports"""

import logging
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass
from typing import Any, Dict, Optional, List
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image
from reportlab.platypus.flowables import HRFlowable, KeepTogether
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfgen import canvas
from io import BytesIO
import base64
from xml.sax.saxutils import escape as xml_escape
from app.effectiveness_benchmarks import (
    get_tier, get_tier_color, get_tier_definition, format_score_with_tier,
    get_all_tiers, TIER_DEFINITIONS
)

logger = logging.getLogger(__name__)


def _first_non_empty(*values: Optional[str]) -> str:
    """Return the first non-empty, non-placeholder string from the provided values."""
    for value in values:
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned and cleaned.lower() not in {"n/a", "unknown", "none"}:
                return cleaned
    return ""


def resolve_ad_name(results: Optional[Dict], fallback_video_name: str = "") -> str:
    """Resolve the most descriptive ad name from breakdown/metadata or fall back to video name."""
    if not isinstance(results, dict):
        results = {}
    breakdown = results.get('breakdown') or {}
    metadata = results.get('metadata') or {}
    
    return _first_non_empty(
        breakdown.get('specific_product'),
        metadata.get('specific_product'),
        breakdown.get('what_is_advertised'),
        metadata.get('ad_name'),
        breakdown.get('brand_name'),
        results.get('ad_name'),
        metadata.get('title'),
        results.get('video_name'),
        fallback_video_name
    )


def resolve_brand_name(results: Optional[Dict]) -> str:
    """Resolve brand name from breakdown or metadata if available."""
    if not isinstance(results, dict):
        results = {}
    breakdown = results.get('breakdown') or {}
    metadata = results.get('metadata') or {}
    
    return _first_non_empty(
        breakdown.get('brand_name'),
        metadata.get('brand_name'),
        results.get('brand_name')
    )


def format_report_title(video_display_name: str, brand_name: Optional[str]) -> str:
    """Format a consistent top-level report title for all Custom Stories PDFs.

    Example: ``Custom Stories Report — Holiday Ad (Brand Name)``.
    Falls back gracefully if brand or video name are missing.
    """
    display = (video_display_name or "").strip()
    brand = (brand_name or "").strip() if isinstance(brand_name, str) else ""

    if display and brand:
        main = f"{display} ({brand})"
    elif display:
        main = display
    elif brand:
        main = brand
    else:
        main = "Untitled Ad"

    return f"Custom Stories Report — {main}"

# Color scheme matching UI
PDF_COLORS = {
    'primary': HexColor('#FF3B30'),      # Red
    'secondary': HexColor('#34C759'),    # Green
    'yellow': HexColor('#FFCC00'),       # Yellow
    'blue': HexColor('#007AFF'),         # Blue
    'text': HexColor('#1C1C1E'),         # Dark text
    'text_light': HexColor('#8E8E93'),   # Light text
    'bg': HexColor('#F5F5F7'),           # Background
    'card': HexColor('#FFFFFF'),         # Card background
    'red_flag_bg': HexColor('#FFE5E5'),  # Light red for red flags
    'yellow_flag_bg': HexColor('#FFF9E5'), # Light yellow for yellow flags
    'blue_flag_bg': HexColor('#E3F2FD'),  # Light blue for blue flags
    'green_bg': HexColor('#E8F5E9'),     # Light green
    'orange_bg': HexColor('#FFE0B2'),    # Light orange
}


@dataclass
class AIBreakdownLayoutConfig:
    """Config flags controlling which sections appear in the AI Breakdown PDF."""
    include_benchmarks: bool = True
    include_highlights: bool = True
    include_soft_risks: bool = True
    include_audience_reactions: bool = True
    include_summary: bool = True


@dataclass
class ClearcastLayoutConfig:
    """Config flags controlling which sections appear in the Clearcast PDF."""
    include_red_flags: bool = True
    include_yellow_flags: bool = True
    include_blue_flags: bool = True
    include_compliant_elements: bool = True
    include_recommendations: bool = True

class PDFGenerator:
    """Base class for PDF generation utilities"""
    
    # Layout constants tuned for on-screen readability (Letter with comfortable margins)
    # VERSION: Updated 2025-11-14 - Increased margins from 50pt to 72pt for better readability
    # 72pt = 1 inch margins provide comfortable reading width and prevent text from touching edges
    PAGE_SIZE = letter
    MARGIN_LEFT = 72   # 1.0" (was 50pt = ~0.69", increased for better readability)
    MARGIN_RIGHT = 72  # 1.0" (was 50pt = ~0.69", increased for better readability)
    MARGIN_TOP = 72    # 1.0"
    MARGIN_BOTTOM = 72 # 1.0"
    SECTION_SPACER = 0.10 * inch
    CARD_SPACER = 0.10 * inch
    SMALL_SPACER = 0.06 * inch
    
    def __init__(self):
        # Page geometry
        self.page_width, self.page_height = self.PAGE_SIZE
        self.content_width = self.page_width - self.MARGIN_LEFT - self.MARGIN_RIGHT
        
        # Base stylesheet and custom styles
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        # Helper function to add style only if it doesn't exist
        def add_style_if_not_exists(name, **kwargs):
            if name not in self.styles.byName:
                self.styles.add(ParagraphStyle(name=name, **kwargs))
        
        # Title style - Large, bold, modern
        add_style_if_not_exists(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=28,
            textColor=PDF_COLORS['text'],
            spaceAfter=16,
            spaceBefore=0,
            fontName='Helvetica-Bold',
            leading=34,
            alignment=TA_LEFT
        )
        
        # Report subheading style - Subtle, elegant
        add_style_if_not_exists(
            name='ReportSubheading',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=PDF_COLORS['text_light'],
            spaceAfter=12,
            spaceBefore=0,
            fontName='Helvetica',
            leading=18,
            alignment=TA_LEFT
        )
        add_style_if_not_exists(
            name='ReportSubtitle',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=PDF_COLORS['text'],
            spaceAfter=6,
            spaceBefore=0,
            fontName='Helvetica',
            leading=20,
            alignment=TA_LEFT
        )
        
        # Section header style - Strong hierarchy
        add_style_if_not_exists(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=18,
            textColor=PDF_COLORS['text'],
            spaceAfter=12,
            spaceBefore=20,
            fontName='Helvetica-Bold',
            leading=22,
            alignment=TA_LEFT
        )
        
        # Subsection style - Clear but not overwhelming
        add_style_if_not_exists(
            name='Subsection',
            parent=self.styles['Heading3'],
            fontSize=13,
            textColor=PDF_COLORS['text'],
            spaceAfter=8,
            spaceBefore=12,
            fontName='Helvetica-Bold',
            leading=16,
            alignment=TA_LEFT
        )
        
        # Body text style - Comfortable reading
        add_style_if_not_exists(
            name='BodyText',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=PDF_COLORS['text'],
            spaceAfter=8,
            leading=16,
            alignment=TA_LEFT,
            wordWrap='LTR',
        )
        
        # Light text style - For metadata and secondary info
        add_style_if_not_exists(
            name='LightText',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=PDF_COLORS['text_light'],
            spaceAfter=6,
            leading=14,
            alignment=TA_LEFT,
            wordWrap='LTR',
        )
        
        # Small text style - For tables and fine print
        add_style_if_not_exists(
            name='SmallText',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=PDF_COLORS['text'],
            spaceAfter=4,
            leading=12,
            alignment=TA_LEFT,
            wordWrap='LTR',
        )
        
        # Card text style - For content inside colored cards
        add_style_if_not_exists(
            name='CardText',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=PDF_COLORS['text'],
            spaceAfter=6,
            leading=14,
            alignment=TA_LEFT,
            wordWrap='LTR',
        )
    
    def _truncate_text(self, text: Optional[str], max_chars: int = 500) -> str:
        """Safely truncate long text while keeping it readable.
        
        This is mainly used for free-form AI text to avoid overflowing pages.
        """
        if text is None:
            return ""
        if not isinstance(text, str):
            text = str(text)
        text = text.strip()
        if len(text) <= max_chars:
            return text
        # Reserve space for ellipsis
        truncated = text[: max_chars - 1].rstrip()
        return truncated + "…"

    def _make_paragraph(
        self,
        text: Optional[str],
        style_name: str = 'BodyText',
        allow_html: bool = False,
    ) -> Paragraph:
        """Create a Paragraph with consistent escaping and styling.

        By default we escape HTML-like characters so that any ``<b>``/``<i>``
        coming from the model is rendered as text, not markup. For our own
        intentional markup, set ``allow_html=True``.
        """
        if text is None:
            text = ""
        if not isinstance(text, str):
            text = str(text)
        if not allow_html:
            text = xml_escape(text)
        style = self.styles.get(style_name, self.styles['BodyText'])
        return Paragraph(text, style)

    @staticmethod
    def _safe_dict(value: Optional[Dict]) -> Dict:
        """Return a dict or an empty dict if the value is not a dict."""
        if isinstance(value, dict):
            return value
        return {}
    
    def _append_ad_metadata(
        self,
        story: List,
        ad_name: str,
        brand_name: str,
        confidence: Optional[float] = None,
        alternatives: Optional[List[str]] = None,
    ):
        """Append ad/brand metadata rows to the PDF story."""
        metadata_added = False
        if ad_name:
            safe_ad = self._truncate_text(ad_name, max_chars=300)
            story.append(Paragraph(f"<b>Ad:</b> {safe_ad}", self.styles['BodyText']))
            metadata_added = True
        if brand_name:
            safe_brand = self._truncate_text(brand_name, max_chars=200)
            story.append(Paragraph(f"<b>Brand:</b> {safe_brand}", self.styles['BodyText']))
            metadata_added = True
        if confidence is not None:
            story.append(Paragraph(f"<b>Identification Confidence:</b> {confidence:.0f}%", self.styles['BodyText']))
            metadata_added = True
            if confidence < 70:
                story.append(Paragraph("<font color='#FF3B30'>Low confidence — verify the advertised product manually.</font>", self.styles['LightText']))
        if alternatives:
            alts_text = ", ".join(alternatives[:3])
            alts_text = self._truncate_text(alts_text, max_chars=250)
            story.append(Paragraph(f"<b>Possible Alternatives:</b> {alts_text}", self.styles['BodyText']))
            metadata_added = True
        if metadata_added:
            story.append(Spacer(1, 0.05*inch))

    def _add_classification_section(
        self,
        story: List,
        classification: Dict,
        focus_summary: List[Dict],
        disclaimers: List[str],
        audio_report: Dict[str, Any],
        delivery_metadata: Dict[str, Any],
    ):
        """Append script/product/brand classification details to the story."""
        story.append(self._make_paragraph("Classification Snapshot", "SectionHeader"))
        script = classification.get("script") or {}
        product = classification.get("product") or {}
        brand = classification.get("brand") or {}

        def _profile_rows(title: str, rows: List[tuple]):
            flowables: List = [
                self._make_paragraph(f"<b>{title}</b>", "BodyText")
            ]
            for label, value in rows:
                if not value:
                    continue
                display = ", ".join(value) if isinstance(value, list) else value
                flowables.append(
                    self._make_paragraph(f"{label}: {display}", "LightText")
                )
            return KeepTogether(flowables)

        columns = [
            _profile_rows(
                "Script",
                [
                    ("Claims", script.get("primary_claims")),
                    ("Tone", script.get("tone")),
                    ("Audience", script.get("target_audience")),
                    ("Sensitive topics", script.get("sensitive_topics")),
                ],
            ),
            _profile_rows(
                "Product / Offer",
                [
                    ("Category", product.get("sector")),
                    ("Sub-category", product.get("subcategory")),
                    ("Inherent risk", product.get("inherent_risk")),
                    ("Regulatory flags", product.get("regulatory_flags")),
                ],
            ),
            _profile_rows(
                "Brand",
                [
                    ("Name", brand.get("name")),
                    ("Industry", brand.get("industry")),
                    ("Tone", brand.get("tone")),
                    ("History", brand.get("clearcast_history")),
                ],
            ),
        ]
        story.append(
            Table(
                [[columns[0], columns[1], columns[2]]],
                colWidths=[self.content_width / 3] * 3,
                style=TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ]
                ),
            )
        )

        if focus_summary:
            flowables: List = [
                self._make_paragraph("Priority Focus Areas", "Subsection")
            ]
            for entry in focus_summary:
                label = entry.get("label") or "Focus Area"
                severity = entry.get("severity") or "INFO"
                reason = entry.get("reason") or ""
                flowables.append(
                    self._make_paragraph(f"{label} • {severity}", "BodyText")
                )
                if reason:
                    flowables.append(
                        self._make_paragraph(reason, "LightText")
                    )
                related = entry.get("related_flags") or []
                if related:
                    items = ", ".join(
                        [
                            f"{flag.get('issue', 'Flag')} ({flag.get('guideline_code') or 'Guideline'})"
                            for flag in related
                        ]
                    )
                    flowables.append(
                        self._make_paragraph(
                            f"Related flags: {items}", "LightText"
                        )
                    )
            story.append(KeepTogether(flowables))

        if disclaimers:
            flowables = [
                self._make_paragraph("Required Disclaimers", "Subsection")
            ]
            for disclaimer in disclaimers:
                flowables.append(
                    self._make_paragraph(f"• {disclaimer}", "LightText")
                )
            story.append(KeepTogether(flowables))
        if audio_report:
            audio_flow = [
                self._make_paragraph("Audio Readiness", "Subsection"),
                self._make_paragraph(
                    f"Status: {audio_report.get('status', 'unknown').replace('_', ' ').title()}",
                    "BodyText",
                ),
            ]
            metrics = []
            if audio_report.get("integrated_lufs") is not None:
                metrics.append(f"Integrated loudness: {audio_report['integrated_lufs']:.1f} LUFS")
            if audio_report.get("true_peak") is not None:
                metrics.append(f"True peak: {audio_report['true_peak']:.1f} dBFS")
            if metrics:
                audio_flow.append(self._make_paragraph(" | ".join(metrics), "LightText"))
            if audio_report.get("recommendation"):
                audio_flow.append(
                    self._make_paragraph(audio_report["recommendation"], "LightText")
                )
            story.append(KeepTogether(audio_flow))
        if delivery_metadata:
            delivery_flow = [
                self._make_paragraph("Clock & Countdown Readiness", "Subsection"),
            ]
            if delivery_metadata.get("clock_number"):
                delivery_flow.append(
                    self._make_paragraph(f"Clock Number: {delivery_metadata['clock_number']}", "BodyText")
                )
            slate_pairs = [
                ("Client", delivery_metadata.get("client_name")),
                ("Agency", delivery_metadata.get("agency_name")),
                ("Product", delivery_metadata.get("product_name")),
                ("Title", delivery_metadata.get("title")),
            ]
            for label, value in slate_pairs:
                if value:
                    delivery_flow.append(
                        self._make_paragraph(f"{label}: {value}", "LightText")
                    )
            status_bits = []
            if delivery_metadata.get("countdown_added"):
                status_bits.append("Countdown added")
            if delivery_metadata.get("padding_added"):
                status_bits.append("Padding added")
            if status_bits:
                delivery_flow.append(
                    self._make_paragraph(" | ".join(status_bits), "LightText")
                )
            ready_text = "Slate ready for delivery" if delivery_metadata.get("ready") else "Slate metadata incomplete"
            delivery_flow.append(
                self._make_paragraph(ready_text, "LightText")
            )
            story.append(KeepTogether(delivery_flow))
        story.append(Spacer(1, self.SECTION_SPACER))
    
    def _add_header_footer(self, canvas_obj, doc, video_name: str = "", report_type: str = ""):
        """Add header and footer to PDF pages aligned with layout margins."""
        # Save state
        canvas_obj.saveState()

        left = self.MARGIN_LEFT
        right = self.page_width - self.MARGIN_RIGHT

        # Header
        canvas_obj.setFont('Helvetica-Bold', 10)
        canvas_obj.setFillColor(PDF_COLORS['text_light'])
        header_text = "Custom Stories"
        if report_type:
            header_text = f"{header_text} — {report_type}"
        canvas_obj.drawString(left, self.page_height - self.MARGIN_TOP + 30, header_text)

        # Footer
        canvas_obj.setFont('Helvetica', 9)
        canvas_obj.setFillColor(PDF_COLORS['text_light'])
        page_num = canvas_obj.getPageNumber()
        canvas_obj.drawString(left, self.MARGIN_BOTTOM - 22, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        canvas_obj.drawRightString(right, self.MARGIN_BOTTOM - 22, f"Page {page_num}")

        # Restore state
        canvas_obj.restoreState()
    
    def _add_thumbnail(self, story: List, thumbnail_base64: Optional[str], width: float = 2*inch):
        """Add video thumbnail to PDF if available"""
        if thumbnail_base64:
            try:
                # Decode base64 image
                image_data = base64.b64decode(thumbnail_base64)
                img = Image(BytesIO(image_data), width=width, height=width * 9/16)  # 16:9 aspect
                story.append(img)
                story.append(Spacer(1, 0.2*inch))
            except Exception as e:
                logger.warning(f"Failed to add thumbnail to PDF: {e}")

    def _add_section_divider(
        self,
        story: List,
        top_space: float = 0.15 * inch,
        bottom_space: float = 0.15 * inch,
    ) -> None:
        """Insert a subtle horizontal divider between logical sections."""
        story.append(Spacer(1, top_space))
        story.append(
            HRFlowable(
                width="100%",
                thickness=0.5,
                lineCap='round',
                color=PDF_COLORS.get('text_light'),
                spaceBefore=0,
                spaceAfter=0,
            )
        )
        story.append(Spacer(1, bottom_space))

    def _build_key_value_block(
        self,
        items: List[tuple],
        label_style: str = 'BodyText',
        value_style: str = 'BodyText'
    ) -> KeepTogether:
        """Create a definition-list style key-value block that stays on one page."""
        flowables: List = []
        for label, value in items:
            if not value:
                continue
            safe_value = self._truncate_text(str(value), max_chars=900)
            flowables.append(
                self._make_paragraph(
                    f"<b>{xml_escape(label)}:</b>",
                    style_name=label_style,
                    allow_html=True,
                )
            )
            flowables.append(
                self._make_paragraph(
                    safe_value,
                    style_name=value_style,
                )
            )
        if not flowables:
            flowables.append(Spacer(1, 0))
        return KeepTogether(flowables)

    def _ensure_keep_together(self, story: List, flowables: List, approx_chars: int = 0) -> None:
        """Wrap and append flowables so the section is not split awkwardly."""
        if not flowables:
            return
        if approx_chars and approx_chars > 1200:
            for flowable in flowables:
                story.append(flowable)
            return
        story.append(KeepTogether(flowables))

    @staticmethod
    def _generate_takeaways(summary_text: str, limit: int = 3) -> List[str]:
        """Derive short bullet takeaways from a long summary if none provided."""
        if not summary_text:
            return []
        sentences = [s.strip() for s in summary_text.replace("\n", " ").split(".") if s.strip()]
        return sentences[:limit]

    @staticmethod
    def _split_profile(profile: Optional[str]) -> tuple:
        """Split profile into persona name and demographic details."""
        if not isinstance(profile, str):
            return ("Audience Persona", None)
        profile = profile.strip()
        if "(" in profile and profile.endswith(")"):
            persona, details = profile.rsplit("(", 1)
            return persona.strip(), details.rstrip(")").strip()
        return (profile, None)

class ClearcastPDFGenerator(PDFGenerator):
    """Generate Clearcast compliance report PDFs"""
    
    def generate_pdf(self, results: Dict, video_name: str = "", video_duration: float = 0.0, 
                     thumbnail_base64: Optional[str] = None, output_path: str = "",
                     layout_config: Optional[ClearcastLayoutConfig] = None) -> bool:
        """
        Generate Clearcast compliance report PDF
        
        Args:
            results: Clearcast check results dictionary
            video_name: Name of the video
            video_duration: Duration in seconds
            thumbnail_base64: Base64 encoded thumbnail image
            output_path: Path to save PDF
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"[ClearcastPDF] Starting generation - NEW layout constants: L={self.MARGIN_LEFT}, R={self.MARGIN_RIGHT}, content_width={self.content_width:.1f}in")
            logger.info(f"[ClearcastPDF] VERIFICATION: If margins are 50, old code is cached. Expected: 60pt margins")
            # Create PDF document using shared layout constants
            doc = SimpleDocTemplate(
                output_path,
                pagesize=self.PAGE_SIZE,
                rightMargin=self.MARGIN_RIGHT,
                leftMargin=self.MARGIN_LEFT,
                topMargin=self.MARGIN_TOP,
                bottomMargin=self.MARGIN_BOTTOM,
            )
            
            # Container for PDF content
            story = []
            layout = layout_config or ClearcastLayoutConfig()
            
            # Resolve ad + brand metadata
            ad_name = resolve_ad_name(results, video_name)
            brand_name = resolve_brand_name(results)
            
            # Title - standardised format across reports
            display_name = ad_name or (video_name or "")
            report_brand = brand_name or display_name or "Untitled"
            report_date = results.get("analyzed_at")
            try:
                report_dt = datetime.fromisoformat(report_date) if report_date else datetime.now()
            except Exception:
                report_dt = datetime.now()
            formatted_date = report_dt.strftime("%d %b %Y")
            title_bits = ["Custom Stories Report", report_brand, formatted_date]
            story.append(Paragraph(" — ".join(title_bits), self.styles['CustomTitle']))
            subtitle_lines = []
            if display_name and display_name != report_brand:
                subtitle_lines.append(display_name)
            if brand_name and brand_name != report_brand:
                subtitle_lines.append(brand_name)
            if subtitle_lines:
                story.append(
                    Paragraph(" — ".join(subtitle_lines), self.styles['ReportSubtitle'])
                )
            story.append(Paragraph("Compliance & Risk View", self.styles['ReportSubheading']))
            ai_note = (
                "This compliance snapshot is generated solely from the supplied ad. "
                "All product identifications, claims checks, and risk flags are AI interpretations without outside context—please verify before publishing."
            )
            story.append(self._make_paragraph(ai_note, 'LightText'))
            story.append(Spacer(1, self.SMALL_SPACER))
            breakdown_meta = self._safe_dict(results.get('breakdown'))
            ad_confidence = breakdown_meta.get('identification_confidence')
            if isinstance(ad_confidence, (int, float)):
                ad_confidence = max(0.0, min(100.0, float(ad_confidence)))
            else:
                ad_confidence = None
            alternatives = breakdown_meta.get('possible_alternatives')
            if isinstance(alternatives, list):
                alternatives = [str(alt).strip() for alt in alternatives if str(alt).strip()]
            else:
                alternatives = []
            self._append_ad_metadata(story, ad_name, brand_name, ad_confidence, alternatives)
            micro_summary = results.get('one_sentence_summary')
            if micro_summary:
                micro_text = self._truncate_text(micro_summary, max_chars=400)
                story.append(Paragraph(f"<b>Key Takeaway:</b> {micro_text}", self.styles['BodyText']))
                story.append(Spacer(1, self.SECTION_SPACER))
            story.append(Spacer(1, self.SMALL_SPACER))

            classification = results.get('classification')
            if classification:
                self._add_classification_section(
                    story,
                    classification,
                    results.get('classification_focus', []) or [],
                    results.get('disclaimers_required', []) or [],
                    results.get('audio_normalization') or {},
                    results.get('delivery_metadata') or {},
                )
            
            # Video info
            meta_lines: List[str] = []
            if video_name:
                safe_video = self._truncate_text(video_name, max_chars=200)
                meta_lines.append(f"<b>Video:</b> {safe_video}")
            if video_duration > 0:
                meta_lines.append(f"<b>Duration:</b> {video_duration:.1f} seconds")

            if meta_lines or thumbnail_base64:
                # Two-column header block: text meta on left, thumbnail on right
                left_width = self.content_width * 0.6
                right_width = self.content_width - left_width

                header_data: List[List] = []
                meta_paras: List[Paragraph] = []
                for line in meta_lines:
                    meta_paras.append(Paragraph(line, self.styles['BodyText']))
                if meta_paras:
                    header_data.append([meta_paras, None])

                if thumbnail_base64:
                    try:
                        image_data = base64.b64decode(thumbnail_base64)
                        thumb_width = min(right_width, 2.2 * inch)
                        img = Image(BytesIO(image_data), width=thumb_width, height=thumb_width * 9 / 16)
                    except Exception as e:
                        logger.warning(f"Failed to add thumbnail to PDF: {e}")
                        img = None
                else:
                    img = None

                if img:
                    if header_data:
                        header_data[0][1] = img
                    else:
                        header_data.append([None, img])

                if header_data:
                    header_table = Table(header_data, colWidths=[left_width, right_width])
                    header_table.setStyle(TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (0, 0), (-1, -1), 0),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                        ('TOPPADDING', (0, 0), (-1, -1), 0),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                    ]))
                    story.append(header_table)
                    story.append(Spacer(1, self.SECTION_SPACER))
            
            # Status badge + overview block kept together
            status = results.get('compliance_status', 'UNKNOWN')
            status_colors = {
                'PASS': PDF_COLORS['secondary'],
                'FAIL': PDF_COLORS['primary'],
                'REVIEW_NEEDED': PDF_COLORS['yellow'],
                'ERROR': PDF_COLORS['text_light']
            }
            status_color = status_colors.get(status, PDF_COLORS['text'])
            
            # Convert HexColor to string usable in <font color='...'>
            status_color_str = getattr(status_color, "hexval", lambda: str(status_color))()
            status_text = f"<b>Status:</b> <font color='{status_color_str}'> {status}</font>"
            status_para = Paragraph(status_text, self.styles['SectionHeader'])
            
            raw_summary = results.get('summary', 'No summary available')
            summary = self._truncate_text(raw_summary, max_chars=700)
            summary_para = Paragraph(f"<b>Summary:</b> {summary}", self.styles['BodyText'])

            prediction = results.get('clearance_prediction', 'Unknown')
            pred_colors = {
                'Will likely clear': PDF_COLORS['secondary'],
                'Unlikely to clear': PDF_COLORS['primary'],
                'Needs modifications': PDF_COLORS['yellow']
            }
            pred_color = pred_colors.get(prediction, PDF_COLORS['text'])
            pred_color_str = getattr(pred_color, "hexval", lambda: str(pred_color))()
            pred_text = f"<b>Clearance Prediction:</b> <font color='{pred_color_str}'> {prediction}</font>"
            pred_para = Paragraph(pred_text, self.styles['Subsection'])
            
            overview_block = KeepTogether(
                [
                    status_para,
                    Spacer(1, self.SMALL_SPACER),
                    summary_para,
                    Spacer(1, self.SMALL_SPACER),
                    pred_para,
                    Spacer(1, 0.15 * inch),
                ]
            )
            story.append(overview_block)
            story.append(Spacer(1, self.SMALL_SPACER))
            
            # Red flags
            red_flags = results.get('red_flags') or []
            if not isinstance(red_flags, list):
                red_flags = []
            if layout.include_red_flags and red_flags:
                for i, flag in enumerate(red_flags, 1):
                    rows: List[List[Paragraph]] = []
                    issue = self._truncate_text(
                        flag.get('issue', 'Unknown issue'),
                        max_chars=160,
                    )
                    card_chars = len(issue)
                    rows.append([
                        self._make_paragraph(
                            f"<b>{i}. {issue}</b>",
                            style_name='CardText',
                            allow_html=True,
                        )
                    ])
                    timestamp = self._truncate_text(
                        flag.get('timestamp', 'N/A'),
                        max_chars=80,
                    )
                    card_chars += len(timestamp)
                    rows.append([
                        self._make_paragraph(
                            f"Timestamp: {timestamp}",
                            style_name='CardText',
                        )
                    ])
                    
                    if flag.get('guideline_reference'):
                        guideline = self._truncate_text(flag['guideline_reference'], max_chars=200)
                        card_chars += len(guideline)
                        rows.append([
                            self._make_paragraph(
                                f"Guideline: {guideline}",
                                style_name='CardText',
                            )
                        ])
                    evidence_parts: List[str] = []
                    evidence_text = flag.get('evidence_text')
                    if evidence_text:
                        evidence = self._truncate_text(evidence_text, max_chars=240)
                        card_chars += len(evidence)
                        evidence_parts.append(f"&ldquo;{xml_escape(evidence)}&rdquo;")
                    evidence_source = flag.get('evidence_source')
                    if evidence_source:
                        source_text = self._truncate_text(evidence_source, max_chars=120)
                        card_chars += len(source_text)
                        evidence_parts.append(f"Source: {xml_escape(source_text)}")
                    if evidence_parts:
                        rows.append([
                            self._make_paragraph(
                                f"<i>Evidence</i>: {' — '.join(evidence_parts)}",
                                style_name='CardText',
                                allow_html=True,
                            )
                        ])
                    if flag.get('required_action'):
                        action = self._truncate_text(flag['required_action'], max_chars=300)
                        card_chars += len(action)
                        rows.append([
                            self._make_paragraph(
                                f"Action Required: {action}",
                                style_name='CardText',
                            )
                        ])
                    
                    # Beautiful card-style table for red flags
                    flag_table = Table(rows, colWidths=[self.content_width])
                    flag_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), PDF_COLORS['red_flag_bg']),
                        ('TEXTCOLOR', (0, 0), (-1, -1), PDF_COLORS['text']),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 11),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('LEADING', (0, 0), (-1, -1), 14),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (-1, -1), 14),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                        # Subtle border for card effect
                        ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#FFCDD2')),
                        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [PDF_COLORS['red_flag_bg']]),
                    ]))
                    flowables: List = []
                    if i == 1:
                        flowables.extend(
                            [
                                Paragraph("🚫 RED FLAGS - Must Fix (WILL block clearance)", self.styles["SectionHeader"]),
                                Spacer(1, self.SECTION_SPACER),
                            ]
                        )
                        card_chars += 200
                    flowables.append(flag_table)
                    self._ensure_keep_together(story, flowables, approx_chars=card_chars)
                    story.append(Spacer(1, self.SECTION_SPACER))
            
            # Yellow flags
            yellow_flags = results.get('yellow_flags') or []
            if not isinstance(yellow_flags, list):
                yellow_flags = []
            if layout.include_yellow_flags and yellow_flags:
                for i, flag in enumerate(yellow_flags, 1):
                    rows: List[List[Paragraph]] = []
                    issue = self._truncate_text(
                        flag.get('issue', 'Unknown issue'),
                        max_chars=160,
                    )
                    card_chars = len(issue)
                    rows.append([
                        self._make_paragraph(
                            f"<b>{i}. {issue}</b>",
                            style_name='CardText',
                            allow_html=True,
                        )
                    ])
                    timestamp = self._truncate_text(
                        flag.get('timestamp', 'N/A'),
                        max_chars=80,
                    )
                    card_chars += len(timestamp)
                    rows.append([
                        self._make_paragraph(
                            f"Timestamp: {timestamp}",
                            style_name='CardText',
                        )
                    ])
                    
                    if flag.get('clearance_impact'):
                        impact = self._truncate_text(flag['clearance_impact'], max_chars=200)
                        card_chars += len(impact)
                        rows.append([
                            self._make_paragraph(
                                f"Impact: {impact}",
                                style_name='CardText',
                            )
                        ])
                    if flag.get('guideline_reference'):
                        guideline = self._truncate_text(flag['guideline_reference'], max_chars=200)
                        card_chars += len(guideline)
                        rows.append([
                            self._make_paragraph(
                                f"Guideline: {guideline}",
                                style_name='CardText',
                            )
                        ])
                    evidence_parts = []
                    evidence_text = flag.get('evidence_text')
                    if evidence_text:
                        evidence = self._truncate_text(evidence_text, max_chars=240)
                        card_chars += len(evidence)
                        evidence_parts.append(f"&ldquo;{xml_escape(evidence)}&rdquo;")
                    evidence_source = flag.get('evidence_source')
                    if evidence_source:
                        source_text = self._truncate_text(evidence_source, max_chars=120)
                        card_chars += len(source_text)
                        evidence_parts.append(f"Source: {xml_escape(source_text)}")
                    if evidence_parts:
                        rows.append([
                            self._make_paragraph(
                                f"<i>Evidence</i>: {' — '.join(evidence_parts)}",
                                style_name='CardText',
                                allow_html=True,
                            )
                        ])
                    if flag.get('suggested_action'):
                        suggestion = self._truncate_text(flag['suggested_action'], max_chars=300)
                        card_chars += len(suggestion)
                        rows.append([
                            self._make_paragraph(
                                f"Suggestion: {suggestion}",
                                style_name='CardText',
                            )
                        ])
                    
                    # Beautiful card-style table for yellow flags
                    flag_table = Table(rows, colWidths=[self.content_width])
                    flag_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), PDF_COLORS['yellow_flag_bg']),
                        ('TEXTCOLOR', (0, 0), (-1, -1), PDF_COLORS['text']),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 11),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('LEADING', (0, 0), (-1, -1), 14),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (-1, -1), 14),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                        # Subtle border for card effect
                        ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#FFE082')),
                        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [PDF_COLORS['yellow_flag_bg']]),
                    ]))
                    flowables = []
                    if i == 1:
                        flowables.extend(
                            [
                                Paragraph("⚠️ YELLOW FLAGS - Review Needed (MAY affect clearance)", self.styles["SectionHeader"]),
                                Spacer(1, self.SECTION_SPACER),
                            ]
                        )
                        card_chars += 200
                    flowables.append(flag_table)
                    self._ensure_keep_together(story, flowables, approx_chars=card_chars)
                    story.append(Spacer(1, self.SECTION_SPACER))
            
            # Blue flags (Technical issues)
            blue_flags = results.get('blue_flags') or []
            if not isinstance(blue_flags, list):
                blue_flags = []
            if layout.include_blue_flags and blue_flags:
                for i, flag in enumerate(blue_flags, 1):
                    rows: List[List[Paragraph]] = []
                    issue = self._truncate_text(
                        flag.get('issue', 'Unknown issue'),
                        max_chars=160,
                    )
                    card_chars = len(issue)
                    rows.append([
                        self._make_paragraph(
                            f"<b>{i}. {issue}</b>",
                            style_name='CardText',
                            allow_html=True,
                        )
                    ])
                    timestamp = self._truncate_text(
                        flag.get('timestamp', 'N/A'),
                        max_chars=80,
                    )
                    card_chars += len(timestamp)
                    rows.append([
                        self._make_paragraph(
                            f"Timestamp: {timestamp}",
                            style_name='CardText',
                        )
                    ])
                    
                    if flag.get('category'):
                        category = self._truncate_text(flag['category'], max_chars=120)
                        card_chars += len(category)
                        rows.append([
                            self._make_paragraph(
                                f"Category: {category}",
                                style_name='CardText',
                            )
                        ])
                    if flag.get('impact'):
                        impact = self._truncate_text(flag['impact'], max_chars=200)
                        card_chars += len(impact)
                        rows.append([
                            self._make_paragraph(
                                f"Impact: {impact}",
                                style_name='CardText',
                            )
                        ])
                    evidence_parts = []
                    evidence_text = flag.get('evidence_text')
                    if evidence_text:
                        evidence = self._truncate_text(evidence_text, max_chars=240)
                        card_chars += len(evidence)
                        evidence_parts.append(f"&ldquo;{xml_escape(evidence)}&rdquo;")
                    evidence_source = flag.get('evidence_source')
                    if evidence_source:
                        source_text = self._truncate_text(evidence_source, max_chars=120)
                        card_chars += len(source_text)
                        evidence_parts.append(f"Source: {xml_escape(source_text)}")
                    if evidence_parts:
                        rows.append([
                            self._make_paragraph(
                                f"<i>Evidence</i>: {' — '.join(evidence_parts)}",
                                style_name='CardText',
                                allow_html=True,
                            )
                        ])
                    if flag.get('fix_required'):
                        fix_text = "Fix required" if flag['fix_required'] else "Fix recommended"
                        card_chars += len(fix_text)
                        rows.append([
                            self._make_paragraph(
                                f"Status: {fix_text}",
                                style_name='CardText',
                            )
                        ])
                    
                    # Beautiful card-style table for blue flags
                    flag_table = Table(rows, colWidths=[self.content_width])
                    flag_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), PDF_COLORS['blue_flag_bg']),
                        ('TEXTCOLOR', (0, 0), (-1, -1), PDF_COLORS['text']),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 11),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('LEADING', (0, 0), (-1, -1), 14),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (-1, -1), 14),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                        # Subtle border for card effect
                        ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#90CAF9')),
                        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [PDF_COLORS['blue_flag_bg']]),
                    ]))
                    flowables = []
                    if i == 1:
                        flowables.extend(
                            [
                                Paragraph("🔧 TECHNICAL ISSUES - Quality Standards", self.styles["SectionHeader"]),
                                Spacer(1, self.SECTION_SPACER),
                            ]
                        )
                        card_chars += 200
                    flowables.append(flag_table)
                    self._ensure_keep_together(story, flowables, approx_chars=card_chars)
                    story.append(Spacer(1, self.SECTION_SPACER))
            
            # Compliant elements
            compliant = results.get('compliant_elements') or []
            if not isinstance(compliant, list):
                compliant = []
            if layout.include_compliant_elements and compliant and not red_flags and not yellow_flags:
                story.append(Spacer(1, 0.2*inch))
                story.append(Paragraph("✅ Compliant Elements", self.styles['SectionHeader']))
                for element in compliant:
                    story.append(Paragraph(f"• {element}", self.styles['BodyText']))
                    story.append(Spacer(1, 0.05*inch))
            
            # Recommendations
            recommendations = results.get('recommendations') or []
            if not isinstance(recommendations, list):
                recommendations = []
            if layout.include_recommendations and recommendations:
                story.append(PageBreak())
                story.append(Paragraph("📋 Recommendations", self.styles['SectionHeader']))
                story.append(Spacer(1, self.SMALL_SPACER))
                for i, rec in enumerate(recommendations, 1):
                    rec_text = self._truncate_text(rec, max_chars=400)
                    story.append(Paragraph(f"{i}. {rec_text}", self.styles['BodyText']))
                    story.append(Spacer(1, 0.05*inch))
            
            # Build PDF with header/footer
            def on_first_page(canvas_obj, doc):
                self._add_header_footer(canvas_obj, doc, video_name, "Compliance & Risk")
            
            def on_later_pages(canvas_obj, doc):
                self._add_header_footer(canvas_obj, doc, video_name, "Compliance & Risk")
            
            doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
            
            logger.info(f"Generated Clearcast PDF: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate Clearcast PDF: {e}", exc_info=True)
            return False

class AIBreakdownPDFGenerator(PDFGenerator):
    """Generate AI Video Breakdown report PDFs"""
    
    def generate_pdf(self, results: Dict, video_name: str = "", video_duration: float = 0.0,
                     thumbnail_base64: Optional[str] = None, output_path: str = "",
                     layout_config: Optional[AIBreakdownLayoutConfig] = None) -> bool:
        """
        Generate AI Breakdown report PDF
        
        Args:
            results: AI breakdown results dictionary
            video_name: Name of the video
            video_duration: Duration in seconds
            thumbnail_base64: Base64 encoded thumbnail image
            output_path: Path to save PDF
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"[AIBreakdownPDF] Starting generation - NEW layout constants: L={self.MARGIN_LEFT}, R={self.MARGIN_RIGHT}, content_width={self.content_width:.1f}in")
            logger.info(f"[AIBreakdownPDF] VERIFICATION: If margins are 50, old code is cached. Expected: 60pt margins")
            # Create PDF document using shared layout constants
            doc = SimpleDocTemplate(
                output_path,
                pagesize=self.PAGE_SIZE,
                rightMargin=self.MARGIN_RIGHT,
                leftMargin=self.MARGIN_LEFT,
                topMargin=self.MARGIN_TOP,
                bottomMargin=self.MARGIN_BOTTOM,
            )
            
            # Container for PDF content
            story = []
            layout = layout_config or AIBreakdownLayoutConfig()
            
            def dedupe_highlights(entries: List[Dict]) -> List[Dict]:
                """Local helper to prevent duplicate improvement cards."""
                deduped_list: List[Dict] = []
                seen = set()
                for entry in entries or []:
                    if not isinstance(entry, dict):
                        continue
                    key = (entry.get("aspect") or entry.get("suggestion") or "").strip().lower()
                    if key and key in seen:
                        continue
                    if key:
                        seen.add(key)
                    deduped_list.append(entry)
                return deduped_list
            
            # Resolve ad + brand metadata
            ad_name = resolve_ad_name(results, video_name)
            brand_name = resolve_brand_name(results)
            
            display_name = ad_name or (video_name or "")
            story.append(Paragraph("Custom Stories Report", self.styles['CustomTitle']))
            subtitle_lines = []
            if display_name:
                subtitle_lines.append(display_name)
            if brand_name:
                subtitle_lines.append(brand_name)
            if subtitle_lines:
                story.append(
                    Paragraph(" — ".join(subtitle_lines), self.styles['ReportSubtitle'])
                )
            story.append(Paragraph("Creative Performance View", self.styles['ReportSubheading']))
            ai_note = (
                "This creative analysis is generated entirely by Custom Stories AI from the ad itself—"
                "product identification, audience personas, and insights are inferred without external reference. "
                "Use it as an intelligent first read and validate before making final calls."
            )
            story.append(self._make_paragraph(ai_note, 'LightText'))
            story.append(Spacer(1, self.SMALL_SPACER))
            self._append_ad_metadata(story, ad_name, brand_name)
            story.append(Spacer(1, self.SMALL_SPACER))
            
            # Video info + thumbnail block
            meta_lines: List[str] = []
            if video_name:
                safe_video = self._truncate_text(video_name, max_chars=200)
                meta_lines.append(f"<b>Video:</b> {safe_video}")
            if video_duration > 0:
                meta_lines.append(f"<b>Duration:</b> {video_duration:.1f} seconds")

            if meta_lines or thumbnail_base64:
                left_width = self.content_width * 0.6
                right_width = self.content_width - left_width

                header_data: List[List] = []
                meta_paras: List[Paragraph] = []
                for line in meta_lines:
                    meta_paras.append(Paragraph(line, self.styles['BodyText']))
                if meta_paras:
                    header_data.append([meta_paras, None])

                if thumbnail_base64:
                    try:
                        image_data = base64.b64decode(thumbnail_base64)
                        thumb_width = min(right_width, 2.2 * inch)
                        img = Image(BytesIO(image_data), width=thumb_width, height=thumb_width * 9 / 16)
                    except Exception as e:
                        logger.warning(f"Failed to add thumbnail to PDF: {e}")
                        img = None
                else:
                    img = None

                if img:
                    if header_data:
                        header_data[0][1] = img
                    else:
                        header_data.append([None, img])

                if header_data:
                    header_table = Table(header_data, colWidths=[left_width, right_width])
                    header_table.setStyle(TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (0, 0), (-1, -1), 0),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                        ('TOPPADDING', (0, 0), (-1, -1), 0),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                    ]))
                    story.append(header_table)
                    story.append(Spacer(1, self.SECTION_SPACER))
            
            # Check for errors
            if results.get('error'):
                error_text = self._truncate_text(results.get('error'), max_chars=400)
                error_para = Paragraph(f"<b>Error:</b> {error_text}", 
                                     self.styles['BodyText'])
                story.append(error_para)
                doc.build(story)
                return True
            
            # Content Breakdown Section
            breakdown = self._safe_dict(results.get('breakdown'))
            cta_highlight = None
            if breakdown:
                story.append(Paragraph("📊 CONTENT BREAKDOWN", self.styles['SectionHeader']))
                story.append(Spacer(1, self.SMALL_SPACER))
                
                # What's being advertised
                if breakdown.get('what_is_advertised'):
                    what_text = self._truncate_text(breakdown.get('what_is_advertised'), max_chars=400)
                    story.append(Paragraph(f"<b>🎯 What's Being Advertised:</b> {what_text}", 
                                         self.styles['Subsection']))
                    story.append(Spacer(1, 0.05*inch))
                
                # Product details
                details_pairs = [
                    ("Brand", breakdown.get('brand_name')),
                    ("Product", breakdown.get('specific_product')),
                    ("Category", breakdown.get('product_category')),
                    ("Content Type", breakdown.get('content_type')),
                    ("Duration", breakdown.get('duration_category')),
                    ("Target Audience", breakdown.get('target_audience')),
                    ("Production Quality", breakdown.get('production_quality')),
                ]
                definition_block = self._build_key_value_block(details_pairs)
                story.append(definition_block)
                story.append(Spacer(1, 0.1 * inch))
                
                # Narrative structure
                if breakdown.get('narrative_structure'):
                    story_text = self._truncate_text(breakdown.get('narrative_structure'), max_chars=900)
                    story.append(Paragraph(f"<b>Story:</b> {story_text}", 
                                         self.styles['BodyText']))
                    story.append(Spacer(1, self.SECTION_SPACER))
                
                cta_clarity = breakdown.get('cta_clarity')
                if cta_clarity:
                    cta_text = self._truncate_text(cta_clarity, max_chars=300)
                    story.append(Paragraph(f"<b>CTA Clarity:</b> {cta_text}", self.styles['BodyText']))
                suggested_cta = breakdown.get('suggested_improved_cta')
                if suggested_cta:
                    suggestion_text = self._truncate_text(suggested_cta, max_chars=300)
                    if cta_clarity:
                        suggestion_text = self._truncate_text(
                            f"{cta_clarity} — Suggested CTA: {suggested_cta}",
                            max_chars=320,
                        )
                    cta_highlight = {
                        "aspect": "CTA Update",
                        "suggestion": suggestion_text,
                        "priority": "Medium",
                    }
                if cta_clarity:
                    story.append(Spacer(1, self.SMALL_SPACER))
                
                # Key messages
                key_messages = breakdown.get('key_messages', [])
                if key_messages:
                    story.append(Paragraph("<b>Key Messages:</b>", self.styles['BodyText']))
                    for msg in key_messages:
                        msg_text = self._truncate_text(msg, max_chars=250)
                        story.append(Paragraph(f"• {msg_text}", self.styles['BodyText']))
                    story.append(Spacer(1, self.SMALL_SPACER))
            
            # Estimated Outcome Section
            outcome = self._safe_dict(results.get('estimated_outcome'))
            if outcome:
                self._add_section_divider(story, top_space=self.SECTION_SPACER, bottom_space=self.SMALL_SPACER)
                story.append(Paragraph("🎯 ESTIMATED OUTCOME", self.styles['SectionHeader']))
                story.append(Spacer(1, self.SECTION_SPACER))
                
                # Primary goal
                if outcome.get('primary_goal'):
                    story.append(Paragraph(f"<b><u>Primary Goal</u>:</b> {outcome['primary_goal']}", 
                                         self.styles['Subsection']))
                    story.append(Spacer(1, self.SMALL_SPACER))
                
                # Effectiveness score with tier
                score = outcome.get('effectiveness_score', 0)
                tier = get_tier(score)
                tier_color_hex = get_tier_color(tier)
                tier_color = HexColor(tier_color_hex)
                
                score_block: List = []
                score_block.append(Paragraph(f"<b>Effectiveness Score:</b> {format_score_with_tier(score)}", self.styles['BodyText']))
                
                score_bar_data = [['']]
                score_bar = Table(score_bar_data, colWidths=[self.content_width], rowHeights=[0.2*inch])
                score_bar.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, 0), tier_color),
                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                    ('TOPPADDING', (0, 0), (-1, -1), 0),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ]))
                score_block.append(Spacer(1, 0.05 * inch))
                score_block.append(score_bar)
                
                tier_def = get_tier_definition(tier)
                score_block.append(Spacer(1, 0.05 * inch))
                score_block.append(
                    Paragraph(f"<b>{tier} Performance:</b> {tier_def['overall']}", self.styles['BodyText'])
                )
                score_block.append(Spacer(1, 0.05 * inch))
                perf_grid = [
                    [
                        self._make_paragraph("<b><u>Engagement</u></b>", 'SmallText', allow_html=True),
                        self._make_paragraph(tier_def['engagement'], 'SmallText'),
                    ],
                    [
                        self._make_paragraph("<b><u>Conversion</u></b>", 'SmallText', allow_html=True),
                        self._make_paragraph(tier_def['conversion'], 'SmallText'),
                    ],
                    [
                        self._make_paragraph("<b><u>Memorability</u></b>", 'SmallText', allow_html=True),
                        self._make_paragraph(tier_def['memorability'], 'SmallText'),
                    ],
                ]
                perf_table = Table(perf_grid, colWidths=[self.content_width * 0.25, self.content_width * 0.75])
                perf_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F8F8F8')),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('INNERGRID', (0, 0), (-1, -1), 0.25, HexColor('#E0E0E0')),
                    ('BOX', (0, 0), (-1, -1), 0.25, HexColor('#E0E0E0')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                score_block.append(perf_table)
                
                if layout.include_benchmarks:
                    score_block.append(Spacer(1, self.SMALL_SPACER))
                    score_block.append(Paragraph("<b>Effectiveness Score Benchmarks:</b>", self.styles['Subsection']))
                    score_block.append(Spacer(1, self.SMALL_SPACER))
                    
                    benchmark_data = [[
                        Paragraph('<b>Score Range</b>', self.styles['SmallText']),
                        Paragraph('<b>Tier</b>', self.styles['SmallText']),
                        Paragraph('<b>Overall Performance</b>', self.styles['SmallText']),
                        Paragraph('<b>Engagement</b>', self.styles['SmallText']),
                        Paragraph('<b>Conversion</b>', self.styles['SmallText']),
                        Paragraph('<b>Memorability</b>', self.styles['SmallText']),
                    ]]
                    
                    for tier_name in get_all_tiers():
                        tier_info = TIER_DEFINITIONS[tier_name]
                        min_score, max_score = tier_info['range']
                        score_range = f"{min_score}-{max_score}%"
                        overall_text = self._truncate_text(tier_info['overall'], max_chars=260)
                        
                        benchmark_data.append([
                            Paragraph(score_range, self.styles['SmallText']),
                            Paragraph(tier_name, self.styles['SmallText']),
                            Paragraph(overall_text, self.styles['SmallText']),
                            Paragraph(tier_info['engagement'], self.styles['SmallText']),
                            Paragraph(tier_info['conversion'], self.styles['SmallText']),
                            Paragraph(tier_info['memorability'], self.styles['SmallText']),
                        ])
                    
                    total_width = self.content_width
                    col_widths = [
                        total_width * 0.12,
                        total_width * 0.12,
                        total_width * 0.36,
                        total_width * 0.13,
                        total_width * 0.13,
                        total_width * 0.14,
                    ]
                    
                    benchmark_table = Table(benchmark_data, colWidths=col_widths)
                    benchmark_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1C1C1E')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 10),
                        ('LEADING', (0, 0), (-1, 0), 12),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                        ('TOPPADDING', (0, 0), (-1, 0), 10),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 9),
                        ('LEADING', (0, 1), (-1, -1), 12),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#FFFFFF'), HexColor('#F5F5F7')]),
                        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E5EA')),
                        ('VALIGN', (0, 1), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (0, 0), (-1, -1), 8),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                        ('TOPPADDING', (0, 1), (-1, -1), 8),
                        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                        ('TEXTCOLOR', (1, 1), (1, 1), HexColor(TIER_DEFINITIONS['Poor']['color'])),
                        ('TEXTCOLOR', (1, 2), (1, 2), HexColor(TIER_DEFINITIONS['Below Average']['color'])),
                        ('TEXTCOLOR', (1, 3), (1, 3), HexColor(TIER_DEFINITIONS['Average']['color'])),
                        ('TEXTCOLOR', (1, 4), (1, 4), HexColor(TIER_DEFINITIONS['Good']['color'])),
                        ('TEXTCOLOR', (1, 5), (1, 5), HexColor(TIER_DEFINITIONS['Excellent']['color'])),
                        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
                        ('FONTSIZE', (1, 1), (1, -1), 9),
                    ]))
                    score_block.append(benchmark_table)
                
                approx_chars = 1000 if layout.include_benchmarks else 700
                self._ensure_keep_together(story, score_block, approx_chars=approx_chars)
                story.append(Spacer(1, self.SMALL_SPACER))
                
                # Reasoning
                if outcome.get('reasoning'):
                    reasoning_text = self._truncate_text(outcome.get('reasoning'), max_chars=900)
                    story.append(Paragraph(f"<b>Reasoning:</b> {reasoning_text}", 
                                         self.styles['BodyText']))
                    story.append(Spacer(1, self.SECTION_SPACER))
                
                score_rationale = outcome.get('score_rationale') or []
                if isinstance(score_rationale, list) and score_rationale:
                    story.append(Paragraph("<b>Why this score:</b>", self.styles['BodyText']))
                    for point in score_rationale[:3]:
                        point_text = self._truncate_text(point, max_chars=300)
                        story.append(Paragraph(f"- {point_text}", self.styles['BodyText']))
                    story.append(Spacer(1, self.SMALL_SPACER))
                
                # Expected metrics with tier labels
                metrics = outcome.get('expected_metrics', {})
                if metrics:
                    story.append(Paragraph("<b><u>Expected Metrics</u></b>", self.styles['BodyText']))
                    from app.effectiveness_benchmarks import convert_text_to_tier
                    for key, value in metrics.items():
                        # Convert text-based metrics to tier labels
                        metric_tier = convert_text_to_tier(str(value))
                        if metric_tier:
                            metric_text = f"• {key.replace('_', ' ').title()}: {value} ({metric_tier})"
                        else:
                            metric_text = f"• {key.replace('_', ' ').title()}: {value}"
                        story.append(Paragraph(metric_text, self.styles['BodyText']))

                # Divider before detailed qualitative sections (highlights/risks/reactions)
                if any(
                    bool(results.get(name))
                    for name in ("green_highlights", "yellow_highlights", "soft_risks", "audience_reactions")
                ):
                    self._add_section_divider(story)
            
            # Green Highlights
            green_highlights = results.get('green_highlights') or []
            if not isinstance(green_highlights, list):
                green_highlights = []
            if layout.include_highlights and green_highlights:
                story.append(Paragraph("✅ WHAT'S WORKING WELL", self.styles['SectionHeader']))
                story.append(Spacer(1, self.SECTION_SPACER))
                
                for i, highlight in enumerate(green_highlights, 1):
                    aspect_text = self._truncate_text(
                        highlight.get('aspect', ''),
                        max_chars=120,
                    )
                    rows: List[List[Paragraph]] = []
                    card_chars = len(aspect_text)
                    # Title line
                    rows.append([
                        self._make_paragraph(
                            f"<b>{i}. {aspect_text}</b>",
                            style_name='CardText',
                            allow_html=True,
                        )
                    ])
                    # Explanation
                    if highlight.get('explanation'):
                        explanation = self._truncate_text(
                            highlight.get('explanation'),
                            max_chars=260,
                        )
                        card_chars += len(explanation)
                        rows.append([
                            self._make_paragraph(
                                explanation,
                                style_name='CardText',
                            )
                        ])
                    evidence = highlight.get('evidence_text')
                    if evidence:
                        evidence_text = self._truncate_text(evidence, max_chars=220)
                        card_chars += len(evidence_text)
                        rows.append([
                            self._make_paragraph(
                                f"Evidence: {evidence_text}",
                                style_name='CardText',
                            )
                        ])
                    # Impact
                    if highlight.get('impact'):
                        impact = self._truncate_text(str(highlight['impact']), max_chars=200)
                        card_chars += len(impact)
                        rows.append([
                            self._make_paragraph(
                                f"Impact: {impact}",
                                style_name='CardText',
                            )
                        ])
                    
                    # Beautiful card-style table with proper spacing
                    highlight_table = Table(rows, colWidths=[self.content_width])
                    highlight_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), PDF_COLORS['green_bg']),
                        ('TEXTCOLOR', (0, 0), (-1, -1), PDF_COLORS['text']),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 12),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('LEADING', (0, 0), (-1, -1), 14),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (-1, -1), 14),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                        # Subtle border for card effect
                        ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#C8E6C9')),
                        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [PDF_COLORS['green_bg']]),
                    ]))
                    self._ensure_keep_together(story, [highlight_table], approx_chars=card_chars)
                    story.append(Spacer(1, self.SECTION_SPACER))
            
            # Yellow Highlights
            yellow_highlights = results.get('yellow_highlights') or []
            if not isinstance(yellow_highlights, list):
                yellow_highlights = []
            else:
                yellow_highlights = list(yellow_highlights)
            if cta_highlight:
                yellow_highlights.insert(0, cta_highlight)
            yellow_highlights = dedupe_highlights(yellow_highlights)
            if layout.include_highlights and yellow_highlights:
                story.append(Paragraph("⚠️ AREAS FOR IMPROVEMENT", self.styles['SectionHeader']))
                story.append(Spacer(1, self.SECTION_SPACER))
                
                for i, highlight in enumerate(yellow_highlights, 1):
                    aspect_text = self._truncate_text(
                        highlight.get('aspect', ''),
                        max_chars=120,
                    )
                    rows: List[List[Paragraph]] = []
                    card_chars = len(aspect_text)
                    rows.append([
                        self._make_paragraph(
                            f"<b>{i}. {aspect_text}</b>",
                            style_name='CardText',
                            allow_html=True,
                        )
                    ])
                    if highlight.get('suggestion'):
                        suggestion = self._truncate_text(
                            highlight.get('suggestion'),
                            max_chars=260,
                        )
                        card_chars += len(suggestion)
                        rows.append([
                            self._make_paragraph(
                                f"Suggestion: {suggestion}",
                                style_name='CardText',
                            )
                        ])
                        evidence = highlight.get('evidence_text')
                        if evidence:
                            evidence_text = self._truncate_text(evidence, max_chars=220)
                            card_chars += len(evidence_text)
                            rows.append([
                                self._make_paragraph(
                                    f"Evidence: {evidence_text}",
                                    style_name='CardText',
                                )
                            ])
                    if highlight.get('priority'):
                        priority = self._truncate_text(str(highlight['priority']), max_chars=80)
                        card_chars += len(priority)
                        rows.append([
                            self._make_paragraph(
                                f"Priority: {priority}",
                                style_name='CardText',
                            )
                        ])
                    
                    # Beautiful card-style table with proper spacing
                    highlight_table = Table(rows, colWidths=[self.content_width])
                    highlight_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), PDF_COLORS['yellow_flag_bg']),
                        ('TEXTCOLOR', (0, 0), (-1, -1), PDF_COLORS['text']),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 12),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('LEADING', (0, 0), (-1, -1), 14),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (-1, -1), 14),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                        # Subtle border for card effect
                        ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#FFE082')),
                        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [PDF_COLORS['yellow_flag_bg']]),
                    ]))
                    self._ensure_keep_together(story, [highlight_table], approx_chars=card_chars)
                    story.append(Spacer(1, self.SECTION_SPACER))
            
            # Soft Risks
            soft_risks = results.get('soft_risks') or []
            if not isinstance(soft_risks, list):
                soft_risks = []
            if layout.include_soft_risks and soft_risks:
                story.append(Paragraph("⚠️ SOFT RISKS & WATCHPOINTS", self.styles['SectionHeader']))
                story.append(Spacer(1, self.SECTION_SPACER))
                for risk in soft_risks[:5]:
                    risk_title = self._truncate_text(risk.get('risk', 'Risk'), max_chars=160)
                    paragraphs: List[Paragraph] = []
                    card_chars = len(risk_title)
                    paragraphs.append(
                        self._make_paragraph(
                            f"<b>{risk_title}</b>",
                            style_name='CardText',
                            allow_html=True,
                        )
                    )
                    if risk.get('impact'):
                        impact_text = self._truncate_text(risk['impact'], max_chars=200)
                        card_chars += len(impact_text)
                        paragraphs.append(
                            self._make_paragraph(
                                f"Impact: {impact_text}",
                                style_name='CardText',
                            )
                        )
                    if risk.get('mitigation'):
                        mitigation_text = self._truncate_text(risk['mitigation'], max_chars=220)
                        card_chars += len(mitigation_text)
                        paragraphs.append(
                            self._make_paragraph(
                                f"Mitigation: {mitigation_text}",
                                style_name='CardText',
                            )
                        )
                    if risk.get('evidence_text'):
                        evidence_text = self._truncate_text(risk['evidence_text'], max_chars=220)
                        card_chars += len(evidence_text)
                        paragraphs.append(
                            self._make_paragraph(
                                f"Evidence: {evidence_text}",
                                style_name='CardText',
                            )
                        )
                    # Beautiful card-style table for risks
                    risk_table = Table([[p] for p in paragraphs], colWidths=[self.content_width])
                    risk_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), PDF_COLORS['orange_bg']),
                        ('TEXTCOLOR', (0, 0), (-1, -1), PDF_COLORS['text']),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 11),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('LEADING', (0, 0), (-1, -1), 14),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (-1, -1), 14),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                        # Subtle border for card effect
                        ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#FFCC80')),
                        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [PDF_COLORS['orange_bg']]),
                    ]))
                    self._ensure_keep_together(story, [risk_table], approx_chars=card_chars)
                    story.append(Spacer(1, self.SECTION_SPACER))
            
            # Audience Reactions
            audience_reactions = results.get('audience_reactions') or []
            if not isinstance(audience_reactions, list):
                audience_reactions = []
            if layout.include_audience_reactions and audience_reactions:
                story.append(Paragraph("👥 SIMULATED AUDIENCE REACTIONS", self.styles['SectionHeader']))
                story.append(Spacer(1, self.SECTION_SPACER))
                audience_context = self._safe_dict(results.get("audience_context"))
                airing_country = audience_context.get("airing_country")
                if airing_country:
                    story.append(
                        Paragraph(
                            f"<i>Primary airing market: {airing_country}</i>",
                            self.styles["LightText"],
                        )
                    )
                    story.append(Spacer(1, self.SMALL_SPACER))

                for reaction in audience_reactions:
                    rows: List[List[Paragraph]] = []
                    persona, demographic = self._split_profile(reaction.get('profile', 'Viewer Persona'))
                    persona_text = self._truncate_text(reaction.get('persona') or persona, max_chars=140)
                    rows.append([
                        self._make_paragraph(
                            f"<b><u>{persona_text}</u></b>",
                            style_name='CardText',
                            allow_html=True,
                        )
                    ])
                    demo_bits: List[str] = []
                    for key in ("gender", "age_range", "race_ethnicity"):
                        value = reaction.get(key)
                        if value and value not in ("Unknown", "Not specified"):
                            demo_bits.append(value)
                    if reaction.get("location") and reaction["location"] not in ("Unknown", "Not specified"):
                        demo_bits.append(f"Location: {reaction['location']}")
                    if not demo_bits and demographic:
                        demo_bits.append(self._truncate_text(demographic, max_chars=140))
                    if demo_bits:
                        rows.append([
                            self._make_paragraph(
                                " • ".join(demo_bits),
                                style_name='CardText',
                            )
                        ])
                    if reaction.get('engagement_level'):
                        rows.append([
                            self._make_paragraph(
                                f"Engagement Signal: {reaction['engagement_level']}",
                                style_name='CardText',
                            )
                        ])
                    if reaction.get('reaction'):
                        reaction_text = self._truncate_text(reaction['reaction'], max_chars=220)
                        rows.append([
                            self._make_paragraph(
                                f'Emotional Take: "{reaction_text}"',
                                style_name='CardText',
                            )
                        ])
                    if reaction.get('likely_action'):
                        action_text = self._truncate_text(reaction['likely_action'], max_chars=180)
                        rows.append([
                            self._make_paragraph(
                                f"Likely Action: {action_text}",
                                style_name='CardText',
                            )
                        ])
                    if reaction.get('key_concern'):
                        concern_text = self._truncate_text(reaction['key_concern'], max_chars=180)
                        rows.append([
                            self._make_paragraph(
                                f"Key Concern: {concern_text}",
                                style_name='CardText',
                            )
                        ])

                    reaction_table = Table(rows, colWidths=[self.content_width])
                    reaction_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), PDF_COLORS['blue_flag_bg']),
                        ('TEXTCOLOR', (0, 0), (-1, -1), PDF_COLORS['text']),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 12),
                        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('LEADING', (0, 0), (-1, -1), 14),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (-1, -1), 14),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                        ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#90CAF9')),
                        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [PDF_COLORS['blue_flag_bg']]),
                    ]))
                    approx_chars = sum(len(str(value or "")) for value in reaction.values())
                    self._ensure_keep_together(story, [reaction_table], approx_chars=approx_chars or 400)
                    story.append(Spacer(1, self.SECTION_SPACER / 2))
                story.append(Spacer(1, self.SECTION_SPACER / 2))
            
            # Summary
            summary = results.get('summary')
            if layout.include_summary and summary:
                summary_text = self._truncate_text(summary, max_chars=900)
                takeaways = results.get('summary_key_takeaways') or self._generate_takeaways(summary_text)
                story.append(PageBreak())
                story.append(Paragraph("📝 SUMMARY", self.styles['SectionHeader']))
                story.append(self._make_paragraph(
                    "<u>How to read this:</u> insights are AI-inferred from the ad only—validate before publishing.",
                    'LightText',
                    allow_html=True
                ))
                story.append(Spacer(1, self.SMALL_SPACER))
                if takeaways:
                    story.append(Paragraph("<b>Key Takeaways:</b>", self.styles['BodyText']))
                    for point in takeaways[:3]:
                        story.append(
                            self._make_paragraph(
                                f"• {self._truncate_text(point, max_chars=200)}",
                                style_name='BodyText',
                            )
                        )
                    story.append(Spacer(1, self.SMALL_SPACER))
                summary_para = Paragraph(summary_text, self.styles['BodyText'])
                story.append(summary_para)
            
            # Build PDF with header/footer
            def on_first_page(canvas_obj, doc):
                self._add_header_footer(canvas_obj, doc, video_name, "Creative Performance")
            
            def on_later_pages(canvas_obj, doc):
                self._add_header_footer(canvas_obj, doc, video_name, "Creative Performance")
            
            doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
            
            logger.info(f"Generated AI Breakdown PDF: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate AI Breakdown PDF: {e}", exc_info=True)
            return False

