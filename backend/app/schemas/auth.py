from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=1, max_length=256)
    mfa_code: str | None = Field(default=None, min_length=6, max_length=8)


class LoginResponse(BaseModel):
    mfa_required: bool = False
    user_id: str | None = None
    csrf_token: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class MfaSetupResponse(BaseModel):
    provisioning_uri: str
    secret_preview: str


class MfaCodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class MeResponse(BaseModel):
    public_id: str
    username: str
    display_name: str
    roles: list[str]
    permissions: list[str]
    scopes: list[dict]
