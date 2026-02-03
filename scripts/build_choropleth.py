import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ADMIN_PATH = DATA_DIR / "zw_admin1.geojson"
PRIMARY_PATH = DATA_DIR / "primary_schools.geojson"
SECONDARY_PATH = DATA_DIR / "secondary_schools.geojson"
OUTPUT_PATH = DATA_DIR / "zw_admin1_schools.geojson"


def load_geojson(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(value: str) -> str:
    return " ".join(value.strip().split()).lower()


def main():
    admin = load_geojson(ADMIN_PATH)
    primary = load_geojson(PRIMARY_PATH)
    secondary = load_geojson(SECONDARY_PATH)

    primary_counts = Counter()
    secondary_counts = Counter()

    for feature in primary.get("features", []):
        name = feature.get("properties", {}).get("Province", "")
        if name:
            primary_counts[normalize(name)] += 1

    for feature in secondary.get("features", []):
        name = feature.get("properties", {}).get("Province", "")
        if name:
            secondary_counts[normalize(name)] += 1

    total_primary = sum(primary_counts.values())
    total_secondary = sum(secondary_counts.values())
    total_all = total_primary + total_secondary

    for feature in admin.get("features", []):
        props = feature.setdefault("properties", {})
        admin_name = props.get("admin1_name", "")
        key = normalize(admin_name)
        p_count = primary_counts.get(key, 0)
        s_count = secondary_counts.get(key, 0)
        total = p_count + s_count
        props["primary_count"] = p_count
        props["secondary_count"] = s_count
        props["total_count"] = total
        props["primary_pct"] = (p_count / total_primary * 100) if total_primary else 0
        props["secondary_pct"] = (
            (s_count / total_secondary * 100) if total_secondary else 0
        )
        props["total_pct"] = (total / total_all * 100) if total_all else 0

    OUTPUT_PATH.write_text(json.dumps(admin, ensure_ascii=True), encoding="utf-8")


if __name__ == "__main__":
    main()
