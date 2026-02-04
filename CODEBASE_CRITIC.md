## Executive Summary
This codebase is functional but not production-grade. The data pipeline contains a correctness landmine (UTM zone conversion hard-coded to a single zone), and the map UI scales poorly with dataset growth. Overall score: 5/10.

## High-Severity Issues
1. Incorrect UTM conversion for a large portion of Zimbabwe (data corruption).
   Code:
   ```py
   transformer = Transformer.from_crs("EPSG:32736", "EPSG:4326", always_xy=True)
   ```
   Zimbabwe spans UTM zones 35S and 36S. Hard-coding 36S will misproject western coordinates (e.g., Bulawayo/Matabeleland), producing invalid lat/lon that are then blanked or misplaced. This is silent data loss.
   Fix (choose zone or try both and pick in-bounds):
   ```py
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
           return candidates[0]  # fallback if none in bounds
       except Exception:
           return None
   ```
   Impact: Prevents systematic coordinate corruption for all schools in the western half of the country.

## Medium-Severity Issues
1. GeoJSON build can ingest uncleaned CSV and emit invalid points.
   Code:
   ```py
   source_path = CLEANED_CSV if CLEANED_CSV.exists() else DEFAULT_CSV
   ```
   If the cleaned file is missing, raw data (including 0/0 and out-of-bounds coordinates) is used with no validation. This can place markers in the ocean or at (0,0), silently polluting the map.
   Fix (enforce cleaned input or validate at build time):
   ```py
   if source_path == DEFAULT_CSV:
       raise SystemExit("Run clean_schools.py first; cleaned CSV required.")
   ```
   or add bounds checks inside row_to_feature():
   ```py
   if lat is None or lon is None or not coords_in_zimbabwe(lat, lon):
       return None
   ```
   Impact: Prevents invalid markers and misleading outputs.

2. Map re-filters the full dataset on every pan/zoom.
   Code:
   ```js
   map.on("moveend zoomend", () => {
     updateCounts(
       activeLevels().primary
         ? filterFeatures(primaryFeatures, normalize(searchInput.value), provinces, districts)
         : [],
       activeLevels().secondary
         ? filterFeatures(secondaryFeatures, normalize(searchInput.value), provinces, districts)
         : []
     );
   });
   ```
   This is an O(n) pass on every move event, even when filters are unchanged. On large datasets it becomes sluggish.
   Fix (reuse currentFiltered computed by applyFilters()):
   ```js
   map.on("moveend zoomend", () => {
     const bounds = map.getBounds();
     const inView = currentFiltered.filter((f) => {
       const [lon, lat] = f.geometry.coordinates;
       return bounds.contains([lat, lon]);
     });
     inViewCountEl.textContent = inView.length.toLocaleString();
   });
   ```
   Impact: Cuts redundant full-dataset scans on every map interaction.

## Low-Severity / Style Issues
1. Mutating GeoJSON feature objects with _marker is brittle.
   Code:
   ```js
   primaryFeatures.forEach((feature) => {
     feature._marker = makeMarker(feature, true);
   });
   ```
   Attaching _marker to data objects couples UI state to raw data and risks name collisions with upstream properties.
   Fix (use a Map):
   ```js
   const markerByFeature = new Map();
   primaryFeatures.forEach((feature) => {
     markerByFeature.set(feature, makeMarker(feature, true));
   });
   ```
   Impact: Cleaner separation between data and UI state.

2. normalize_title preserves all-caps values, undermining normalization.
   Code:
   ```py
   if value.isupper():
       return value
   return value.title()
   ```
   This leaves HARARE as HARARE, causing inconsistent casing vs. title-case values.
   Fix:
   ```py
   if value.isupper():
       return value.title()
   ```
   Impact: Consistent filtering and display.

## Overall Assessment
Score: 5/10
Justification: The core functionality works, but a critical geospatial correctness bug exists and the UI layer does redundant work that will not scale. The code is cleanly structured, but lacks the defensive rigor expected for production data pipelines.

## Recommended Rewrite Direction
Treat the pipeline as a strict, validated ETL: enforce a cleaned input contract, validate coordinates consistently, and make coordinate conversion zone-aware. On the frontend, separate raw data from UI state, and avoid re-filtering on map movements. Add a minimal test for the UTM conversion and a regression test for out-of-bounds filtering to lock in correctness.
