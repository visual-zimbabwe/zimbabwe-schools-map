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
  spiderfyDistanceMultiplier: 1.2,
  maxClusterRadius: 50,
});

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
    const layer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 4,
          fillColor: "#1f78b4",
          color: "#0b3c5d",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.9,
        }),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(buildPopup(feature.properties));
      },
    });

    clusterLayer.addLayer(layer);
    map.addLayer(clusterLayer);

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
