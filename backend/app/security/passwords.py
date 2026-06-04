from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError

from app.core.security_config import PASSWORD_MIN_LENGTH


password_hasher = PasswordHasher(type=Type.ID)


def hash_password(password: str) -> str:
    validate_password_policy(password)
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def validate_password_policy(password: str) -> None:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must contain at least {PASSWORD_MIN_LENGTH} characters.")
    if not any(char.isupper() for char in password):
        raise ValueError("Password must contain an uppercase letter.")
    if not any(char.islower() for char in password):
        raise ValueError("Password must contain a lowercase letter.")
    if not any(char.isdigit() for char in password):
        raise ValueError("Password must contain a digit.")
    if not any(not char.isalnum() for char in password):
        raise ValueError("Password must contain a symbol.")
