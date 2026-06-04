from pydantic import BaseModel, Field


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    display_name: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=12, max_length=256)
    preferred_language: str = Field(default="fr", pattern="^(fr|en)$")
    role_codes: list[str] = Field(default_factory=list)


class UserUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=3, max_length=160)
    status: str | None = Field(default=None, max_length=40)
    mfa_required: bool | None = None
    preferred_language: str | None = Field(default=None, pattern="^(fr|en)$")


class AssignRolesRequest(BaseModel):
    role_codes: list[str]


class AssignScopeRequest(BaseModel):
    scope_type: str = Field(pattern="^(NATIONAL|REGION|DEPARTMENT|SCHOOL)$")
    region_id: int | None = None
    department_id: int | None = None
    school_id: int | None = None


class UserResponse(BaseModel):
    id: int
    public_id: str
    username: str
    display_name: str
    status: str
    preferred_language: str
    roles: list[str]
