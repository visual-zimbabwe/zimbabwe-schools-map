const ZIM_BOUNDS = [
  [-22.5, 25.2],
  [-15.3, 33.2],
];

const map = L.map("map", { zoomControl: false, maxZoom: 10, minZoom: 6 }).fitBounds(
  ZIM_BOUNDS
);
L.control.zoom({ position: "topleft" }).addTo(map);
L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  { attribution: "&copy; OpenStreetMap contributors &copy; CARTO" }
).addTo(map);

const loading = document.getElementById("loading");
const totalCountEl = document.getElementById("totalCount");
const primaryCountEl = document.getElementById("primaryCount");
const secondaryCountEl = document.getElementById("secondaryCount");
const togglePrimary = document.getElementById("togglePrimary");
const toggleSecondary = document.getElementById("toggleSecondary");
const topZones = document.getElementById("topZones");
const bottomZones = document.getElementById("bottomZones");

let primaryFeatures = [];
let secondaryFeatures = [];
let heatLayer = null;

function normalize(value) {
  return String(value || "").trim();
}

function getActiveFeatures() {
  const activePrimary = togglePrimary.classList.contains("active");
  const activeSecondary = toggleSecondary.classList.contains("active");
  return [
    ...(activePrimary ? primaryFeatures : []),
    ...(activeSecondary ? secondaryFeatures : []),
  ];
}

function buildHeatPoints() {
  const activePrimary = togglePrimary.classList.contains("active");
  const activeSecondary = toggleSecondary.classList.contains("active");
  const points = [];

  if (activePrimary) {
    primaryFeatures.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      points.push([lat, lon, 0.85]);
    });
  }

  if (activeSecondary) {
    secondaryFeatures.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      points.push([lat, lon, 1.0]);
    });
  }

  return points;
}

function updateStats() {
  const activePrimary = togglePrimary.classList.contains("active");
  const activeSecondary = toggleSecondary.classList.contains("active");
  const primaryCount = activePrimary ? primaryFeatures.length : 0;
  const secondaryCount = activeSecondary ? secondaryFeatures.length : 0;
  const total = primaryCount + secondaryCount;

  totalCountEl.textContent = `${total.toLocaleString()} schools`;
  primaryCountEl.textContent = primaryCount.toLocaleString();
  secondaryCountEl.textContent = secondaryCount.toLocaleString();
}

function renderRankList(container, rows) {
  container.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("li");
    item.innerHTML = `<span>${row.name}</span><strong>${row.count.toLocaleString()}</strong>`;
    container.appendChild(item);
  });
}

function updateRanks() {
  const activeFeatures = getActiveFeatures();
  const counts = new Map();

  activeFeatures.forEach((feature) => {
    const province = normalize(feature.properties.Province);
    if (!province) return;
    counts.set(province, (counts.get(province) || 0) + 1);
  });

  const sorted = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const top = sorted.slice(0, 5);
  const bottom = sorted.slice(-5).reverse();

  renderRankList(topZones, top.length ? top : [{ name: "No data", count: 0 }]);
  renderRankList(
    bottomZones,
    bottom.length ? bottom : [{ name: "No data", count: 0 }]
  );
}

function updateHeatLayer() {
  const points = buildHeatPoints();
  if (heatLayer) {
    heatLayer.setLatLngs(points);
  } else {
    heatLayer = L.heatLayer(points, {
      radius: 34,
      blur: 26,
      maxZoom: 9,
      minOpacity: 0.32,
      gradient: {
        0.0: "#1b2a4a",
        0.35: "#2a6f97",
        0.65: "#f1c453",
        1.0: "#f0c04c",
      },
    }).addTo(map);
  }
  updateStats();
  updateRanks();
}

function loadGeoJSON(url, fallback) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`${url} -> ${response.status}`);
      return response.json();
    })
    .catch((err) => {
      if (fallback) return fallback;
      throw err;
    });
}

Promise.all([
  loadGeoJSON("data/primary_schools.geojson", window.PRIMARY_SCHOOLS),
  loadGeoJSON("data/secondary_schools.geojson", window.SECONDARY_SCHOOLS),
])
  .then(([primary, secondary]) => {
    primaryFeatures = primary.features || [];
    secondaryFeatures = secondary.features || [];
    updateHeatLayer();
    loading.style.display = "none";
  })
  .catch((err) => {
    loading.textContent = "Failed to load school data.";
    console.error(err);
  });

togglePrimary.addEventListener("click", () => {
  togglePrimary.classList.toggle("active");
  updateHeatLayer();
});

toggleSecondary.addEventListener("click", () => {
  toggleSecondary.classList.toggle("active");
  updateHeatLayer();
});
