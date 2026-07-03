"""PyMongo client for Coach / Planner / Reflection writes (ADR-003)."""

from __future__ import annotations

import os
from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is not set")
    return MongoClient(uri, serverSelectionTimeoutMS=15000)


def get_db() -> Database:
    name = os.environ.get("MONGODB_DB_NAME", "engram")
    return get_client()[name]
