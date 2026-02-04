## Executive Summary
The codebase is functional but not production-grade. It contains a correctness defect in coordinate conversion, pervasive duplication of core utilities, and brittle normalization that corrupts real-world names. The frontend is clean but monolithic and lacks guardrails for failure modes. Score: 5/10.

## High-Severity Issues
1. Incorrect UTM fallback can write out-of-bounds coordinates into the cleaned dataset.
Code:
```python
        for epsg in ("EPSG:32735", "EPSG:32736"):
            transformer = Transformer.from_crs(epsg, "EPSG:4326", always_xy=True)
            lon, lat = transformer.transform(x, y)
            if coords_in_zimbabwe(lat, lon):
                return lat, lon
            candidates.append((lat, lon))
        return candidates[0] if candidates else None
```
Why this is bad: If neither candidate is in Zimbabwe, you still return the first candidate and overwrite latitude/longitude with invalid data. This silently corrupts downstream datasets and GeoJSON outputs.
Fix:
```python
        for epsg in ("EPSG:32735", "EPSG:32736"):
            transformer = Transformer.from_crs(epsg, "EPSG:4326", always_xy=True)
            lon, lat = transformer.transform(x, y)
            if coords_in_zimbabwe(lat, lon):
                return lat, lon
        return None
```
Impact: Prevents injecting invalid coordinates and avoids false positives that look valid but are outside Zimbabwe.

## Medium-Severity Issues
1. Utility functions are duplicated across pipeline scripts, increasing maintenance risk.
Code:
```python
def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def coords_in_zimbabwe(lat, lon):
    return (
        ZIM_BOUNDS["lat_min"] <= lat <= ZIM_BOUNDS["lat_max"]
        and ZIM_BOUNDS["lon_min"] <= lon <= ZIM_BOUNDS["lon_max"]
    )


def open_csv(path: Path):
    with path.open("rb") as handle:
        start = handle.read(4)
    if start.startswith(b"\xff\xfe") or start.startswith(b"\xfe\xff"):
        encoding = "utf-16"
    else:
        encoding = "utf-8-sig"
    return path.open(newline="", encoding=encoding)
```
Why this is bad: You now have two sources of truth for parsing, bounds checks, and encoding detection. Any future fix will be inconsistently applied.
Fix:
```python
# scripts/geo_utils.py
from pathlib import Path
from scripts.constants import ZIM_BOUNDS

def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def coords_in_zimbabwe(lat, lon):
    return (
        ZIM_BOUNDS["lat_min"] <= lat <= ZIM_BOUNDS["lat_max"]
        and ZIM_BOUNDS["lon_min"] <= lon <= ZIM_BOUNDS["lon_max"]
    )


def open_csv(path: Path):
    with path.open("rb") as handle:
        start = handle.read(4)
    if start.startswith(b"\xff\xfe") or start.startswith(b"\xfe\xff"):
        encoding = "utf-16"
    else:
        encoding = "utf-8-sig"
    return path.open(newline="", encoding=encoding)
```
Impact: Reduces drift and ensures fixes are applied consistently across the pipeline.

2. `normalize_title` destroys acronyms and proper casing in real names.
Code:
```python
def normalize_title(value: str) -> str:
    if not value:
        return ""
    value = normalize_spaces(value)
    return value.title()
```
Why this is bad: Title-casing breaks acronyms and mixed-case proper nouns. That is irreversible data loss in a cleaning pipeline.
Fix:
```python
def normalize_title(value: str) -> str:
    if not value:
        return ""
    value = normalize_spaces(value)
    words = []
    for word in value.split(" "):
        if word.isupper():
            words.append(word)
        else:
            words.append(word.capitalize())
    return " ".join(words)
```
Impact: Preserves data fidelity while still normalizing casing.

3. `try_utm_to_latlon` swallows all exceptions, masking real failures.
Code:
```python
    except Exception:
        return None
```
Why this is bad: Silent failures hide configuration errors (bad pyproj install, projection failures) and reduce debuggability.
Fix:
```python
    except ImportError:
        return None
    except (ValueError, RuntimeError) as exc:
        raise RuntimeError(f"UTM conversion failed: {exc}")
```
Impact: Surfaces real failures while still tolerating optional dependencies.

4. Frontend data loading has no recoverable state on failure, leaving the UI stuck under the loading mask.
Code:
```javascript
  .catch((err) => {
      loading.textContent = "Failed to load school data.";
      console.error(err);
    });
```
Why this is bad: The overlay is never dismissed, even if partial data loads or the user wants to retry. The UI is effectively dead.
Fix:
```javascript
  .catch((err) => {
      loading.textContent = "Failed to load school data.";
      loading.classList.add("error");
      console.error(err);
    })
    .finally(() => {
      loading.style.display = "none";
    });
```
Impact: The map becomes usable even when data is missing, and users get a clear failure state.

## Low-Severity / Style Issues
1. `setupMultiSelect` registers redundant global click handlers per widget.
Code:
```javascript
    document.addEventListener("click", (event) => {
      if (!container.contains(event.target)) {
        container.classList.remove("open");
      }
    });
```
Why this is bad: Multiple identical listeners add unnecessary overhead and make future cleanup harder.
Fix:
```javascript
const openMenus = new Set();

function registerMultiSelect(container) {
  openMenus.add(container);
}

document.addEventListener("click", (event) => {
  openMenus.forEach((container) => {
    if (!container.contains(event.target)) {
      container.classList.remove("open");
    }
  });
});
```
Impact: Removes redundant listeners and simplifies behavior.

2. `normalize` uses `String(value || "")`, which treats `0` as empty.
Code:
```javascript
  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }
```
Why this is bad: `0` is a valid string and should normalize to "0", not empty. It is minor, but it is incorrect behavior.
Fix:
```javascript
  function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
  }
```
Impact: Correct normalization for falsy but valid values.

3. `build_school_geojson` writes JS payloads that are unused by the app.
Code:
```python
    js_payload = f"window.{config['window']} = {json.dumps(geojson, ensure_ascii=True)};\n"
    config["js"].write_text(js_payload, encoding="utf-8")
```
Why this is bad: The app only fetches GeoJSON and never reads `window.PRIMARY_SCHOOLS` / `window.SECONDARY_SCHOOLS`, so this output is dead weight and creates a misleading data contract.
Fix:
```python
# Remove JS payload outputs entirely and keep only GeoJSON.
LEVELS = {
    "Primary": {"geojson": DATA_DIR / "primary_schools.geojson"},
    "Secondary": {"geojson": DATA_DIR / "secondary_schools.geojson"},
}

def write_outputs(level, config, source_path: Path):
    geojson = build_geojson(level, source_path)
    config["geojson"].write_text(
        json.dumps(geojson, ensure_ascii=True), encoding="utf-8"
    )
```
Impact: Eliminates unused artifacts and makes the output contract explicit.

## Overall Assessment
Score: 5/10  
Justification: The UI and data pipeline are coherent, but a correctness bug in coordinate conversion and duplicated utilities keep this below a production bar. Error handling and normalization still need tightening to protect data fidelity and long-term maintainability.

## Recommended Rewrite Direction
Extract shared pipeline utilities into a single module, harden coordinate conversion (only accept in-bounds output), make normalization preserve acronyms, and modularize the frontend into small, testable components with explicit error states. Treat data integrity as a first-class concern and wire it through the UI.

## Optional: Full Refactored Example
Not requested.
