# Progress Log

Rule: Update this file whenever changes are made (files, data, plans, or decisions).

## 2026-02-03
- Added initial repository README.
- Established progress logging rule.
- Added AGENTS note to always update PROGRESS.md on changes.
- Added AGENTS note to always commit changes without asking for permission.
- Initialized git repository.
- Added detailed project specification for the Map of Secondary Schools MVP.
- Built Web v1.0 map: added static app files, styles, and Leaflet clustering.
- Generated `data/secondary_schools.geojson` from `location_of_schools.csv`.
- Removed CDN integrity attributes to avoid Leaflet/cluster assets blocking.
- Constrained map bounds and zoom to Zimbabwe extent.
- Added Zimbabwe boundary mask and outline.
- Added boundary JS fallback and resilient loading for local file usage.
- Increased mask opacity and page background to fully hide outside boundaries.
- Moved mask and boundary to dedicated panes above tiles to prevent flicker.
- Added SVG clipPath to tile pane for Zimbabwe-only rendering.
- Reverted boundary-outline removal (restored prior boundary behavior).
- Reverting boundary masking and clipping to restore full world map.
- Removed unused Zimbabwe boundary JS after reverting to full world map.
- Added embedded secondary schools JS to avoid fetch failures on file://.
- Switched markers to div icons to improve popup reliability.
- Increased marker size and enabled cluster spiderfy at max zoom.
- Added search, province/district filters, and summary panel.
- Moved filter panel to top-right to avoid covering zoom controls.
- Moved legend to bottom-right to avoid overlapping the panel.
- Planned approach for adding primary schools and dual-level visualization (data pipeline + UI layers).
- Added primary schools GeoJSON/JS outputs and a build script for both levels.
- Updated map UI and logic to show primary + secondary with toggles, legend, and counts.
- Updated README to reflect primary + secondary map outputs.
- Confirmed auto-push to GitHub after each commit.
