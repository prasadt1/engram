from app.storage import LocalDiskStorage


def test_local_storage_roundtrip(tmp_path):
    store = LocalDiskStorage(root=str(tmp_path / "media"))
    key = store.save(b"fake-jpeg-bytes", filename="sunset.JPG", content_type="image/jpeg")

    assert key.startswith("photos/")
    assert key.endswith(".jpg")  # extension normalized to lowercase
    assert store.exists(key)
    assert store.signed_url(key) == f"/media/{key}"


def test_local_storage_keys_are_unique_per_save(tmp_path):
    store = LocalDiskStorage(root=str(tmp_path / "media"))
    k1 = store.save(b"a", filename="same-name.jpg", content_type="image/jpeg")
    k2 = store.save(b"b", filename="same-name.jpg", content_type="image/jpeg")
    assert k1 != k2


def test_missing_key_does_not_exist(tmp_path):
    store = LocalDiskStorage(root=str(tmp_path / "media"))
    assert not store.exists("photos/nope.jpg")
