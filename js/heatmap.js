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
const isFileProtocol = window.location.protocol === "file:";
let heatReady = false;
const HEAT_RADIUS_KM = 5;
const ZIMBABWE_BOUNDARY_SOURCES = [
  {
    type: "naturalearth",
    url: "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
  },
  {
    type: "geoboundaries",
    url: "https://www.geoboundaries.org/api/current/gbOpen/ZWE/ADM0/",
  },
  {
    type: "simplemaps",
    url: "https://simplemaps.com/static/svg/country/zw/all/zw.json",
  },
];

function primeWindowData() {
  if (window.PRIMARY_SCHOOLS && window.SECONDARY_SCHOOLS) {
    primaryFeatures = window.PRIMARY_SCHOOLS.features || [];
    secondaryFeatures = window.SECONDARY_SCHOOLS.features || [];
    return true;
  }
  return false;
}

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
      points.push([lat, lon, 0.2]);
    });
  }

  if (activeSecondary) {
    secondaryFeatures.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      points.push([lat, lon, 0.3]);
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
  if (!points.length) {
    if (heatLayer) {
      map.removeLayer(heatLayer);
      heatLayer = null;
    }
    updateStats();
    updateRanks();
    return;
  }
  const size = map.getSize();
  if (!size || size.y === 0 || size.x === 0) {
    return;
  }
  const heatOptions = {
    radius: heatRadiusPx(),
    blur: 8,
    maxZoom: 9,
    minOpacity: 0.28,
    max: 0.4,
    gradient: {
      0.0: "#07162c",
      0.3: "#0f3a5a",
      0.31: "#1f78b4",
      0.6: "#1f78b4",
      0.61: "#f2a93b",
      0.85: "#f2a93b",
      0.86: "#ffe09a",
      1.0: "#fff7c9",
    },
  };
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }
  heatLayer = L.heatLayer(points, heatOptions).addTo(map);
  updateStats();
  updateRanks();
}

function heatRadiusPx() {
  const zoom = map.getZoom();
  const lat = map.getCenter().lat;
  const metersPerPixel =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const px = (HEAT_RADIUS_KM * 1000) / metersPerPixel;
  return Math.max(6, Math.min(60, Math.round(px)));
}

function coordsToLatLngs(coords) {
  return coords.map(([lon, lat]) => [lat, lon]);
}

function extractRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(coordsToLatLngs);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) =>
      polygon.map(coordsToLatLngs)
    );
  }
  return [];
}

function addZimbabweMask(feature) {
  const rings = extractRings(feature.geometry);
  if (!rings.length) return;

  const outerRing = [
    [90, -180],
    [90, 180],
    [-90, 180],
    [-90, -180],
  ];

  const maskPane = map.createPane("maskPane");
  maskPane.style.zIndex = 450;

  const outlinePane = map.createPane("outlinePane");
  outlinePane.style.zIndex = 460;

  L.polygon([outerRing, ...rings], {
    pane: "maskPane",
    stroke: false,
    fillColor: "#0b1320",
    fillOpacity: 1,
  }).addTo(map);

  L.geoJSON(feature, {
    pane: "outlinePane",
    style: {
      color: "#0f172a",
      weight: 1.4,
      fillOpacity: 0,
    },
  }).addTo(map);
}

function normalizeBoundaryData(data) {
  if (!data) return null;
  if (data.type === "Feature") return data;
  if (data.type === "FeatureCollection" && data.features?.length) {
    return data.features[0];
  }
  return null;
}

function loadNaturalEarth() {
  return fetch(ZIMBABWE_BOUNDARY_SOURCES[0].url)
    .then((response) => {
      if (!response.ok) throw new Error("Natural Earth fetch failed.");
      return response.json();
    })
    .then((data) => {
      const feature =
        (data.features || []).find(
          (item) =>
            item.properties?.["ISO3166-1-Alpha-3"] === "ZWE" ||
            item.properties?.ISO3166_1_Alpha_3 === "ZWE" ||
            item.properties?.iso_a3 === "ZWE" ||
            item.properties?.ADMIN === "Zimbabwe" ||
            item.properties?.name === "Zimbabwe"
        ) || null;
      return feature;
    });
}

function loadGeoBoundaries() {
  return fetch(ZIMBABWE_BOUNDARY_SOURCES[1].url)
    .then((response) => {
      if (!response.ok) throw new Error("geoBoundaries metadata fetch failed.");
      return response.json();
    })
    .then((meta) => {
      const url = meta.gjDownloadURL || meta.simplifiedGeometryGeoJSON;
      if (!url) throw new Error("geoBoundaries download URL missing.");
      return fetch(url).then((response) => {
        if (!response.ok) throw new Error("geoBoundaries file fetch failed.");
        return response.json();
      });
    })
    .then(normalizeBoundaryData);
}

function loadSimpleMaps() {
  return fetch(ZIMBABWE_BOUNDARY_SOURCES[2].url)
    .then((response) => {
      if (!response.ok) throw new Error("SimpleMaps boundary fetch failed.");
      return response.json();
    })
    .then(normalizeBoundaryData);
}

function loadZimbabweBoundary() {
  loadNaturalEarth()
    .catch(() => loadGeoBoundaries())
    .catch(() => loadSimpleMaps())
    .then((feature) => {
      if (feature) addZimbabweMask(feature);
    })
    .catch((err) => {
      console.warn("Boundary mask not loaded.", err);
    });
}

function scheduleHeatLayer() {
  if (heatReady) return;
  heatReady = true;
  const attempt = () => {
    const size = map.getSize();
    if (!size || size.y === 0 || size.x === 0) {
      setTimeout(attempt, 60);
      return;
    }
    updateHeatLayer();
  };
  requestAnimationFrame(attempt);
}

function loadGeoJSON(url, fallback) {
  if (isFileProtocol && fallback) {
    return Promise.resolve(fallback);
  }
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
    primaryFeatures = (primary && primary.features) || primaryFeatures;
    secondaryFeatures = (secondary && secondary.features) || secondaryFeatures;
    if (!primaryFeatures.length && !secondaryFeatures.length) {
      loading.textContent =
        "No school data loaded. Use a local server or verify data files.";
      return;
    }
    map.whenReady(() => {
      map.invalidateSize();
      loadZimbabweBoundary();
      scheduleHeatLayer();
    });
    loading.style.display = "none";
  })
  .catch((err) => {
    loading.textContent = "Failed to load school data.";
    console.error(err);
  });

if (isFileProtocol && primeWindowData()) {
  updateStats();
  updateRanks();
  map.whenReady(() => {
    map.invalidateSize();
    loadZimbabweBoundary();
    scheduleHeatLayer();
  });
  loading.style.display = "none";
}

map.on("zoomend moveend", () => {
  if (!primaryFeatures.length && !secondaryFeatures.length) return;
  updateHeatLayer();
});

togglePrimary.addEventListener("click", () => {
  togglePrimary.classList.toggle("active");
  updateHeatLayer();
});

toggleSecondary.addEventListener("click", () => {
  toggleSecondary.classList.toggle("active");
  updateHeatLayer();
});
