"""
Clearcast Knowledge Base (Regulatory RAG)
Ingests the Clearcast/BCAP PDF and provides relevant rule citations.

Features:
- Keyword-based retrieval (always available)
- Semantic search with embeddings (when sentence-transformers is installed)
- Chunk-level retrieval for precise context
"""

import os
import logging
import hashlib
import pickle
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import pypdf
import numpy as np

logger = logging.getLogger(__name__)

# Try to import sentence-transformers for semantic search
SEMANTIC_AVAILABLE = False
try:
    from sentence_transformers import SentenceTransformer
    SEMANTIC_AVAILABLE = True
    logger.info("Semantic search available (sentence-transformers installed)")
except ImportError:
    logger.info("Semantic search unavailable (sentence-transformers not installed). Using keyword-based retrieval.")


class ClearcastKnowledgeBase:
    """
    Knowledge base for Clearcast and BCAP rules.
    
    Features:
    - Keyword-based retrieval (always available)
    - Semantic search with embeddings (optional, requires sentence-transformers)
    - Chunk-level indexing for precise context retrieval
    """
    
    def __init__(self, pdf_path: Optional[str] = None, use_semantic: bool = True):
        self.pdf_path = pdf_path
        self.full_text = ""
        self.chunks: List[Dict] = []  # List of {text, page, start_idx}
        self.embeddings: Optional[np.ndarray] = None
        self.model: Optional['SentenceTransformer'] = None
        self.use_semantic = use_semantic and SEMANTIC_AVAILABLE
        self.cache_dir = Path(__file__).parent / "_cache"
        
        if self.pdf_path and os.path.exists(self.pdf_path):
            self.load_pdf(self.pdf_path)
        else:
            # Try to find the PDF in standard locations
            self._find_and_load_default_pdf()

    def _find_and_load_default_pdf(self):
        """Search for the PDF in common locations."""
        possible_paths = [
            Path(__file__).parent.parent.parent.parent.parent / "docs/references/clearcast-guidance.pdf",
            Path("docs/references/clearcast-guidance.pdf"),
            Path("A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf"),
            Path("app/A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf"),
            Path(__file__).parent.parent.parent / "A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf",
        ]
        
        for path in possible_paths:
            if path.exists():
                logger.info(f"Found Clearcast PDF at: {path}")
                self.load_pdf(str(path))
                return
        
        logger.warning("Clearcast PDF not found. RAG features will be limited.")

    def load_pdf(self, path: str):
        """Load and index the PDF content."""
        try:
            reader = pypdf.PdfReader(path)
            text_content = []
            
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    # Add page marker for citation
                    page_text = f"\n[Page {i+1}]\n{text}"
                    text_content.append(page_text)
            
            self.full_text = "\n".join(text_content)
            logger.info(f"Successfully loaded Clearcast PDF ({len(reader.pages)} pages)")
            
            # Create chunks for better retrieval
            self._create_chunks()
            
            # Load or create embeddings if semantic search is enabled
            if self.use_semantic:
                self._load_or_create_embeddings(path)
            
        except Exception as e:
            logger.error(f"Failed to load Clearcast PDF: {e}")
    
    def _create_chunks(self, chunk_size: int = 500, overlap: int = 100):
        """
        Split text into overlapping chunks for better retrieval.
        
        Args:
            chunk_size: Target size of each chunk in characters
            overlap: Number of characters to overlap between chunks
        """
        self.chunks = []
        
        if not self.full_text:
            return
        
        # Split by pages first
        pages = self.full_text.split("[Page ")
        
        for page_content in pages:
            if not page_content.strip():
                continue
            
            # Extract page number
            try:
                page_num = int(page_content.split("]")[0].strip())
                text = "]".join(page_content.split("]")[1:])
            except (ValueError, IndexError):
                page_num = 0
                text = page_content
            
            # Split page into paragraphs
            paragraphs = text.split("\n\n")
            current_chunk = ""
            
            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue
                
                # If adding this paragraph exceeds chunk size, save current and start new
                if len(current_chunk) + len(para) > chunk_size and current_chunk:
                    self.chunks.append({
                        "text": current_chunk.strip(),
                        "page": page_num,
                        "char_count": len(current_chunk)
                    })
                    # Keep overlap from end of previous chunk
                    current_chunk = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                
                current_chunk += "\n" + para
            
            # Save remaining chunk
            if current_chunk.strip():
                self.chunks.append({
                    "text": current_chunk.strip(),
                    "page": page_num,
                    "char_count": len(current_chunk)
                })
        
        logger.info(f"Created {len(self.chunks)} chunks from PDF")
    
    def _get_cache_path(self, pdf_path: str) -> Path:
        """Get cache file path based on PDF hash."""
        # Hash the PDF path and modification time
        pdf_stat = os.stat(pdf_path)
        cache_key = f"{pdf_path}_{pdf_stat.st_mtime}_{pdf_stat.st_size}"
        hash_key = hashlib.md5(cache_key.encode()).hexdigest()[:12]
        return self.cache_dir / f"embeddings_{hash_key}.pkl"
    
    def _load_or_create_embeddings(self, pdf_path: str):
        """Load embeddings from cache or create new ones."""
        if not self.chunks:
            return
        
        # Ensure cache directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = self._get_cache_path(pdf_path)
        
        # Try to load from cache
        if cache_path.exists():
            try:
                with open(cache_path, 'rb') as f:
                    cached = pickle.load(f)
                    if len(cached.get('embeddings', [])) == len(self.chunks):
                        self.embeddings = cached['embeddings']
                        logger.info(f"Loaded {len(self.embeddings)} embeddings from cache")
                        return
            except Exception as e:
                logger.warning(f"Failed to load embeddings cache: {e}")
        
        # Create new embeddings
        self._create_embeddings()
        
        # Save to cache
        if self.embeddings is not None:
            try:
                with open(cache_path, 'wb') as f:
                    pickle.dump({'embeddings': self.embeddings}, f)
                logger.info(f"Saved embeddings to cache: {cache_path}")
            except Exception as e:
                logger.warning(f"Failed to save embeddings cache: {e}")
    
    def _create_embeddings(self):
        """Create embeddings for all chunks using sentence-transformers."""
        if not SEMANTIC_AVAILABLE or not self.chunks:
            return
        
        try:
            # Use a lightweight model suitable for regulatory text
            if self.model is None:
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
            
            chunk_texts = [c['text'] for c in self.chunks]
            self.embeddings = self.model.encode(chunk_texts, show_progress_bar=False)
            logger.info(f"Created {len(self.embeddings)} embeddings")
            
        except Exception as e:
            logger.error(f"Failed to create embeddings: {e}")
            self.embeddings = None

    def get_relevant_rules(
        self, 
        context_keywords: List[str], 
        limit: int = 2000,
        query_text: Optional[str] = None
    ) -> str:
        """
        Retrieve relevant sections of the guidance based on keywords and/or semantic query.
        
        Args:
            context_keywords: List of terms like 'alcohol', 'gambling', 'pricing'
            limit: Max characters to return
            query_text: Optional natural language query for semantic search
            
        Returns:
            String containing relevant excerpts
        """
        if not self.full_text:
            return "Clearcast guidance PDF not loaded."
        
        # Try semantic search first if available and query provided
        if self.use_semantic and self.embeddings is not None and (query_text or context_keywords):
            return self._semantic_search(context_keywords, limit, query_text)
        
        # Fall back to keyword search
        return self._keyword_search(context_keywords, limit)
    
    def _semantic_search(
        self, 
        keywords: List[str], 
        limit: int, 
        query_text: Optional[str] = None
    ) -> str:
        """
        Retrieve relevant chunks using semantic similarity.
        """
        if not self.model or self.embeddings is None or not self.chunks:
            return self._keyword_search(keywords, limit)
        
        try:
            # Build query from keywords and/or natural language
            if query_text:
                query = query_text
            else:
                query = " ".join(keywords)
            
            # Add keywords as context
            if keywords and query_text:
                query = f"{query_text}. Keywords: {', '.join(keywords)}"
            
            # Encode query
            query_embedding = self.model.encode([query])[0]
            
            # Calculate cosine similarity with all chunks
            similarities = np.dot(self.embeddings, query_embedding) / (
                np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_embedding) + 1e-8
            )
            
            # Get top chunks by similarity
            top_indices = np.argsort(similarities)[::-1]
            
            # Collect chunks until limit
            result_text = "RELEVANT CLEARCAST GUIDANCE (Semantic Search):\n\n"
            current_len = 0
            seen_pages = set()
            
            for idx in top_indices:
                chunk = self.chunks[idx]
                similarity = similarities[idx]
                
                # Skip low-similarity chunks
                if similarity < 0.2:
                    break
                
                chunk_text = f"[Page {chunk['page']}] (relevance: {similarity:.2f})\n{chunk['text']}\n---\n"
                
                if current_len + len(chunk_text) > limit:
                    break
                
                result_text += chunk_text
                current_len += len(chunk_text)
                seen_pages.add(chunk['page'])
            
            if current_len == 0:
                # No semantic matches, fall back to keyword
                return self._keyword_search(keywords, limit)
            
            logger.info(f"Semantic search returned {len(seen_pages)} pages, {current_len} chars")
            return result_text
            
        except Exception as e:
            logger.warning(f"Semantic search failed: {e}. Falling back to keyword search.")
            return self._keyword_search(keywords, limit)
    
    def _keyword_search(self, context_keywords: List[str], limit: int = 2000) -> str:
        """
        Original keyword-based retrieval as fallback.
        """
        if not self.full_text:
            return "Clearcast guidance PDF not loaded."
            
        pages = self.full_text.split("[Page ")
        
        # Score pages based on keyword frequency
        page_scores: List[Tuple[int, str]] = []
        for page in pages:
            if not page.strip():
                continue
                
            score = 0
            page_lower = page.lower()
            for keyword in context_keywords:
                if keyword.lower() in page_lower:
                    score += page_lower.count(keyword.lower())
            
            if score > 0:
                page_scores.append((score, f"[Page {page}"))
        
        # Sort by score descending
        page_scores.sort(key=lambda x: x[0], reverse=True)
        
        # Collect top pages until limit is reached
        current_len = 0
        result_text = "RELEVANT CLEARCAST GUIDANCE (Keyword Search):\n\n"
        
        for score, content in page_scores:
            if current_len + len(content) > limit:
                break
            result_text += content + "\n---\n"
            current_len += len(content)
            
        if not page_scores:
            return "No specific guidance found for these keywords in the loaded document."
            
        return result_text
    
    def search(
        self, 
        query: str, 
        top_k: int = 5,
        min_similarity: float = 0.25
    ) -> List[Dict]:
        """
        Search for relevant chunks with detailed results.
        
        Args:
            query: Natural language query
            top_k: Number of results to return
            min_similarity: Minimum similarity threshold
            
        Returns:
            List of dicts with text, page, and similarity score
        """
        results = []
        
        if self.use_semantic and self.embeddings is not None and self.model:
            try:
                query_embedding = self.model.encode([query])[0]
                similarities = np.dot(self.embeddings, query_embedding) / (
                    np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_embedding) + 1e-8
                )
                
                top_indices = np.argsort(similarities)[::-1][:top_k]
                
                for idx in top_indices:
                    sim = similarities[idx]
                    if sim < min_similarity:
                        continue
                    chunk = self.chunks[idx]
                    results.append({
                        "text": chunk["text"],
                        "page": chunk["page"],
                        "similarity": float(sim)
                    })
                    
            except Exception as e:
                logger.warning(f"Semantic search failed: {e}")
        
        # Fall back to keyword if no results
        if not results:
            keywords = query.lower().split()
            for chunk in self.chunks[:top_k * 3]:  # Check more chunks
                score = sum(1 for kw in keywords if kw in chunk["text"].lower())
                if score > 0:
                    results.append({
                        "text": chunk["text"],
                        "page": chunk["page"],
                        "similarity": score / len(keywords) if keywords else 0
                    })
            results = sorted(results, key=lambda x: x["similarity"], reverse=True)[:top_k]
        
        return results

# Singleton instance
_kb_instance = None

def get_knowledge_base() -> ClearcastKnowledgeBase:
    global _kb_instance
    if _kb_instance is None:
        _kb_instance = ClearcastKnowledgeBase()
    return _kb_instance
