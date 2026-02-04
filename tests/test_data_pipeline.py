import csv
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path


def write_csv(path: Path, rows, fieldnames):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _base_temp_dir():
    base_dir = Path(tempfile.gettempdir()) / "zimbabwe-tests"
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


def test_clean_schools_removes_bad_coords():
    base_dir = _base_temp_dir()
    token = uuid.uuid4().hex
    input_csv = base_dir / f"input-{token}.csv"
    output_csv = base_dir / f"clean-{token}.csv"
    report_md = base_dir / f"report-{token}.md"

    rows = [
        {
            "Schoolnumber": "001",
            "Name": "Alpha School",
            "Province": "Harare",
            "District": "Harare",
            "SchoolLevel": "Primary",
            "Grant_Class": "P1",
            "latitude": "-17.8292",
            "longitude": "31.0522",
            "X": "",
            "Y": "",
        },
        {
            "Schoolnumber": "002",
            "Name": "Out of Bounds",
            "Province": "Harare",
            "District": "Harare",
            "SchoolLevel": "Secondary",
            "Grant_Class": "S1",
            "latitude": "-5.0",
            "longitude": "40.0",
            "X": "",
            "Y": "",
        },
        {
            "Schoolnumber": "003",
            "Name": "Zero Coords",
            "Province": "Harare",
            "District": "Harare",
            "SchoolLevel": "Primary",
            "Grant_Class": "P2",
            "latitude": "0",
            "longitude": "0",
            "X": "",
            "Y": "",
        },
    ]
    fieldnames = list(rows[0].keys())
    write_csv(input_csv, rows, fieldnames)

    try:
        result = subprocess.run(
            [
                sys.executable,
                "scripts/clean_schools.py",
                "--input",
                str(input_csv),
                "--output",
                str(output_csv),
                "--report",
                str(report_md),
            ],
            cwd=Path(__file__).resolve().parents[1],
            check=True,
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert output_csv.exists()
        assert report_md.exists()

        with output_csv.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            cleaned = list(reader)

        assert len(cleaned) == 3
        assert cleaned[0]["latitude"] == "-17.8292"
        assert cleaned[0]["longitude"] == "31.0522"
        assert cleaned[1]["latitude"] == ""
        assert cleaned[1]["longitude"] == ""
        assert cleaned[2]["latitude"] == ""
        assert cleaned[2]["longitude"] == ""
    finally:
        for path in (input_csv, output_csv, report_md):
            try:
                path.unlink()
            except FileNotFoundError:
                pass


def test_build_geojson_filters_by_level():
    from scripts import build_school_geojson as geo

    base_dir = _base_temp_dir()
    token = uuid.uuid4().hex
    input_csv = base_dir / f"schools-{token}.csv"
    rows = [
        {
            "Schoolnumber": "101",
            "Name": "Alpha",
            "Province": "Harare",
            "District": "Harare",
            "SchoolLevel": "Primary",
            "Grant_Class": "P1",
            "latitude": "-17.8",
            "longitude": "31.0",
        },
        {
            "Schoolnumber": "102",
            "Name": "Beta",
            "Province": "Bulawayo",
            "District": "Bulawayo",
            "SchoolLevel": "Secondary",
            "Grant_Class": "S1",
            "latitude": "-20.1",
            "longitude": "28.6",
        },
        {
            "Schoolnumber": "103",
            "Name": "No Coords",
            "Province": "Harare",
            "District": "Harare",
            "SchoolLevel": "Primary",
            "Grant_Class": "P2",
            "latitude": "",
            "longitude": "",
        },
    ]
    fieldnames = list(rows[0].keys())
    write_csv(input_csv, rows, fieldnames)

    try:
        geojson = geo.build_geojson("Primary", input_csv)
        assert geojson["type"] == "FeatureCollection"
        assert len(geojson["features"]) == 1
        feature = geojson["features"][0]
        assert feature["properties"]["Schoolnumber"] == "101"
        assert feature["geometry"]["coordinates"] == [31.0, -17.8]
    finally:
        try:
            input_csv.unlink()
        except FileNotFoundError:
            pass
