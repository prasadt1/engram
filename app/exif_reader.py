"""Real EXIF metadata extraction from uploaded image bytes.

Additive, defensive helper used by ``app.coach.analyze_photo`` to read genuine
camera metadata off an upload's original bytes — as opposed to the coach
model's ``settings_estimate``, which is *guessed* from pixels. This never
raises: it returns ``None`` when there is no EXIF block, when Pillow can't
decode the image, or on any unexpected error, so it can run alongside the
vision call without ever failing an analysis (matching the fallback-on-decode
style of ``_prepare_vision_image`` in coach.py).

The returned dict uses camelCase keys so it can be stored on the portfolio
document and passed straight through the serializer to the frontend
``PortfolioListItem.exif`` shape with no intermediate transform. Fields with
no data are omitted rather than filled with "unknown" placeholders — that is
the AI-estimate path's job, not this one's.
"""
from __future__ import annotations

import io
import logging
from typing import Any

from PIL import ExifTags, Image

logger = logging.getLogger(__name__)

# Numeric EXIF tag IDs. Read by ID rather than by name because the string
# names Pillow exposes vary across versions (e.g. ISOSpeedRatings vs
# PhotographicSensitivity share ID 0x8827).
_TAG_MAKE = 0x010F
_TAG_MODEL = 0x0110
_TAG_DATETIME = 0x0132  # top-level DateTime (fallback for capture time)
_EXIF_IFD = 0x8769  # sub-IFD holding the exposure tags below
_GPS_IFD = 0x8825

_TAG_EXPOSURE_TIME = 0x829A
_TAG_FNUMBER = 0x829D
_TAG_ISO = 0x8827  # ISOSpeedRatings / PhotographicSensitivity (same ID)
_TAG_DATETIME_ORIGINAL = 0x9003
_TAG_FOCAL_LENGTH = 0x920A


def _to_float(value: Any) -> float | None:
    """Coerce the many numeric shapes Pillow returns (IFDRational, Fraction,
    (num, den) tuple, int, float) into a float. Returns None if not coercible."""
    try:
        if value is None:
            return None
        if isinstance(value, (tuple, list)) and len(value) == 2:
            num, den = value
            den = float(den)
            return float(num) / den if den else None
        return float(value)  # IFDRational/Fraction/int/float all support float()
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _fmt_focal_length(value: Any) -> str | None:
    f = _to_float(value)
    if f is None or f <= 0:
        return None
    # Whole numbers read cleaner without a trailing ".0" (50mm, not 50.0mm).
    return f"{int(round(f))}mm" if abs(f - round(f)) < 0.05 else f"{f:.1f}mm"


def _fmt_aperture(value: Any) -> str | None:
    f = _to_float(value)
    if f is None or f <= 0:
        return None
    return f"f/{f:g}"


def _fmt_shutter(value: Any) -> str | None:
    t = _to_float(value)
    if t is None or t <= 0:
        return None
    if t >= 1:
        return f"{t:g}s"
    # Sub-second exposures read as a reciprocal fraction (1/500s).
    return f"1/{int(round(1 / t))}s"


def _fmt_iso(value: Any) -> str | None:
    # ISOSpeedRatings can be a scalar or a sequence; take the first entry.
    if isinstance(value, (tuple, list)):
        value = value[0] if value else None
    f = _to_float(value)
    if f is None or f <= 0:
        return None
    return f"ISO {int(round(f))}"


def _clean_str(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip().strip("\x00").strip()
    return s or None


def _gps_to_decimal(gps_ifd: dict) -> dict[str, float] | None:
    """Convert an EXIF GPS IFD (numeric keys) to decimal lat/lng.

    Uses the standard degrees + minutes/60 + seconds/3600 conversion, negating
    for S/W hemispheres. Returns None if the required fields are missing or
    unparseable. No reverse-geocoding — coordinates only (see branch spec's
    privacy rule; presentation is deliberately left to a later decision)."""
    try:
        gps = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps_ifd.items()}
        lat = gps.get("GPSLatitude")
        lng = gps.get("GPSLongitude")
        lat_ref = gps.get("GPSLatitudeRef")
        lng_ref = gps.get("GPSLongitudeRef")
        if not (lat and lng and lat_ref and lng_ref):
            return None

        def dms(triple: Any) -> float | None:
            if not (isinstance(triple, (tuple, list)) and len(triple) == 3):
                return None
            d, m, s = (_to_float(triple[0]), _to_float(triple[1]), _to_float(triple[2]))
            if None in (d, m, s):
                return None
            return d + m / 60.0 + s / 3600.0

        lat_dec = dms(lat)
        lng_dec = dms(lng)
        if lat_dec is None or lng_dec is None:
            return None
        if str(lat_ref).upper().startswith("S"):
            lat_dec = -lat_dec
        if str(lng_ref).upper().startswith("W"):
            lng_dec = -lng_dec
        return {"lat": round(lat_dec, 6), "lng": round(lng_dec, 6)}
    except Exception:
        return None


def extract_exif(image_bytes: bytes) -> dict[str, Any] | None:
    """Read real camera EXIF from an upload's original bytes.

    Returns a dict with any of ``make``, ``model``, ``focalLength``,
    ``aperture``, ``shutterSpeed``, ``iso``, ``capturedAt``, ``gps``
    (``{lat, lng}``) that are present, or ``None`` when there is no usable
    EXIF at all / the image can't be decoded. Never raises."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            exif = img.getexif()
            if not exif:
                return None

            # The exposure tags (FNumber/ExposureTime/ISO/FocalLength/
            # DateTimeOriginal) live in the Exif sub-IFD, not the top level,
            # so merge that in. Top level carries Make/Model/DateTime.
            try:
                exif_ifd = exif.get_ifd(_EXIF_IFD) or {}
            except Exception:
                exif_ifd = {}

            def tag(tag_id: int) -> Any:
                if tag_id in exif_ifd:
                    return exif_ifd[tag_id]
                return exif.get(tag_id)

            result: dict[str, Any] = {}
            if (make := _clean_str(exif.get(_TAG_MAKE))) is not None:
                result["make"] = make
            if (model := _clean_str(exif.get(_TAG_MODEL))) is not None:
                result["model"] = model
            if (focal := _fmt_focal_length(tag(_TAG_FOCAL_LENGTH))) is not None:
                result["focalLength"] = focal
            if (aperture := _fmt_aperture(tag(_TAG_FNUMBER))) is not None:
                result["aperture"] = aperture
            if (shutter := _fmt_shutter(tag(_TAG_EXPOSURE_TIME))) is not None:
                result["shutterSpeed"] = shutter
            if (iso := _fmt_iso(tag(_TAG_ISO))) is not None:
                result["iso"] = iso
            captured = _clean_str(tag(_TAG_DATETIME_ORIGINAL)) or _clean_str(exif.get(_TAG_DATETIME))
            if captured is not None:
                result["capturedAt"] = captured

            try:
                gps_ifd = exif.get_ifd(_GPS_IFD)
            except Exception:
                gps_ifd = None
            if gps_ifd:
                gps = _gps_to_decimal(gps_ifd)
                if gps is not None:
                    result["gps"] = gps

            return result or None
    except Exception:
        logger.debug("EXIF extraction failed; returning None", exc_info=True)
        return None
