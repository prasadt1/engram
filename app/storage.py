"""Pluggable photo storage: Alibaba OSS in production, local disk in dev.

The rest of the app only ever sees `get_storage()` and the PhotoStorage
interface, so development proceeds on LocalDiskStorage while the Alibaba
account clears verification, and OSS slots in via env change alone:

    STORAGE_BACKEND=oss  + OSS_* vars in .env

OSSStorage is the primary "proof of Alibaba Cloud services" code file for
the hackathon submission (private bucket + presigned read URLs via oss2).
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Protocol


class PhotoStorage(Protocol):
    def save(self, data: bytes, *, filename: str, content_type: str) -> str:
        """Store bytes; return an opaque storage key."""
        ...

    def signed_url(self, key: str, *, expires_seconds: int = 3600) -> str:
        """Return a time-limited URL the browser can fetch the photo from."""
        ...

    def exists(self, key: str) -> bool: ...


def _safe_key(filename: str) -> str:
    ext = Path(filename).suffix.lower() or ".jpg"
    return f"photos/{uuid.uuid4().hex}{ext}"


class LocalDiskStorage:
    """Dev backend: writes under ./data/media, served by FastAPI at /media."""

    def __init__(self, root: str = "data/media", public_base: str = "/media") -> None:
        self.root = Path(root)
        self.public_base = public_base.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, *, filename: str, content_type: str) -> str:
        key = _safe_key(filename)
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def signed_url(self, key: str, *, expires_seconds: int = 3600) -> str:
        # Local dev has no signing; the /media static route serves it directly.
        return f"{self.public_base}/{key}"

    def exists(self, key: str) -> bool:
        return (self.root / key).is_file()


class OSSStorage:
    """Alibaba Cloud OSS backend (oss2 SDK), private bucket + presigned reads."""

    def __init__(self) -> None:
        import oss2  # imported lazily so dev machines without creds never touch it

        auth = oss2.Auth(
            os.environ["OSS_ACCESS_KEY_ID"],
            os.environ["OSS_ACCESS_KEY_SECRET"],
        )
        endpoint = os.environ.get("OSS_ENDPOINT", "https://oss-ap-southeast-1.aliyuncs.com")
        self.bucket = oss2.Bucket(auth, endpoint, os.environ["OSS_BUCKET"])

    def save(self, data: bytes, *, filename: str, content_type: str) -> str:
        key = _safe_key(filename)
        self.bucket.put_object(key, data, headers={"Content-Type": content_type})
        return key

    def signed_url(self, key: str, *, expires_seconds: int = 3600) -> str:
        return self.bucket.sign_url("GET", key, expires_seconds)

    def exists(self, key: str) -> bool:
        return self.bucket.object_exists(key)


_storage: PhotoStorage | None = None


def get_storage() -> PhotoStorage:
    global _storage
    if _storage is None:
        backend = os.environ.get("STORAGE_BACKEND", "local").lower()
        _storage = OSSStorage() if backend == "oss" else LocalDiskStorage()
    return _storage
