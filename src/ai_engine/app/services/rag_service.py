import re
from pathlib import Path
from typing import List, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import PROJECT_ROOT
from app.logging_config import logger
from app.schemas.rag import PolicyChunk, Citation


class RAGService:
    """
    Local, deterministic Retrieval-Augmented Generation (RAG) service.
    Loads standard operating procedures and regulatory guidance markdown files,
    chunks them by sections, and indexes them with TF-IDF for sub-5ms retrieval.
    """

    def __init__(self, kb_dir: Path | None = None):
        if kb_dir is None:
            # Look for knowledge_base directory relative to file or project root
            self.kb_dir = Path(__file__).resolve().parents[2] / "knowledge_base"
            if not self.kb_dir.exists():
                self.kb_dir = PROJECT_ROOT / "src" / "ai_engine" / "knowledge_base"
        else:
            self.kb_dir = kb_dir

        self.chunks: List[PolicyChunk] = []
        self.vectorizer: TfidfVectorizer | None = None
        self.tfidf_matrix = None
        self._is_indexed = False

    def initialize(self) -> None:
        """Load all markdown documents, chunk them, and construct the TF-IDF index."""
        self.chunks = []
        if not self.kb_dir.exists():
            logger.warning(f"Knowledge base directory does not exist: {self.kb_dir}")
            return

        md_files = sorted(list(self.kb_dir.glob("*.md")))
        if not md_files:
            logger.warning(f"No markdown policy files found in: {self.kb_dir}")
            return

        chunk_counter = 1
        for file_path in md_files:
            file_name = file_path.name
            try:
                content = file_path.read_text(encoding="utf-8")
            except Exception as e:
                logger.error(f"Failed to read knowledge document {file_path}: {e}")
                continue

            # Extract Document Title / ID
            doc_title = file_name.replace(".md", "").replace("_", " ").title()
            first_line = content.split("\n", 1)[0]
            if first_line.startswith("# "):
                doc_title = first_line.replace("# ", "").strip()

            # Split by markdown level 3 headers (### Section ...) or level 2
            sections = re.split(r"\n(?=###?\s+)", content)
            for sec in sections:
                sec_text = sec.strip()
                if not sec_text or sec_text.startswith("# ") and len(sec_text.split("\n")) <= 2:
                    continue

                # Determine section title
                sec_lines = sec_text.split("\n")
                header = sec_lines[0].replace("#", "").strip()
                body = "\n".join(sec_lines[1:]).strip()
                if not body:
                    body = sec_text

                chunk_id = f"KB-{file_name[:8].upper()}-{chunk_counter:03d}"
                source_label = f"{doc_title} — {header}"

                chunk = PolicyChunk(
                    chunk_id=chunk_id,
                    document=file_name,
                    section=header,
                    content=body,
                    source=source_label,
                    score=0.0
                )
                self.chunks.append(chunk)
                chunk_counter += 1

        logger.info(f"Loaded {len(self.chunks)} policy chunks from {len(md_files)} documents.")

        if self.chunks:
            # Build TF-IDF index
            corpus = [f"{c.section}\n{c.content}" for c in self.chunks]
            self.vectorizer = TfidfVectorizer(
                ngram_range=(1, 2),
                sublinear_tf=True,
                stop_words="english"
            )
            self.tfidf_matrix = self.vectorizer.fit_transform(corpus)
            self._is_indexed = True
            logger.info("RAG TF-IDF index constructed successfully.")

    def query(self, query_text: str, top_k: int = 3, min_score: float = 0.05) -> List[PolicyChunk]:
        """
        Search indexed policy chunks using cosine similarity.
        Returns top_k most relevant chunks. Never fabricates citations.
        """
        if not self._is_indexed or not self.vectorizer or self.tfidf_matrix is None or not self.chunks:
            self.initialize()
            if not self._is_indexed or not self.chunks:
                return []

        cleaned_query = query_text.strip()
        if not cleaned_query:
            return []

        query_vec = self.vectorizer.transform([cleaned_query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]

        # Rank indices by score descending
        ranked_indices = similarities.argsort()[::-1]

        results: List[PolicyChunk] = []
        for idx in ranked_indices[:top_k]:
            score = float(similarities[idx])
            if score >= min_score:
                base_chunk = self.chunks[idx]
                scored_chunk = PolicyChunk(
                    chunk_id=base_chunk.chunk_id,
                    document=base_chunk.document,
                    section=base_chunk.section,
                    content=base_chunk.content,
                    source=base_chunk.source,
                    score=round(score, 4)
                )
                results.append(scored_chunk)

        return results

    def get_citations(self, query_text: str, top_k: int = 3) -> List[Citation]:
        """Retrieve policy chunks and format into verifiable citations."""
        chunks = self.query(query_text, top_k=top_k)
        citations: List[Citation] = []
        for c in chunks:
            # Extract clean excerpt (first 200 chars or first sentence)
            first_sentence = c.content.split(". ")[0].strip()
            excerpt = (first_sentence + ".") if not first_sentence.endswith(".") else first_sentence
            if len(excerpt) > 220:
                excerpt = excerpt[:217] + "..."

            citations.append(Citation(
                document=c.document,
                section=c.section,
                chunk_id=c.chunk_id,
                source=c.source,
                excerpt=excerpt
            ))
        return citations


# Global singleton instance
rag_service = RAGService()
rag_service.initialize()
