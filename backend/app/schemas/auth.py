from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GoogleCredentialRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=10000)
    login_mode: str | None = "user"


class AuthUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    picture_url: str | None
    role: str
    department: str
    email_verified: bool


class GoogleLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUserResponse
    judge_mode: bool = False
    login_mode: Literal["user", "admin"] = "user"


class CurrentUserResponse(BaseModel):
    user: AuthUserResponse
    permissions: list[str]
    judge_mode: bool = False
    login_mode: Literal["user", "admin"] = "user"


class LogoutResponse(BaseModel):
    logged_out: bool
    token_revoked: bool = False
    message: str


class SessionStatusResponse(BaseModel):
    authenticated: bool
    expiry: int
    remaining_seconds: int
    role: str
    department: str
    judge_mode: bool = False
    login_mode: Literal["user", "admin"] = "user"
