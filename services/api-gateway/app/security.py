"""
Security Utilities
Handles encryption/decryption of API tokens and sensitive data
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os


class SecurityService:
    """Service for encrypting/decrypting sensitive data"""

    def __init__(self):
        # Get secret key from environment
        secret_key = os.getenv('SECRET_KEY')

        if not secret_key:
            raise ValueError(
                "SECRET_KEY environment variable not set. "
                "Please set it to a secure random string (minimum 32 characters)."
            )

        # Derive encryption key from secret
        self.cipher = self._create_cipher(secret_key)

    def _create_cipher(self, secret_key: str) -> Fernet:
        """
        Create Fernet cipher from secret key

        Uses PBKDF2 to derive a proper encryption key
        """
        # Use fixed salt (stored in code)
        # In production, you might want to use environment variable
        salt = b'pantrypal_encryption_salt_v1'

        # Derive key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )

        key = base64.urlsafe_b64encode(kdf.derive(secret_key.encode()))
        return Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a string

        Args:
            plaintext: String to encrypt

        Returns:
            Encrypted string (base64 encoded)
        """
        if not plaintext:
            return ""

        encrypted = self.cipher.encrypt(plaintext.encode())
        return encrypted.decode('utf-8')

    def decrypt(self, encrypted: str) -> str:
        """
        Decrypt a string

        Args:
            encrypted: Encrypted string (base64 encoded)

        Returns:
            Decrypted plaintext string
        """
        if not encrypted:
            return ""

        try:
            decrypted = self.cipher.decrypt(encrypted.encode())
            return decrypted.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Failed to decrypt: {e}")

    def encrypt_api_token(self, token: str) -> str:
        """
        Encrypt API token for storage

        Args:
            token: API token (Mealie/Tandoor)

        Returns:
            Encrypted token
        """
        return self.encrypt(token)

    def decrypt_api_token(self, encrypted_token: str) -> str:
        """
        Decrypt API token

        Args:
            encrypted_token: Encrypted API token

        Returns:
            Plaintext API token
        """
        return self.decrypt(encrypted_token)


# Singleton instance
_security_service = None


def get_security_service() -> SecurityService:
    """Get SecurityService singleton"""
    global _security_service
    if _security_service is None:
        _security_service = SecurityService()
    return _security_service
