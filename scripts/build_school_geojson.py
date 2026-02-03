import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CSV_PATH = ROOT / "location_of_schools.csv"

LEVELS = {
    "Primary": {
        "geojson": DATA_DIR / "primary_schools.geojson",
        "js": DATA_DIR / "primary_schools.js",
        "window": "PRIMARY_SCHOOLS",
    },
    "Secondary": {
        "geojson": DATA_DIR / "secondary_schools.geojson",
        "js": DATA_DIR / "secondary_schools.js",
        "window": "SECONDARY_SCHOOLS",
    },
}


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def row_to_feature(row):
    lat = parse_float(row.get("latitude"))
    lon = parse_float(row.get("longitude"))
    if lat is None or lon is None:
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


def build_geojson(level):
    features = []
    with CSV_PATH.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if (row.get("SchoolLevel") or "").strip() != level:
                continue
            feature = row_to_feature(row)
            if feature:
                features.append(feature)
    return {"type": "FeatureCollection", "features": features}


def write_outputs(level, config):
    geojson = build_geojson(level)
    config["geojson"].write_text(
        json.dumps(geojson, ensure_ascii=True), encoding="utf-8"
    )
    js_payload = f"window.{config['window']} = {json.dumps(geojson, ensure_ascii=True)};\n"
    config["js"].write_text(js_payload, encoding="utf-8")


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for level, config in LEVELS.items():
        write_outputs(level, config)


if __name__ == "__main__":
    main()
