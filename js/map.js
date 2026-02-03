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
const clearFilters = document.getElementById("clearFilters");
const schoolNames = document.getElementById("schoolNames");

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

function getSelectedValues(container) {
  return [...container.querySelectorAll("input[type='checkbox']:checked")].map(
    (input) => input.value
  );
}

function setMultiSelectOptions(container, values, placeholder) {
  const currentValues = new Set(getSelectedValues(container));
  const trigger = container.querySelector(".multi-trigger");
  const menu = container.querySelector(".multi-menu");
  menu.innerHTML = "";

  values.forEach((value) => {
    const option = document.createElement("label");
    option.className = "multi-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = value;
    checkbox.checked = currentValues.has(value);
    const text = document.createElement("span");
    text.textContent = value;
    option.appendChild(checkbox);
    option.appendChild(text);
    menu.appendChild(option);
  });

  updateMultiSelectLabel(container, placeholder);
}

function updateMultiSelectLabel(container, placeholder) {
  const trigger = container.querySelector(".multi-trigger");
  const values = getSelectedValues(container);
  if (!values.length) {
    trigger.firstChild.textContent = placeholder;
    return;
  }
  const label =
    values.length === 1
      ? values[0]
      : `${values.length} selected`;
  trigger.firstChild.textContent = label;
}

function setupMultiSelect(container, placeholder, onChange) {
  const trigger = container.querySelector(".multi-trigger");
  trigger.firstChild.textContent = placeholder;

  trigger.addEventListener("click", () => {
    container.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) {
      container.classList.remove("open");
    }
  });

  container.addEventListener("change", (event) => {
    if (event.target.matches("input[type='checkbox']")) {
      updateMultiSelectLabel(container, placeholder);
      onChange();
    }
  });
}

function activeLevels() {
  return {
    primary: togglePrimary.classList.contains("active"),
    secondary: toggleSecondary.classList.contains("active"),
  };
}

function filterFeatures(features, query, provinces, districts) {
  return features.filter((feature) => {
    const props = feature.properties || {};
    const name = normalize(props.Name);
    if (query && !name.includes(query)) return false;
    if (provinces.length && !provinces.includes(props.Province)) return false;
    if (districts.length && !districts.includes(props.District)) return false;
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
  const provinces = getSelectedValues(provinceSelect);
  const levels = activeLevels();
  const all = [
    ...(levels.primary ? primaryFeatures : []),
    ...(levels.secondary ? secondaryFeatures : []),
  ];
  const districts = all
    .filter((f) =>
      provinces.length ? provinces.includes(f.properties.Province) : true
    )
    .map((f) => f.properties.District)
    .filter(Boolean);
  const unique = [...new Set(districts)].sort();
  setMultiSelectOptions(districtSelect, unique, "All districts");
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
  const provinces = getSelectedValues(provinceSelect);
  const districts = getSelectedValues(districtSelect);

  primaryCluster.clearLayers();
  secondaryCluster.clearLayers();

  const filteredPrimary = primary
    ? filterFeatures(primaryFeatures, query, provinces, districts)
    : [];
  const filteredSecondary = secondary
    ? filterFeatures(secondaryFeatures, query, provinces, districts)
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

    const nameOptions = [
      ...new Set(
        [...primaryFeatures, ...secondaryFeatures]
          .map((f) => f.properties.Name)
          .filter(Boolean)
      ),
    ].sort();
    schoolNames.innerHTML = "";
    nameOptions.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      schoolNames.appendChild(option);
    });

    const provinces = [
      ...new Set(
        [...primaryFeatures, ...secondaryFeatures]
          .map((f) => f.properties.Province)
          .filter(Boolean)
      ),
    ].sort();
    setupMultiSelect(provinceSelect, "All provinces", () => {
      refreshDistrictOptions();
      applyFilters();
    });
    setupMultiSelect(districtSelect, "All districts", applyFilters);
    setMultiSelectOptions(provinceSelect, provinces, "All provinces");
    refreshDistrictOptions();
    applyFilters();
    loading.style.display = "none";
  })
  .catch((err) => {
    loading.textContent = "Failed to load school data.";
    console.error(err);
  });

searchInput.addEventListener("input", applyFilters);
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

clearFilters.addEventListener("click", () => {
  searchInput.value = "";
  provinceSelect
    .querySelectorAll("input[type='checkbox']")
    .forEach((input) => (input.checked = false));
  districtSelect
    .querySelectorAll("input[type='checkbox']")
    .forEach((input) => (input.checked = false));
  updateMultiSelectLabel(provinceSelect, "All provinces");
  updateMultiSelectLabel(districtSelect, "All districts");
  togglePrimary.classList.add("active");
  toggleSecondary.classList.add("active");
  refreshDistrictOptions();
  applyFilters();
});

map.on("moveend zoomend", () => {
  const provinces = getSelectedValues(provinceSelect);
  const districts = getSelectedValues(districtSelect);
  updateCounts(
    activeLevels().primary
      ? filterFeatures(
          primaryFeatures,
          normalize(searchInput.value),
          provinces,
          districts
        )
      : [],
    activeLevels().secondary
      ? filterFeatures(
          secondaryFeatures,
          normalize(searchInput.value),
          provinces,
          districts
        )
      : []
  );
});
