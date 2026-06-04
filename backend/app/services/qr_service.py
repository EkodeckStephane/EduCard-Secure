import base64
import json
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_card_scope
from app.core.config import get_settings
from app.models.entities import Card, QrVerificationEvent, SigningKeyVersion
from app.services.security_events import record_security_event


FORMAT_VERSION = "EDUQR1"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _canonical(data: dict) -> bytes:
    return json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")


def _default_private_path() -> Path:
    return Path(__file__).resolve().parents[3] / "private" / "dev_qr_ed25519_private.pem"


def _default_public_path() -> Path:
    return Path(__file__).resolve().parents[3] / "private" / "dev_qr_ed25519_public.pem"


def key_paths() -> tuple[Path, Path]:
    settings = get_settings()
    private_path = Path(settings.qr_signing_private_key_path) if settings.qr_signing_private_key_path else _default_private_path()
    public_path = Path(settings.qr_signing_public_key_path) if settings.qr_signing_public_key_path else _default_public_path()
    return private_path, public_path


def generate_dev_keys(overwrite: bool = False) -> tuple[Path, Path, str]:
    private_path, public_path = key_paths()
    private_path.parent.mkdir(parents=True, exist_ok=True)
    if not overwrite and (private_path.exists() or public_path.exists()):
        raise FileExistsError("Development QR key already exists")
    private_key = Ed25519PrivateKey.generate()
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_key = private_key.public_key()
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    private_path.write_bytes(private_bytes)
    public_path.write_bytes(public_bytes)
    fingerprint = public_key_fingerprint(public_key)
    return private_path, public_path, fingerprint


def load_private_key() -> Ed25519PrivateKey:
    private_path, _ = key_paths()
    if not private_path.exists():
        raise HTTPException(status_code=500, detail="QR signing key is not configured")
    key = serialization.load_pem_private_key(private_path.read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise HTTPException(status_code=500, detail="Unsupported QR signing key")
    return key


def load_public_key() -> Ed25519PublicKey:
    _, public_path = key_paths()
    if not public_path.exists():
        raise HTTPException(status_code=500, detail="QR public key is not configured")
    key = serialization.load_pem_public_key(public_path.read_bytes())
    if not isinstance(key, Ed25519PublicKey):
        raise HTTPException(status_code=500, detail="Unsupported QR public key")
    return key


def public_key_fingerprint(public_key: Ed25519PublicKey) -> str:
    digest = hashes.Hash(hashes.SHA256())
    digest.update(
        public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
    )
    return _b64(digest.finalize())


def ensure_signing_key_version(db: Session, public_key: Ed25519PublicKey) -> SigningKeyVersion:
    fingerprint = public_key_fingerprint(public_key)
    row = db.execute(select(SigningKeyVersion).where(SigningKeyVersion.public_key_fingerprint == fingerprint)).scalar_one_or_none()
    if row:
        if row.status == "REVOKED":
            raise HTTPException(status_code=409, detail="QR signing key is revoked")
        return row
    row = SigningKeyVersion(key_version=f"dev-{uuid4().hex[:12]}", public_key_fingerprint=fingerprint, status="ACTIVE", valid_from=datetime.utcnow())
    db.add(row)
    db.flush()
    return row


def generate_qr_payload(db: Session, card_id: int, ttl_minutes: int, principal: CurrentPrincipal) -> dict:
    assert_card_scope(db, principal, card_id)
    card = db.get(Card, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Only active cards can receive QR payloads")
    private_key = load_private_key()
    public_key = private_key.public_key()
    key_version = ensure_signing_key_version(db, public_key)
    valid_until = datetime.utcnow() + timedelta(minutes=ttl_minutes)
    body = {
        "v": FORMAT_VERSION,
        "opaque_id": str(uuid4()),
        "card_id": card.id,
        "valid_until": valid_until.replace(microsecond=0).isoformat() + "Z",
        "nonce": _b64(uuid4().bytes),
        "key_version": key_version.key_version,
    }
    signature = _b64(private_key.sign(_canonical(body)))
    payload = _b64(json.dumps({**body, "sig": signature}, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    record_security_event(db, "QR_GENERATED", "HIGH", principal.user.id, "card", card.public_id)
    db.commit()
    return {"payload": payload, "format_version": FORMAT_VERSION, "key_version": key_version.key_version, "valid_until": valid_until}


def verify_qr_payload(db: Session, payload: str, principal: CurrentPrincipal) -> dict:
    result = "anomalie"
    card: Card | None = None
    opaque = "malformed"
    try:
        decoded = json.loads(_unb64(payload))
        signature = decoded.pop("sig")
        required = {"v", "opaque_id", "card_id", "valid_until", "nonce", "key_version"}
        if set(decoded.keys()) != required or decoded["v"] != FORMAT_VERSION:
            result = "payload mal forme"
            raise ValueError("Malformed payload")
        opaque = decoded["opaque_id"]
        key_version = db.execute(select(SigningKeyVersion).where(SigningKeyVersion.key_version == decoded["key_version"])).scalar_one_or_none()
        if not key_version:
            result = "cle inconnue"
            raise ValueError("Unknown key")
        if key_version.status == "REVOKED":
            result = "cle revoquee"
            raise ValueError("Revoked key")
        public_key = load_public_key()
        if public_key_fingerprint(public_key) != key_version.public_key_fingerprint:
            result = "cle inconnue"
            raise ValueError("Key fingerprint mismatch")
        public_key.verify(_unb64(signature), _canonical(decoded))
        valid_until = datetime.fromisoformat(decoded["valid_until"].replace("Z", ""))
        if valid_until < datetime.utcnow():
            result = "identifiant expire"
            raise ValueError("Expired")
        card = db.get(Card, int(decoded["card_id"]))
        if not card:
            result = "carte inconnue"
        elif card.status == "SUSPENDED":
            result = "carte suspendue"
        elif card.status == "REVOKED":
            result = "carte revoquee"
        elif card.status != "ACTIVE":
            result = "anomalie"
        else:
            assert_card_scope(db, principal, card.id)
            result = "valide"
    except InvalidSignature:
        result = "signature invalide"
    except HTTPException:
        raise
    except Exception:
        if result == "anomalie":
            result = "payload mal forme"
    db.add(
        QrVerificationEvent(
            card_id=card.id if card else None,
            opaque_identifier=opaque[:120],
            verification_result=result,
            reason_code=result.upper().replace(" ", "_"),
            verified_by=principal.user.id,
        )
    )
    record_security_event(db, "QR_VERIFIED", "HIGH" if result != "valide" else "INFO", principal.user.id, "card", card.public_id if card else None, result)
    db.commit()
    return {"result": result, "card_id": card.id if card else None, "reason": result}
