import pytest
from app.services.rag_service import rag_service
from app.schemas.rag import RAGQueryRequest


def test_rag_service_initialization():
    """Verify that RAG service indexes documents and produces chunks."""
    assert len(rag_service.chunks) > 0, "RAG service should index policy chunks."
    assert rag_service.vectorizer is not None, "TF-IDF vectorizer should be initialized."
    assert rag_service.tfidf_matrix is not None, "TF-IDF matrix should be built."


def test_rag_query_retrieval():
    """Verify that a query for velocity and impossible travel returns relevant SOP chunks."""
    results = rag_service.query("velocity anomaly multiple transfers baseline", top_k=3)
    assert len(results) > 0, "Query should return matching policy chunks."
    top_chunk = results[0]
    assert top_chunk.score > 0.0
    assert "SOP" in top_chunk.source or "Monitoring" in top_chunk.source or "Investigation" in top_chunk.source


def test_rag_citations_integrity():
    """Verify that generated citations contain valid document, section, chunk ID, and excerpt."""
    citations = rag_service.get_citations("device fingerprint rooted compromised jailbreak", top_k=2)
    assert len(citations) > 0
    cit = citations[0]
    assert cit.document.endswith(".md")
    assert len(cit.section) > 0
    assert cit.chunk_id.startswith("KB-")
    assert len(cit.excerpt) > 0


def test_rag_zero_fabrication_on_empty_query():
    """Verify that an empty or whitespace query returns zero citations."""
    results = rag_service.query("   ", top_k=3)
    assert len(results) == 0, "Empty query must return 0 chunks without fabricating."
