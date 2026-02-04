## Executive Summary
Score: 4/10. The UI is functional and the data pipeline is clear, but performance and operational hardening are below a production bar, and the data cleaning scripts quietly accept questionable inputs. The map rendering is the main risk: it recreates all markers on every filter change, which will lock up with real-world data sizes. Security hygiene (third-party CDN without SRI) is also unacceptable for production.

## High-Severity Issues
1. Performance-killer: recreating all markers on every filter change
   - Code: `js/map.js`
     ```js
     filteredPrimary.forEach((feature) =>
       primaryCluster.addLayer(makeMarker(feature, true))
     );
     filteredSecondary.forEach((feature) =>
       secondaryCluster.addLayer(makeMarker(feature, false))
     );
     ```
   - Why this is bad: This re-creates every marker object on each input event (`searchInput` is wired to `input`), causing O(n) allocations and GC thrash. With 10k+ points, the UI will stutter or freeze.
   - Fix (cache markers and reuse):
     ```js
     // Build once after loading features
     primaryFeatures.forEach((f) => { f._marker = makeMarker(f, true); });
     secondaryFeatures.forEach((f) => { f._marker = makeMarker(f, false); });

     function applyFilters() {
       ...
       primaryCluster.clearLayers();
       secondaryCluster.clearLayers();
       primaryCluster.addLayers(filteredPrimary.map((f) => f._marker));
       secondaryCluster.addLayers(filteredSecondary.map((f) => f._marker));
       ...
     }
     ```
   - Impact: Large datasets remain responsive; avoids repeated marker construction.

2. Security: third-party CDN scripts/styles without integrity
   - Code: `index.html`
     ```html
     <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
     <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
     ```
   - Why this is bad: Supply-chain risk. Any CDN compromise or version change silently executes in users' browsers. Unacceptable for production.
   - Fix (pin + SRI or self-host):
     ```html
     <link rel="stylesheet"
           href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
           integrity="sha384-..."
           crossorigin="anonymous" />
     ```
     Or serve vendor assets locally and version them.
   - Impact: Prevents silent third-party tampering.

## Medium-Severity Issues
1. No automated tests for data cleaning or outputs
   - Code: absence of `tests/` and any test runner configuration.
   - Why this is bad: Your pipeline mutates data and generates artifacts; without tests, regressions are inevitable (e.g., coordinate cleaning, per-level filtering).
   - Fix: Add `tests/test_clean_schools.py` and `tests/test_build_school_geojson.py` with fixtures validating:
     - out-of-bounds coords dropped
     - UTM conversion works
     - level filtering is correct
     - output GeoJSON schema
   - Impact: Prevents silent data integrity regressions.

2. Data validation constants are dead code
   - Code: `scripts/clean_schools.py`
     ```py
     ALLOWED_LEVELS = {"Primary", "Secondary"}
     ALLOWED_GRANT_CLASS = {"P1", "P2", "P3", "S1", "S2", "S3"}
     ```
   - Why this is bad: You define validation rules and then ignore them. That guarantees inconsistent categories downstream and broken filters.
   - Fix (enforce or log invalids):
     ```py
     if level not in ALLOWED_LEVELS:
         stats["invalid_level"] += 1
         cleaned["SchoolLevel"] = ""
     if grant and grant not in ALLOWED_GRANT_CLASS:
         stats["invalid_grant"] += 1
         cleaned["Grant_Class"] = ""
     ```
   - Impact: Eliminates silent category drift.

3. Misleading missing-lat/lon stats
   - Code: `scripts/clean_schools.py`
     ```py
     if lat is None or lon is None:
         stats["missing_latlon"] += 1
         ...
         if converted:
             ... stats["filled_from_xy"] += 1
     ```
   - Why this is bad: You count rows as missing even when later fixed from UTM. The reported percentage is not "final missing," which misleads stakeholders.
   - Fix (track raw vs final):
     ```py
     if lat is None or lon is None:
         stats["missing_latlon_raw"] += 1
         ...
     if lat is None or lon is None:
         stats["missing_latlon_final"] += 1
     ```
   - Impact: Accurate reporting for QA and decision-making.

4. Brittle multi-select label update
   - Code: `js/map.js`
     ```js
     trigger.firstChild.textContent = placeholder;
     ```
   - Why this is bad: `firstChild` depends on whitespace text nodes in the HTML and is fragile. Any HTML reformatting breaks the label.
   - Fix (explicit label span):
     ```html
     <button class="multi-trigger" type="button">
       <span class="multi-label">All provinces</span>
       <span class="multi-caret">▾</span>
     </button>
     ```
     ```js
     const label = trigger.querySelector(".multi-label");
     label.textContent = placeholder;
     ```
   - Impact: Removes DOM fragility.

## Low-Severity / Style Issues
1. Mojibake in caret glyph
   - Code: `index.html`
     ```html
     <span class="multi-caret">â–¾</span>
     ```
   - Why this is bad: Encoding error renders garbage on some browsers.
   - Fix: Use `▾` in UTF-8 or `&#9662;`.

2. Font loading via CSS `@import`
   - Code: `css/styles.css`
     ```css
     @import url("https://fonts.googleapis.com/css2?family=Fraunces...
     ```
   - Why this is bad: `@import` blocks rendering longer than `<link>` and hides failures.
   - Fix: Move to `<link rel="stylesheet">` in `index.html` and add preconnect.

3. `normalize_title` can mangle acronyms
   - Code: `scripts/clean_schools.py`
     ```py
     return normalize_spaces(value).title()
     ```
   - Why this is bad: `title()` turns "ZIMRA" into "Zimra" and breaks canonical names.
   - Fix: Use a whitelist or keep original casing when all-caps.

## Overall Assessment
Score: 4/10  
Justification: Functional but not production-grade. The map layer rebuild loop is a real performance killer, and security hygiene around third-party assets is missing. The data pipeline lacks validation and tests, allowing incorrect categories and misleading reporting.

## Recommended Rewrite Direction
Make the UI data-driven and incremental: pre-build markers, filter by toggling visibility, debounce input, and compute in-view counts from cached filters. In the data pipeline, enforce validation rules and emit deterministic reports, with a small test suite covering core invariants. Self-host or SRI-pin all vendor assets.
