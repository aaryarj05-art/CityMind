"""Reusable FastAPI authentication and authorization dependencies."""

from collections.abc import Callable
from dataclasses import dataclass
import os
import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import (
    AuthConfigurationError,
    AuthenticatedUser,
    SessionError,
    authenticate_session,
    record_auth_event,
)

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class InternalServicePrincipal:
    service_name: str = "citymind-adk"


def _request_metadata(request: Request) -> tuple[str | None, str | None]:
    client_ip = request.client.host if request.client else None
    return client_ip, request.headers.get("user-agent")


def _unauthorized(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    try:
        return authenticate_session(db, credentials.credentials)
    except AuthConfigurationError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    except SessionError as exc:
        client_ip, user_agent = _request_metadata(request)
        event_type = "session_expired" if exc.reason_code == "session_expired" else "invalid_session"
        record_auth_event(
            db,
            event_type=event_type,
            success=False,
            reason_code=exc.reason_code,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        detail = "Session expired" if exc.reason_code == "session_expired" else "Invalid session"
        raise _unauthorized(detail) from exc


def optional_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthenticatedUser | None:
    if credentials is None:
        return None
    return get_current_user(request, credentials, db)


def _permission_denied(
    permission_name: str,
    request: Request,
    current: AuthenticatedUser,
    db: Session,
) -> None:
    client_ip, user_agent = _request_metadata(request)
    record_auth_event(
        db,
        event_type="permission_denied",
        success=False,
        reason_code=permission_name,
        user=current.user,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    raise HTTPException(status_code=403, detail="Permission denied")


def require_permission(permission_name: str) -> Callable:
    def dependency(
        request: Request,
        current: AuthenticatedUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> AuthenticatedUser:
        if permission_name not in current.permissions:
            _permission_denied(permission_name, request, current, db)
        return current

    dependency.__name__ = f"require_{permission_name.replace('.', '_')}"
    return dependency


def require_user_or_internal_service(permission_name: str) -> Callable:
    """Allow a permitted user or the configured ADK service token on approved reads only."""
    def dependency(
        request: Request,
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
        db: Session = Depends(get_db),
    ) -> AuthenticatedUser | InternalServicePrincipal:
        internal_value = request.headers.get("X-CityMind-Internal-Token")
        if internal_value is not None:
            configured = os.getenv("CITYMIND_INTERNAL_SERVICE_TOKEN", "")
            if not configured:
                raise HTTPException(status_code=503, detail="Internal service authentication unavailable")
            if not secrets.compare_digest(internal_value, configured):
                raise _unauthorized("Invalid internal service credentials")
            return InternalServicePrincipal()

        override = request.app.dependency_overrides.get(get_current_user)
        current = override() if override else get_current_user(request, credentials, db)
        if permission_name not in current.permissions:
            _permission_denied(permission_name, request, current, db)
        return current

    dependency.__name__ = f"require_user_or_internal_{permission_name.replace('.', '_')}"
    return dependency


def require_any_permission(permission_names: list[str]) -> Callable:
    expected = frozenset(permission_names)

    def dependency(
        request: Request,
        current: AuthenticatedUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> AuthenticatedUser:
        if current.permissions.isdisjoint(expected):
            _permission_denied("any:" + ",".join(sorted(expected)), request, current, db)
        return current

    dependency.__name__ = "require_any_" + "_or_".join(name.replace(".", "_") for name in sorted(expected))
    return dependency