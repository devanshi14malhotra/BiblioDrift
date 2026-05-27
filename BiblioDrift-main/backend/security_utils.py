# Security Utilities for Credential Encryption
# Provides encryption and decryption for sensitive configuration data

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import os
import base64
import logging

logger = logging.getLogger(__name__)


class CredentialEncryption:
    """
    Secure encryption/decryption for sensitive credentials.
    Uses Fernet symmetric encryption with PBKDF2 key derivation.
    
    Security Features:
    - Keys derived from master password using PBKDF2 with salt
    - Fernet provides authenticated encryption
    - Salt stored alongside encrypted data (safe by design)
    - Prevents credential exposure in config files
    
    Usage:
        # Initialize with a master password (store securely in env var)
        encryptor = CredentialEncryption(master_password)
        
        # Encrypt a credential
        encrypted = encryptor.encrypt("my-secret-key")
        
        # Decrypt a credential
        decrypted = encryptor.decrypt(encrypted)
    """
    
    def __init__(self, master_password: str = None, salt: bytes = None):
        """
        Initialize the encryption service.
        
        Args:
            master_password: Master password for encryption. 
                           If None, uses CREDENTIAL_MASTER_PASSWORD env var.
            salt: Optional salt for key derivation. Generated if not provided.
        """
        self.master_password = master_password or os.getenv('CREDENTIAL_MASTER_PASSWORD')
        
        if not self.master_password:
            raise ValueError(
                "Master password required for encryption. "
                "Set CREDENTIAL_MASTER_PASSWORD environment variable."
            )
        
        self.salt = salt or os.urandom(16)
        self.key = self._derive_key(self.master_password, self.salt)
        self.fernet = Fernet(self.key)
    
    def _derive_key(self, password: str, salt: bytes) -> bytes:
        """
        Derive a 32-byte key from password using PBKDF2.
        
        Args:
            password: The master password
            salt: Random salt for key derivation
            
        Returns:
            Base64-encoded key suitable for Fernet
        """
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100_000,  # OWASP recommended minimum
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext credential.
        
        Args:
            plaintext: The credential to encrypt
            
        Returns:
            Encrypted credential with salt prepended (base64 encoded)
        """
        if not plaintext:
            raise ValueError("Cannot encrypt empty credential")
        
        try:
            encrypted_data = self.fernet.encrypt(plaintext.encode())
            # Prepend salt to encrypted data for storage
            full_data = self.salt + encrypted_data
            return base64.b64encode(full_data).decode('utf-8')
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise
    
    def decrypt(self, encrypted_credential: str) -> str:
        """
        Decrypt an encrypted credential.
        
        Args:
            encrypted_credential: Encrypted credential (with salt prepended)
            
        Returns:
            Decrypted plaintext credential
        """
        if not encrypted_credential:
            raise ValueError("Cannot decrypt empty credential")
        
        try:
            # Decode and extract salt and encrypted data
            full_data = base64.b64decode(encrypted_credential.encode())
            salt = full_data[:16]  # First 16 bytes are salt
            encrypted_data = full_data[16:]
            
            # Re-derive key with extracted salt
            key = self._derive_key(self.master_password, salt)
            fernet = Fernet(key)
            
            # Decrypt
            decrypted = fernet.decrypt(encrypted_data)
            return decrypted.decode('utf-8')
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError(f"Invalid or corrupted credential: {e}")
    
    @staticmethod
    def generate_master_password() -> str:
        """
        Generate a secure random master password.
        Store this securely (e.g., in environment variables, secret manager).
        
        Returns:
            A secure random 32-character password
        """
        import secrets
        return secrets.token_urlsafe(32)


# Convenience functions for simple usage
_default_encryptor = None


def get_encryptor() -> CredentialEncryption:
    """Get or create the default encryptor instance."""
    global _default_encryptor
    if _default_encryptor is None:
        _default_encryptor = CredentialEncryption()
    return _default_encryptor


def encrypt_credential(plaintext: str) -> str:
    """
    Encrypt a credential using the default encryptor.
    
    Args:
        plaintext: Credential to encrypt
        
    Returns:
        Encrypted credential string
    """
    return get_encryptor().encrypt(plaintext)


def decrypt_credential(encrypted: str) -> str:
    """
    Decrypt a credential using the default encryptor.
    
    Args:
        encrypted: Encrypted credential string
        
    Returns:
        Decrypted plaintext credential
    """
    return get_encryptor().decrypt(encrypted)
