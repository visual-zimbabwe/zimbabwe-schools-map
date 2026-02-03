# Progress Log

Rule: Update this file whenever changes are made (files, data, plans, or decisions).

## 2026-02-03
- Added initial repository README.
- Established progress logging rule.
- Added AGENTS note to always update PROGRESS.md on changes.
- Initialized git repository.
- Added AGENTS note to always commit changes without asking for permission.
- Added detailed project specification for the Map of Secondary Schools MVP.
- Built Web v1.0 map: added static app files, styles, and Leaflet clustering.
- Generated `data/secondary_schools.geojson` from `location_of_schools.csv`.
- Removed CDN integrity attributes to avoid Leaflet/cluster assets blocking.
- Constrained map bounds and zoom to Zimbabwe extent.
- Added Zimbabwe boundary mask and outline.
- Added boundary JS fallback and resilient loading for local file usage.
- Increased mask opacity and page background to fully hide outside boundaries.
