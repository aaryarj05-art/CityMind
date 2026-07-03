from pydantic import BaseModel, Field


class AIQueryRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None
    user_id: str = "control-room-officer"


class AIQueryResponse(BaseModel):
    session_id: str
    response: str
    agents_used: list[str]
    grounded: bool