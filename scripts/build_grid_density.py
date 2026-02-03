import json
from math import floor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PRIMARY_PATH = DATA_DIR / "primary_schools.geojson"
SECONDARY_PATH = DATA_DIR / "secondary_schools.geojson"
OUTPUT_PATH = DATA_DIR / "zw_grid_density.geojson"

# Grid size in degrees (about 0.1 deg ~= 11 km at the equator).
CELL_SIZE = 0.1

ZIM_BOUNDS = {
    "min_lat": -22.5,
    "max_lat": -15.3,
    "min_lon": 25.2,
    "max_lon": 33.2,
}


def load_geojson(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def grid_key(lat, lon):
    lat_idx = floor((lat - ZIM_BOUNDS["min_lat"]) / CELL_SIZE)
    lon_idx = floor((lon - ZIM_BOUNDS["min_lon"]) / CELL_SIZE)
    return lat_idx, lon_idx


def cell_bounds(lat_idx, lon_idx):
    lat_min = ZIM_BOUNDS["min_lat"] + lat_idx * CELL_SIZE
    lat_max = lat_min + CELL_SIZE
    lon_min = ZIM_BOUNDS["min_lon"] + lon_idx * CELL_SIZE
    lon_max = lon_min + CELL_SIZE
    return lat_min, lat_max, lon_min, lon_max


def main():
    primary = load_geojson(PRIMARY_PATH)
    secondary = load_geojson(SECONDARY_PATH)

    grid = {}

    def add_point(lat, lon, level):
        key = grid_key(lat, lon)
        if key not in grid:
            grid[key] = {"primary": 0, "secondary": 0}
        grid[key][level] += 1

    for feature in primary.get("features", []):
        lon, lat = feature["geometry"]["coordinates"]
        if (
            ZIM_BOUNDS["min_lat"] <= lat <= ZIM_BOUNDS["max_lat"]
            and ZIM_BOUNDS["min_lon"] <= lon <= ZIM_BOUNDS["max_lon"]
        ):
            add_point(lat, lon, "primary")

    for feature in secondary.get("features", []):
        lon, lat = feature["geometry"]["coordinates"]
        if (
            ZIM_BOUNDS["min_lat"] <= lat <= ZIM_BOUNDS["max_lat"]
            and ZIM_BOUNDS["min_lon"] <= lon <= ZIM_BOUNDS["max_lon"]
        ):
            add_point(lat, lon, "secondary")

    features = []
    for (lat_idx, lon_idx), counts in grid.items():
        lat_min, lat_max, lon_min, lon_max = cell_bounds(lat_idx, lon_idx)
        total = counts["primary"] + counts["secondary"]
        if total == 0:
            continue
        poly = {
            "type": "Polygon",
            "coordinates": [
                [
                    [lon_min, lat_min],
                    [lon_max, lat_min],
                    [lon_max, lat_max],
                    [lon_min, lat_max],
                    [lon_min, lat_min],
                ]
            ],
        }
        features.append(
            {
                "type": "Feature",
                "geometry": poly,
                "properties": {
                    "primary_count": counts["primary"],
                    "secondary_count": counts["secondary"],
                    "total_count": total,
                },
            }
        )

    output = {"type": "FeatureCollection", "features": features}
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=True), encoding="utf-8")


if __name__ == "__main__":
    main()
