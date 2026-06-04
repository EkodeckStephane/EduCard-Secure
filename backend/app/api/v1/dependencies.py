from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security_config import CSRF_COOKIE_NAME, SESSION_COOKIE_NAME
from app.models.entities import Card, Department, School, Student, Subdivision, User, UserScope
from app.security.rbac import permissions_for_roles
from app.services.auth_service import get_session, role_codes_for_user


@dataclass
class CurrentPrincipal:
    user: User
    role_codes: set[str]
    permissions: set[str]
    scopes: list[UserScope]


def get_current_principal(
    db: Session = Depends(get_db),
    session_cookie: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> CurrentPrincipal:
    session = get_session(db, session_cookie)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user = db.get(User, session.user_id)
    if not user or user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    roles = role_codes_for_user(db, user.id)
    scopes = list(db.execute(select(UserScope).where(UserScope.user_id == user.id)).scalars())
    return CurrentPrincipal(user=user, role_codes=roles, permissions=permissions_for_roles(roles), scopes=scopes)


def require_csrf(
    csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE_NAME),
    csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token missing or invalid")


def require_permission(permission: str) -> Callable[[CurrentPrincipal], CurrentPrincipal]:
    def dependency(principal: CurrentPrincipal = Depends(get_current_principal)) -> CurrentPrincipal:
        if permission not in principal.permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        return principal

    return dependency


def require_role(role_code: str) -> Callable[[CurrentPrincipal], CurrentPrincipal]:
    def dependency(principal: CurrentPrincipal = Depends(get_current_principal)) -> CurrentPrincipal:
        if role_code not in principal.role_codes:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role required")
        return principal

    return dependency


def _school_allowed(db: Session, principal: CurrentPrincipal, school_id: int) -> bool:
    if not principal.scopes:
        return False
    for scope in principal.scopes:
        if scope.scope_type == "NATIONAL":
            return True
        if scope.scope_type == "SCHOOL" and scope.school_id == school_id:
            return True
        school = db.get(School, school_id)
        if not school:
            return False
        if scope.scope_type == "REGION" and scope.region_id:
            dept_region = db.execute(
                select(Department.region_id)
                .join(Subdivision, Subdivision.department_id == Department.id)
                .join(School, School.subdivision_id == Subdivision.id)
                .where(School.id == school_id)
            ).scalar_one_or_none()
            if dept_region == scope.region_id:
                return True
        if scope.scope_type == "DEPARTMENT" and scope.department_id:
            dept_id = db.execute(
                select(Department.id)
                .join(Subdivision, Subdivision.department_id == Department.id)
                .join(School, School.subdivision_id == Subdivision.id)
                .where(School.id == school_id)
            ).scalar_one_or_none()
            if dept_id == scope.department_id:
                return True
    return False


def assert_school_scope(db: Session, principal: CurrentPrincipal, school_id: int) -> None:
    if not _school_allowed(db, principal, school_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Resource outside assigned scope")


def assert_student_scope(db: Session, principal: CurrentPrincipal, student_id: int) -> None:
    student = db.get(Student, student_id)
    if not student or not student.current_school_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    assert_school_scope(db, principal, student.current_school_id)


def assert_card_scope(db: Session, principal: CurrentPrincipal, card_id: int) -> None:
    card = db.get(Card, card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    assert_student_scope(db, principal, card.student_id)
