# Map of Secondary Schools — Project Specification

## Overview

**Purpose:** Build a minimalist, web-based map that visualizes the spatial distribution of secondary schools in Zimbabwe. The tool supports education NGOs and policymakers by making school locations easy to explore, filter, and understand spatially.

**Core MVP goals:**
- Show only **secondary schools** on a map.
- Cluster markers to avoid overplotting.
- Provide clickable markers with key school details (name, district, level).
- Keep UI minimal: full-screen map + small legend.
- Use free, open-source technologies and static hosting (no server required).

**Success criteria (MVP):**
- Map loads in under 3 seconds on a typical broadband connection.
- Clusters and markers are responsive (no visible lag for pan/zoom).
- Popups show accurate school info for each point.
- Data pipeline is documented and repeatable.

## User Requirements

### Primary users
- **Education NGOs:** Need quick, visual access to the distribution of secondary schools.
- **Policymakers:** Use the map to identify gaps, access issues, and geographic coverage.

### Functional requirements
- Display a map centered on Zimbabwe.
- Load a dataset of schools and filter to **SchoolLevel = Secondary**.
- Render **marker clusters** at varying zoom levels.
- Show **popup** details for each school:
  - Name
  - District
  - School level
- Provide a simple **legend** indicating “Secondary Schools.”

### Non-functional requirements
- Works on modern browsers (Chrome, Edge, Firefox).
- Fully static (no backend services).
- Uses only free/open data and libraries.
- Accessible and readable on both desktop and mobile.

### Out-of-scope (MVP)
- Advanced filtering (ownership, religion, capacity).
- Search or routing.
- Administrative analytics dashboards.

## Data Handling

### Data source
Local dataset: `location_of_schools.csv`

### Assumed columns (from current data)
- `Name`
- `Province`
- `District`
- `SchoolLevel`
- `latitude`
- `longitude`
- `Schoolnumber` (unique identifier)
- `Grant_Class` (not required for MVP)
- `OBJECTID` (not required for MVP)

### CSV sample (placeholder)
```csv
Schoolnumber,Name,Province,District,SchoolLevel,latitude,longitude
1065,ST. JOHNS,Harare,Warren Park Mabelreign,Secondary,-17.77348,31.02569
2020,ST DAVID'S BONDA,Manicaland,Mutasa,Secondary,-18.4493,32.596
```

### Data pipeline (MVP)
1. **Input**: `location_of_schools.csv`
2. **Filter**: `SchoolLevel == "Secondary"`
3. **Output**: `secondary_schools.geojson` (or JSON array)

### Data processing options
**Option A (preferred):** Convert CSV to GeoJSON
- One-time preprocessing for faster client performance.
- Enables direct map layer usage.

**Option B:** Load CSV in browser
- Use a CSV parser (e.g., Papa Parse).
- Slightly larger client footprint but no preprocessing step.

### Data quality checks
- Latitude and longitude are present and parseable as float.
- SchoolLevel matches `"Secondary"`.
- Name, District, Province are non-empty.

## Technical Architecture

### Architecture overview
Static web app hosted on GitHub Pages (or equivalent). Client-side code reads prepared data and renders the map.

### Proposed file structure
```
/
├─ index.html
├─ css/
│  └─ styles.css
├─ js/
│  ├─ map.js
│  └─ data-loader.js
├─ data/
│  └─ secondary_schools.geojson
├─ assets/
│  └─ favicon.svg
├─ PROJECT_SPEC.md
└─ PROGRESS.md
```

### Tech stack (free)
| Layer | Tool | Purpose |
|---|---|---|
| Map rendering | Leaflet | Base map and marker rendering |
| Clustering | Leaflet.markercluster | Clustered markers |
| Data format | GeoJSON | Standard geospatial format |
| Hosting | GitHub Pages | Static hosting |

### Why this stack
- Leaflet is lightweight and widely supported.
- Marker clustering handles thousands of points gracefully.
- GeoJSON is easy to load and inspect.
- Static hosting is reliable and zero-cost.

## UI/UX Design

### Design principles
- Minimal: focus on map and data, avoid controls overload.
- Clear: consistent color for secondary schools.
- Responsive: full-screen map across device sizes.

### Layout
**Full-screen map** with a floating legend in a corner.

### Components
- **Map canvas** (100% width/height)
- **Legend** (small, top-right)
- **Popup** (on marker click)

### Map styling
- Base layer: OpenStreetMap tiles.
- Marker color: single color (e.g., blue) for secondary schools.
- Cluster styling: size-based circles with counts.

### Accessibility considerations
- High contrast between markers and map.
- Keyboard and screen-reader compatibility for legend and popups.
- Avoid text in images; use HTML for all labels.

## Development Steps

### Step 1: Data preparation
- Filter `location_of_schools.csv` to only secondary schools.
- Convert to `secondary_schools.geojson` (or JSON array).
- Validate coordinates and required fields.

### Step 2: Project scaffolding
- Create `index.html`, `styles.css`, and JS files.
- Add Leaflet and markercluster dependencies (via CDN).

### Step 3: Map initialization
- Initialize Leaflet map centered on Zimbabwe.
- Add OSM tile layer with attribution.

### Step 4: Data loading
- Load GeoJSON via `fetch`.
- Create markers for each feature.
- Add markers to cluster layer.

### Step 5: Popup design
- Popup content: Name, District, Province, Level.
- Ensure clean formatting and safe HTML escaping.

### Step 6: Legend
- Add small legend explaining marker/cluster meaning.
- Keep it unobtrusive.

### Step 7: Optimize
- Enable marker clustering with sensible thresholds.
- Lazy load data if needed (not likely for MVP).

### Step 8: Documentation
- Update `README.md` with setup and deployment steps.
- Update `PROGRESS.md` after every change.

## Testing Plan

### Functional tests
- Map loads without errors.
- Secondary schools appear on map.
- Clustering works at zoomed-out levels.
- Popups show accurate details.

### Data tests
- All features have valid lat/long.
- No missing name or district.
- Only `SchoolLevel == Secondary` entries present.

### UI tests
- Legend is readable on desktop and mobile.
- Map occupies full viewport without scrollbars.
- Popups do not overflow screen on mobile.

### Performance checks
- Measure initial load time.
- Ensure map remains responsive under pan/zoom.

## Deployment

### Hosting option (MVP)
**GitHub Pages**
- Push repository to GitHub.
- Enable Pages from `main` branch `/` root.
- Confirm map loads at public URL.

### Build/Deploy steps
1. Generate `secondary_schools.geojson`.
2. Commit and push changes.
3. Confirm static assets load over HTTPS.

## Gaps & Assumptions

### Known gaps
- The CSV does not include ownership/denomination (e.g., Catholic).
- No built-in search or filtering beyond school level.

### Assumptions
- All secondary schools have valid coordinates.
- Users have internet access to load OSM tiles.

## Optional Enhancement (Beyond MVP)

**Feature:** “Province Filter + Summary Panel”  
**Why optional:** Adds value for analysis but increases UI complexity.  
**Details:** A dropdown to filter by Province and a small panel showing total schools in the current view.  
**Implementation impact:** Medium — requires additional UI state and filtering logic.

## QA Checklist (Pre-launch)
- [ ] Data filtered correctly to Secondary level.
- [ ] Map loads without console errors.
- [ ] Marker clusters display counts properly.
- [ ] Popups show correct Name/District/Province/Level.
- [ ] Legend visible but not obstructive.
- [ ] Mobile layout usable (no hidden map or clipped popups).

## Next Steps for AI CLI Implementation

1. **Generate data output** (`secondary_schools.geojson`) from `location_of_schools.csv`.
2. **Create static app skeleton** (`index.html`, CSS, JS).
3. **Integrate Leaflet + markercluster** and load the data file.
4. **Validate UI and data integrity** with basic checks.
5. **Update `README.md` and `PROGRESS.md`** with implementation details.

This spec is designed to be executed quickly with an AI CLI tool, using free, static web technologies and minimal dependencies.
