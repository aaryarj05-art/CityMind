from pydantic import BaseModel, ConfigDict, Field


class GoogleCredentialRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=10000)


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


class CurrentUserResponse(BaseModel):
    user: AuthUserResponse
    permissions: list[str]
    judge_mode: bool = False


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
