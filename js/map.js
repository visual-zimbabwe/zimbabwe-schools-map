const ZIM_BOUNDS = [
  [-22.5, 25.2],
  [-15.3, 33.2],
];

const map = L.map("map", { zoomControl: false }).fitBounds(ZIM_BOUNDS);
L.control.zoom({ position: "topleft" }).addTo(map);

const baseLayers = {
  "Clean Light": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: "&copy; OpenStreetMap contributors &copy; CARTO" }
  ),
  Terrain: L.tileLayer(
    "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
    { attribution: "&copy; OpenStreetMap contributors &copy; Stamen" }
  ),
};
baseLayers["Clean Light"].addTo(map);
L.control.layers(baseLayers, null, { position: "bottomright" }).addTo(map);

const clusterOptions = {
  showCoverageOnHover: false,
  maxClusterRadius: 48,
  spiderfyOnMaxZoom: true,
  iconCreateFunction: (cluster) => {
    const count = cluster.getChildCount();
    const size = count < 50 ? 36 : count < 200 ? 44 : 52;
    return L.divIcon({
      html: `<div style="
        width:${size}px;height:${size}px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        background:radial-gradient(circle at 30% 30%, rgba(244,196,48,0.9), rgba(17,17,17,0.9));
        color:white;font-weight:700;font-size:12px;box-shadow:0 8px 18px rgba(0,0,0,0.2)
      ">${count}</div>`,
      className: "",
      iconSize: [size, size],
    });
  },
};

const primaryCluster = L.markerClusterGroup(clusterOptions);
const secondaryCluster = L.markerClusterGroup(clusterOptions);

const searchInput = document.getElementById("searchInput");
const provinceSelect = document.getElementById("provinceSelect");
const districtSelect = document.getElementById("districtSelect");
const filteredCountEl = document.getElementById("filteredCount");
const inViewCountEl = document.getElementById("inViewCount");
const primaryCountEl = document.getElementById("primaryCount");
const secondaryCountEl = document.getElementById("secondaryCount");
const storyText = document.getElementById("storyText");
const loading = document.getElementById("loading");
const togglePrimary = document.getElementById("togglePrimary");
const toggleSecondary = document.getElementById("toggleSecondary");

let primaryFeatures = [];
let secondaryFeatures = [];
let currentFiltered = [];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPopup(props) {
  return `
    <div class="popup-title">${escapeHtml(props.Name)}</div>
    <div class="popup-row"><strong>Level:</strong> ${escapeHtml(props.SchoolLevel)}</div>
    <div class="popup-row"><strong>Province:</strong> ${escapeHtml(props.Province)}</div>
    <div class="popup-row"><strong>District:</strong> ${escapeHtml(props.District)}</div>
  `;
}

function makeMarker(feature, isPrimary) {
  const icon = L.divIcon({
    className: `school-marker ${isPrimary ? "marker-primary" : "marker-secondary"}`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  const [lon, lat] = feature.geometry.coordinates;
  const marker = L.marker([lat, lon], { icon });
  marker.bindPopup(buildPopup(feature.properties));
  return marker;
}

function setOptions(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = placeholder;
  select.appendChild(opt);
  values.forEach((value) => {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = value;
    select.appendChild(item);
  });
  if ([...select.options].some((o) => o.value === current)) {
    select.value = current;
  }
}

function activeLevels() {
  return {
    primary: togglePrimary.classList.contains("active"),
    secondary: toggleSecondary.classList.contains("active"),
  };
}

function filterFeatures(features, query, province, district) {
  return features.filter((feature) => {
    const props = feature.properties || {};
    const name = normalize(props.Name);
    if (query && !name.includes(query)) return false;
    if (province && props.Province !== province) return false;
    if (district && props.District !== district) return false;
    return true;
  });
}

function updateStory() {
  const { primary, secondary } = activeLevels();
  if (primary && secondary) {
    storyText.textContent =
      "Both levels are visible. Compare access and density across provinces.";
  } else if (primary) {
    storyText.textContent =
      "Primary schools shape early learning access. Zoom in for community detail.";
  } else if (secondary) {
    storyText.textContent =
      "Secondary schools show pathways to advanced learning. Explore clusters.";
  } else {
    storyText.textContent =
      "Select a level to start exploring schools across Zimbabwe.";
  }
}

function refreshDistrictOptions() {
  const province = provinceSelect.value;
  const levels = activeLevels();
  const all = [
    ...(levels.primary ? primaryFeatures : []),
    ...(levels.secondary ? secondaryFeatures : []),
  ];
  const districts = all
    .filter((f) => !province || f.properties.Province === province)
    .map((f) => f.properties.District)
    .filter(Boolean);
  const unique = [...new Set(districts)].sort();
  setOptions(districtSelect, unique, "All districts");
}

function updateCounts(filteredPrimary, filteredSecondary) {
  const combined = [...filteredPrimary, ...filteredSecondary];
  currentFiltered = combined;
  filteredCountEl.textContent = combined.length.toLocaleString();
  primaryCountEl.textContent = filteredPrimary.length.toLocaleString();
  secondaryCountEl.textContent = filteredSecondary.length.toLocaleString();

  const bounds = map.getBounds();
  const inView = combined.filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return bounds.contains([lat, lon]);
  });
  inViewCountEl.textContent = inView.length.toLocaleString();
}

function applyFilters() {
  const { primary, secondary } = activeLevels();
  const query = normalize(searchInput.value);
  const province = provinceSelect.value;
  const district = districtSelect.value;

  primaryCluster.clearLayers();
  secondaryCluster.clearLayers();

  const filteredPrimary = primary
    ? filterFeatures(primaryFeatures, query, province, district)
    : [];
  const filteredSecondary = secondary
    ? filterFeatures(secondaryFeatures, query, province, district)
    : [];

  filteredPrimary.forEach((feature) =>
    primaryCluster.addLayer(makeMarker(feature, true))
  );
  filteredSecondary.forEach((feature) =>
    secondaryCluster.addLayer(makeMarker(feature, false))
  );

  updateCounts(filteredPrimary, filteredSecondary);
  updateStory();
}

function loadGeoJSON(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} -> ${response.status}`);
    return response.json();
  });
}

Promise.all([
  loadGeoJSON("data/primary_schools.geojson"),
  loadGeoJSON("data/secondary_schools.geojson"),
])
  .then(([primary, secondary]) => {
    primaryFeatures = primary.features || [];
    secondaryFeatures = secondary.features || [];

    map.addLayer(primaryCluster);
    map.addLayer(secondaryCluster);

    const provinces = [
      ...new Set(
        [...primaryFeatures, ...secondaryFeatures]
          .map((f) => f.properties.Province)
          .filter(Boolean)
      ),
    ].sort();
    setOptions(provinceSelect, provinces, "All provinces");
    refreshDistrictOptions();
    applyFilters();
    loading.style.display = "none";
  })
  .catch((err) => {
    loading.textContent = "Failed to load school data.";
    console.error(err);
  });

searchInput.addEventListener("input", applyFilters);
provinceSelect.addEventListener("change", () => {
  refreshDistrictOptions();
  applyFilters();
});
districtSelect.addEventListener("change", applyFilters);

togglePrimary.addEventListener("click", () => {
  togglePrimary.classList.toggle("active");
  refreshDistrictOptions();
  applyFilters();
});
toggleSecondary.addEventListener("click", () => {
  toggleSecondary.classList.toggle("active");
  refreshDistrictOptions();
  applyFilters();
});

map.on("moveend zoomend", () => {
  updateCounts(
    activeLevels().primary
      ? filterFeatures(
          primaryFeatures,
          normalize(searchInput.value),
          provinceSelect.value,
          districtSelect.value
        )
      : [],
    activeLevels().secondary
      ? filterFeatures(
          secondaryFeatures,
          normalize(searchInput.value),
          provinceSelect.value,
          districtSelect.value
        )
      : []
  );
});
