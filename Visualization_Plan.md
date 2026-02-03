# School Geospatial Visualization Plan

## Executive Summary
The dataset includes school name, latitude, longitude, province, and district. This enables spatial distribution, density, and proximity analyses at district and province scales. From these fields, we can derive counts, spatial clustering, and nearest-neighbor distances to identify over- and under-served areas. To tell stronger equity stories, we can optionally join external layers like population density, road networks, travel time, and administrative boundaries to contextualize access.

The visualization suite below surfaces where schools cluster, where gaps emerge, and how spatial patterns vary across districts and provinces. The set includes at least one static image, an interactive website, a dashboard, and additional creative formats, with explicit notes where external data would increase impact.

1. National Accessibility Heatmap: “Where Access Concentrates”
- Story Told: A national density view shows how schools cluster around urban corridors and thin out across rural districts, revealing potential access inequities and education deserts.
- Data Used: Latitude/longitude for density; province/district for contextual labels. Optional admin boundaries for mask and annotation.
- Format/Type: Static image suitable for print or report cover.
- Tools/Techniques: Kernel density estimation or hexbin density; spatial smoothing; annotate top 5 highest-density zones and 5 largest low-density zones.
- Impact/Why It Matters: A single, powerful image that communicates the stark imbalance of school distribution, ideal for decision-makers who need the big picture fast.
- Visualization Suggestions: Use a warm-to-cool sequential palette (gold to deep blue) on a muted basemap. Add callouts for provinces or districts with the lowest density. Include a scale bar and density legend. If boundary polygons are available, mask to country border to avoid visual noise.

2. District Equity Dashboard: “Who Is Under-Served?”
- Story Told: A district-level comparison of school counts and density per district highlights disparities and identifies under-served districts that may require targeted interventions.
- Data Used: District, province, and point locations aggregated to district counts; optional district area to compute density; optional population data to compute schools per 10,000 people.
- Format/Type: Dashboard with map + ranked table + bar chart.
- Tools/Techniques: Aggregations in Python or SQL; choropleth map; sortable table; filters for province; inline summary stats and percentiles.
- Impact/Why It Matters: Decision-ready view that connects geography with measurable inequity indicators. It turns a map into prioritized action lists.
- Visualization Suggestions: Use a two-panel layout: choropleth on the left, ranked districts on the right. Color scale should be perceptually uniform. Add toggles for “Count,” “Density,” and “Schools per 10k population” (if population data is added). Keep the map and table linked for brushing and highlight.

3. Interactive Explorer: “Zoom from National to School-Level”
- Story Told: An exploratory web map allows users to move from national patterns to specific districts and schools, revealing local clusters and gaps at multiple scales.
- Data Used: School name, lat/long, district, province. Optional school type or status if later available.
- Format/Type: Interactive website using Leaflet or Mapbox.
- Tools/Techniques: Clustering at low zoom, expansion at high zoom; search by school name; filter by province/district; popups with school details.
- Impact/Why It Matters: Converts the dataset into a navigable atlas that supports planning, reporting, and community engagement. Enables rapid investigation of any district.
- Visualization Suggestions: Use a clean, neutral basemap and colored cluster markers by province. Include a side panel with summary stats for the current viewport. Provide a “gap scan” mode that overlays a grid and highlights empty cells at the current zoom to show local deserts.

4. Nearest-School Distance Story: “How Far Is the Typical Journey?”
- Story Told: By computing nearest-neighbor distances between schools (or school-to-district centroid distances), the visualization highlights spatial isolation and areas with sparse coverage.
- Data Used: Lat/long for nearest-neighbor distance; district for aggregation.
- Format/Type: Narrative scrollytelling web page with 3–4 slides and a supporting map.
- Tools/Techniques: Compute nearest-neighbor distances and map them as graduated circles or a distance surface; annotate top 10 “most isolated” schools or districts.
- Impact/Why It Matters: Shifts the narrative from “how many schools exist” to “how far people may need to travel.” It makes geographic accessibility tangible.
- Visualization Suggestions: Use a sequential color scale for distance, with large, pale circles for isolated areas. Add a short narrative panel that highlights distance outliers. If road networks are available, replace straight-line distances with travel time for stronger real-world impact.

5. Province vs District Mosaic: “Inequity Within Provinces”
- Story Told: Provinces may look balanced overall, but district-level variation reveals hidden inequities inside provinces. This visualization compares districts within their province context.
- Data Used: District and province; aggregated counts and densities.
- Format/Type: Static multi-panel small multiples, one panel per province.
- Tools/Techniques: Each panel shows districts as tiles sized by area or uniform; color by school density or count; consistent scale across panels.
- Impact/Why It Matters: Reveals internal provincial disparities that a national map can hide. This is ideal for provincial education offices who need an internal fairness lens.
- Visualization Suggestions: Use a consistent color ramp across all panels. Add a province summary line above each panel with total count and median district density. Keep the layout compact and print-friendly.

6. District Hotspot vs Coldspot Map: “Where Clusters Are Statistically Significant”
- Story Told: A spatial statistics view identifies districts that are significantly higher or lower in school concentration than neighbors, beyond what the eye sees.
- Data Used: District-level counts with adjacency; district polygons required.
- Format/Type: Interactive or static thematic map.
- Tools/Techniques: Spatial autocorrelation (Local Moran’s I or Getis-Ord Gi*); map districts as hotspots, coldspots, and not significant.
- Impact/Why It Matters: Moves from descriptive mapping to statistical evidence, supporting stronger policy arguments for resource reallocation.
- Visualization Suggestions: Use a categorical palette: red for hotspots, blue for coldspots, gray for not significant. Provide a short methods sidebar that explains the test. If polygon boundaries are not available, replace this plan with a gridded hotspot analysis using fixed cells.

## Set Review
The strongest stories are 1, 2, and 4 because they foreground inequity and accessibility. Visualization 6 is powerful but depends on district polygons; without boundaries, it should be replaced by a gridded hotspot method. Visualization 5 is impactful for provincial stakeholders but may be less compelling for a national audience unless paired with a top-line disparity statistic.

## Top 3 Priorities
1. National Accessibility Heatmap
2. District Equity Dashboard
3. Nearest-School Distance Story

## Implementation Recommendations
Start by validating coordinate quality and confirming the province and district naming consistency for aggregation. Acquire administrative boundary polygons (district and province) to enable accurate choropleths and spatial statistics. If possible, add population density and road network data to transition from “school presence” to “accessibility.” For interactive delivery, prioritize the explorer map and dashboard using Leaflet or Mapbox with a lightweight data pipeline that pre-aggregates district metrics.
