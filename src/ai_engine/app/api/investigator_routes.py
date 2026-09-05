from fastapi import APIRouter, HTTPException, status
from app.logging_config import logger
from app.schemas.rag import RAGQueryRequest, RAGQueryResponse
from app.schemas.investigator import InvestigationContext, InvestigationResult
from app.services.rag_service import rag_service
from app.services.investigator_service import investigator_service

router = APIRouter(prefix="/investigator", tags=["AI Investigator & RAG"])


@router.post(
    "/analyze",
    response_model=InvestigationResult,
    summary="Execute Agentic Fraud Investigation",
    status_code=status.HTTP_200_OK
)
def run_investigation(ctx: InvestigationContext) -> InvestigationResult:
    """
    Execute autonomous multi-vector evidence synthesis, local RAG policy retrieval,
    and recommended action generation for a flagged transaction.
    """
    try:
        result = investigator_service.investigate(ctx)
        logger.info(
            f"Investigation {result.investigation_id} completed: Action={result.recommended_action} "
            f"| Confidence={result.confidence:.2f} | EvidenceCount={len(result.evidence)}"
        )
        return result
    except Exception as e:
        logger.error(f"Investigation execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Investigation synthesis failed: {str(e)}"
        )


@router.post(
    "/rag-query",
    response_model=RAGQueryResponse,
    summary="Query RAG Policy Knowledge Base",
    status_code=status.HTTP_200_OK
)
def query_knowledge_base(request: RAGQueryRequest) -> RAGQueryResponse:
    """
    Query the local fraud investigation standard operating procedures (SOP)
    and regulatory compliance knowledge base.
    """
    try:
        chunks = rag_service.query(request.query, top_k=request.top_k)
        return RAGQueryResponse(
            query=request.query,
            retrieved_chunks=chunks,
            total_chunks_matched=len(chunks)
        )
    except Exception as e:
        logger.error(f"RAG query execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Knowledge retrieval failed: {str(e)}"
        )
