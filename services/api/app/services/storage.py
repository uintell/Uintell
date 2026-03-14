from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import boto3

from app.core.config import Settings


@dataclass(slots=True)
class StoredBlob:
    key: str
    uri: str


class FileStorage(ABC):
    @abstractmethod
    async def save_bytes(self, *, filename: str, content: bytes, content_type: str | None = None) -> StoredBlob: ...


class LocalFileStorage(FileStorage):
    def __init__(self, root: Path) -> None:
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)

    async def save_bytes(self, *, filename: str, content: bytes, content_type: str | None = None) -> StoredBlob:
        key = f"{uuid4()}-{filename}"
        destination = self._root / key
        destination.write_bytes(content)
        return StoredBlob(key=key, uri=str(destination))


class S3FileStorage(FileStorage):
    def __init__(self, settings: Settings) -> None:
        if not settings.s3_bucket:
            raise ValueError("s3_bucket must be configured when file_storage_backend=s3")
        self._bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            region_name=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    async def save_bytes(self, *, filename: str, content: bytes, content_type: str | None = None) -> StoredBlob:
        key = f"uploads/{uuid4()}-{filename}"
        extra_args = {"ContentType": content_type} if content_type else {}
        self._client.put_object(Bucket=self._bucket, Key=key, Body=content, **extra_args)
        return StoredBlob(key=key, uri=f"s3://{self._bucket}/{key}")


def build_storage(settings: Settings) -> FileStorage:
    if settings.file_storage_backend == "s3":
        return S3FileStorage(settings)
    return LocalFileStorage(settings.uploads_root)
