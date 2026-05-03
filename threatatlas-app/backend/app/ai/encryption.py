"""
Fernet symmetric encryption for AI provider API keys.

The Fernet key is derived from the application SECRET_KEY using PBKDF2HMAC so
no additional environment variable is required.  The raw key is NEVER returned
by any API endpoint; callers use mask_api_key() for display.
"""
import base64
import hashlib

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import settings


def _get_fernet() -> Fernet:
    secret = settings.secret_key.encode()
    # Deterministic salt derived from secret — no extra env var needed
    salt = hashlib.sha256(secret).digest()[:16]
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret))
    return Fernet(key)


_fernet: Fernet | None = None


def _fernet_instance() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = _get_fernet()
    return _fernet


def encrypt_api_key(plaintext: str) -> bytes:
    return _fernet_instance().encrypt(plaintext.encode())


def decrypt_api_key(ciphertext: bytes) -> str:
    return _fernet_instance().decrypt(ciphertext).decode()


def mask_api_key(plaintext: str) -> str:
    """Return a display-safe masked version, e.g. 'sk-abc...****'."""
    if len(plaintext) <= 8:
        return "****"
    return plaintext[:6] + "...****"
