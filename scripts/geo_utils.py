from pathlib import Path

try:
    from scripts.constants import ZIM_BOUNDS
except ModuleNotFoundError:
    from constants import ZIM_BOUNDS


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def coords_in_zimbabwe(lat, lon):
    return (
        ZIM_BOUNDS["lat_min"] <= lat <= ZIM_BOUNDS["lat_max"]
        and ZIM_BOUNDS["lon_min"] <= lon <= ZIM_BOUNDS["lon_max"]
    )


def open_csv(path: Path):
    with path.open("rb") as handle:
        start = handle.read(4)
    if start.startswith(b"\xff\xfe") or start.startswith(b"\xfe\xff"):
        encoding = "utf-16"
    else:
        encoding = "utf-8-sig"
    return path.open(newline="", encoding=encoding)
