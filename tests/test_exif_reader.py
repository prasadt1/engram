"""Tests for app.exif_reader.extract_exif — real camera metadata extraction.

Fixtures build synthetic JPEGs with genuine EXIF tags via Pillow's own
Image.Exif writer (the exposure tags live in the 0x8769 sub-IFD; GPS in the
0x8825 IFD), so these exercise the same read path a real upload hits."""
import io

from PIL import Image

from app.exif_reader import extract_exif


def _jpeg_with_exif(exif_dict: dict | None = None, gps: dict | None = None) -> bytes:
    """Build an 8x8 JPEG. If exif_dict/gps given, embed them as real EXIF.

    exif_dict maps numeric tag IDs to values; nest exposure tags under key
    0x8769 (the Exif sub-IFD) exactly as a camera would. Passing exif=None to
    Image.save() raises on this Pillow version, so the no-EXIF branch omits the
    kwarg entirely (the natural 'no metadata' case)."""
    im = Image.new("RGB", (8, 8), (120, 120, 120))
    buf = io.BytesIO()
    if exif_dict or gps:
        exif = Image.Exif()
        for k, v in (exif_dict or {}).items():
            exif[k] = v
        if gps is not None:
            exif[0x8825] = gps
        im.save(buf, format="JPEG", exif=exif)
    else:
        im.save(buf, format="JPEG")
    return buf.getvalue()


def test_extract_exif_full_populated_dict():
    data = _jpeg_with_exif(
        {
            0x010F: "Apple",  # Make
            0x0110: "iPhone 13 Pro",  # Model
            0x8769: {  # Exif sub-IFD
                0x829D: 2.8,  # FNumber
                0x829A: (1, 500),  # ExposureTime
                0x8827: 400,  # ISOSpeedRatings
                0x920A: 50.0,  # FocalLength
                0x9003: "2024:06:18 10:30:00",  # DateTimeOriginal
            },
        }
    )
    result = extract_exif(data)
    assert result == {
        "make": "Apple",
        "model": "iPhone 13 Pro",
        "focalLength": "50mm",
        "aperture": "f/2.8",
        "shutterSpeed": "1/500s",
        "iso": "ISO 400",
        "capturedAt": "2024:06:18 10:30:00",
    }


def test_extract_exif_gps_converts_to_decimal():
    # 37°46'30"N, 122°25'15"W -> +37.775, -122.420833
    gps = {1: "N", 2: (37.0, 46.0, 30.0), 3: "W", 4: (122.0, 25.0, 15.0)}
    result = extract_exif(_jpeg_with_exif({0x010F: "Canon"}, gps=gps))
    assert result is not None
    assert result["make"] == "Canon"
    assert result["gps"] == {"lat": 37.775, "lng": -122.420833}


def test_extract_exif_no_exif_returns_none():
    assert extract_exif(_jpeg_with_exif()) is None


def test_extract_exif_malformed_bytes_returns_none_never_raises():
    assert extract_exif(b"not-an-image-at-all") is None
    assert extract_exif(b"") is None


def test_extract_exif_truncated_bytes_returns_none():
    full = _jpeg_with_exif({0x010F: "Apple", 0x8769: {0x829D: 2.8}})
    assert extract_exif(full[:40]) is None


def test_extract_exif_partial_fields_omits_missing():
    # Only aperture present — every other field must be absent, not "unknown".
    data = _jpeg_with_exif({0x8769: {0x829D: 4.0}})
    result = extract_exif(data)
    assert result == {"aperture": "f/4"}
