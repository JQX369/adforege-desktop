"""
Ad Script Lab Orchestrator.

Coordinates the multi-agent pipeline for TV ad script generation.
Includes a "Synthesizer" preprocessing step that transforms raw user inputs
into a structured Master Creative Brief.
"""

import logging
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, safe_get_response_text

from .types import (
    AdScriptRun,
    AdScriptBrief,
    AdScriptGenerateRequest,
    RunStatus,
    CreativeMode,
)
from .config import get_mode_config, AGENT_CONFIGS
from .rag_client import get_rag_client
from .agents import (
    run_brand_discovery,
    run_retriever,
    run_amazon_start,
    run_ideate,
    run_selector,
    run_polish,
    run_braintrust,
    run_compliance,
    fix_all_scripts,
    run_finalize,
)

logger = logging.getLogger(__name__)


# =============================================================================
# SYNTHESIZER - Master Creative Brief Generator
# =============================================================================

SYNTHESIZER_PROMPT = '''You are the "Synthesizer" - an expert at translating raw client inputs into a structured Master Creative Brief for an advertising agency pipeline.

## Raw Client Inputs:
**Objective:** {objective}
**Website URL:** {website_url}
**Target Audience (raw):** {target_audience}
**SMP (raw):** {smp}
**Tone of Voice (raw):** {tone_of_voice}
**Visual Style Preference:** {visual_style}
**Market/Region:** {market}
**Ad Length:** {length_seconds} seconds
**Budget:** {budget_range}
**Mandatories:** {mandatories}

## Brand Discovery Context:
{brand_context}

## Uploaded Briefing Documents Context:
{briefing_context}

---

Your task is to synthesize a complete, agency-ready creative brief. Fill in any gaps using your understanding of the brand, market, and objective. Be specific and actionable.

RESPOND WITH VALID JSON:
```json
{{
  "target_audience": "Detailed, specific target audience description (demographics, psychographics, behaviors). If the raw input was empty, infer from objective and brand context.",
  "single_minded_proposition": "Clear, compelling SMP that captures the core benefit. If raw input was empty, craft one based on the objective and brand.",
  "tone_of_voice": "Specific tone descriptors (e.g., 'Warm, witty, slightly irreverent, with undercurrents of aspiration'). If raw was empty, infer from brand.",
  "research_insights": "3-5 key insights about the target audience and their relationship to this product/category. What pain points or desires can we leverage?",
  "creative_territories": ["Territory 1: Brief description", "Territory 2: Brief description"],
  "key_messages": ["Primary message to communicate", "Secondary support point"],
  "brand_personality_traits": ["Trait 1", "Trait 2", "Trait 3"],
  "competitive_context": "Brief note on competitive landscape and how this brand should differentiate",
  "success_metrics": "What would success look like for this campaign?",
  "compliance_notes": "Market-specific compliance considerations ({market})"
}}
```

Be creative but realistic. The brief should feel like it was written by a senior strategist who deeply understands the brand.'''


async def run_synthesizer(
    request: AdScriptGenerateRequest,
    brand_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    The Synthesizer: Translates raw user inputs into a structured Master Creative Brief.
    
    This preprocessing step:
    1. Combines all available context (user inputs, brand discovery, uploaded docs)
    2. Uses AI to fill gaps and infer missing fields
    3. Produces a complete, agency-ready brief
    
    Args:
        request: The raw API request with user inputs
        brand_context: Optional brand discovery results
        
    Returns:
        Dictionary with synthesized brief fields
    """
    logger.info("Synthesizer: Processing inputs for Master Creative Brief")
    
    # Prepare brand context string
    brand_context_str = ""
    if brand_context and brand_context.get("success"):
        brand_parts = []
        if brand_context.get("brand_name"):
            brand_parts.append(f"Brand Name: {brand_context['brand_name']}")
        if brand_context.get("tagline"):
            brand_parts.append(f"Tagline: {brand_context['tagline']}")
        if brand_context.get("products_services"):
            brand_parts.append(f"Products/Services: {', '.join(brand_context['products_services'][:5])}")
        if brand_context.get("brand_values"):
            brand_parts.append(f"Values: {', '.join(brand_context['brand_values'])}")
        if brand_context.get("brand_context"):
            brand_parts.append(f"Summary: {brand_context['brand_context']}")
        brand_context_str = "\n".join(brand_parts) if brand_parts else "No brand discovery performed."
    else:
        brand_context_str = "No brand discovery performed."
    
    # Prepare briefing documents context
    briefing_context_str = request.briefing_context or "No briefing documents uploaded."
    
    # Format the prompt
    prompt = SYNTHESIZER_PROMPT.format(
        objective=request.objective or "[Not provided]",
        website_url=request.website_url or "[Not provided]",
        target_audience=request.target_audience or "[Not provided - please infer]",
        smp=request.single_minded_proposition or "[Not provided - please craft one]",
        tone_of_voice=request.tone_of_voice or "[Not provided - please infer from brand]",
        visual_style=request.visual_style or "[Not specified]",
        market=request.market or "uk",
        length_seconds=request.length_seconds,
        budget_range=request.budget_range,
        mandatories=", ".join(request.mandatories) if request.mandatories else "[None specified]",
        brand_context=brand_context_str,
        briefing_context=briefing_context_str[:5000]  # Limit to avoid token overflow
    )
    
    # Call Gemini
    model = create_gemini_model('pro')
    if not model:
        logger.warning("Synthesizer: Gemini unavailable, using raw inputs")
        return {
            "success": False,
            "reason": "AI model unavailable"
        }
    
    try:
        generation_config = genai.GenerationConfig(
            temperature=0.7,  # Some creativity for filling gaps
            max_output_tokens=2000,
        )
        
        response = model.generate_content(prompt, generation_config=generation_config)
        response_text = safe_get_response_text(response)
        
        if not response_text:
            logger.warning("Synthesizer: Empty response from Gemini")
            return {"success": False, "reason": "Empty response"}
        
        # Parse JSON from response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            synthesized = json.loads(json_match.group())
            logger.info("Synthesizer: Successfully synthesized Master Creative Brief")
            return {
                "success": True,
                **synthesized
            }
        else:
            logger.warning("Synthesizer: Could not parse JSON from response")
            return {"success": False, "reason": "JSON parse error"}
            
    except Exception as e:
        logger.error("Synthesizer error: %s", str(e))
        return {"success": False, "reason": str(e)}

# Storage path for persistent runs
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
AD_SCRIPT_STORAGE_DIR = PROJECT_ROOT / "ad_script_runs"


class AdScriptOrchestrator:
    """
    Orchestrates the multi-agent ad script generation pipeline.
    
    Pipeline stages:
    1. Retrieve - Fetch relevant TV ads from RAG
    2. Amazon Start - Generate "Working Backwards" press release
    3. Ideate - Generate initial concepts (5-10 based on mode)
    4. Select - Narrow to top 3 concepts
    5. Polish - Develop full scripts for top 3
    6. Braintrust - Get creative director critiques
    7. Compliance - Check against UK broadcast regulations
    8. Finalize - Produce final script pack
    """
    
    def __init__(self):
        self.rag_client = get_rag_client()
        self._runs: Dict[str, AdScriptRun] = {}
        self._storage_dir = AD_SCRIPT_STORAGE_DIR
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._load_runs()
        logger.info("AdScriptOrchestrator initialized with persistent storage at %s", self._storage_dir)
    
    def _get_run_file_path(self, run_id: str) -> Path:
        """Get the file path for a run's JSON file."""
        return self._storage_dir / f"{run_id}.json"
    
    def _load_runs(self) -> None:
        """Load all runs from disk on startup."""
        loaded_count = 0
        error_count = 0
        
        for json_file in self._storage_dir.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                run = AdScriptRun(**data)
                self._runs[run.run_id] = run
                loaded_count += 1
            except Exception as e:
                logger.warning("Failed to load run from %s: %s", json_file, str(e))
                error_count += 1
        
        logger.info("Loaded %d ad script runs from disk (%d errors)", loaded_count, error_count)
    
    def _save_run(self, run: AdScriptRun) -> None:
        """Save a run to disk."""
        try:
            file_path = self._get_run_file_path(run.run_id)
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(run.model_dump(mode='json'), f, indent=2, default=str)
            logger.debug("Saved run %s to disk", run.run_id)
        except Exception as e:
            logger.error("Failed to save run %s: %s", run.run_id, str(e))
    
    def _delete_run_file(self, run_id: str) -> bool:
        """Delete a run's file from disk."""
        try:
            file_path = self._get_run_file_path(run_id)
            if file_path.exists():
                file_path.unlink()
                logger.debug("Deleted run file for %s", run_id)
                return True
            return False
        except Exception as e:
            logger.error("Failed to delete run file %s: %s", run_id, str(e))
            return False
    
    def create_run(
        self, 
        request: AdScriptGenerateRequest, 
        brand_context: dict = None,
        synthesized_brief: dict = None
    ) -> AdScriptRun:
        """Create a new run from an API request, optionally using synthesized brief data."""
        # Auto-generate asset name if not provided
        asset_name = request.asset_name
        if not asset_name:
            from datetime import datetime
            asset_name = f"Campaign {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        # Use brand discovery data if available
        brand_name = request.brand_name
        product_service = request.product_service
        brand_context_str = ""
        
        if brand_context and brand_context.get("success"):
            if not brand_name and brand_context.get("brand_name"):
                brand_name = brand_context["brand_name"]
            if not product_service and brand_context.get("products_services"):
                product_service = ", ".join(brand_context["products_services"][:3])
            if brand_context.get("brand_context"):
                brand_context_str = brand_context["brand_context"]

        # Fallback: Extract brand name from website URL if still not set
        if not brand_name and request.website_url:
            try:
                from urllib.parse import urlparse
                import re
                domain = urlparse(request.website_url).netloc
                # Remove www. and TLD, extract the main name
                domain_name = domain.replace('www.', '').split('.')[0]
                # Convert camelCase/kebab-case to words: "kidscustomstories" -> "Kids Custom Stories"
                # Split on capital letters or hyphens/underscores
                words = re.split(r'(?<=[a-z])(?=[A-Z])|[-_]', domain_name)
                brand_name = ' '.join(word.capitalize() for word in words if word)
                logger.info("Extracted brand name from URL: %s", brand_name)
            except Exception as e:
                logger.warning("Failed to extract brand from URL: %s", str(e))

        # Use synthesized brief to fill in gaps if available
        target_audience = request.target_audience
        smp = request.single_minded_proposition
        tone_of_voice = request.tone_of_voice
        research_insights = ""
        
        if synthesized_brief and synthesized_brief.get("success"):
            # Fill in empty fields from synthesizer
            if not target_audience and synthesized_brief.get("target_audience"):
                target_audience = synthesized_brief["target_audience"]
                logger.info("Synthesizer filled in target_audience")
            if not smp and synthesized_brief.get("single_minded_proposition"):
                smp = synthesized_brief["single_minded_proposition"]
                logger.info("Synthesizer filled in SMP")
            if not tone_of_voice and synthesized_brief.get("tone_of_voice"):
                tone_of_voice = synthesized_brief["tone_of_voice"]
                logger.info("Synthesizer filled in tone_of_voice")
            if synthesized_brief.get("research_insights"):
                research_insights = synthesized_brief["research_insights"]
        
        # Convert request to brief
        brief = AdScriptBrief(
            objective=request.objective,
            target_audience=target_audience,
            single_minded_proposition=smp,
            tone_of_voice=tone_of_voice,
            asset_name=asset_name,
            length_seconds=request.length_seconds,
            mandatories=request.mandatories,
            parent_id=request.parent_id,
            creative_mode=CreativeMode(request.creative_mode) if request.creative_mode else CreativeMode.STANDARD,
            market=request.market or "uk",
            visual_style=request.visual_style,
            briefing_context=request.briefing_context,
            brand_name=brand_name,
            product_service=product_service,
            budget_range=request.budget_range,
            comms_style=request.comms_style,
            brand_colors=request.brand_colors,
            brand_context=brand_context_str,
            research_insights=research_insights,
        )
        
        # Build brief context (generate research insights, compliance requirements)
        self._build_brief_context(brief, synthesized_brief)
        
        # Create run
        run = AdScriptRun(brief=brief)
        self._runs[run.run_id] = run
        self._save_run(run)  # Persist immediately
        
        logger.info("Created run %s for asset '%s'", run.run_id, brief.asset_name)
        return run
    
    def _build_brief_context(self, brief: AdScriptBrief, synthesized_brief: dict = None) -> None:
        """
        Build additional context for the brief.
        
        Populates:
        - brand_context: Summary of brand/category
        - research_insights: Audience research summary
        - compliance_requirements: Extracted from mandatories + market-specific
        """
        # Build brand context if not already set
        if not brief.brand_context:
            context_parts = []
            if brief.brand_name:
                context_parts.append(f"Brand: {brief.brand_name}")
            if brief.product_service:
                context_parts.append(f"Product/Service: {brief.product_service}")
            if brief.comms_style:
                context_parts.append(f"Communications Style: {brief.comms_style}")
            if brief.brand_colors:
                context_parts.append(f"Brand Colors: {', '.join(brief.brand_colors)}")
            brief.brand_context = ". ".join(context_parts) if context_parts else ""
        
        # Extract compliance requirements from mandatories + market
        compliance_keywords = ["compliance", "clearcast", "ofcom", "asa", "bcap", 
                             "alcohol", "gambling", "health", "finance", "children",
                             "fcc", "ftc", "nad", "easa", "avmsd"]
        compliance_items = []
        
        for mandatory in brief.mandatories:
            mandatory_lower = mandatory.lower()
            if any(kw in mandatory_lower for kw in compliance_keywords):
                compliance_items.append(mandatory)
        
        # Add market-specific compliance notes
        market = getattr(brief, 'market', 'uk') or 'uk'
        market_compliance = {
            "uk": "UK market: BCAP Code, Clearcast pre-clearance required, ASA oversight",
            "usa": "US market: FTC guidelines, NAD review, network S&P clearance",
            "eu": "EU market: AVMSD compliance, EASA guidelines, national ASA coordination"
        }
        market_note = market_compliance.get(market.lower(), market_compliance["uk"])
        
        if compliance_items:
            brief.compliance_requirements = f"{market_note}. Additional: {', '.join(compliance_items)}"
        else:
            brief.compliance_requirements = market_note
        
        # Add synthesized compliance notes if available
        if synthesized_brief and synthesized_brief.get("compliance_notes"):
            brief.compliance_requirements += f"\n{synthesized_brief['compliance_notes']}"
        
        # Research insights - use synthesized if available, otherwise placeholder
        if not brief.research_insights:
            if synthesized_brief and synthesized_brief.get("research_insights"):
                brief.research_insights = synthesized_brief["research_insights"]
            else:
                brief.research_insights = f"Target audience: {brief.target_audience}"
    
    def get_run(self, run_id: str) -> Optional[AdScriptRun]:
        """Retrieve a run by ID."""
        return self._runs.get(run_id)
    
    def delete_run(self, run_id: str) -> bool:
        """Delete a run by ID."""
        if run_id in self._runs:
            del self._runs[run_id]
            self._delete_run_file(run_id)
            logger.info("Deleted run %s", run_id)
            return True
        return False
    
    def list_runs(self, limit: int = 20) -> List[AdScriptRun]:
        """List recent runs."""
        runs = sorted(
            self._runs.values(),
            key=lambda r: r.created_at,
            reverse=True
        )
        return runs[:limit]
    
    def update_run(self, run: AdScriptRun) -> None:
        """Update a run in memory and persist to disk."""
        run.updated_at = datetime.utcnow()
        self._runs[run.run_id] = run
        self._save_run(run)
    
    async def execute_run(self, run: AdScriptRun) -> AdScriptRun:
        """
        Execute the full pipeline for a run.
        
        This is the main entry point for running the multi-agent protocol.
        """
        pipeline_start = datetime.utcnow()
        
        try:
            run.status = RunStatus.RUNNING
            run.update_stage("starting")
            self._save_run(run)  # Persist status change
            
            mode_config = get_mode_config(run.brief.creative_mode)
            logger.info(
                "[%s] PIPELINE STARTED - mode=%s, neighbors=%d, ideas=%d",
                run.run_id[:8],
                run.brief.creative_mode,
                mode_config.neighbors,
                mode_config.ideas_count
            )
            
            # Stage 1: Retrieve relevant ads
            run.update_stage("retriever")
            await self._execute_stage(
                run, "retriever",
                run_retriever, 
                self.rag_client, 
                mode_config
            )
            self._save_run(run)  # Persist after each stage
            
            # Stage 2: Amazon "Working Backwards" document
            run.update_stage("amazon_start")
            await self._execute_stage(
                run, "amazon_start",
                run_amazon_start,
                mode_config
            )
            self._save_run(run)
            
            # Stage 3: Generate ideas
            run.update_stage("ideate")
            await self._execute_stage(
                run, "ideate",
                run_ideate,
                mode_config
            )
            self._save_run(run)
            
            # Stage 4: Select top 3
            run.update_stage("selector")
            await self._execute_stage(
                run, "selector",
                run_selector,
                mode_config
            )
            self._save_run(run)
            
            # Stage 5: Polish selected concepts
            run.update_stage("polish")
            await self._execute_stage(
                run, "polish",
                run_polish,
                mode_config
            )
            self._save_run(run)
            
            # Stage 6: Braintrust critique (may run multiple loops)
            for loop in range(mode_config.braintrust_loops):
                run.update_stage(f"braintrust_loop_{loop + 1}")
                await self._execute_stage(
                    run, "braintrust",
                    run_braintrust,
                    mode_config,
                    loop_number=loop + 1
                )
                self._save_run(run)
            
            # Stage 7: Compliance check
            run.update_stage("compliance")
            await self._execute_stage(
                run, "compliance",
                run_compliance,
                mode_config
            )
            self._save_run(run)

            # Stage 7.5: Auto-fix compliance issues
            run.update_stage("compliance_fix")
            await self._execute_stage(
                run, "compliance_fix",
                self._fix_compliance,
                mode_config
            )
            self._save_run(run)

            # Stage 8: Finalize
            run.update_stage("finalize")
            await self._execute_stage(
                run, "finalize",
                run_finalize,
                mode_config
            )
            
            run.status = RunStatus.COMPLETED
            run.update_stage("completed")
            self._save_run(run)  # Final save
            
            pipeline_duration = (datetime.utcnow() - pipeline_start).total_seconds()
            logger.info(
                "[%s] PIPELINE COMPLETED in %.1fs - final_script='%s'",
                run.run_id[:8],
                pipeline_duration,
                run.artifacts.final_script.title if run.artifacts.final_script else "None"
            )
            
        except asyncio.TimeoutError as e:
            pipeline_duration = (datetime.utcnow() - pipeline_start).total_seconds()
            logger.error(
                "[%s] PIPELINE TIMEOUT after %.1fs at stage '%s'",
                run.run_id[:8],
                pipeline_duration,
                run.current_stage
            )
            run.status = RunStatus.FAILED
            run.error = f"Pipeline timed out at stage '{run.current_stage}'"
            run.update_stage("failed", {"error": str(e), "timeout": True})
            self._save_run(run)
            
        except Exception as e:
            pipeline_duration = (datetime.utcnow() - pipeline_start).total_seconds()
            logger.exception(
                "[%s] PIPELINE FAILED after %.1fs at stage '%s': %s",
                run.run_id[:8],
                pipeline_duration,
                run.current_stage,
                str(e)
            )
            run.status = RunStatus.FAILED
            run.error = str(e)
            run.update_stage("failed", {"error": str(e)})
            self._save_run(run)  # Save failure state
        
        return run
    
    async def _execute_stage(
        self,
        run: AdScriptRun,
        stage_name: str,
        stage_func,
        *args,
        **kwargs
    ) -> None:
        """Execute a single pipeline stage with error handling and timing."""
        start_time = datetime.utcnow()
        
        # Get expected timeout for this stage (for logging)
        stage_config = AGENT_CONFIGS.get(stage_name, {})
        expected_timeout = stage_config.get("timeout_seconds") or stage_config.get("per_script_timeout_seconds", "N/A")
        
        try:
            logger.info(
                "[%s] Stage '%s' STARTED (timeout=%ss)",
                run.run_id[:8], stage_name, expected_timeout
            )
            await stage_func(run, *args, **kwargs)
            
            duration_s = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                "[%s] Stage '%s' COMPLETED in %.1fs",
                run.run_id[:8], stage_name, duration_s
            )
            
        except asyncio.TimeoutError as e:
            duration_s = (datetime.utcnow() - start_time).total_seconds()
            logger.error(
                "[%s] Stage '%s' TIMED OUT after %.1fs (limit=%ss)",
                run.run_id[:8], stage_name, duration_s, expected_timeout
            )
            raise
            
        except Exception as e:
            duration_s = (datetime.utcnow() - start_time).total_seconds()
            logger.error(
                "[%s] Stage '%s' FAILED after %.1fs: %s",
                run.run_id[:8], stage_name, duration_s, str(e)
            )
            raise

    async def _fix_compliance(
        self,
        run: AdScriptRun,
        config
    ) -> None:
        """
        Auto-fix compliance issues in polished scripts.

        Takes the compliance checks from stage 7 and applies fixes to resolve
        any flagged issues. Scripts arrive at finalize stage pre-cleared with
        only solutions (not warnings) to display.
        """
        polished = run.artifacts.polished_3
        compliance_checks = run.artifacts.compliance_checks

        if not polished:
            logger.warning("No polished scripts to fix")
            return

        if not compliance_checks:
            logger.warning("No compliance checks to fix against")
            return

        # Get market from brief
        market = getattr(run.brief, 'market', 'uk') or 'uk'

        logger.info(
            "Auto-fixing compliance issues for %d scripts (market=%s)",
            len(polished), market
        )

        # Run the fixer on all scripts
        fixed_scripts = await fix_all_scripts(polished, compliance_checks, market)

        # Update the polished scripts with fixed versions
        run.artifacts.polished_3 = fixed_scripts

        # Log summary of fixes
        total_fixes = sum(
            len(s.compliance_result.solutions_applied) if s.compliance_result else 0
            for s in fixed_scripts
        )
        logger.info(
            "Applied %d compliance fixes across %d scripts",
            total_fixes, len(fixed_scripts)
        )


# Global orchestrator instance
_orchestrator: Optional[AdScriptOrchestrator] = None


def get_orchestrator() -> AdScriptOrchestrator:
    """Get the global orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AdScriptOrchestrator()
    return _orchestrator


async def run_ad_script_protocol(request: AdScriptGenerateRequest) -> AdScriptRun:
    """
    Main entry point for generating an ad script.
    
    Creates a new run and executes the full pipeline.
    Pipeline includes a Synthesizer preprocessing step that transforms
    raw user inputs into a structured Master Creative Brief.
    
    Args:
        request: The generation request with brief details
        
    Returns:
        The completed (or failed) AdScriptRun with all artifacts
    """
    orchestrator = get_orchestrator()
    
    # Step 1: Run brand discovery if website URL provided
    brand_context = None
    if request.website_url:
        logger.info("Running brand discovery for: %s", request.website_url)
        try:
            brand_context = await run_brand_discovery(request.website_url)
            if brand_context.get("success"):
                logger.info("Brand discovery successful: %s", brand_context.get("brand_name", "Unknown"))
            else:
                logger.warning("Brand discovery failed: %s", brand_context.get("error", "Unknown error"))
        except Exception as e:
            logger.warning("Brand discovery error: %s", str(e))
    
    # Step 2: Run Synthesizer to create Master Creative Brief
    # This fills in gaps and structures the brief for downstream agents
    synthesized_brief = None
    needs_synthesis = (
        not request.target_audience or
        not request.single_minded_proposition or
        not request.tone_of_voice or
        request.briefing_context  # If user uploaded docs, always synthesize
    )
    
    if needs_synthesis:
        logger.info("Running Synthesizer to create Master Creative Brief")
        try:
            synthesized_brief = await run_synthesizer(request, brand_context)
            if synthesized_brief.get("success"):
                logger.info("Synthesizer completed - brief fields enhanced")
            else:
                logger.warning("Synthesizer did not produce results: %s", synthesized_brief.get("reason", "Unknown"))
        except Exception as e:
            logger.warning("Synthesizer error (continuing with raw inputs): %s", str(e))
    
    # Step 3: Create and execute the run
    run = orchestrator.create_run(request, brand_context, synthesized_brief)
    return await orchestrator.execute_run(run)
