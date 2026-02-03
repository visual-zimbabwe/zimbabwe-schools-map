import json
from math import cos, floor, pi, sin, sqrt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PRIMARY_PATH = DATA_DIR / "primary_schools.geojson"
SECONDARY_PATH = DATA_DIR / "secondary_schools.geojson"
ADMIN_PATH = DATA_DIR / "zw_admin1.geojson"
OUTPUT_PATH = DATA_DIR / "zw_hex_density.geojson"

# Hex size in degrees (flat-top). Adjust for more/less detail.
HEX_SIZE = 0.12

ZIM_BOUNDS = {
    "min_lat": -22.5,
    "max_lat": -15.3,
    "min_lon": 25.2,
    "max_lon": 33.2,
}


def load_geojson(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


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


def axial_round(q, r):
    x = q
    z = r
    y = -x - z
    rx = round(x)
    ry = round(y)
    rz = round(z)

    x_diff = abs(rx - x)
    y_diff = abs(ry - y)
    z_diff = abs(rz - z)

    if x_diff > y_diff and x_diff > z_diff:
        rx = -ry - rz
    elif y_diff > z_diff:
        ry = -rx - rz
    else:
        rz = -rx - ry

    return rx, rz


def point_to_axial(x, y, size):
    q = (2 / 3 * x) / size
    r = (-1 / 3 * x + sqrt(3) / 3 * y) / size
    return axial_round(q, r)


def axial_to_point(q, r, size):
    x = size * (3 / 2 * q)
    y = size * (sqrt(3) * (r + q / 2))
    return x, y


def hex_corners(center_x, center_y, size):
    corners = []
    for i in range(6):
        angle = pi / 180 * (60 * i)
        corners.append([center_x + size * cos(angle), center_y + size * sin(angle)])
    corners.append(corners[0])
    return corners


def main():
    admin = load_geojson(ADMIN_PATH)
    geometries = [feat["geometry"] for feat in admin.get("features", [])]

    primary = load_geojson(PRIMARY_PATH)
    secondary = load_geojson(SECONDARY_PATH)

    counts = {}

    def add_point(lon, lat, level):
        q, r = point_to_axial(lon, lat, HEX_SIZE)
        key = (q, r)
        if key not in counts:
            counts[key] = {"primary": 0, "secondary": 0}
        counts[key][level] += 1

    for feature in primary.get("features", []):
        lon, lat = feature["geometry"]["coordinates"]
        if (
            ZIM_BOUNDS["min_lat"] <= lat <= ZIM_BOUNDS["max_lat"]
            and ZIM_BOUNDS["min_lon"] <= lon <= ZIM_BOUNDS["max_lon"]
        ):
            add_point(lon, lat, "primary")

    for feature in secondary.get("features", []):
        lon, lat = feature["geometry"]["coordinates"]
        if (
            ZIM_BOUNDS["min_lat"] <= lat <= ZIM_BOUNDS["max_lat"]
            and ZIM_BOUNDS["min_lon"] <= lon <= ZIM_BOUNDS["max_lon"]
        ):
            add_point(lon, lat, "secondary")

    total_primary = sum(c["primary"] for c in counts.values())
    total_secondary = sum(c["secondary"] for c in counts.values())
    total_all = total_primary + total_secondary

    features = []
    for (q, r), c in counts.items():
        center_x, center_y = axial_to_point(q, r, HEX_SIZE)
        if not any(point_in_geometry((center_x, center_y), g) for g in geometries):
            continue
        total = c["primary"] + c["secondary"]
        poly = {
            "type": "Polygon",
            "coordinates": [hex_corners(center_x, center_y, HEX_SIZE)],
        }
        features.append(
            {
                "type": "Feature",
                "geometry": poly,
                "properties": {
                    "primary_count": c["primary"],
                    "secondary_count": c["secondary"],
                    "total_count": total,
                    "primary_pct": (c["primary"] / total_primary * 100) if total_primary else 0,
                    "secondary_pct": (c["secondary"] / total_secondary * 100) if total_secondary else 0,
                    "total_pct": (total / total_all * 100) if total_all else 0,
                },
            }
        )

    output = {"type": "FeatureCollection", "features": features}
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=True), encoding="utf-8")


if __name__ == "__main__":
    main()
