from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, get_current_principal, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import Permission, Role, User, UserRole, UserScope
from app.schemas.users import AssignRolesRequest, AssignScopeRequest, UserCreateRequest, UserResponse, UserUpdateRequest
from app.security.passwords import hash_password
from app.security.rbac import ROLE_PERMISSIONS
from app.services.security_events import record_security_event


router = APIRouter(tags=["users"])


def _user_response(db: Session, user: User) -> UserResponse:
    roles = db.execute(select(Role.code).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user.id)).scalars().all()
    return UserResponse(id=user.id, public_id=user.public_id, username=user.username, display_name=user.display_name, status=user.status, roles=list(roles))


@router.get("/users", response_model=list[UserResponse])
def list_users(
    _: CurrentPrincipal = Depends(require_permission("user:update")),
    db: Session = Depends(get_db),
) -> list[UserResponse]:
    users = db.execute(select(User).order_by(User.username)).scalars().all()
    return [_user_response(db, user) for user in users]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_csrf)])
def create_user(
    payload: UserCreateRequest,
    principal: CurrentPrincipal = Depends(require_permission("user:create")),
    db: Session = Depends(get_db),
) -> UserResponse:
    if db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    user = User(public_id=str(uuid4()), username=payload.username, display_name=payload.display_name, password_hash=hash_password(payload.password), status="ACTIVE", is_demo=True)
    db.add(user)
    db.flush()
    for code in payload.role_codes:
        role = db.execute(select(Role).where(Role.code == code)).scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown role {code}")
        db.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=principal.user.id))
    record_security_event(db, "USER_CREATED", "HIGH", user_id=principal.user.id, resource_type="user", resource_public_id=user.public_id)
    db.commit()
    return _user_response(db, user)


@router.patch("/users/{user_id}", response_model=UserResponse, dependencies=[Depends(require_csrf)])
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    principal: CurrentPrincipal = Depends(require_permission("user:update")),
    db: Session = Depends(get_db),
) -> UserResponse:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.status is not None:
        user.status = payload.status
    if payload.mfa_required is not None:
        user.mfa_required = payload.mfa_required
    record_security_event(db, "USER_UPDATED", "MEDIUM", user_id=principal.user.id, resource_type="user", resource_public_id=user.public_id)
    db.commit()
    return _user_response(db, user)


@router.get("/roles")
def list_roles(_: CurrentPrincipal = Depends(get_current_principal), db: Session = Depends(get_db)) -> list[dict]:
    roles = db.execute(select(Role).order_by(Role.code)).scalars().all()
    return [{"id": role.id, "code": role.code, "label": role.label, "permissions": sorted(ROLE_PERMISSIONS.get(role.code, set()))} for role in roles]


@router.get("/permissions")
def list_permissions(_: CurrentPrincipal = Depends(get_current_principal), db: Session = Depends(get_db)) -> list[dict]:
    permissions = db.execute(select(Permission).order_by(Permission.code)).scalars().all()
    return [{"id": permission.id, "code": permission.code, "resource": permission.resource, "action": permission.action} for permission in permissions]


@router.post("/users/{user_id}/roles", dependencies=[Depends(require_csrf)])
def assign_roles(
    user_id: int,
    payload: AssignRolesRequest,
    principal: CurrentPrincipal = Depends(require_permission("role:assign")),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.execute(delete(UserRole).where(UserRole.user_id == user.id))
    for code in payload.role_codes:
        role = db.execute(select(Role).where(Role.code == code)).scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown role {code}")
        db.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=principal.user.id))
    record_security_event(db, "ROLES_ASSIGNED", "HIGH", user_id=principal.user.id, resource_type="user", resource_public_id=user.public_id)
    db.commit()
    return {"status": "roles_assigned"}


@router.post("/users/{user_id}/scopes", dependencies=[Depends(require_csrf)])
def assign_scope(
    user_id: int,
    payload: AssignScopeRequest,
    principal: CurrentPrincipal = Depends(require_permission("user:update")),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.scope_type == "NATIONAL" and any([payload.region_id, payload.department_id, payload.school_id]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="National scope cannot target a lower level")
    scope = UserScope(user_id=user.id, scope_type=payload.scope_type, region_id=payload.region_id, department_id=payload.department_id, school_id=payload.school_id)
    db.add(scope)
    record_security_event(db, "SCOPE_ASSIGNED", "HIGH", user_id=principal.user.id, resource_type="user", resource_public_id=user.public_id)
    db.commit()
    return {"status": "scope_assigned"}
