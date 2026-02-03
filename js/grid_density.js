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

const palette = ["#f5f3ef", "#f7d79b", "#f2c14e", "#e07a5f", "#5f0f40"];

function getCounts(feature) {
  const props = feature.properties || {};
  if (levelSelect.value === "primary") return props.primary_count || 0;
  if (levelSelect.value === "secondary") return props.secondary_count || 0;
  return props.total_count || 0;
}

function getBreaks(values) {
  if (!values.length) return [0, 1, 2, 3, 4];
  const max = Math.max(...values);
  const step = Math.max(1, Math.ceil(max / 4));
  return [0, step, step * 2, step * 3, step * 4];
}

function colorFor(value, breaks) {
  if (value <= breaks[1]) return palette[1];
  if (value <= breaks[2]) return palette[2];
  if (value <= breaks[3]) return palette[3];
  return palette[4];
}

function styleFeature(feature) {
  const value = getCounts(feature);
  const breaks = currentData.breaks;
  return {
    fillColor: colorFor(value, breaks),
    weight: 0.6,
    opacity: 0.7,
    color: "#ffffff",
    fillOpacity: 0.8,
  };
}

function buildLegend(breaks) {
  legendEl.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = "Schools per grid cell";
  legendEl.appendChild(title);

  const scale = document.createElement("div");
  scale.className = "legend-scale";
  for (let i = 0; i < 4; i += 1) {
    const item = document.createElement("div");
    item.className = "legend-item";
    const swatch = document.createElement("div");
    swatch.className = "legend-swatch";
    swatch.style.background = palette[i + 1];
    const label = document.createElement("div");
    const from = breaks[i] + 1;
    const to = breaks[i + 1];
    label.textContent = `${from} - ${to}`;
    item.appendChild(swatch);
    item.appendChild(label);
    scale.appendChild(item);
  }
  legendEl.appendChild(scale);
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
  const values = geojson.features.map((feature) => getCounts(feature));
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
      layer.bindTooltip(
        `<strong>Grid cell</strong><br/>Total: ${total}<br/>Primary: ${primary}<br/>Secondary: ${secondary}`,
        { className: "custom-tooltip", sticky: true }
      );
      layer.on({
        mouseover: (event) => {
          event.target.setStyle({ weight: 1.2, color: "#0f172a" });
        },
        mouseout: (event) => {
          geoLayer.resetStyle(event.target);
        },
      });
    },
  }).addTo(map);

  updateSummary(geoLayer);
}

fetch("data/zw_grid_density.geojson")
  .then((response) => response.json())
  .then((geojson) => {
    renderLayer(geojson);
    levelSelect.addEventListener("change", () => renderLayer(geojson));
    map.on("moveend", () => updateSummary(geoLayer));
  })
  .catch((err) => {
    console.error("Failed to load grid density:", err);
  });
