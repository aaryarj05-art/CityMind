"""Authentication persistence models. Tokens and credentials are never stored."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_sub = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    picture_url = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    role = Column(String, nullable=False, default="Guest", index=True)
    department = Column(String, nullable=False, default="Public")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    last_login_at = Column(DateTime, nullable=True)


class AuthenticationAudit(Base):
    __tablename__ = "authentication_audits"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    google_sub = Column(String, nullable=True)
    email = Column(String, nullable=True)
    role = Column(String, nullable=True)
    success = Column(Boolean, nullable=False)
    reason_code = Column(String, nullable=True)
    timestamp = Column(DateTime, nullable=False, default=utc_now, index=True)
    client_ip = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)