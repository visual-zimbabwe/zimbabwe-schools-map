/* global L */
const ZIMBABWE_CENTER = [-19.0154, 29.1549];
const INITIAL_ZOOM = 6;

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
}).setView(ZIMBABWE_CENTER, INITIAL_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const clusterLayer = L.markerClusterGroup({
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  spiderfyOnMaxZoom: true,
  spiderfyDistanceMultiplier: 1.2,
  maxClusterRadius: 50,
});

const schoolIcon = L.divIcon({
  className: "school-marker",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const searchInput = document.getElementById("searchInput");
const provinceSelect = document.getElementById("provinceSelect");
const districtSelect = document.getElementById("districtSelect");
const filteredCountEl = document.getElementById("filteredCount");
const inViewCountEl = document.getElementById("inViewCount");
const topProvincesEl = document.getElementById("topProvinces");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPopup(props) {
  const name = escapeHtml(props.Name);
  const district = escapeHtml(props.District);
  const province = escapeHtml(props.Province);
  const level = escapeHtml(props.SchoolLevel);
  return `
    <div class="popup">
      <div class="popup-title">${name}</div>
      <div class="popup-row"><strong>District:</strong> ${district}</div>
      <div class="popup-row"><strong>Province:</strong> ${province}</div>
      <div class="popup-row"><strong>Level:</strong> ${level}</div>
    </div>
  `;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function setOptions(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = placeholder;
  select.appendChild(defaultOpt);
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
  if ([...select.options].some((o) => o.value === current)) {
    select.value = current;
  }
}

function countBy(list, keyFn) {
  const counts = new Map();
  list.forEach((item) => {
    const key = keyFn(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

let schoolFeatures = [];
let currentLayer = null;

function buildLayer(features) {
  return L.geoJSON(
    {
      type: "FeatureCollection",
      features,
    },
    {
      pointToLayer: (feature, latlng) =>
        L.marker(latlng, {
          icon: schoolIcon,
          keyboard: false,
          riseOnHover: true,
        }),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(buildPopup(feature.properties));
      },
    }
  );
}

function updateSummary(filteredFeatures) {
  filteredCountEl.textContent = filteredFeatures.length.toLocaleString();
  const bounds = map.getBounds();
  const inView = filteredFeatures.filter((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return bounds.contains([lat, lng]);
  });
  inViewCountEl.textContent = inView.length.toLocaleString();

  const provinceCounts = [...countBy(filteredFeatures, (f) => f.properties.Province)]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  topProvincesEl.innerHTML = "";
  provinceCounts.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} — ${p.count}`;
    topProvincesEl.appendChild(li);
  });
}

function applyFilters() {
  const q = normalizeText(searchInput.value);
  const province = provinceSelect.value;
  const district = districtSelect.value;

  const filtered = schoolFeatures.filter((f) => {
    const name = normalizeText(f.properties.Name);
    if (q && !name.includes(q)) {
      return false;
    }
    if (province && f.properties.Province !== province) {
      return false;
    }
    if (district && f.properties.District !== district) {
      return false;
    }
    return true;
  });

  if (currentLayer) {
    clusterLayer.removeLayer(currentLayer);
  }
  currentLayer = buildLayer(filtered);
  clusterLayer.addLayer(currentLayer);

  updateSummary(filtered);
}

function refreshDistrictOptions() {
  const province = provinceSelect.value;
  const districts = schoolFeatures
    .filter((f) => !province || f.properties.Province === province)
    .map((f) => f.properties.District)
    .filter(Boolean);
  const unique = [...new Set(districts)].sort();
  setOptions(districtSelect, unique, "All districts");
}

function loadSchoolData() {
  if (window.SECONDARY_SCHOOLS) {
    return Promise.resolve(window.SECONDARY_SCHOOLS);
  }
  return fetch("data/secondary_schools.geojson").then((response) => {
    if (!response.ok) {
      throw new Error(`data/secondary_schools.geojson -> ${response.status}`);
    }
    return response.json();
  });
}

loadSchoolData()
  .then((geojson) => {
    schoolFeatures = geojson.features || [];
    const provinces = [
      ...new Set(schoolFeatures.map((f) => f.properties.Province).filter(Boolean)),
    ].sort();
    setOptions(provinceSelect, provinces, "All provinces");
    refreshDistrictOptions();
    applyFilters();

    map.addLayer(clusterLayer);

    clusterLayer.on("clusterclick", (event) => {
      if (map.getZoom() === map.getMaxZoom()) {
        event.layer.spiderfy();
      }
    });

    try {
      map.fitBounds(clusterLayer.getBounds(), { padding: [20, 20] });
    } catch (err) {
      // fallback to default view
    }
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load school data:", err);
  });

searchInput.addEventListener("input", () => {
  applyFilters();
});

provinceSelect.addEventListener("change", () => {
  refreshDistrictOptions();
  applyFilters();
});

districtSelect.addEventListener("change", () => {
  applyFilters();
});

map.on("moveend zoomend", () => {
  updateSummary(
    currentLayer ? currentLayer.toGeoJSON().features : schoolFeatures
  );
});
