"""
Benchmark Service for Ad Performance Analysis.

Provides category-level benchmarks and percentile rankings by querying
the Supabase RAG database for aggregate statistics.
"""

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
import statistics

logger = logging.getLogger(__name__)

# Try to import Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None
    create_client = None
    logger.warning("Supabase client not installed - benchmarks will use stub data")


@dataclass
class MetricBenchmark:
    """Benchmark data for a single metric."""
    value: float  # The ad's score
    percentile: int  # Percentile rank (0-100)
    category_avg: float  # Average in category
    category_min: float  # Minimum in category
    category_max: float  # Maximum in category
    sample_size: int  # Number of ads in sample


@dataclass 
class BenchmarkResult:
    """Complete benchmark result for an ad."""
    category: str
    sample_size: int
    metrics: Dict[str, MetricBenchmark] = field(default_factory=dict)
    insights: List[str] = field(default_factory=list)
    strengths: List[str] = field(default_factory=list)
    improvements: List[str] = field(default_factory=list)


class BenchmarkService:
    """
    Service for calculating ad performance benchmarks against category peers.
    
    Uses the Supabase RAG database to fetch aggregate statistics and
    calculate percentile rankings for the analyzed ad.
    """
    
    def __init__(self, supabase_url: Optional[str] = None, supabase_key: Optional[str] = None):
        self.supabase_url = supabase_url or os.environ.get("SUPABASE_URL")
        self.supabase_key = supabase_key or os.environ.get("SUPABASE_KEY")
        self._client: Optional[Client] = None
        self._cache: Dict[str, Dict] = {}  # Category -> aggregated data cache
    
    def _ensure_client(self) -> Optional[Client]:
        """Lazy initialization of Supabase client."""
        if self._client is None and SUPABASE_AVAILABLE and self.supabase_url and self.supabase_key:
            self._client = create_client(self.supabase_url, self.supabase_key)
        return self._client
    
    def _calculate_percentile(self, value: float, values: List[float]) -> int:
        """Calculate the percentile rank of a value within a list of values."""
        if not values or len(values) == 0:
            return 50  # Default to median if no data
        
        # Count how many values are less than the given value
        count_below = sum(1 for v in values if v < value)
        percentile = (count_below / len(values)) * 100
        return min(99, max(1, int(percentile)))  # Clamp to 1-99
    
    def _extract_effectiveness_scores(self, ads_data: List[Dict]) -> Dict[str, List[float]]:
        """
        Extract effectiveness scores from ads data.
        
        Looks for scores in various locations within the ad data structure.
        """
        scores = {
            'overall_impact': [],
            'pulse_score': [],
            'echo_score': [],
        }
        
        for ad in ads_data:
            # Try to extract from 'effectiveness' field (JSON)
            effectiveness = ad.get('effectiveness')
            if isinstance(effectiveness, dict):
                if 'overall_impact' in effectiveness:
                    try:
                        scores['overall_impact'].append(float(effectiveness['overall_impact']))
                    except (ValueError, TypeError):
                        pass
                if 'pulse_score' in effectiveness:
                    try:
                        scores['pulse_score'].append(float(effectiveness['pulse_score']))
                    except (ValueError, TypeError):
                        pass
                if 'echo_score' in effectiveness:
                    try:
                        scores['echo_score'].append(float(effectiveness['echo_score']))
                    except (ValueError, TypeError):
                        pass
            
            # Also try 'impact_scores' field
            impact_scores = ad.get('impact_scores')
            if isinstance(impact_scores, dict):
                for key in ['overall_impact', 'pulse_score', 'echo_score']:
                    if key in impact_scores:
                        try:
                            scores[key].append(float(impact_scores[key]))
                        except (ValueError, TypeError):
                            pass
        
        return scores
    
    async def get_category_benchmarks(self, category: str) -> Dict[str, Any]:
        """
        Fetch aggregate statistics for a category from the RAG database.
        
        Args:
            category: Product category (e.g., 'FMCG', 'Retail', 'Entertainment')
            
        Returns:
            Dictionary with aggregated benchmark data
        """
        # Check cache first
        cache_key = category.lower().strip()
        if cache_key in self._cache:
            logger.debug(f"Using cached benchmarks for category: {category}")
            return self._cache[cache_key]
        
        client = self._ensure_client()
        if not client:
            logger.warning("No Supabase client available, returning stub benchmarks")
            return self._get_stub_benchmarks(category)
        
        try:
            # Query ads in the same category
            result = client.table('ads') \
                .select('id, product_category, effectiveness, impact_scores, performance_metrics') \
                .ilike('product_category', f'%{category}%') \
                .limit(100) \
                .execute()
            
            if not result.data or len(result.data) == 0:
                logger.info(f"No ads found for category: {category}, using all ads")
                # Fallback: get all ads
                result = client.table('ads') \
                    .select('id, product_category, effectiveness, impact_scores, performance_metrics') \
                    .limit(100) \
                    .execute()
            
            ads_data = result.data or []
            sample_size = len(ads_data)
            
            # Extract scores from the ads
            scores = self._extract_effectiveness_scores(ads_data)
            
            # Calculate aggregates
            benchmarks = {
                'category': category,
                'sample_size': sample_size,
                'scores': {}
            }
            
            for metric, values in scores.items():
                if values:
                    benchmarks['scores'][metric] = {
                        'values': values,
                        'avg': statistics.mean(values),
                        'min': min(values),
                        'max': max(values),
                        'median': statistics.median(values),
                        'stdev': statistics.stdev(values) if len(values) > 1 else 0
                    }
            
            # Cache the result
            self._cache[cache_key] = benchmarks
            logger.info(f"Fetched benchmarks for {category}: {sample_size} ads, {len(scores['overall_impact'])} with scores")
            
            return benchmarks
            
        except Exception as e:
            logger.error(f"Failed to fetch category benchmarks: {e}")
            return self._get_stub_benchmarks(category)
    
    def _get_stub_benchmarks(self, category: str) -> Dict[str, Any]:
        """Return stub benchmark data for development/testing."""
        return {
            'category': category,
            'sample_size': 25,
            'scores': {
                'overall_impact': {
                    'values': [6.5, 7.0, 7.2, 7.5, 7.8, 6.8, 7.1, 6.9, 7.3, 7.6],
                    'avg': 7.17,
                    'min': 6.5,
                    'max': 7.8,
                    'median': 7.15,
                    'stdev': 0.4
                },
                'pulse_score': {
                    'values': [6.8, 7.2, 7.5, 7.8, 8.0, 7.0, 7.3, 7.1, 7.6, 7.9],
                    'avg': 7.42,
                    'min': 6.8,
                    'max': 8.0,
                    'median': 7.4,
                    'stdev': 0.38
                },
                'echo_score': {
                    'values': [5.5, 6.0, 6.2, 6.5, 6.8, 5.8, 6.1, 5.9, 6.3, 6.6],
                    'avg': 6.17,
                    'min': 5.5,
                    'max': 6.8,
                    'median': 6.15,
                    'stdev': 0.4
                }
            }
        }
    
    async def calculate_benchmarks(
        self,
        ad_scores: Dict[str, float],
        category: str
    ) -> BenchmarkResult:
        """
        Calculate percentile rankings for an ad against its category.
        
        Args:
            ad_scores: Dictionary with the ad's impact scores
                       (overall_impact, pulse_score, echo_score)
            category: Product category for comparison
            
        Returns:
            BenchmarkResult with percentile rankings and insights
        """
        # Get category benchmarks
        benchmarks = await self.get_category_benchmarks(category)
        
        result = BenchmarkResult(
            category=category,
            sample_size=benchmarks.get('sample_size', 0)
        )
        
        # Calculate percentile for each metric
        for metric in ['overall_impact', 'pulse_score', 'echo_score']:
            ad_value = ad_scores.get(metric, 0)
            
            metric_data = benchmarks.get('scores', {}).get(metric, {})
            values = metric_data.get('values', [])
            
            if values:
                percentile = self._calculate_percentile(ad_value, values)
                result.metrics[metric] = MetricBenchmark(
                    value=ad_value,
                    percentile=percentile,
                    category_avg=metric_data.get('avg', 0),
                    category_min=metric_data.get('min', 0),
                    category_max=metric_data.get('max', 0),
                    sample_size=len(values)
                )
        
        # Generate insights
        result.insights = self._generate_insights(result.metrics, category)
        result.strengths = self._identify_strengths(result.metrics)
        result.improvements = self._identify_improvements(result.metrics)
        
        return result
    
    def _generate_insights(self, metrics: Dict[str, MetricBenchmark], category: str) -> List[str]:
        """Generate textual insights from benchmark data."""
        insights = []
        
        for metric_name, benchmark in metrics.items():
            label = metric_name.replace('_', ' ').title()
            
            if benchmark.percentile >= 75:
                insights.append(f"Top {100 - benchmark.percentile}% for {label} in {category}")
            elif benchmark.percentile >= 50:
                insights.append(f"Above average {label} for {category} (top {100 - benchmark.percentile}%)")
            elif benchmark.percentile >= 25:
                insights.append(f"Below average {label} for {category}")
            else:
                insights.append(f"Room to improve {label} (bottom {benchmark.percentile}%)")
        
        return insights
    
    def _identify_strengths(self, metrics: Dict[str, MetricBenchmark]) -> List[str]:
        """Identify metrics where the ad excels (top 40%)."""
        strengths = []
        
        metric_labels = {
            'overall_impact': 'Overall Impact',
            'pulse_score': 'Immediate Engagement',
            'echo_score': 'Brand Memorability'
        }
        
        for metric_name, benchmark in metrics.items():
            if benchmark.percentile >= 60:
                label = metric_labels.get(metric_name, metric_name.replace('_', ' ').title())
                strengths.append(f"{label}: {benchmark.value:.1f}/10 (top {100 - benchmark.percentile}%)")
        
        return strengths
    
    def _identify_improvements(self, metrics: Dict[str, MetricBenchmark]) -> List[str]:
        """Identify metrics where the ad could improve (bottom 40%)."""
        improvements = []
        
        metric_descriptions = {
            'overall_impact': ('Overall Impact', 'Consider strengthening the core message clarity and persuasive elements'),
            'pulse_score': ('Immediate Engagement', 'Add stronger hooks or clearer calls-to-action to drive immediate response'),
            'echo_score': ('Brand Memorability', 'Reinforce distinctive brand assets and memorable moments')
        }
        
        for metric_name, benchmark in metrics.items():
            if benchmark.percentile < 40:
                label, suggestion = metric_descriptions.get(
                    metric_name, 
                    (metric_name.replace('_', ' ').title(), 'Consider improvements in this area')
                )
                gap = benchmark.category_avg - benchmark.value
                if gap > 0:
                    improvements.append(f"{label}: {gap:.1f} points below average. {suggestion}")
        
        return improvements


def get_benchmark_service() -> BenchmarkService:
    """Factory function to get a BenchmarkService instance."""
    return BenchmarkService()







