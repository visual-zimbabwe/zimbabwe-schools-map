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

const clusterOptions = {
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  spiderfyOnMaxZoom: true,
  spiderfyDistanceMultiplier: 1.2,
  maxClusterRadius: 50,
};

const primaryCluster = L.markerClusterGroup(clusterOptions);
const secondaryCluster = L.markerClusterGroup(clusterOptions);

const primaryIcon = L.divIcon({
  className: "school-marker school-marker--primary",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const secondaryIcon = L.divIcon({
  className: "school-marker school-marker--secondary",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const searchInput = document.getElementById("searchInput");
const provinceSelect = document.getElementById("provinceSelect");
const districtSelect = document.getElementById("districtSelect");
const filteredCountEl = document.getElementById("filteredCount");
const inViewCountEl = document.getElementById("inViewCount");
const topProvincesEl = document.getElementById("topProvinces");
const primaryCountEl = document.getElementById("primaryCount");
const secondaryCountEl = document.getElementById("secondaryCount");
const primaryToggle = document.getElementById("primaryToggle");
const secondaryToggle = document.getElementById("secondaryToggle");

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

let primaryFeatures = [];
let secondaryFeatures = [];
let allFeatures = [];
let currentFiltered = [];

function buildLayer(features, icon) {
  return L.geoJSON(
    {
      type: "FeatureCollection",
      features,
    },
    {
      pointToLayer: (feature, latlng) =>
        L.marker(latlng, {
          icon,
          keyboard: false,
          riseOnHover: true,
        }),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(buildPopup(feature.properties));
      },
    }
  );
}

function getActiveLevels() {
  return {
    primary: primaryToggle.checked,
    secondary: secondaryToggle.checked,
  };
}

function getActiveFeatures() {
  const levels = getActiveLevels();
  const features = [];
  if (levels.primary) {
    features.push(...primaryFeatures);
  }
  if (levels.secondary) {
    features.push(...secondaryFeatures);
  }
  return features;
}

function updateSummary(filteredFeatures) {
  filteredCountEl.textContent = filteredFeatures.length.toLocaleString();

  const primaryCount = filteredFeatures.filter(
    (f) => f.properties.SchoolLevel === "Primary"
  ).length;
  const secondaryCount = filteredFeatures.filter(
    (f) => f.properties.SchoolLevel === "Secondary"
  ).length;
  primaryCountEl.textContent = primaryCount.toLocaleString();
  secondaryCountEl.textContent = secondaryCount.toLocaleString();

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
    li.textContent = `${p.name} - ${p.count}`;
    topProvincesEl.appendChild(li);
  });
}

function applyFilters() {
  const { primary, secondary } = getActiveLevels();
  const q = normalizeText(searchInput.value);
  const province = provinceSelect.value;
  const district = districtSelect.value;

  if (!primary && !secondary) {
    primaryCluster.clearLayers();
    secondaryCluster.clearLayers();
    currentFiltered = [];
    updateSummary([]);
    return;
  }

  const filteredPrimary = primary
    ? primaryFeatures.filter((f) => {
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
      })
    : [];

  const filteredSecondary = secondary
    ? secondaryFeatures.filter((f) => {
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
      })
    : [];

  primaryCluster.clearLayers();
  secondaryCluster.clearLayers();

  if (filteredPrimary.length) {
    primaryCluster.addLayer(buildLayer(filteredPrimary, primaryIcon));
  }
  if (filteredSecondary.length) {
    secondaryCluster.addLayer(buildLayer(filteredSecondary, secondaryIcon));
  }

  currentFiltered = [...filteredPrimary, ...filteredSecondary];
  updateSummary(currentFiltered);
}

function refreshDistrictOptions() {
  const province = provinceSelect.value;
  const districtFeatures = getActiveFeatures().filter((f) => {
    if (province && f.properties.Province !== province) {
      return false;
    }
    return true;
  });
  const districts = districtFeatures
    .map((f) => f.properties.District)
    .filter(Boolean);
  const unique = [...new Set(districts)].sort();
  setOptions(districtSelect, unique, "All districts");
}

function loadGeoJson(windowKey, url) {
  if (window[windowKey]) {
    return Promise.resolve(window[windowKey]);
  }
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`${url} -> ${response.status}`);
    }
    return response.json();
  });
}

function fitToVisible() {
  const bounds = L.latLngBounds([]);
  if (primaryCluster.getLayers().length) {
    bounds.extend(primaryCluster.getBounds());
  }
  if (secondaryCluster.getLayers().length) {
    bounds.extend(secondaryCluster.getBounds());
  }
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

Promise.all([
  loadGeoJson("PRIMARY_SCHOOLS", "data/primary_schools.geojson"),
  loadGeoJson("SECONDARY_SCHOOLS", "data/secondary_schools.geojson"),
])
  .then(([primaryData, secondaryData]) => {
    primaryFeatures = primaryData.features || [];
    secondaryFeatures = secondaryData.features || [];
    allFeatures = [...primaryFeatures, ...secondaryFeatures];

    const provinces = [
      ...new Set(allFeatures.map((f) => f.properties.Province).filter(Boolean)),
    ].sort();
    setOptions(provinceSelect, provinces, "All provinces");
    refreshDistrictOptions();

    map.addLayer(primaryCluster);
    map.addLayer(secondaryCluster);

    primaryCluster.on("clusterclick", (event) => {
      if (map.getZoom() === map.getMaxZoom()) {
        event.layer.spiderfy();
      }
    });

    secondaryCluster.on("clusterclick", (event) => {
      if (map.getZoom() === map.getMaxZoom()) {
        event.layer.spiderfy();
      }
    });

    applyFilters();
    fitToVisible();
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

primaryToggle.addEventListener("change", () => {
  refreshDistrictOptions();
  applyFilters();
});

secondaryToggle.addEventListener("change", () => {
  refreshDistrictOptions();
  applyFilters();
});

map.on("moveend zoomend", () => {
  updateSummary(currentFiltered);
});
