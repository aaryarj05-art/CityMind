from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import require_permission
from app.schemas.ai import AIQueryRequest, AIQueryResponse
from app.services.adk_service import ADKServiceError, query_citymind_agents
from app.services.auth_service import AuthenticatedUser

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.post("/query", response_model=AIQueryResponse)
async def query_ai(
    request: AIQueryRequest,
    current: AuthenticatedUser = Depends(require_permission("ai.query")),
) -> AIQueryResponse:
    try:
        result = await query_citymind_agents(
            message=request.message,
            user_id=str(current.user.id),
            session_id=request.session_id,
            role=current.user.role,
            department=current.user.department,
            citymind_session_id=str(current.claims["session_id"]),
        )
        return AIQueryResponse(**result)
    except ADKServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc