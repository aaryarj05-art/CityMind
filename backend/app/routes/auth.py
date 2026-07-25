"""Google Identity Services exchange and CityMind session endpoints."""

import logging
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
from app.runtime_config import judge_open_access

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


def _metadata(request: Request) -> tuple[str | None, str | None]:
    return (
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


AUTH_ERROR_DETAILS = {
    "google_verification_failed": {
        "code": "google_verification_failed",
        "message": "Google token verification failed. Confirm the frontend VITE_GOOGLE_CLIENT_ID and backend GOOGLE_OAUTH_CLIENT_ID are the same OAuth Web Client ID.",
    },
    "wrong_audience": {
        "code": "wrong_audience",
        "message": "Google token audience mismatch. The frontend and backend are using different OAuth client IDs.",
    },
    "wrong_issuer": {
        "code": "wrong_issuer",
        "message": "Google token issuer was rejected. Sign in again using the official Google prompt.",
    },
    "expired_google_credential": {
        "code": "expired_google_credential",
        "message": "Google returned an expired credential. Retry sign-in and check system time on the browser device.",
    },
    "invalid_expiry": {
        "code": "invalid_expiry",
        "message": "Google returned a credential with an invalid expiry. Retry sign-in.",
    },
    "email_not_verified": {
        "code": "email_not_verified",
        "message": "Google account email is not verified. Use a verified Google account.",
    },
    "missing_required_claim": {
        "code": "missing_required_claim",
        "message": "Google credential is missing required identity fields. Retry sign-in.",
    },
    "inactive_user": {
        "code": "inactive_user",
        "message": "This CityMind account is inactive. Contact the demo administrator.",
    },
}


def _auth_error_detail(reason_code: str) -> dict[str, str]:
    return AUTH_ERROR_DETAILS.get(reason_code, {
        "code": reason_code,
        "message": "Google sign-in was rejected by CityMind authentication.",
    })


@router.post("/google", response_model=GoogleLoginResponse)
def google_login(payload: GoogleCredentialRequest, request: Request, db: Session = Depends(get_db)):
    client_ip, user_agent = _metadata(request)
    user = None
    logger.info("Google login exchange started", extra={"origin": request.headers.get("origin"), "client_ip": client_ip})
    try:
        login_mode = auth_service.normalize_login_mode(payload.login_mode)
        claims = auth_service.verify_google_credential(payload.credential)
        user = auth_service.upsert_google_user(db, claims, login_mode=login_mode)
        if not user.is_active:
            raise auth_service.AuthenticationError("inactive_user")
        token, expires_in, _ = auth_service.create_session_token(user, login_mode=login_mode)
    except auth_service.AuthConfigurationError as exc:
        auth_service.record_auth_event(
            db, event_type="login_failure", success=False,
            reason_code="authentication_not_configured", user=user,
            client_ip=client_ip, user_agent=user_agent,
        )
        logger.error("Google login failed: authentication configuration unavailable", extra={"origin": request.headers.get("origin"), "client_ip": client_ip})
        raise HTTPException(status_code=503, detail={
            "code": "authentication_not_configured",
            "message": "CityMind authentication is not configured. Confirm GOOGLE_OAUTH_CLIENT_ID and CITYMIND_JWT_SECRET are set on the backend.",
        }) from exc
    except auth_service.AuthenticationError as exc:
        auth_service.record_auth_event(
            db, event_type="login_failure", success=False,
            reason_code=exc.reason_code, user=user,
            client_ip=client_ip, user_agent=user_agent,
        )
        detail = _auth_error_detail(exc.reason_code)
        logger.warning("Google login failed", extra={"reason": exc.reason_code, "origin": request.headers.get("origin"), "client_ip": client_ip})
        raise HTTPException(status_code=401, detail=detail) from exc

    logger.info("Google login succeeded", extra={"user_id": user.id if user else None, "role": user.role if user else None, "login_mode": login_mode, "origin": request.headers.get("origin")})
    auth_service.record_auth_event(
        db, event_type="login_success", success=True, user=user,
        client_ip=client_ip, user_agent=user_agent,
    )
    return GoogleLoginResponse(
        access_token=token,
        expires_in=expires_in,
        user=AuthUserResponse.model_validate(user),
        judge_mode=judge_open_access(),
        login_mode=login_mode,
    )


@router.get("/me", response_model=CurrentUserResponse)
def auth_me(current: AuthenticatedUser = Depends(get_current_user)):
    return CurrentUserResponse(
        user=AuthUserResponse.model_validate(current.user),
        permissions=permissions_for_role(current.user.role),
        judge_mode=bool(current.claims.get("judge_mode", False)),
        login_mode=auth_service.normalize_login_mode(current.claims.get("login_mode") or auth_service.login_mode_for_role(current.user.role)),
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
        judge_mode=bool(current.claims.get("judge_mode", False)),
        login_mode=auth_service.normalize_login_mode(current.claims.get("login_mode") or auth_service.login_mode_for_role(current.user.role)),
    )