# Zimbabwe School Data Sources

This file lists public, ethical sources focused on schools in Zimbabwe (all levels). Each entry explains the data, plus format, access, and last-updated details when available.

## School Location and Facility Datasets

- **Schools in Zimbabwe (Geo-Connect / MoPSE)** -- Point dataset of schools across Zimbabwe published on Geo-Connect; useful for school locations and identifiers.  
  **Format:** CSV. **Access:** Direct download. **Last updated:** 2025-06-18 (per dataset metadata).  
  `https://data.geo-connect.org/datasets/schools-in-zimbabwe/`
- **Zimbabwe Education Facilities (OpenStreetMap Export)** -- OSM-derived education facilities tagged as kindergarten, school, college, or university; provides geolocated features contributed by the OSM community.  
  **Format:** OSM export (resource formats vary on the source page). **Access:** Download via source page. **Last updated:** 2025-08-02 (temporal coverage on listing).  
  `https://geo.btaa.org/catalog/7a0a8fbe-1c5f-448e-8b97-4c4ed6d27ed8`
- **OpenStreetMap Geofabrik Zimbabwe Extract** -- Full Zimbabwe OSM extract; filter for school features using tags like `amenity=school|college|university` and `amenity=kindergarten`.  
  **Format:** .osm.pbf and Shapefile ZIP. **Access:** Download. **Last updated:** Shown on the extract page.  
  `https://download.geofabrik.de/africa/zimbabwe.html`
- **OpenStreetMap Overpass API** -- Query-only access to OSM data; use bounding boxes for Zimbabwe and school-related tags to retrieve up-to-date school features.  
  **Format:** JSON/XML. **Access:** API (no key). **Last updated:** Near real-time OSM edits.  
  `https://wiki.openstreetmap.org/wiki/Overpass_API`

## School Statistics and Indicators

- **UNESCO UIS Data Browser** -- National education indicators for Zimbabwe (e.g., number of schools, enrollment, teachers, infrastructure proxies); filter by education level and indicator.  
  **Format:** CSV/Excel/JSON. **Access:** Download or API via UIS. **Last updated:** UIS release notes on site.  
  `https://databrowser.uis.unesco.org/`
- **UNESCO UIS Data API / Bulk Downloads** -- Programmatic access and bulk education datasets from UIS (covers school-related indicators across levels).  
  **Format:** API (JSON/SDMX) and bulk downloads. **Access:** API / Download. **Last updated:** Varies by dataset.  
  `https://www.unesco.org/en/education/data-analytics/education-data/uis-data`
