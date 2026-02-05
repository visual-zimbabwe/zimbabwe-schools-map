import json
from pathlib import Path
from xml.sax.saxutils import escape


DATA_DIR = Path("data")
PRIMARY_GEOJSON = DATA_DIR / "primary_schools.geojson"
SECONDARY_GEOJSON = DATA_DIR / "secondary_schools.geojson"
OUTPUT_KML = DATA_DIR / "google_earth_schools.kml"


LEVEL_COLORS = {
    "primary": "#1f77b4",
    "secondary": "#ff7f0e",
}


def load_geojson(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("features", [])


def to_kml_color(hex_color: str, alpha: str = "ff") -> str:
    """Convert #rrggbb to aabbggrr for KML."""
    hex_color = hex_color.lstrip("#")
    r = hex_color[0:2]
    g = hex_color[2:4]
    b = hex_color[4:6]
    return f"{alpha}{b}{g}{r}"


def slugify(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value.strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-") or "unknown"


def build_description(props: dict, level_label: str) -> str:
    name = escape(str(props.get("Name", "")).strip())
    province = escape(str(props.get("Province", "")).strip())
    district = escape(str(props.get("District", "")).strip())
    grant = escape(str(props.get("Grant_Class", "")).strip())
    number = escape(str(props.get("Schoolnumber", "")).strip())
    parts = [
        f"<b>{name}</b>",
        f"Level: {escape(level_label)}",
    ]
    if province:
        parts.append(f"Province: {province}")
    if district:
        parts.append(f"District: {district}")
    if grant:
        parts.append(f"Grant Class: {grant}")
    if number:
        parts.append(f"School Number: {number}")
    return "<br/>".join(parts)


def iter_placemarks(features, level_label: str):
    for feat in features:
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        lon, lat = coords[0], coords[1]
        if lon is None or lat is None:
            continue
        props = feat.get("properties") or {}
        province = str(props.get("Province") or "Unknown").strip() or "Unknown"
        yield {
            "name": str(props.get("Name") or "Unnamed").strip() or "Unnamed",
            "province": province,
            "lon": lon,
            "lat": lat,
            "description": build_description(props, level_label),
        }


def build_styles():
    styles = []
    for level, scale, hl_scale in [("primary", 0.8, 1.0), ("secondary", 1.0, 1.2)]:
        color = to_kml_color(LEVEL_COLORS[level])
        style_id = f"style-{level}"
        hl_id = f"{style_id}-hl"
        map_id = f"{style_id}-map"
        styles.append(
            f"""
  <Style id="{style_id}">
    <IconStyle>
      <color>{color}</color>
      <scale>{scale}</scale>
    </IconStyle>
    <LabelStyle>
      <scale>0</scale>
    </LabelStyle>
  </Style>
  <Style id="{hl_id}">
    <IconStyle>
      <color>{color}</color>
      <scale>{hl_scale}</scale>
    </IconStyle>
    <LabelStyle>
      <scale>1</scale>
    </LabelStyle>
  </Style>
  <StyleMap id="{map_id}">
    <Pair>
      <key>normal</key>
      <styleUrl>#{style_id}</styleUrl>
    </Pair>
    <Pair>
      <key>highlight</key>
      <styleUrl>#{hl_id}</styleUrl>
    </Pair>
  </StyleMap>
"""
        )
    return "\n".join(styles)


def build_folder(name: str, placemarks, level: str):
    lines = [f'  <Folder><name>{escape(name)}</name>']
    current_province = None
    for item in sorted(placemarks, key=lambda p: (p["province"], p["name"])):
        if item["province"] != current_province:
            if current_province is not None:
                lines.append("    </Folder>")
            lines.append(f'    <Folder><name>{escape(item["province"])}</name>')
            current_province = item["province"]
        style_url = f"#style-{level}-map"
        lines.append(
            f"""
      <Placemark>
        <name>{escape(item['name'])}</name>
        <description><![CDATA[{item['description']}]]></description>
        <styleUrl>{style_url}</styleUrl>
        <Point>
          <coordinates>{item['lon']},{item['lat']},0</coordinates>
        </Point>
      </Placemark>
"""
        )
    if current_province is not None:
        lines.append("    </Folder>")
    lines.append("  </Folder>")
    return "\n".join(lines)


def main():
    primary_features = load_geojson(PRIMARY_GEOJSON)
    secondary_features = load_geojson(SECONDARY_GEOJSON)

    primary_marks = list(iter_placemarks(primary_features, "Primary"))
    secondary_marks = list(iter_placemarks(secondary_features, "Secondary"))

    styles_block = build_styles()
    primary_folder = build_folder("Primary Schools", primary_marks, "primary")
    secondary_folder = build_folder("Secondary Schools", secondary_marks, "secondary")

    kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Zimbabwe Schools</name>
{styles_block}
{primary_folder}
{secondary_folder}
</Document>
</kml>
"""
    OUTPUT_KML.write_text(kml, encoding="utf-8")
    print(f"Wrote {OUTPUT_KML}")


if __name__ == "__main__":
    main()
