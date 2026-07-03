import os
import pytest
from dotenv import load_dotenv

load_dotenv()

@pytest.mark.skipif(not os.environ.get("MONGODB_URI"), reason="no live Mongo configured")
def test_get_db_connects_and_returns_configured_database():
    from app.db import get_db
    db = get_db()
    assert db.name == os.environ.get("MONGODB_DB_NAME", "engram")
    db.client.admin.command("ping")  # raises if the URI/credentials are bad
