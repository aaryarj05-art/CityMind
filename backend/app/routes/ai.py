from fastapi import APIRouter, HTTPException, status

from app.schemas.ai import AIQueryRequest, AIQueryResponse
from app.services.adk_service import (
    ADKServiceError,
    query_citymind_agents,
)


router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.post(
    "/query",
    response_model=AIQueryResponse,
)
async def query_ai(request: AIQueryRequest) -> AIQueryResponse:
    try:
        result = await query_citymind_agents(
            message=request.message,
            user_id=request.user_id,
            session_id=request.session_id,
        )

        return AIQueryResponse(**result)

    except ADKServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc