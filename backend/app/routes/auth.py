"""Google Identity Services exchange and CityMind session endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config.permissions import permissions_for_role
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.auth import (
    AuthUserResponse,
    CurrentUserResponse,
    GoogleCredentialRequest,
    GoogleLoginResponse,
    LogoutResponse,
    SessionStatusResponse,
)
from app.services import auth_service
from app.services.auth_service import AuthenticatedUser

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _metadata(request: Request) -> tuple[str | None, str | None]:
    return (
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


@router.post("/google", response_model=GoogleLoginResponse)
def google_login(payload: GoogleCredentialRequest, request: Request, db: Session = Depends(get_db)):
    client_ip, user_agent = _metadata(request)
    user = None
    try:
        claims = auth_service.verify_google_credential(payload.credential)
        user = auth_service.upsert_google_user(db, claims)
        if not user.is_active:
            raise auth_service.AuthenticationError("inactive_user")
        token, expires_in, _ = auth_service.create_session_token(user)
    except auth_service.AuthConfigurationError as exc:
        auth_service.record_auth_event(
            db, event_type="login_failure", success=False,
            reason_code="authentication_not_configured", user=user,
            client_ip=client_ip, user_agent=user_agent,
        )
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    except auth_service.AuthenticationError as exc:
        auth_service.record_auth_event(
            db, event_type="login_failure", success=False,
            reason_code=exc.reason_code, user=user,
            client_ip=client_ip, user_agent=user_agent,
        )
        raise HTTPException(status_code=401, detail="Unable to authenticate") from exc

    auth_service.record_auth_event(
        db, event_type="login_success", success=True, user=user,
        client_ip=client_ip, user_agent=user_agent,
    )
    return GoogleLoginResponse(
        access_token=token,
        expires_in=expires_in,
        user=AuthUserResponse.model_validate(user),
    )


@router.get("/me", response_model=CurrentUserResponse)
def auth_me(current: AuthenticatedUser = Depends(get_current_user)):
    return CurrentUserResponse(
        user=AuthUserResponse.model_validate(current.user),
        permissions=permissions_for_role(current.user.role),
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    current: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client_ip, user_agent = _metadata(request)
    auth_service.record_auth_event(
        db, event_type="logout", success=True, user=current.user,
        client_ip=client_ip, user_agent=user_agent,
    )
    return LogoutResponse(
        logged_out=True,
        token_revoked=False,
        message="Logged out locally. The prototype does not maintain a server-side token denylist.",
    )


@router.get("/session-status", response_model=SessionStatusResponse)
def session_status(current: AuthenticatedUser = Depends(get_current_user)):
    expiry = int(current.claims["exp"])
    remaining = max(0, expiry - int(datetime.now(timezone.utc).timestamp()))
    return SessionStatusResponse(
        authenticated=True,
        expiry=expiry,
        remaining_seconds=remaining,
        role=current.user.role,
        department=current.user.department,
    )