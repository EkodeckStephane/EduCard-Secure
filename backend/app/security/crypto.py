import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import get_settings


def _fernet() -> Fernet:
    material = get_settings().field_encryption_key or get_settings().secret_key
    if not material:
        raise RuntimeError("FIELD_ENCRYPTION_KEY or SECRET_KEY must be configured locally.")
    key = base64.urlsafe_b64encode(hashlib.sha256(material.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_text(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_text(value: str) -> str:
    return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
