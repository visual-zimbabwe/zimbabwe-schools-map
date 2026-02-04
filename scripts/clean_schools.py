import argparse
import csv
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_INPUT = ROOT / "location_of_schools.csv"
DEFAULT_OUTPUT = DATA_DIR / "clean_schools.csv"
REPORT_PATH = DATA_DIR / "quality_report.md"

ALLOWED_LEVELS = {"Primary", "Secondary"}
ALLOWED_GRANT_CLASS = {"P1", "P2", "P3", "S1", "S2", "S3"}

ZIM_LAT_MIN = -23.5
ZIM_LAT_MAX = -15.5
ZIM_LON_MIN = 25.0
ZIM_LON_MAX = 34.0


def open_csv(path: Path):
    with path.open("rb") as handle:
        start = handle.read(4)
    if start.startswith(b"\xff\xfe") or start.startswith(b"\xfe\xff"):
        encoding = "utf-16"
    else:
        encoding = "utf-8-sig"
    return path.open(newline="", encoding=encoding)


def normalize_spaces(value: str) -> str:
    return " ".join(value.strip().split())


def normalize_title(value: str) -> str:
    if not value:
        return ""
    value = normalize_spaces(value)
    if value.isupper():
        return value
    return value.title()


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def coords_in_zimbabwe(lat, lon):
    return ZIM_LAT_MIN <= lat <= ZIM_LAT_MAX and ZIM_LON_MIN <= lon <= ZIM_LON_MAX


def try_utm_to_latlon(x, y):
    try:
        from pyproj import Transformer

        candidates = []
        for epsg in ("EPSG:32735", "EPSG:32736"):
            transformer = Transformer.from_crs(epsg, "EPSG:4326", always_xy=True)
            lon, lat = transformer.transform(x, y)
            if coords_in_zimbabwe(lat, lon):
                return lat, lon
            candidates.append((lat, lon))
        return candidates[0] if candidates else None
    except Exception:
        return None


def clean_row(row):
    cleaned = dict(row)

    cleaned["Schoolnumber"] = normalize_spaces(cleaned.get("Schoolnumber", ""))
    cleaned["Name"] = normalize_spaces(cleaned.get("Name", ""))
    cleaned["Province"] = normalize_title(cleaned.get("Province", ""))
    cleaned["District"] = normalize_title(cleaned.get("District", ""))

    level = normalize_title(cleaned.get("SchoolLevel", ""))
    cleaned["SchoolLevel"] = level

    grant = normalize_spaces(cleaned.get("Grant_Class", ""))
    if grant == "(blank)":
        grant = ""
    cleaned["Grant_Class"] = grant.upper()

    cleaned["Name_Normalized"] = cleaned["Name"].lower()

    return cleaned


def main():
    parser = argparse.ArgumentParser(description="Clean Zimbabwe schools dataset.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Input CSV not found: {args.input}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    stats = Counter()
    missing_fields = Counter()
    level_counts = Counter()
    grant_counts = Counter()

    with open_csv(args.input) as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        if "Name_Normalized" not in fieldnames:
            fieldnames.append("Name_Normalized")

        with args.output.open("w", newline="", encoding="utf-8") as out:
            writer = csv.DictWriter(out, fieldnames=fieldnames)
            writer.writeheader()

            for row in reader:
                stats["rows"] += 1
                for key, value in row.items():
                    if value is None or str(value).strip() == "":
                        missing_fields[key] += 1

                cleaned = clean_row(row)

                level = cleaned.get("SchoolLevel", "")
                if level and level not in ALLOWED_LEVELS:
                    stats["invalid_level"] += 1
                    cleaned["SchoolLevel"] = ""
                    level = ""

                grant = cleaned.get("Grant_Class", "")
                if grant and grant not in ALLOWED_GRANT_CLASS:
                    stats["invalid_grant"] += 1
                    cleaned["Grant_Class"] = ""
                    grant = ""

                level_counts[level] += 1
                grant_counts[grant] += 1

                lat = parse_float(cleaned.get("latitude"))
                lon = parse_float(cleaned.get("longitude"))
                x = parse_float(cleaned.get("X"))
                y = parse_float(cleaned.get("Y"))

                if lat is None or lon is None:
                    stats["missing_latlon_raw"] += 1
                    if lat is None and lon is None and x is not None and y is not None:
                        converted = try_utm_to_latlon(x, y)
                        if converted:
                            lat, lon = converted
                            cleaned["latitude"] = f"{lat:.6f}"
                            cleaned["longitude"] = f"{lon:.6f}"
                            stats["filled_from_xy"] += 1
                if lat is not None and lon is not None:
                    if lat == 0.0 or lon == 0.0:
                        stats["zero_coords"] += 1
                        cleaned["latitude"] = ""
                        cleaned["longitude"] = ""
                    elif not coords_in_zimbabwe(lat, lon):
                        stats["out_of_bounds"] += 1
                        cleaned["latitude"] = ""
                        cleaned["longitude"] = ""

                final_lat = parse_float(cleaned.get("latitude"))
                final_lon = parse_float(cleaned.get("longitude"))
                if final_lat is None or final_lon is None:
                    stats["missing_latlon_final"] += 1

                writer.writerow(cleaned)

    if stats["rows"]:
        stats["missing_latlon_raw_pct"] = round(
            stats["missing_latlon_raw"] / stats["rows"] * 100, 2
        )
        stats["missing_latlon_final_pct"] = round(
            stats["missing_latlon_final"] / stats["rows"] * 100, 2
        )

    lines = [
        "# Data Quality Report",
        "",
        f"Source: `{args.input}`",
        f"Output: `{args.output}`",
        "",
        "## Summary",
        f"- Rows: {stats['rows']}",
        f"- Missing lat/lon (raw): {stats['missing_latlon_raw']} ({stats.get('missing_latlon_raw_pct', 0)}%)",
        f"- Missing lat/lon (final): {stats['missing_latlon_final']} ({stats.get('missing_latlon_final_pct', 0)}%)",
        f"- Filled from X/Y: {stats['filled_from_xy']}",
        f"- Zero coords removed: {stats['zero_coords']}",
        f"- Out-of-bounds coords removed: {stats['out_of_bounds']}",
        f"- Invalid school levels cleared: {stats['invalid_level']}",
        f"- Invalid grant classes cleared: {stats['invalid_grant']}",
        "",
        "## School Levels",
    ]
    for level, count in level_counts.most_common():
        label = level or "(blank)"
        lines.append(f"- {label}: {count}")

    lines.append("")
    lines.append("## Grant Class")
    for grant, count in grant_counts.most_common():
        label = grant or "(blank)"
        lines.append(f"- {label}: {count}")

    lines.append("")
    lines.append("## Missing Fields (Top 10)")
    for field, count in missing_fields.most_common(10):
        lines.append(f"- {field}: {count}")

    args.report.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
