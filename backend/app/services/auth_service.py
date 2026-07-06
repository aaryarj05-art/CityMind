"""Google identity verification and CityMind-owned session tokens."""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from app.config.permissions import RoleAssignment, permissions_for_role, role_for_email
from app.runtime_config import judge_open_access
from app.models.auth import AuthenticationAudit, User

CITYMIND_ISSUER = "citymind"
CITYMIND_AUDIENCE = "citymind-api"
CITYMIND_ALGORITHM = "HS256"


class AuthenticationError(Exception):
    def __init__(self, reason_code: str = "invalid_credential"):
        super().__init__(reason_code)
        self.reason_code = reason_code


class SessionError(Exception):
    def __init__(self, reason_code: str = "invalid_session"):
        super().__init__(reason_code)
        self.reason_code = reason_code


class AuthConfigurationError(Exception):
    pass


@dataclass(frozen=True)
class AuthenticatedUser:
    user: User
    claims: dict[str, Any]
    permissions: frozenset[str]


def _jwt_secret() -> str:
    secret = os.getenv("CITYMIND_JWT_SECRET", "").strip()
    if not secret:
        raise AuthConfigurationError("CityMind authentication is not configured")
    return secret


def session_minutes() -> int:
    try:
        value = int(os.getenv("CITYMIND_SESSION_MINUTES", "15"))
    except ValueError:
        value = 15
    return max(1, min(value, 1440))


def verify_google_credential(credential: str) -> dict[str, Any]:
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    if not client_id:
        raise AuthConfigurationError("Google authentication is not configured")
    try:
        claims = id_token.verify_oauth2_token(
            credential,
            GoogleAuthRequest(),
            audience=client_id,
        )
    except Exception as exc:
        raise AuthenticationError("google_verification_failed") from exc

    now = datetime.now(timezone.utc).timestamp()
    required = ("sub", "email", "email_verified", "aud", "iss", "exp")
    if any(claims.get(name) in (None, "") for name in required):
        raise AuthenticationError("missing_required_claim")
    if claims["aud"] != client_id:
        raise AuthenticationError("wrong_audience")
    if claims["iss"] not in {"accounts.google.com", "https://accounts.google.com"}:
        raise AuthenticationError("wrong_issuer")
    try:
        if float(claims["exp"]) <= now:
            raise AuthenticationError("expired_google_credential")
    except (TypeError, ValueError) as exc:
        raise AuthenticationError("invalid_expiry") from exc
    if claims["email_verified"] is not True:
        raise AuthenticationError("email_not_verified")
    return claims


def upsert_google_user(db: Session, claims: dict[str, Any]) -> User:
    assignment = (RoleAssignment(role="DemoAdmin", department="Hackathon Judge")
        if judge_open_access() else role_for_email(str(claims["email"])))
    user = db.query(User).filter(User.google_sub == str(claims["sub"])).first()
    now = datetime.now(timezone.utc)
    if user is None:
        user = User(google_sub=str(claims["sub"]), created_at=now)
        db.add(user)
    user.email = str(claims["email"])
    user.name = str(claims.get("name") or claims["email"])
    user.picture_url = claims.get("picture")
    user.email_verified = True
    user.role = assignment.role
    user.department = assignment.department
    user.last_login_at = now
    db.commit()
    db.refresh(user)
    return user


def create_session_token(user: User, now: datetime | None = None) -> tuple[str, int, dict[str, Any]]:
    secret = _jwt_secret()
    issued_at = now or datetime.now(timezone.utc)
    duration = session_minutes() * 60
    expiry = issued_at + timedelta(seconds=duration)
    claims = {
        "sub": str(user.id),
        "google_sub": user.google_sub,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "department": user.department,
        "email_verified": user.email_verified,
        "judge_mode": judge_open_access(),
        "session_id": str(uuid.uuid4()),
        "iat": int(issued_at.timestamp()),
        "exp": int(expiry.timestamp()),
        "iss": CITYMIND_ISSUER,
        "aud": CITYMIND_AUDIENCE,
    }
    return jwt.encode(claims, secret, algorithm=CITYMIND_ALGORITHM), duration, claims


def decode_session_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            _jwt_secret(),
            algorithms=[CITYMIND_ALGORITHM],
            issuer=CITYMIND_ISSUER,
            audience=CITYMIND_AUDIENCE,
            options={"require": [
                "sub", "google_sub", "email", "name", "role", "department",
                "email_verified", "judge_mode", "session_id", "iat", "exp", "iss", "aud",
            ]},
        )
    except AuthConfigurationError:
        raise
    except jwt.ExpiredSignatureError as exc:
        raise SessionError("session_expired") from exc
    except jwt.InvalidIssuerError as exc:
        raise SessionError("wrong_issuer") from exc
    except jwt.InvalidAudienceError as exc:
        raise SessionError("wrong_audience") from exc
    except jwt.PyJWTError as exc:
        raise SessionError("invalid_session") from exc


def authenticate_session(db: Session, token: str) -> AuthenticatedUser:
    claims = decode_session_token(token)
    try:
        user_id = int(claims["sub"])
    except (TypeError, ValueError) as exc:
        raise SessionError("invalid_subject") from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise SessionError("inactive_or_missing_user")
    identity_matches = (
        user.google_sub == claims.get("google_sub")
        and user.email == claims.get("email")
        and user.role == claims.get("role")
        and user.department == claims.get("department")
        and user.email_verified is True
        and claims.get("email_verified") is True
    )
    if not identity_matches:
        raise SessionError("identity_mismatch")
    return AuthenticatedUser(
        user=user,
        claims=claims,
        permissions=frozenset(permissions_for_role(user.role)),
    )


def record_auth_event(
    db: Session,
    *,
    event_type: str,
    success: bool,
    reason_code: str | None = None,
    user: User | None = None,
    google_sub: str | None = None,
    email: str | None = None,
    role: str | None = None,
    client_ip: str | None = None,
    user_agent: str | None = None,
    judge_mode: bool | None = None,
) -> None:
    event = AuthenticationAudit(
        event_type=event_type,
        user_id=user.id if user else None,
        google_sub=user.google_sub if user else google_sub,
        email=user.email if user else email,
        role=user.role if user else role,
        success=success,
        judge_mode=judge_open_access() if judge_mode is None else judge_mode,
        reason_code=reason_code,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    db.add(event)
    db.commit()