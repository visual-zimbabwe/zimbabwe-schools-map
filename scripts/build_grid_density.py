import json
from math import floor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PRIMARY_PATH = DATA_DIR / "primary_schools.geojson"
SECONDARY_PATH = DATA_DIR / "secondary_schools.geojson"
OUTPUT_PATH = DATA_DIR / "zw_grid_density.geojson"
ADMIN_PATH = DATA_DIR / "zw_admin1.geojson"

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


def point_in_ring(point, ring):
    x, y = point
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        if ((y1 > y) != (y2 > y)) and (
            x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1
        ):
            inside = not inside
    return inside


def point_in_polygon(point, polygon):
    outer = polygon[0]
    if not point_in_ring(point, outer):
        return False
    for hole in polygon[1:]:
        if point_in_ring(point, hole):
            return False
    return True


def point_in_geometry(point, geometry):
    if geometry["type"] == "Polygon":
        return point_in_polygon(point, geometry["coordinates"])
    if geometry["type"] == "MultiPolygon":
        return any(point_in_polygon(point, poly) for poly in geometry["coordinates"])
    return False


def main():
    primary = load_geojson(PRIMARY_PATH)
    secondary = load_geojson(SECONDARY_PATH)
    admin = load_geojson(ADMIN_PATH)

    geometries = [feat["geometry"] for feat in admin.get("features", [])]

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

    total_primary = sum(counts["primary"] for counts in grid.values())
    total_secondary = sum(counts["secondary"] for counts in grid.values())
    total_all = total_primary + total_secondary

    features = []
    lat_cells = floor((ZIM_BOUNDS["max_lat"] - ZIM_BOUNDS["min_lat"]) / CELL_SIZE) + 1
    lon_cells = floor((ZIM_BOUNDS["max_lon"] - ZIM_BOUNDS["min_lon"]) / CELL_SIZE) + 1

    for lat_idx in range(lat_cells):
        for lon_idx in range(lon_cells):
            lat_min, lat_max, lon_min, lon_max = cell_bounds(lat_idx, lon_idx)
            centroid = (lon_min + CELL_SIZE / 2, lat_min + CELL_SIZE / 2)
            if not any(point_in_geometry(centroid, geom) for geom in geometries):
                continue
            counts = grid.get((lat_idx, lon_idx), {"primary": 0, "secondary": 0})
            total = counts["primary"] + counts["secondary"]
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
                        "primary_pct": (
                            (counts["primary"] / total_primary * 100)
                            if total_primary
                            else 0
                        ),
                        "secondary_pct": (
                            (counts["secondary"] / total_secondary * 100)
                            if total_secondary
                            else 0
                        ),
                        "total_pct": (total / total_all * 100) if total_all else 0,
                    },
                }
            )

    output = {"type": "FeatureCollection", "features": features}
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=True), encoding="utf-8")


if __name__ == "__main__":
    main()
