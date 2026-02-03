# Zimbabwe Schools Map (Minimal)

This repo contains the Zimbabwe schools dataset and supporting notes for a minimalist web tool concept.

Current focus:
- Web v1.1: Map of Primary + Secondary Schools (Leaflet-based, static web app)

Key data (not stored in repo):
- Download the source dataset from Geo-Connect (MoPSE): see `Source.md`
- Place it at `location_of_schools.csv`
- Generate outputs with `python scripts/build_school_geojson.py`
  - `data/primary_schools.geojson`
  - `data/secondary_schools.geojson`

How to run locally:
- Download the dataset (see `Source.md`) and save it as `location_of_schools.csv`
- Run `python scripts/build_school_geojson.py`
- Open `index.html` in a browser or serve a local static server.

Progress tracking:
- Update `PROGRESS.md` whenever changes are made to files, data, or plans.
