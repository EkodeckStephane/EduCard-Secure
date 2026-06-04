from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import (
    AuditEvent,
    BackupEvent,
    DataAccessRequest,
    DataProcessingRegister,
    Incident,
    IncidentEvent,
    NotificationEvent,
    RetentionRule,
    SecurityEvent,
)
from app.schemas.security_ops import (
    AuditCreateRequest,
    IncidentCreateRequest,
    IncidentUpdateRequest,
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
def list_audit_events(action: str | None = None, severity: str | None = None, principal: CurrentPrincipal = Depends(require_permission("audit:read")), db: Session = Depends(get_db)):
    stmt = select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(200)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    if severity:
        stmt = stmt.where(AuditEvent.severity == severity)
    rows = db.execute(stmt).scalars()
    return [
        {"id": row.id, "event_public_id": row.event_public_id, "action": row.action, "resource_type": row.resource_type, "result": row.result, "severity": row.severity, "occurred_at": row.occurred_at}
        for row in rows
    ]


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
    return [{"id": row.id, "rule": row.event_type, "severity": row.severity, "status": "OPEN", "resource_type": row.resource_type, "created_at": row.created_at} for row in rows]


@router.post("/alerts/{security_event_id}/ack", dependencies=[Depends(require_csrf)])
def acknowledge_alert(security_event_id: int, principal: CurrentPrincipal = Depends(require_permission("security:read")), db: Session = Depends(get_db)):
    event = db.get(SecurityEvent, security_event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.add(NotificationEvent(event_type="ALERT_ACKNOWLEDGED", recipient_scope=str(security_event_id), status="ACKNOWLEDGED"))
    record_security_event(db, "ALERT_ACKNOWLEDGED", "MEDIUM", principal.user.id, "security_event", str(security_event_id))
    db.commit()
    return {"status": "acknowledged"}


@router.get("/incidents")
def list_incidents(principal: CurrentPrincipal = Depends(require_permission("incident:update")), db: Session = Depends(get_db)):
    rows = db.execute(select(Incident).order_by(Incident.created_at.desc()).limit(200)).scalars()
    return [{"id": row.id, "public_id": row.public_id, "category": row.category, "priority": row.priority, "severity": row.severity, "status": row.status} for row in rows]


@router.post("/incidents", dependencies=[Depends(require_csrf)])
def create_incident(payload: IncidentCreateRequest, principal: CurrentPrincipal = Depends(require_permission("incident:create")), db: Session = Depends(get_db)):
    row = Incident(public_id=str(uuid4()), category=payload.category, priority=payload.priority, severity=payload.severity, status="OPEN", is_demo=True)
    db.add(row)
    db.flush()
    db.add(IncidentEvent(incident_id=row.id, event_type="CREATED", comment_minimized=payload.comment, created_by=principal.user.id))
    append_audit_event(db, principal, "INCIDENT_CREATED", "incident", row.public_id, severity=payload.severity)
    record_security_event(db, "INCIDENT_CREATED", "MEDIUM", principal.user.id, "incident", row.public_id)
    db.commit()
    return {"id": row.id, "public_id": row.public_id, "status": row.status}


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
    row = DataAccessRequest(public_id=str(uuid4()), request_type=payload.request_type, subject_type=payload.subject_type, student_id=payload.student_id, status="RECEIVED")
    db.add(row)
    append_audit_event(db, principal, "PRIVACY_REQUEST_CREATED", "data_access_request", row.public_id, severity="HIGH")
    db.commit()
    return {"id": row.id, "public_id": row.public_id, "status": row.status}


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
    row = RetentionRule(resource_type=payload.resource_type, retention_period_days=payload.retention_period_days, action_on_expiry=payload.action_on_expiry, status=payload.status)
    db.add(row)
    append_audit_event(db, principal, "RETENTION_RULE_CREATED", "retention_rule", payload.resource_type, severity="HIGH", justification="Legal validation required")
    record_security_event(db, "RETENTION_RULE_CREATED", "HIGH", principal.user.id, "retention_rule", payload.resource_type)
    db.commit()
    return {"id": row.id, "status": row.status}


@router.get("/backups")
def list_backup_events(principal: CurrentPrincipal = Depends(require_permission("backup:read")), db: Session = Depends(get_db)):
    rows = db.execute(select(BackupEvent).order_by(BackupEvent.started_at.desc()).limit(100)).scalars()
    return [{"id": row.id, "event_type": row.event_type, "status": row.status, "file_reference": row.file_reference, "started_at": row.started_at, "finished_at": row.finished_at} for row in rows]
