from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import (
    AuditEvent,
    AuditEventHash,
    BackupEvent,
    DataAccessRequest,
    DataProcessingRegister,
    Incident,
    IncidentEvent,
    NotificationEvent,
    RetentionRule,
    SecurityEvent,
    User,
)
from app.schemas.security_ops import (
    AlertAcknowledgeRequest,
    AlertResolveRequest,
    AuditCreateRequest,
    IncidentCommentRequest,
    IncidentCreateRequest,
    IncidentTransitionRequest,
    IncidentUpdateRequest,
    PrivacyTransitionRequest,
    PrivacyRequestCreate,
    ProcessingRegisterCreate,
    RetentionRuleCreate,
)
from app.services.audit_service import append_audit_event, verify_audit_chain
from app.services.security_events import record_security_event


router = APIRouter(tags=["security-ops"])


@router.post("/audit/events", dependencies=[Depends(require_csrf)])
def create_audit_event(payload: AuditCreateRequest, principal: CurrentPrincipal = Depends(require_permission("audit:read")), db: Session = Depends(get_db)):
    event = append_audit_event(db, principal, payload.action, payload.resource_type, payload.resource_public_id, payload.result, payload.justification, payload.severity)
    record_security_event(db, "AUDIT_EVENT_CREATED", "MEDIUM", principal.user.id, "audit", event.event_public_id)
    db.commit()
    return {"id": event.id, "event_public_id": event.event_public_id}


@router.get("/audit/events")
@router.get("/audit")
def list_audit_events(
    action: str | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    severity: str | None = None,
    resource_type: str | None = None,
    resource_public_id: str | None = None,
    from_date: datetime | None = Query(default=None, alias="from"),
    to_date: datetime | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=25, le=100),
    principal: CurrentPrincipal = Depends(require_permission("audit:read")),
    db: Session = Depends(get_db),
):
    stmt = select(AuditEvent, User.username, AuditEventHash).outerjoin(User, User.id == AuditEvent.actor_user_id).outerjoin(AuditEventHash, AuditEventHash.audit_event_id == AuditEvent.id)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    if event_type:
        types = [value.strip() for value in event_type.split(",") if value.strip()]
        stmt = stmt.where(or_(*[AuditEvent.action.like(f"{value}%") for value in types]))
    if actor:
        stmt = stmt.where(User.username.like(f"%{actor}%"))
    if severity:
        stmt = stmt.where(AuditEvent.severity.in_([value.strip() for value in severity.split(",")]))
    if resource_type:
        stmt = stmt.where(AuditEvent.resource_type == resource_type)
    if resource_public_id:
        stmt = stmt.where(AuditEvent.resource_public_id == resource_public_id)
    if from_date:
        stmt = stmt.where(AuditEvent.occurred_at >= from_date)
    if to_date:
        stmt = stmt.where(AuditEvent.occurred_at <= to_date)
    total = int(db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one())
    rows = db.execute(stmt.order_by(AuditEvent.occurred_at.desc()).offset((page - 1) * per_page).limit(per_page)).all()
    items = [
        {
            "id": row.id,
            "event_public_id": row.event_public_id,
            "action": row.action,
            "actor": username,
            "resource_type": row.resource_type,
            "resource_public_id": row.resource_public_id,
            "result": row.result,
            "severity": row.severity,
            "occurred_at": row.occurred_at,
            "scope": row.scope_summary,
            "justification": row.justification,
            "correlation_id": row.correlation_id,
            "event_hash": hash_row.event_hash if hash_row else None,
            "previous_hash": hash_row.previous_hash if hash_row else None,
        }
        for row, username, hash_row in rows
    ]
    result = {"items": items, "total": total, "page": page, "per_page": per_page, "pages": max(1, (total + per_page - 1) // per_page)}
    return result if page != 1 or per_page != 50 or any([event_type, actor, severity, resource_type, resource_public_id, from_date, to_date]) else items


@router.get("/audit/{audit_id}/verify")
def verify_audit_entry(audit_id: int, principal: CurrentPrincipal = Depends(require_permission("audit:read")), db: Session = Depends(get_db)):
    row = db.get(AuditEvent, audit_id)
    stored = db.execute(select(AuditEventHash).where(AuditEventHash.audit_event_id == audit_id)).scalar_one_or_none()
    if not row or not stored:
        raise HTTPException(status_code=404, detail="Audit event not found")
    chain = verify_audit_chain(db)
    failure_ids = {item["audit_event_id"] for item in chain["failures"]}
    return {"id": row.id, "status": "BROKEN" if row.id in failure_ids else "OK", "event_hash": stored.event_hash, "previous_hash": stored.previous_hash}


@router.get("/audit/integrity")
def audit_integrity(principal: CurrentPrincipal = Depends(require_permission("audit:read")), db: Session = Depends(get_db)):
    result = verify_audit_chain(db)
    if result["status"] != "OK":
        record_security_event(db, "AUDIT_CHAIN_BROKEN", "CRITICAL", principal.user.id, "audit", details_minimized=str(result["failures"][:3]))
        db.commit()
    return result


@router.get("/alerts")
def list_alerts(severity: str | None = None, principal: CurrentPrincipal = Depends(require_permission("security:read")), db: Session = Depends(get_db)):
    stmt = select(SecurityEvent).where(SecurityEvent.severity.in_(["HIGH", "CRITICAL"])).order_by(SecurityEvent.created_at.desc()).limit(200)
    if severity:
        stmt = stmt.where(SecurityEvent.severity == severity)
    rows = db.execute(stmt).scalars()
    return [{"id": row.id, "rule": row.event_type, "event_type": row.event_type, "severity": row.severity, "status": row.alert_status, "resource_type": row.resource_type, "resource_public_id": row.resource_public_id, "description": row.details_minimized, "created_at": row.created_at, "acknowledgement_comment": row.acknowledgement_comment, "resolution_note": row.resolution_note} for row in rows]


@router.post("/alerts/{security_event_id}/ack", dependencies=[Depends(require_csrf)])
@router.post("/alerts/{security_event_id}/acknowledge", dependencies=[Depends(require_csrf)])
def acknowledge_alert(security_event_id: int, payload: AlertAcknowledgeRequest | None = None, principal: CurrentPrincipal = Depends(require_permission("security:read")), db: Session = Depends(get_db)):
    event = db.get(SecurityEvent, security_event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Alert not found")
    comment = payload.comment if payload else "Accusé de réception historique"
    event.alert_status = "ACKNOWLEDGED"
    event.acknowledged_by = principal.user.id
    event.acknowledged_at = datetime.utcnow()
    event.acknowledgement_comment = comment
    db.add(NotificationEvent(event_type="ALERT_ACKNOWLEDGED", recipient_scope=str(security_event_id), status="ACKNOWLEDGED"))
    record_security_event(db, "ALERT_ACKNOWLEDGED", "MEDIUM", principal.user.id, "security_event", str(security_event_id))
    db.commit()
    return {"status": "ACKNOWLEDGED"}


@router.post("/alerts/{security_event_id}/resolve", dependencies=[Depends(require_csrf)])
def resolve_alert(security_event_id: int, payload: AlertResolveRequest, principal: CurrentPrincipal = Depends(require_permission("security:read")), db: Session = Depends(get_db)):
    event = db.get(SecurityEvent, security_event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Alert not found")
    if event.alert_status != "ACKNOWLEDGED":
        raise HTTPException(status_code=409, detail="Alert must be acknowledged before resolution")
    event.alert_status = "RESOLVED"
    event.resolved_by = principal.user.id
    event.resolved_at = datetime.utcnow()
    event.resolution_note = payload.resolution_note
    record_security_event(db, "ALERT_RESOLVED", "MEDIUM", principal.user.id, "security_event", str(security_event_id))
    db.commit()
    return {"status": "RESOLVED"}


@router.get("/incidents")
def list_incidents(principal: CurrentPrincipal = Depends(require_permission("incident:update")), db: Session = Depends(get_db)):
    rows = db.execute(select(Incident).order_by(Incident.created_at.desc()).limit(200)).scalars()
    return [{"id": row.id, "public_id": row.public_id, "title": row.title, "category": row.category, "priority": row.priority, "severity": row.severity, "status": row.status, "assigned_to": row.assigned_to, "created_at": row.created_at, "occurred_at": row.occurred_at} for row in rows]


@router.post("/incidents", dependencies=[Depends(require_csrf)])
def create_incident(payload: IncidentCreateRequest, principal: CurrentPrincipal = Depends(require_permission("incident:create")), db: Session = Depends(get_db)):
    row = Incident(
        public_id=str(uuid4()),
        title=payload.title or payload.category.replace("_", " ").title(),
        category=payload.category,
        priority=payload.priority,
        severity=payload.severity,
        status="OPEN",
        description_minimized=payload.description or payload.comment,
        resource_type=payload.resource_type,
        resource_public_id=payload.resource_public_id,
        assigned_to=payload.assigned_to,
        occurred_at=datetime.fromisoformat(payload.occurred_at) if payload.occurred_at else datetime.utcnow(),
        is_demo=True,
    )
    db.add(row)
    db.flush()
    db.add(IncidentEvent(incident_id=row.id, event_type="CREATED", comment_minimized=payload.comment, created_by=principal.user.id))
    append_audit_event(db, principal, "INCIDENT_CREATED", "incident", row.public_id, severity=payload.severity)
    record_security_event(db, "INCIDENT_CREATED", "MEDIUM", principal.user.id, "incident", row.public_id)
    db.commit()
    return {"id": row.id, "public_id": row.public_id, "status": row.status}


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: int, principal: CurrentPrincipal = Depends(require_permission("incident:update")), db: Session = Depends(get_db)):
    row = db.get(Incident, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    events = db.execute(select(IncidentEvent, User.username).outerjoin(User, User.id == IncidentEvent.created_by).where(IncidentEvent.incident_id == incident_id).order_by(IncidentEvent.created_at.desc())).all()
    return {
        "id": row.id, "public_id": row.public_id, "title": row.title, "category": row.category,
        "priority": row.priority, "severity": row.severity, "status": row.status,
        "description": row.description_minimized, "assigned_to": row.assigned_to,
        "resource_type": row.resource_type, "resource_public_id": row.resource_public_id,
        "created_at": row.created_at, "occurred_at": row.occurred_at,
        "timeline": [{"id": event.id, "event_type": event.event_type, "comment": event.comment_minimized, "actor": username, "created_at": event.created_at} for event, username in events],
    }


@router.post("/incidents/{incident_id}/comments", dependencies=[Depends(require_csrf)])
def add_incident_comment(incident_id: int, payload: IncidentCommentRequest, principal: CurrentPrincipal = Depends(require_permission("incident:update")), db: Session = Depends(get_db)):
    row = db.get(Incident, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    event = IncidentEvent(incident_id=row.id, event_type="COMMENT", comment_minimized=payload.text, created_by=principal.user.id)
    db.add(event)
    append_audit_event(db, principal, "INCIDENT_COMMENT_ADDED", "incident", row.public_id, severity=row.severity)
    db.commit()
    return {"id": event.id, "status": "created"}


@router.post("/incidents/{incident_id}/transition", dependencies=[Depends(require_csrf)])
def transition_incident(incident_id: int, payload: IncidentTransitionRequest, principal: CurrentPrincipal = Depends(require_permission("incident:update")), db: Session = Depends(get_db)):
    row = db.get(Incident, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    allowed = {
        "OPEN": {"IN_PROGRESS", "REJECTED"},
        "IN_PROGRESS": {"ESCALATED", "RESOLVED"},
        "ESCALATED": {"IN_PROGRESS"},
        "RESOLVED": {"IN_PROGRESS", "CLOSED"},
    }
    if payload.new_status not in allowed.get(row.status, set()):
        raise HTTPException(status_code=409, detail="Incident transition not allowed")
    previous = row.status
    row.status = payload.new_status
    if row.status in {"RESOLVED", "CLOSED"}:
        row.resolved_at = datetime.utcnow()
    db.add(IncidentEvent(incident_id=row.id, event_type=f"{previous}_TO_{row.status}", comment_minimized=payload.comment, created_by=principal.user.id))
    append_audit_event(db, principal, "INCIDENT_TRANSITIONED", "incident", row.public_id, justification=payload.comment, severity=row.severity)
    db.commit()
    return {"id": row.id, "status": row.status}


@router.patch("/incidents/{incident_id}", dependencies=[Depends(require_csrf)])
def update_incident(incident_id: int, payload: IncidentUpdateRequest, principal: CurrentPrincipal = Depends(require_permission("incident:update")), db: Session = Depends(get_db)):
    row = db.get(Incident, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    if payload.status:
        row.status = payload.status
        if payload.status in {"RESOLVED", "CLOSED"}:
            row.resolved_at = datetime.utcnow()
    if payload.priority:
        row.priority = payload.priority
    if payload.severity:
        row.severity = payload.severity
    if payload.assigned_to is not None:
        row.assigned_to = payload.assigned_to
    db.add(IncidentEvent(incident_id=row.id, event_type="UPDATED", comment_minimized=payload.comment, created_by=principal.user.id))
    append_audit_event(db, principal, "INCIDENT_UPDATED", "incident", row.public_id, severity=row.severity)
    db.commit()
    return {"id": row.id, "status": row.status}


@router.get("/privacy/requests")
def list_privacy_requests(principal: CurrentPrincipal = Depends(require_permission("privacy:read")), db: Session = Depends(get_db)):
    rows = db.execute(select(DataAccessRequest).order_by(DataAccessRequest.received_at.desc()).limit(200)).scalars()
    return [{"id": row.id, "public_id": row.public_id, "request_type": row.request_type, "subject_type": row.subject_type, "status": row.status} for row in rows]


@router.post("/privacy/requests", dependencies=[Depends(require_csrf)])
def create_privacy_request(payload: PrivacyRequestCreate, principal: CurrentPrincipal = Depends(require_permission("privacy:update")), db: Session = Depends(get_db)):
    row = DataAccessRequest(
        public_id=str(uuid4()), request_type=payload.request_type, subject_type=payload.subject_type,
        student_id=payload.student_id, status="RECEIVED", subject_last_name=payload.subject_last_name,
        subject_first_name=payload.subject_first_name, subject_contact_masked=payload.subject_contact,
        request_object=payload.request_object,
        received_at=datetime.fromisoformat(payload.received_at) if payload.received_at else datetime.utcnow(),
    )
    db.add(row)
    append_audit_event(db, principal, "PRIVACY_REQUEST_CREATED", "data_access_request", row.public_id, severity="HIGH")
    db.commit()
    return {"id": row.id, "public_id": row.public_id, "status": row.status}


@router.post("/privacy/requests/{request_id}/transition", dependencies=[Depends(require_csrf)])
@router.post("/data-requests/{request_id}/transition", dependencies=[Depends(require_csrf)])
def transition_privacy_request(request_id: int, payload: PrivacyTransitionRequest, principal: CurrentPrincipal = Depends(require_permission("privacy:update")), db: Session = Depends(get_db)):
    row = db.get(DataAccessRequest, request_id)
    if not row:
        raise HTTPException(status_code=404, detail="Data request not found")
    row.status = payload.new_status
    if payload.new_status in {"CLOSED", "REJECTED"}:
        row.closed_at = datetime.utcnow()
    append_audit_event(db, principal, "DATA_REQUEST_TRANSITIONED", "data_access_request", row.public_id, justification=payload.comment, severity="HIGH")
    db.commit()
    return {"id": row.id, "status": row.status}


@router.get("/privacy/register")
def list_processing_register(principal: CurrentPrincipal = Depends(require_permission("privacy:read")), db: Session = Depends(get_db)):
    rows = db.execute(select(DataProcessingRegister).order_by(DataProcessingRegister.processing_name)).scalars()
    return [{"id": row.id, "processing_name": row.processing_name, "purpose": row.purpose, "requires_legal_validation": row.requires_legal_validation} for row in rows]


@router.post("/privacy/register", dependencies=[Depends(require_csrf)])
def create_processing_register(payload: ProcessingRegisterCreate, principal: CurrentPrincipal = Depends(require_permission("privacy:update")), db: Session = Depends(get_db)):
    row = DataProcessingRegister(
        processing_name=payload.processing_name,
        purpose=payload.purpose,
        data_categories=payload.data_categories,
        legal_basis_note=payload.legal_basis_note,
        retention_note=payload.retention_note,
        data_subjects=payload.data_subjects,
        controller_name=payload.controller_name,
        processors_note=payload.processors_note,
        security_measures=payload.security_measures,
        status=payload.status,
        requires_legal_validation=True,
    )
    db.add(row)
    append_audit_event(db, principal, "PROCESSING_REGISTER_CREATED", "data_processing_register", payload.processing_name, severity="HIGH")
    db.commit()
    return {"id": row.id, "requires_legal_validation": row.requires_legal_validation}


@router.get("/privacy/retention")
def list_retention_rules(principal: CurrentPrincipal = Depends(require_permission("privacy:read")), db: Session = Depends(get_db)):
    rows = db.execute(select(RetentionRule).order_by(RetentionRule.resource_type)).scalars()
    return [{"id": row.id, "resource_type": row.resource_type, "retention_period_days": row.retention_period_days, "status": row.status} for row in rows]


@router.post("/privacy/retention", dependencies=[Depends(require_csrf)])
def create_retention_rule(payload: RetentionRuleCreate, principal: CurrentPrincipal = Depends(require_permission("privacy:update")), db: Session = Depends(get_db)):
    row = RetentionRule(resource_type=payload.resource_type, name=payload.name, retention_period_days=payload.retention_period_days, duration_unit=payload.duration_unit, trigger_type=payload.trigger_type, action_on_expiry=payload.action_on_expiry, status=payload.status)
    db.add(row)
    append_audit_event(db, principal, "RETENTION_RULE_CREATED", "retention_rule", payload.resource_type, severity="HIGH", justification="Legal validation required")
    record_security_event(db, "RETENTION_RULE_CREATED", "HIGH", principal.user.id, "retention_rule", payload.resource_type)
    db.commit()
    return {"id": row.id, "status": row.status}


@router.get("/backups")
def list_backup_events(
    event_type: str | None = None,
    status_value: str | None = Query(default=None, alias="status"),
    from_date: datetime | None = Query(default=None, alias="from"),
    to_date: datetime | None = Query(default=None, alias="to"),
    principal: CurrentPrincipal = Depends(require_permission("backup:read")),
    db: Session = Depends(get_db),
):
    del principal
    stmt = select(BackupEvent).order_by(BackupEvent.started_at.desc()).limit(100)
    if event_type:
        stmt = stmt.where(BackupEvent.event_type == event_type)
    if status_value:
        stmt = stmt.where(BackupEvent.status == status_value)
    if from_date:
        stmt = stmt.where(BackupEvent.started_at >= from_date)
    if to_date:
        stmt = stmt.where(BackupEvent.started_at <= to_date)
    rows = list(db.execute(stmt).scalars())
    users = {row.id: row for row in db.execute(select(User)).scalars()}
    return [{
        "id": row.id, "event_type": row.event_type, "status": row.status,
        "file_reference": row.file_reference, "started_at": row.started_at, "finished_at": row.finished_at,
        "checksum_present": row.checksum_present, "file_size_bytes": row.file_size_bytes,
        "created_by": users[row.created_by].username if row.created_by in users else None,
        "operator": row.operator or (users[row.created_by].display_name if row.created_by in users else "Script"),
    } for row in rows]
