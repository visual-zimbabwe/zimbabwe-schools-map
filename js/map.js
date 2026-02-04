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
const panelToggle = document.getElementById("panelToggle");
const mediaQuery = window.matchMedia(
  "(max-width: 900px), (hover: none) and (pointer: coarse)"
);

function updateBrowserUIInset() {
  if (!window.visualViewport) return;
  const chromeBottom = Math.max(
    0,
    window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop
  );
  document.documentElement.style.setProperty(
    "--chrome-bottom",
    `${chromeBottom}px`
  );
}

function setPanelCollapsed(collapsed) {
  document.body.classList.toggle("panel-collapsed", collapsed);
  if (panelToggle) {
    panelToggle.setAttribute("aria-expanded", String(!collapsed));
    panelToggle.textContent = collapsed ? "Filters" : "Hide filters";
  }
}

function syncPanelForViewport() {
  if (mediaQuery.matches) {
    if (!document.body.classList.contains("panel-init")) {
      document.body.classList.add("panel-init");
      setPanelCollapsed(true);
    }
  } else {
    document.body.classList.remove("panel-init");
    setPanelCollapsed(false);
  }
  updateBrowserUIInset();
}

let primaryFeatures = [];
let secondaryFeatures = [];
let currentFiltered = [];

function debounce(fn, delay) {
  let timerId;
  return (...args) => {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
}

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

  const actions = document.createElement("div");
  actions.className = "multi-actions";
  actions.innerHTML =
    '<button type="button" class="multi-action-btn" data-action="select-all">Select all</button>' +
    '<button type="button" class="multi-action-btn" data-action="clear-all">Clear</button>';
  menu.appendChild(actions);

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
  const labelEl = trigger.querySelector(".multi-label");
  const values = getSelectedValues(container);
  if (!values.length) {
    labelEl.textContent = placeholder;
    return;
  }
  const label =
    values.length === 1
      ? values[0]
      : `${values.length} selected`;
  labelEl.textContent = label;
}

function setupMultiSelect(container, placeholder, onChange) {
  const trigger = container.querySelector(".multi-trigger");
  const labelEl = trigger.querySelector(".multi-label");
  labelEl.textContent = placeholder;

  trigger.addEventListener("click", () => {
    container.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) {
      container.classList.remove("open");
    }
  });

  container.addEventListener("click", (event) => {
    const button = event.target.closest(".multi-action-btn");
    if (!button) return;
    const action = button.getAttribute("data-action");
    if (action === "select-all") {
      container
        .querySelectorAll("input[type='checkbox']")
        .forEach((input) => (input.checked = true));
    } else if (action === "clear-all") {
      container
        .querySelectorAll("input[type='checkbox']")
        .forEach((input) => (input.checked = false));
    }
    updateMultiSelectLabel(container, placeholder);
    onChange();
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
  updateInViewCount();
}

function updateInViewCount() {
  const bounds = map.getBounds();
  const inView = currentFiltered.filter((f) => {
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

  primaryCluster.addLayers(filteredPrimary.map((feature) => feature._marker));
  secondaryCluster.addLayers(
    filteredSecondary.map((feature) => feature._marker)
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

    primaryFeatures.forEach((feature) => {
      feature._marker = makeMarker(feature, true);
    });
    secondaryFeatures.forEach((feature) => {
      feature._marker = makeMarker(feature, false);
    });

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
    syncPanelForViewport();
  })
  .catch((err) => {
    loading.textContent = "Failed to load school data.";
    console.error(err);
  });

const debouncedApplyFilters = debounce(applyFilters, 200);

searchInput.addEventListener("input", debouncedApplyFilters);
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

if (panelToggle) {
  panelToggle.addEventListener("click", () => {
    const collapsed = document.body.classList.contains("panel-collapsed");
    setPanelCollapsed(!collapsed);
  });
}

mediaQuery.addEventListener("change", syncPanelForViewport);
syncPanelForViewport();
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateBrowserUIInset);
  window.visualViewport.addEventListener("scroll", updateBrowserUIInset);
}
updateBrowserUIInset();

map.on("moveend zoomend", () => {
  updateInViewCount();
});
