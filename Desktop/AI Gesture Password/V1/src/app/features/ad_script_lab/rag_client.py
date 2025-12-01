"""
RAG Client for TV Ads Archive.

Provides an interface for retrieving relevant TV ads from the Supabase-hosted
embedding_items and ads tables using hybrid semantic + lexical search.

Tables:
- embedding_items: text, embedding (vector(1536)), ad_id, item_type, meta
- ads: brand_name, product_name, year, country, one_line_summary, etc.

Embedding Model: text-embedding-3-large (1536 dimensions)
"""

import logging
import os
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
import json

from .types import RagNeighbor

logger = logging.getLogger(__name__)

# Try to import OpenAI for embeddings
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI not installed - Supabase RAG will not work")

# Try to import Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None  # Type stub for when supabase is not installed
    create_client = None
    logger.warning("Supabase client not installed - using stub RAG client")


class BaseTvAdsRagClient(ABC):
    """Abstract base class for TV ads RAG retrieval."""
    
    @abstractmethod
    async def retrieve(
        self,
        query: str,
        limit: int = 10,
        min_similarity: float = 0.3,
        filters: Optional[dict] = None
    ) -> List[RagNeighbor]:
        """
        Retrieve relevant TV ads based on a query.
        
        Args:
            query: Natural language query describing the desired ads
            limit: Maximum number of results to return
            min_similarity: Minimum similarity score threshold
            filters: Optional filters (e.g., category, year range, brand)
            
        Returns:
            List of RagNeighbor objects sorted by relevance
        """
        pass
    
    @abstractmethod
    async def get_by_id(self, ad_id: str) -> Optional[RagNeighbor]:
        """Retrieve a specific ad by ID."""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the RAG service is available."""
        pass


class StubTvAdsRagClient(BaseTvAdsRagClient):
    """
    Stubbed RAG client returning mock data.
    
    This implementation provides realistic-looking mock data for development
    and testing. Replace with SupabaseTvAdsRagClient when ready.
    """
    
    def __init__(self):
        self._mock_ads = self._generate_mock_ads()
        logger.info("Initialized StubTvAdsRagClient with %d mock ads", len(self._mock_ads))
    
    def _generate_mock_ads(self) -> List[RagNeighbor]:
        """Generate mock TV ad entries for testing."""
        return [
            RagNeighbor(
                id="mock-001",
                title="The Journey Home",
                brand="John Lewis",
                category="Retail",
                year=2023,
                description="Emotional Christmas ad following a child's journey to find the perfect gift for their parent. Features stop-motion animation and a cover of a classic song.",
                script_excerpt="OPEN on a snow-covered village... A child peers through a frosted window...",
                video_url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                effectiveness_score=8.5,
                awards=["British Arrows Gold", "Creative Circle Silver"],
                similarity_score=0.0,
                tags=["emotional", "christmas", "animation", "family", "gift-giving"]
            ),
            RagNeighbor(
                id="mock-002",
                title="Impossible is Nothing",
                brand="Adidas",
                category="Sports/Fitness",
                year=2022,
                description="High-energy sports montage featuring diverse athletes overcoming personal challenges. Features quick cuts and inspiring voiceover.",
                script_excerpt="VO: They said you couldn't... QUICK CUTS of athletes training in dawn light...",
                effectiveness_score=7.8,
                awards=["Cannes Bronze"],
                similarity_score=0.0,
                tags=["inspirational", "sports", "montage", "diversity", "achievement"]
            ),
            RagNeighbor(
                id="mock-003",
                title="Real Taste Guarantee",
                brand="Heinz",
                category="Food & Beverage",
                year=2023,
                description="Slice-of-life comedy showing various people's reactions when they accidentally use a non-Heinz ketchup. Warm, relatable humor.",
                script_excerpt="INT. KITCHEN - DAY. A family sits down to dinner. Dad reaches for the ketchup...",
                effectiveness_score=7.2,
                awards=[],
                similarity_score=0.0,
                tags=["comedy", "food", "relatable", "slice-of-life", "brand-loyalty"]
            ),
            RagNeighbor(
                id="mock-004",
                title="Connected",
                brand="Vodafone",
                category="Telecommunications",
                year=2022,
                description="Touching story of a grandmother learning to video call her grandchildren abroad. Demonstrates technology bridging distances.",
                script_excerpt="CLOSE UP on weathered hands holding a smartphone. We hear a child's voice: 'Hi Nana!'",
                effectiveness_score=8.0,
                awards=["D&AD Graphite Pencil"],
                similarity_score=0.0,
                tags=["emotional", "technology", "family", "connection", "elderly"]
            ),
            RagNeighbor(
                id="mock-005",
                title="Morning Ritual",
                brand="Nescafé",
                category="Food & Beverage",
                year=2023,
                description="ASMR-style coffee preparation sequence with beautiful cinematography. Minimal dialogue, focuses on sensory experience.",
                script_excerpt="EXTREME CLOSE UP: Coffee grounds falling into a filter. The rich aroma seems to fill the screen...",
                effectiveness_score=6.9,
                awards=[],
                similarity_score=0.0,
                tags=["sensory", "asmr", "minimal", "premium", "morning"]
            ),
            RagNeighbor(
                id="mock-006",
                title="The Audition",
                brand="Maltesers",
                category="Confectionery",
                year=2022,
                description="Disability-inclusive comedy featuring a woman in a wheelchair auditioning for a play. Sharp, witty humor that challenges stereotypes.",
                script_excerpt="INT. THEATRE - DAY. A casting director looks uncomfortable. 'So, about the wheelchair...'",
                effectiveness_score=8.3,
                awards=["Channel 4 Diversity Award", "Campaign Big Award"],
                similarity_score=0.0,
                tags=["comedy", "inclusive", "disability", "witty", "progressive"]
            ),
            RagNeighbor(
                id="mock-007",
                title="Carbon Neutral by 2030",
                brand="BP",
                category="Energy",
                year=2023,
                description="Corporate sustainability message with documentary-style footage of renewable energy projects. Serious tone with hopeful conclusion.",
                script_excerpt="DRONE SHOT of wind turbines at sunset. VO: 'The journey to net zero starts with a single step...'",
                effectiveness_score=5.5,
                awards=[],
                similarity_score=0.0,
                tags=["corporate", "sustainability", "documentary", "energy", "environmental"]
            ),
            RagNeighbor(
                id="mock-008",
                title="Game Day",
                brand="Sky Sports",
                category="Entertainment",
                year=2023,
                description="Fast-paced montage of Premier League football moments. Captures the drama and emotion of live sport.",
                script_excerpt="RAPID FIRE CUTS: Goals, saves, celebrations. VO (intense): 'This is what you came for...'",
                effectiveness_score=7.5,
                awards=["Promax Gold"],
                similarity_score=0.0,
                tags=["sports", "action", "dramatic", "live", "entertainment"]
            ),
            RagNeighbor(
                id="mock-009",
                title="The Talk",
                brand="P&G (Always)",
                category="Personal Care",
                year=2022,
                description="Powerful social commentary about parents having 'the talk' with Black children about racial bias. Documentary-style interviews.",
                script_excerpt="INTERVIEW SETUP. Mother: 'I never thought I'd have to explain to my son why...'",
                effectiveness_score=9.1,
                awards=["Cannes Grand Prix", "One Show Best of Show"],
                similarity_score=0.0,
                tags=["social-purpose", "documentary", "racial-equality", "powerful", "authentic"]
            ),
            RagNeighbor(
                id="mock-010",
                title="Dream Bigger",
                brand="Barclays",
                category="Finance",
                year=2023,
                description="Aspirational ad following a young entrepreneur building their business with bank support. Warm, optimistic tone.",
                script_excerpt="TIMELAPSE: An empty shop transforms into a thriving bakery. VO: 'Every big dream starts somewhere small...'",
                effectiveness_score=6.8,
                awards=[],
                similarity_score=0.0,
                tags=["finance", "aspirational", "entrepreneurship", "support", "growth"]
            ),
            RagNeighbor(
                id="mock-011",
                title="Midnight Feast",
                brand="Cadbury",
                category="Confectionery",
                year=2022,
                description="Nostalgic recreation of childhood midnight snacking. Warm, cozy aesthetic with subtle humor.",
                script_excerpt="INT. DARK BEDROOM - NIGHT. A child's feet pad silently down the hallway...",
                effectiveness_score=7.7,
                awards=["British Arrows Silver"],
                similarity_score=0.0,
                tags=["nostalgia", "childhood", "warmth", "indulgence", "nighttime"]
            ),
            RagNeighbor(
                id="mock-012",
                title="The List",
                brand="IKEA",
                category="Retail",
                year=2023,
                description="A couple arguing over a shopping list that becomes increasingly absurd. Physical comedy and witty dialogue.",
                script_excerpt="INT. CAR - DAY. HE: 'Did you remember the MALM?' SHE: 'The what?' HE: (dramatic pause) 'The MALM.'",
                effectiveness_score=7.4,
                awards=["Creative Circle Bronze"],
                similarity_score=0.0,
                tags=["comedy", "couples", "absurd", "dialogue-driven", "retail"]
            ),
        ]
    
    async def retrieve(
        self,
        query: str,
        limit: int = 10,
        min_similarity: float = 0.3,
        filters: Optional[dict] = None
    ) -> List[RagNeighbor]:
        """
        Stub implementation - returns mock ads with simulated similarity scores.
        
        In production, this would:
        1. Embed the query using the same model as the indexed ads
        2. Perform vector similarity search against Supabase pgvector
        3. Apply any filters (category, year, etc.)
        4. Return sorted results
        """
        logger.info("StubTvAdsRagClient.retrieve called with query: %s", query[:100])
        
        # Simulate some relevance scoring based on keyword matching
        query_lower = query.lower()
        keywords = query_lower.split()
        
        scored_ads = []
        for ad in self._mock_ads:
            # Simple keyword-based scoring for stub
            score = 0.0
            searchable = f"{ad.title} {ad.brand} {ad.category} {ad.description} {' '.join(ad.tags)}".lower()
            
            for kw in keywords:
                if kw in searchable:
                    score += 0.1
            
            # Add some randomness to simulate embedding similarity
            import random
            score = min(1.0, score + random.uniform(0.3, 0.6))
            
            if score >= min_similarity:
                ad_copy = ad.model_copy()
                ad_copy.similarity_score = round(score, 3)
                scored_ads.append(ad_copy)
        
        # Sort by similarity and limit
        scored_ads.sort(key=lambda x: x.similarity_score, reverse=True)
        return scored_ads[:limit]
    
    async def get_by_id(self, ad_id: str) -> Optional[RagNeighbor]:
        """Retrieve a specific mock ad by ID."""
        for ad in self._mock_ads:
            if ad.id == ad_id:
                return ad
        return None
    
    async def health_check(self) -> bool:
        """Stub always returns healthy."""
        return True


class SupabaseTvAdsRagClient(BaseTvAdsRagClient):
    """
    Supabase-backed RAG client for production use.
    
    Uses the embedding_items and ads tables with hybrid search
    (semantic via pgvector + lexical via tsvector).
    
    Schema:
    - embedding_items: id, ad_id, item_type, text, embedding (vector(1536)), meta, search_vector
    - ads: brand_name, product_name, product_category, year, country, one_line_summary, etc.
    
    Embedding Model: text-embedding-3-large (1536 dimensions)
    """
    
    def __init__(
        self, 
        supabase_url: str, 
        supabase_key: str,
        openai_api_key: Optional[str] = None,
        embedding_model: str = "text-embedding-3-large"
    ):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.openai_api_key = openai_api_key or os.environ.get("OPENAI_API_KEY")
        self.embedding_model = embedding_model
        self._client: Optional[Client] = None
        self._openai: Optional[OpenAI] = None
        logger.info("SupabaseTvAdsRagClient initialized for %s", supabase_url)
    
    def _ensure_client(self) -> Client:
        """Lazy initialization of Supabase client."""
        if self._client is None:
            if not SUPABASE_AVAILABLE:
                raise RuntimeError("Supabase client not installed. Run: pip install supabase")
            self._client = create_client(self.supabase_url, self.supabase_key)
        return self._client
    
    def _ensure_openai(self) -> OpenAI:
        """Lazy initialization of OpenAI client."""
        if self._openai is None:
            if not OPENAI_AVAILABLE:
                raise RuntimeError("OpenAI not installed. Run: pip install openai")
            if not self.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY not set")
            self._openai = OpenAI(api_key=self.openai_api_key)
        return self._openai
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for query text using OpenAI."""
        openai = self._ensure_openai()
        
        response = openai.embeddings.create(
            model=self.embedding_model,
            input=text,
            dimensions=1536  # Match schema
        )
        
        return response.data[0].embedding
    
    async def retrieve(
        self,
        query: str,
        limit: int = 10,
        min_similarity: float = 0.3,
        filters: Optional[dict] = None
    ) -> List[RagNeighbor]:
        """
        Retrieve relevant TV ads from Supabase using hybrid search.

        1. Generate embedding for query using OpenAI
        2. Query embedding_items with vector similarity using pgvector
        3. Join with ads table for metadata
        4. Return as RagNeighbor objects sorted by similarity
        """
        try:
            client = self._ensure_client()

            # Generate query embedding
            logger.info("Generating embedding for query: %s", query[:100])
            query_embedding = self._generate_embedding(query)

            # Item types that contain the most searchable content for similarity matching
            SEARCHABLE_ITEM_TYPES = [
                'impact_summary',
                'creative_dna',
                'effectiveness_insight',
                'memorable_elements',
                'distinctive_assets',
            ]

            # First, try the RPC function for vector similarity search
            # This is the most efficient way to do similarity search with pgvector
            try:
                logger.debug("Attempting RPC match_embedding_items_hybrid call")
                rpc_result = client.rpc(
                    'match_embedding_items_hybrid',
                    {
                        'query_embedding': query_embedding,
                        'limit_count': limit * 3,  # Get extra for deduplication
                        'item_types': SEARCHABLE_ITEM_TYPES,
                        'query_text': query[:500]  # Required for hybrid search
                    }
                ).execute()

                if rpc_result.data:
                    logger.info("RPC match_embedding_items_hybrid returned %d results", len(rpc_result.data))
                    return self._parse_rpc_results(rpc_result.data, limit)

            except Exception as rpc_error:
                logger.warning("RPC match_embedding_items_hybrid failed: %s. Falling back to manual search.", str(rpc_error))

            # Fallback: Manual similarity calculation
            # Fetch items and compute similarity in Python (less efficient but works without RPC)
            logger.debug("Using fallback manual similarity search")

            result = client.from_('embedding_items') \
                .select('''
                    id,
                    ad_id,
                    item_type,
                    text,
                    embedding,
                    meta,
                    ads!inner(
                        brand_name,
                        product_name,
                        product_category,
                        year,
                        country,
                        one_line_summary,
                        story_summary,
                        performance_metrics
                    )
                ''') \
                .in_('item_type', SEARCHABLE_ITEM_TYPES) \
                .limit(200) \
                .execute()

            if not result.data:
                logger.warning("No results from Supabase query")
                return []

            # Compute similarity scores manually
            import numpy as np
            query_vec = np.array(query_embedding)
            query_norm = np.linalg.norm(query_vec)

            scored_items = []
            for row in result.data:
                embedding = row.get('embedding')
                if not embedding:
                    continue

                # Parse embedding if it's a string
                if isinstance(embedding, str):
                    try:
                        embedding = json.loads(embedding)
                    except:
                        continue

                # Compute cosine similarity
                item_vec = np.array(embedding)
                item_norm = np.linalg.norm(item_vec)
                if item_norm == 0:
                    continue

                similarity = float(np.dot(query_vec, item_vec) / (query_norm * item_norm))

                if similarity >= min_similarity:
                    scored_items.append((similarity, row))

            # Sort by similarity
            scored_items.sort(key=lambda x: x[0], reverse=True)

            # Parse results into RagNeighbor objects, deduplicating by ad_id
            neighbors = []
            seen_ads = set()

            for similarity, row in scored_items:
                ad_id = row.get('ad_id')
                if ad_id in seen_ads:
                    continue
                seen_ads.add(ad_id)

                ads_data = row.get('ads', {})
                meta = row.get('meta', {})
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except:
                        meta = {}

                # Extract performance metrics for effectiveness score
                perf = ads_data.get('performance_metrics', {})
                if isinstance(perf, str):
                    try:
                        perf = json.loads(perf)
                    except:
                        perf = {}

                effectiveness = None
                if perf:
                    scores = []
                    if perf.get('views'):
                        scores.append(min(10, perf['views'] / 1000000))
                    if perf.get('engagement_rate'):
                        scores.append(perf['engagement_rate'] * 10)
                    if scores:
                        effectiveness = sum(scores) / len(scores)

                neighbor = RagNeighbor(
                    id=ad_id,
                    title=ads_data.get('product_name', '') or row.get('text', '')[:50],
                    brand=ads_data.get('brand_name', ''),
                    category=ads_data.get('product_category', ''),
                    year=ads_data.get('year'),
                    description=ads_data.get('one_line_summary', '') or ads_data.get('story_summary', ''),
                    script_excerpt=row.get('text', '')[:300],
                    video_url=None,
                    effectiveness_score=effectiveness,
                    awards=[],
                    similarity_score=round(similarity, 4),
                    tags=self._extract_tags(ads_data, meta)
                )
                neighbors.append(neighbor)

                if len(neighbors) >= limit:
                    break

            logger.info("Retrieved %d neighbors from Supabase (manual similarity)", len(neighbors))
            return neighbors

        except Exception as e:
            logger.error("Supabase retrieval failed: %s", str(e))
            raise
    
    def _parse_rpc_results(self, data: List[Dict], limit: int) -> List[RagNeighbor]:
        """Parse results from match_embedding_items RPC."""
        neighbors = []
        seen_ads = set()
        
        for row in data:
            ad_id = row.get('ad_id')
            if ad_id in seen_ads:
                continue
            seen_ads.add(ad_id)
            
            neighbor = RagNeighbor(
                id=ad_id,
                title=row.get('title', row.get('text', '')[:50]),
                brand=row.get('brand_name', ''),
                category=row.get('product_category', ''),
                year=row.get('year'),
                description=row.get('one_line_summary', row.get('text', '')),
                script_excerpt=row.get('text', '')[:300],
                video_url=None,  # video_url column does not exist in ads table
                effectiveness_score=row.get('effectiveness_score'),
                awards=[],
                similarity_score=row.get('similarity', 0.8),
                tags=row.get('tags', [])
            )
            neighbors.append(neighbor)
            
            if len(neighbors) >= limit:
                break
        
        return neighbors
    
    def _extract_tags(self, ads_data: Dict, meta: Dict) -> List[str]:
        """Extract relevant tags from ad data."""
        tags = []
        
        if ads_data.get('product_category'):
            tags.append(ads_data['product_category'].lower())
        if ads_data.get('country'):
            tags.append(ads_data['country'].lower())
        if ads_data.get('format_type'):
            tags.append(ads_data['format_type'].lower())
        if ads_data.get('objective'):
            tags.append(ads_data['objective'].lower())
        if ads_data.get('funnel_stage'):
            tags.append(ads_data['funnel_stage'].lower())
        
        # Add any tags from meta
        if meta.get('tags'):
            if isinstance(meta['tags'], list):
                tags.extend(meta['tags'])
            elif isinstance(meta['tags'], str):
                tags.extend(meta['tags'].split(','))
        
        return list(set(t.strip() for t in tags if t))[:10]
    
    async def get_by_id(self, ad_id: str) -> Optional[RagNeighbor]:
        """Retrieve a specific ad by ID from Supabase."""
        try:
            client = self._ensure_client()
            
            result = client.from_('ads') \
                .select('*') \
                .eq('id', ad_id) \
                .single() \
                .execute()
            
            if not result.data:
                return None
            
            row = result.data
            return RagNeighbor(
                id=row.get('id'),
                title=row.get('product_name', ''),
                brand=row.get('brand_name', ''),
                category=row.get('product_category', ''),
                year=row.get('year'),
                description=row.get('one_line_summary', ''),
                script_excerpt=row.get('story_summary', '')[:300] if row.get('story_summary') else '',
                video_url=None,  # video_url column does not exist in ads table
                effectiveness_score=None,
                awards=[],
                similarity_score=1.0,
                tags=[]
            )
            
        except Exception as e:
            logger.error("Supabase get_by_id failed: %s", str(e))
            return None
    
    async def health_check(self) -> bool:
        """Check Supabase connection health."""
        try:
            client = self._ensure_client()
            # Simple query to verify connection
            result = client.from_('ads').select('id').limit(1).execute()
            return True
        except Exception as e:
            logger.error("Supabase health check failed: %s", e)
            return False


def get_rag_client() -> BaseTvAdsRagClient:
    """
    Factory function to get the appropriate RAG client.
    
    Returns SupabaseTvAdsRagClient if SUPABASE_URL and SUPABASE_KEY 
    environment variables are set, otherwise returns StubTvAdsRagClient.
    
    Required env vars for Supabase:
    - SUPABASE_URL: Supabase project URL
    - SUPABASE_KEY: Supabase anon/service key
    - OPENAI_API_KEY: OpenAI API key for embeddings
    """
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    if supabase_url and supabase_key:
        if not SUPABASE_AVAILABLE:
            logger.warning("Supabase credentials found but supabase-py not installed. Using stub client.")
            return StubTvAdsRagClient()
        
        if not openai_key:
            logger.warning("SUPABASE credentials found but OPENAI_API_KEY not set. Using stub client.")
            return StubTvAdsRagClient()
        
        if not OPENAI_AVAILABLE:
            logger.warning("Supabase credentials found but openai not installed. Using stub client.")
            return StubTvAdsRagClient()
        
        logger.info("Initializing Supabase RAG client for %s", supabase_url)
        return SupabaseTvAdsRagClient(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            openai_api_key=openai_key
        )
    
    logger.info("No Supabase credentials found, using stub RAG client")
    return StubTvAdsRagClient()

