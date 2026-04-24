"""Symmetric encryption for secrets stored at rest (e.g. OIDC client_secret).

Derives a Fernet key from the application SECRET_KEY so the same deployment can
decrypt what it encrypted across restarts. Rotating SECRET_KEY invalidates
existing ciphertexts — operators must re-save OIDC client secrets after rotation.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError(
            "Failed to decrypt secret — SECRET_KEY may have been rotated. "
            "Re-enter the OIDC client secret via the admin UI."
        ) from exc
