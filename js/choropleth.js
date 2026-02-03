const ZIM_BOUNDS = [
  [-22.5, 25.2],
  [-15.3, 33.2],
];

const levelSelect = document.getElementById("levelSelect");
const visibleCountEl = document.getElementById("visibleCount");
const totalCountEl = document.getElementById("totalCount");
const legendEl = document.getElementById("legend");

const map = L.map("map", { zoomControl: false }).fitBounds(ZIM_BOUNDS);
L.control.zoom({ position: "topleft" }).addTo(map);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  { attribution: "&copy; OpenStreetMap contributors &copy; CARTO" }
).addTo(map);

let geoLayer = null;
let currentData = null;

const gradientStops = [
  "#0b1b3b",
  "#1f4e8c",
  "#3fb6c8",
  "#43b96b",
  "#f6d74b",
  "#f39c34",
];

function getCounts(feature) {
  const props = feature.properties || {};
  if (levelSelect.value === "primary") return props.primary_count || 0;
  if (levelSelect.value === "secondary") return props.secondary_count || 0;
  return props.total_count || 0;
}

function getPct(feature) {
  const props = feature.properties || {};
  if (levelSelect.value === "primary") return props.primary_pct || 0;
  if (levelSelect.value === "secondary") return props.secondary_pct || 0;
  return props.total_pct || 0;
}

function getBreaks(values) {
  if (!values.length) return [0, 1];
  const max = Math.max(...values);
  return [0, max];
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r, g, b) {
  const toHex = (v) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateColor(a, b, t) {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  const r = Math.round(ar.r + (br.r - ar.r) * t);
  const g = Math.round(ar.g + (br.g - ar.g) * t);
  const bVal = Math.round(ar.b + (br.b - ar.b) * t);
  return rgbToHex(r, g, bVal);
}

function colorFor(value, breaks) {
  const max = breaks[1] || 1;
  const t = Math.min(1, Math.max(0, value / max));
  const scaled = t * (gradientStops.length - 1);
  const idx = Math.floor(scaled);
  const localT = scaled - idx;
  const start = gradientStops[idx];
  const end = gradientStops[Math.min(idx + 1, gradientStops.length - 1)];
  return interpolateColor(start, end, localT);
}

function styleFeature(feature) {
  const value = getCounts(feature);
  const breaks = currentData.breaks;
  return {
    fillColor: colorFor(value, breaks),
    weight: 1,
    opacity: 0.8,
    color: "#ffffff",
    fillOpacity: 0.85,
  };
}

function buildLegend(breaks) {
  legendEl.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = "Share of schools (%)";
  legendEl.appendChild(title);

  const bar = document.createElement("div");
  bar.className = "legend-gradient";
  bar.style.background = `linear-gradient(90deg, ${gradientStops.join(",")})`;
  legendEl.appendChild(bar);

  const labels = document.createElement("div");
  labels.className = "legend-labels";
  const min = document.createElement("span");
  min.textContent = `${breaks[0].toFixed(1)}%`;
  const max = document.createElement("span");
  max.textContent = `${breaks[1].toFixed(1)}%`;
  labels.appendChild(min);
  labels.appendChild(max);
  legendEl.appendChild(labels);
}

function updateSummary(layer) {
  let total = 0;
  let visible = 0;
  layer.eachLayer((sub) => {
    const value = getCounts(sub.feature);
    total += value;
    if (map.getBounds().intersects(sub.getBounds())) {
      visible += 1;
    }
  });
  totalCountEl.textContent = total.toLocaleString();
  visibleCountEl.textContent = visible.toLocaleString();
}

function renderLayer(geojson) {
  if (geoLayer) {
    geoLayer.remove();
  }
  const values = geojson.features.map((feature) => getPct(feature));
  const breaks = getBreaks(values);
  currentData = { breaks };
  buildLegend(breaks);

  geoLayer = L.geoJSON(geojson, {
    style: styleFeature,
    onEachFeature: (feature, layer) => {
      const props = feature.properties || {};
      const total = props.total_count || 0;
      const primary = props.primary_count || 0;
      const secondary = props.secondary_count || 0;
      const pct = getPct(feature).toFixed(2);
      layer.bindTooltip(
        `<strong>${props.admin1_name}</strong><br/>Share: ${pct}%<br/>Total: ${total}<br/>Primary: ${primary}<br/>Secondary: ${secondary}`,
        { className: "custom-tooltip", sticky: true }
      );
      layer.on({
        mouseover: (event) => {
          event.target.setStyle({ weight: 2, color: "#0f172a" });
        },
        mouseout: (event) => {
          geoLayer.resetStyle(event.target);
        },
      });
    },
  }).addTo(map);

  updateSummary(geoLayer);
}

fetch("data/zw_admin1_schools.geojson")
  .then((response) => response.json())
  .then((geojson) => {
    renderLayer(geojson);
    levelSelect.addEventListener("change", () => renderLayer(geojson));
    map.on("moveend", () => updateSummary(geoLayer));
  })
  .catch((err) => {
    console.error("Failed to load choropleth:", err);
  });
