from pydantic import BaseModel, Field
from typing import List, Optional


class PolicyChunk(BaseModel):
    chunk_id: str = Field(..., description="Unique identifier for the document chunk.")
    document: str = Field(..., description="Source document file name or document ID.")
    section: str = Field(..., description="Section or chapter header.")
    content: str = Field(..., description="Text content of the chunk.")
    source: str = Field(..., description="Human-readable citation source.")
    score: float = Field(0.0, description="Relevance similarity score.")


class Citation(BaseModel):
    document: str = Field(..., description="Name of the cited document.")
    section: str = Field(..., description="Section title or clause.")
    chunk_id: str = Field(..., description="Referenced chunk ID.")
    source: str = Field(..., description="Formatted citation label.")
    excerpt: str = Field(..., description="Exact textual excerpt supporting the finding.")


class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language search query or synthesized risk keywords.")
    top_k: int = Field(3, ge=1, le=10, description="Maximum number of relevant chunks to retrieve.")


class RAGQueryResponse(BaseModel):
    query: str
    retrieved_chunks: List[PolicyChunk]
    total_chunks_matched: int
