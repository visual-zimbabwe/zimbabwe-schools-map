# Zimbabwe Schools Map

Minimal, static web map of Zimbabwe's primary and secondary schools using Leaflet.

## Features
- Primary + secondary school layers with clustering
- Search by name, filter by province/district, per-level counts
- Offline-friendly static map once data is generated locally
- National accessibility heatmap page with density and top/bottom province rankings

## Live site
- GitHub Pages: `https://visual-zimbabwe.github.io/zimbabwe-schools-map/`

## Data (not included)
The source dataset is not stored in this repository. Download it from Geo-Connect (MoPSE) and save it as `location_of_schools.csv` in the repo root.

Dataset source:
- `https://zimgeoportal.org.zw/datasets/location-of-schools-in-zimbabwe/`

Dataset last updated:
- 20 Sep 2025

## Clean the source data (recommended)
```
python scripts/clean_schools.py
```
This creates:
- `data/clean_schools.csv`
- `data/quality_report.md`

## Build the map data
```
python scripts/build_school_geojson.py
```
This generates:
- `data/primary_schools.geojson`
- `data/secondary_schools.geojson`

## Run locally
- Open `index.html` in a browser, or
- Open `heatmap.html` for the national accessibility heatmap, or
- Serve a static server from the repo root.

## Project structure
```
.
+- css/
+- data/               # generated locally
+- js/
+- scripts/
+- index.html
+- README.md
```

## Credits
- Data: Geo-Connect (`https://www.geo-connect.org/home`).
- Map tiles: OpenStreetMap contributors.
