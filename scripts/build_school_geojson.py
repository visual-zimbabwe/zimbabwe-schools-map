import argparse
import csv
import json
from pathlib import Path

try:
    from scripts.constants import ZIM_BOUNDS
except ModuleNotFoundError:
    from constants import ZIM_BOUNDS

try:
    from scripts.geo_utils import coords_in_zimbabwe, open_csv, parse_float
except ModuleNotFoundError:
    from geo_utils import coords_in_zimbabwe, open_csv, parse_float

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_CSV = ROOT / "location_of_schools.csv"
CLEANED_CSV = DATA_DIR / "clean_schools.csv"
BOUNDS_JSON = DATA_DIR / "bounds.json"

LEVELS = {
    "Primary": {
        "geojson": DATA_DIR / "primary_schools.geojson",
    },
    "Secondary": {
        "geojson": DATA_DIR / "secondary_schools.geojson",
    },
}

def row_to_feature(row):
    lat = parse_float(row.get("latitude"))
    lon = parse_float(row.get("longitude"))
    if lat is None or lon is None:
        return None
    if lat == 0.0 or lon == 0.0:
        return None
    if not coords_in_zimbabwe(lat, lon):
        return None
    props = {
        "Schoolnumber": (row.get("Schoolnumber") or "").strip(),
        "Name": (row.get("Name") or "").strip(),
        "Province": (row.get("Province") or "").strip(),
        "District": (row.get("District") or "").strip(),
        "SchoolLevel": (row.get("SchoolLevel") or "").strip(),
        "Grant_Class": (row.get("Grant_Class") or "").strip(),
    }
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": props,
    }


def build_geojson(level, source_path: Path):
    features = []
    with open_csv(source_path) as handle:
        reader = csv.DictReader(handle)
        required_fields = {
            "Schoolnumber",
            "Name",
            "Province",
            "District",
            "SchoolLevel",
            "Grant_Class",
            "latitude",
            "longitude",
        }
        missing_fields = required_fields - set(reader.fieldnames or [])
        if missing_fields:
            raise SystemExit(
                f"CSV missing required fields: {sorted(missing_fields)}"
            )
        for row in reader:
            if (row.get("SchoolLevel") or "").strip() != level:
                continue
            feature = row_to_feature(row)
            if feature:
                features.append(feature)
    return {"type": "FeatureCollection", "features": features}


def write_outputs(level, config, source_path: Path):
    geojson = build_geojson(level, source_path)
    config["geojson"].write_text(
        json.dumps(geojson, ensure_ascii=True), encoding="utf-8"
    )


def write_bounds():
    BOUNDS_JSON.write_text(
        json.dumps(ZIM_BOUNDS, ensure_ascii=True), encoding="utf-8"
    )


def main():
    parser = argparse.ArgumentParser(
        description="Build GeoJSON outputs for primary and secondary schools."
    )
    parser.add_argument(
        "--input",
        type=Path,
        help="Path to source CSV (defaults to data/clean_schools.csv if present).",
    )
    args = parser.parse_args()

    source_path = args.input
    if source_path is None:
        source_path = CLEANED_CSV if CLEANED_CSV.exists() else DEFAULT_CSV
    if not source_path.exists():
        raise SystemExit(f"Source CSV not found: {source_path}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    write_bounds()
    for level, config in LEVELS.items():
        write_outputs(level, config, source_path)


if __name__ == "__main__":
    main()
