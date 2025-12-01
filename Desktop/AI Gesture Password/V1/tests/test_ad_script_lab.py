"""
Tests for Ad Script Lab multi-agent protocol.
"""

import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from app.features.ad_script_lab.types import (
    AdScriptBrief,
    AdScriptRun,
    AdScriptGenerateRequest,
    CreativeMode,
    RunStatus,
    ScriptIdea,
    PolishedScript,
    RagNeighbor,
    ScriptScores,
)
from app.features.ad_script_lab.config import (
    get_mode_config,
    CreativeModeConfig,
    CREATIVE_MODE_CONFIGS,
)
from app.features.ad_script_lab.rag_client import (
    StubTvAdsRagClient,
    get_rag_client,
)
from app.features.ad_script_lab.orchestrator import (
    AdScriptOrchestrator,
    get_orchestrator,
)


# =============================================================================
# Type Tests
# =============================================================================

class TestTypes:
    """Test type definitions and schemas."""
    
    def test_creative_mode_enum(self):
        """Test CreativeMode enum values."""
        assert CreativeMode.LIGHT.value == "light_think"
        assert CreativeMode.STANDARD.value == "standard_think"
        assert CreativeMode.DEEP.value == "deep_think"
    
    def test_brief_defaults(self):
        """Test AdScriptBrief with minimal required fields."""
        brief = AdScriptBrief(
            objective="Test objective",
            target_audience="Test audience",
            single_minded_proposition="Test SMP",
            tone_of_voice="Test tone",
            asset_name="Test Asset"
        )
        
        assert brief.length_seconds == 30
        assert brief.mandatories == []
        assert brief.creative_mode == CreativeMode.STANDARD
        assert brief.budget_range == "£100k-250k"
        assert brief.compliance_requirements == "compliance categories: none explicitly specified"
    
    def test_brief_full_fields(self):
        """Test AdScriptBrief with all fields."""
        brief = AdScriptBrief(
            objective="Drive brand consideration",
            target_audience="25-44 ABC1",
            single_minded_proposition="The best choice",
            tone_of_voice="Warm and witty",
            asset_name="Summer Campaign",
            length_seconds=60,
            mandatories=["Include logo", "Mention sustainability"],
            creative_mode=CreativeMode.DEEP,
            brand_name="TestBrand",
            product_service="Test Product",
            budget_range="£250k-500k",
            brand_colors=["Blue", "Gold"],
        )
        
        assert brief.length_seconds == 60
        assert len(brief.mandatories) == 2
        assert brief.creative_mode == CreativeMode.DEEP
        assert brief.brand_name == "TestBrand"
    
    def test_run_status_enum(self):
        """Test RunStatus enum values."""
        assert RunStatus.PENDING.value == "pending"
        assert RunStatus.RUNNING.value == "running"
        assert RunStatus.COMPLETED.value == "completed"
        assert RunStatus.FAILED.value == "failed"
    
    def test_ad_script_run_defaults(self):
        """Test AdScriptRun initialization."""
        brief = AdScriptBrief(
            objective="Test",
            target_audience="Test",
            single_minded_proposition="Test",
            tone_of_voice="Test",
            asset_name="Test"
        )
        run = AdScriptRun(brief=brief)
        
        assert run.status == RunStatus.PENDING
        assert run.run_id is not None
        assert len(run.run_id) == 36  # UUID format
        assert run.current_stage == ""
        assert run.error is None
    
    def test_run_update_stage(self):
        """Test AdScriptRun stage update."""
        brief = AdScriptBrief(
            objective="Test",
            target_audience="Test",
            single_minded_proposition="Test",
            tone_of_voice="Test",
            asset_name="Test"
        )
        run = AdScriptRun(brief=brief)
        
        run.update_stage("retriever", {"neighbors": 10})
        
        assert run.current_stage == "retriever"
        assert len(run.stage_history) == 1
        assert run.stage_history[0]["stage"] == "retriever"
        assert run.stage_history[0]["details"]["neighbors"] == 10
    
    def test_script_idea_model(self):
        """Test ScriptIdea model."""
        idea = ScriptIdea(
            title="Test Concept",
            hook="An attention-grabbing opening",
            narrative="The story unfolds...",
            key_moments=["Moment 1", "Moment 2"],
            cta="Buy now",
            rationale="This works because..."
        )
        
        assert idea.title == "Test Concept"
        assert len(idea.key_moments) == 2
        assert idea.id is not None  # Auto-generated
    
    def test_polished_script_model(self):
        """Test PolishedScript model."""
        script = PolishedScript(
            title="Final Script",
            concept_id="abc123",
            opening="OPEN on...",
            development="The story continues...",
            climax="The peak moment...",
            resolution="CTA and logo"
        )
        
        assert script.estimated_duration_seconds == 30
        assert script.concept_id == "abc123"


# =============================================================================
# Config Tests
# =============================================================================

class TestConfig:
    """Test configuration system."""
    
    def test_mode_configs_exist(self):
        """Test all creative modes have configs."""
        assert "light_think" in CREATIVE_MODE_CONFIGS
        assert "standard_think" in CREATIVE_MODE_CONFIGS
        assert "deep_think" in CREATIVE_MODE_CONFIGS
    
    def test_get_mode_config(self):
        """Test get_mode_config function."""
        light = get_mode_config("light_think")
        standard = get_mode_config("standard_think")
        deep = get_mode_config("deep_think")
        
        assert isinstance(light, CreativeModeConfig)
        assert isinstance(standard, CreativeModeConfig)
        assert isinstance(deep, CreativeModeConfig)
    
    def test_mode_config_progression(self):
        """Test that configs increase in depth/cost."""
        light = get_mode_config("light_think")
        standard = get_mode_config("standard_think")
        deep = get_mode_config("deep_think")
        
        # Neighbors should increase
        assert light.neighbors < standard.neighbors <= deep.neighbors
        
        # Ideas count should be reasonable
        assert light.ideas_count <= standard.ideas_count <= deep.ideas_count
        
        # Braintrust loops should increase for deep
        assert deep.braintrust_loops >= standard.braintrust_loops
    
    def test_invalid_mode_returns_standard(self):
        """Test that invalid mode returns standard config."""
        config = get_mode_config("invalid_mode")
        standard = get_mode_config("standard_think")
        
        assert config.neighbors == standard.neighbors
        assert config.ideas_count == standard.ideas_count


# =============================================================================
# RAG Client Tests
# =============================================================================

class TestRagClient:
    """Test RAG client functionality."""
    
    @pytest.mark.asyncio
    async def test_stub_client_retrieves_neighbors(self):
        """Test stub client returns mock neighbors."""
        client = StubTvAdsRagClient()
        
        neighbors = await client.retrieve(
            query="emotional christmas ad retail",
            limit=5
        )
        
        assert len(neighbors) <= 5
        assert all(isinstance(n, RagNeighbor) for n in neighbors)
    
    @pytest.mark.asyncio
    async def test_stub_client_neighbors_have_scores(self):
        """Test stub client assigns similarity scores."""
        client = StubTvAdsRagClient()
        
        neighbors = await client.retrieve(query="test", limit=3)
        
        for neighbor in neighbors:
            assert 0 <= neighbor.similarity_score <= 1
    
    @pytest.mark.asyncio
    async def test_stub_client_get_by_id(self):
        """Test retrieving a specific ad by ID."""
        client = StubTvAdsRagClient()
        
        ad = await client.get_by_id("mock-001")
        
        assert ad is not None
        assert ad.id == "mock-001"
        assert ad.brand == "John Lewis"
    
    @pytest.mark.asyncio
    async def test_stub_client_get_by_id_not_found(self):
        """Test get_by_id returns None for unknown ID."""
        client = StubTvAdsRagClient()
        
        ad = await client.get_by_id("nonexistent-id")
        
        assert ad is None
    
    @pytest.mark.asyncio
    async def test_stub_client_health_check(self):
        """Test health check returns True."""
        client = StubTvAdsRagClient()
        
        healthy = await client.health_check()
        
        assert healthy is True
    
    def test_get_rag_client_returns_stub(self):
        """Test factory returns stub client when no Supabase config."""
        client = get_rag_client()
        
        assert isinstance(client, StubTvAdsRagClient)


# =============================================================================
# Orchestrator Tests
# =============================================================================

class TestOrchestrator:
    """Test orchestrator functionality."""
    
    def test_orchestrator_singleton(self):
        """Test get_orchestrator returns singleton."""
        orch1 = get_orchestrator()
        orch2 = get_orchestrator()
        
        assert orch1 is orch2
    
    def test_create_run_from_request(self):
        """Test creating a run from an API request."""
        orchestrator = AdScriptOrchestrator()
        
        request = AdScriptGenerateRequest(
            objective="Test objective",
            target_audience="Test audience",
            single_minded_proposition="Test SMP",
            tone_of_voice="Test tone",
            asset_name="Test Asset",
            brand_name="TestBrand"
        )
        
        run = orchestrator.create_run(request)
        
        assert run.brief.objective == "Test objective"
        assert run.brief.brand_name == "TestBrand"
        assert run.status == RunStatus.PENDING
    
    def test_create_run_builds_context(self):
        """Test that create_run builds brief context."""
        orchestrator = AdScriptOrchestrator()
        
        request = AdScriptGenerateRequest(
            objective="Test",
            target_audience="Test",
            single_minded_proposition="Test",
            tone_of_voice="Test",
            asset_name="Test",
            brand_name="TestBrand",
            product_service="TestProduct",
            mandatories=["alcohol compliance", "include logo"]
        )
        
        run = orchestrator.create_run(request)
        
        assert "TestBrand" in run.brief.brand_context
        assert "TestProduct" in run.brief.brand_context
        assert "alcohol" in run.brief.compliance_requirements.lower()
    
    def test_get_run(self):
        """Test retrieving a run by ID."""
        orchestrator = AdScriptOrchestrator()
        
        request = AdScriptGenerateRequest(
            objective="Test",
            target_audience="Test",
            single_minded_proposition="Test",
            tone_of_voice="Test",
            asset_name="Test"
        )
        
        run = orchestrator.create_run(request)
        retrieved = orchestrator.get_run(run.run_id)
        
        assert retrieved is not None
        assert retrieved.run_id == run.run_id
    
    def test_get_run_not_found(self):
        """Test get_run returns None for unknown ID."""
        orchestrator = AdScriptOrchestrator()
        
        retrieved = orchestrator.get_run("nonexistent-id")
        
        assert retrieved is None
    
    def test_list_runs(self):
        """Test listing runs."""
        orchestrator = AdScriptOrchestrator()
        
        # Create a few runs
        for i in range(3):
            request = AdScriptGenerateRequest(
                objective=f"Test {i}",
                target_audience="Test",
                single_minded_proposition="Test",
                tone_of_voice="Test",
                asset_name=f"Asset {i}"
            )
            orchestrator.create_run(request)
        
        runs = orchestrator.list_runs(limit=10)
        
        assert len(runs) >= 3
    
    @pytest.mark.asyncio
    async def test_execute_run_updates_status(self):
        """Test that execute_run updates run status."""
        orchestrator = AdScriptOrchestrator()
        
        request = AdScriptGenerateRequest(
            objective="Test",
            target_audience="Test",
            single_minded_proposition="Test",
            tone_of_voice="Test",
            asset_name="Test"
        )
        
        run = orchestrator.create_run(request)
        assert run.status == RunStatus.PENDING
        
        # Mock all agent functions to avoid real API calls
        with patch('app.features.ad_script_lab.orchestrator.run_retriever', new_callable=AsyncMock), \
             patch('app.features.ad_script_lab.orchestrator.run_amazon_start', new_callable=AsyncMock), \
             patch('app.features.ad_script_lab.orchestrator.run_ideate', new_callable=AsyncMock), \
             patch('app.features.ad_script_lab.orchestrator.run_selector', new_callable=AsyncMock), \
             patch('app.features.ad_script_lab.orchestrator.run_polish', new_callable=AsyncMock), \
             patch('app.features.ad_script_lab.orchestrator.run_braintrust', new_callable=AsyncMock), \
             patch('app.features.ad_script_lab.orchestrator.run_compliance', new_callable=AsyncMock), \
             patch('app.features.ad_script_lab.orchestrator.run_finalize', new_callable=AsyncMock):
            
            result = await orchestrator.execute_run(run)
        
        assert result.status == RunStatus.COMPLETED
        assert result.current_stage == "completed"
    
    @pytest.mark.asyncio
    async def test_execute_run_handles_errors(self):
        """Test that execute_run handles agent errors gracefully."""
        orchestrator = AdScriptOrchestrator()
        
        request = AdScriptGenerateRequest(
            objective="Test",
            target_audience="Test",
            single_minded_proposition="Test",
            tone_of_voice="Test",
            asset_name="Test"
        )
        
        run = orchestrator.create_run(request)
        
        # Mock retriever to raise an error
        async def failing_retriever(*args, **kwargs):
            raise RuntimeError("Test error")
        
        with patch('app.features.ad_script_lab.orchestrator.run_retriever', new=failing_retriever):
            result = await orchestrator.execute_run(run)
        
        assert result.status == RunStatus.FAILED
        assert "Test error" in result.error


# =============================================================================
# Agent Tests (Mocked)
# =============================================================================

class TestAgents:
    """Test individual agent functions."""
    
    @pytest.mark.asyncio
    async def test_retriever_agent(self):
        """Test retriever agent updates run state."""
        from app.features.ad_script_lab.agents.retriever import run_retriever
        
        brief = AdScriptBrief(
            objective="Test",
            target_audience="Test",
            single_minded_proposition="Test",
            tone_of_voice="Test",
            asset_name="Test"
        )
        run = AdScriptRun(brief=brief)
        
        rag_client = StubTvAdsRagClient()
        config = get_mode_config("standard_think")
        
        await run_retriever(run, rag_client, config)
        
        assert len(run.retrieval.neighbors) > 0
        assert run.retrieval.retrieval_time_ms > 0


# =============================================================================
# Integration Test (Mocked LLM)
# =============================================================================

class TestIntegration:
    """Integration tests with mocked LLM."""
    
    @pytest.mark.asyncio
    async def test_full_pipeline_mocked(self):
        """Test full pipeline with mocked Gemini responses."""
        from app.features.ad_script_lab.orchestrator import run_ad_script_protocol
        
        # Mock all LLM calls
        with patch('app.features.ad_script_lab.agents.amazon_start.create_gemini_model') as mock_gemini, \
             patch('app.features.ad_script_lab.agents.ideate.create_gemini_model') as mock_ideate, \
             patch('app.features.ad_script_lab.agents.selector.create_gemini_model') as mock_select, \
             patch('app.features.ad_script_lab.agents.polish.create_gemini_model') as mock_polish, \
             patch('app.features.ad_script_lab.agents.braintrust.create_gemini_model') as mock_brain, \
             patch('app.features.ad_script_lab.agents.compliance.create_gemini_model') as mock_comp, \
             patch('app.features.ad_script_lab.agents.finalize.create_gemini_model') as mock_final:
            
            # All mocks return None to trigger fallback behavior
            for mock in [mock_gemini, mock_ideate, mock_select, mock_polish, 
                        mock_brain, mock_comp, mock_final]:
                mock.return_value = None
            
            request = AdScriptGenerateRequest(
                objective="Drive brand consideration",
                target_audience="25-44 ABC1 adults",
                single_minded_proposition="The refreshing choice",
                tone_of_voice="Warm and aspirational",
                asset_name="Summer Refresh Campaign",
                brand_name="TestBrand",
                creative_mode="light_think"  # Use light for faster test
            )
            
            result = await run_ad_script_protocol(request)
        
        assert result.status == RunStatus.COMPLETED
        assert result.brief.asset_name == "Summer Refresh Campaign"
        assert len(result.retrieval.neighbors) > 0
        
        # With fallbacks, we should still have artifacts
        assert result.artifacts.press_release != ""
        assert len(result.artifacts.ideas_10) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])








