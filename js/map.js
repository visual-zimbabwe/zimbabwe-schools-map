/* global L */
const ZIMBABWE_CENTER = [-19.0154, 29.1549];
const INITIAL_ZOOM = 6;
const ZIMBABWE_BOUNDS = [
  [-22.45, 25.24], // southwest
  [-15.6, 33.05], // northeast
];

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
  maxBounds: ZIMBABWE_BOUNDS,
  maxBoundsViscosity: 1.0,
}).setView(ZIMBABWE_CENTER, INITIAL_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  minZoom: 6,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const clusterLayer = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyDistanceMultiplier: 1.2,
  maxClusterRadius: 50,
});

const maskPane = map.createPane("maskPane");
maskPane.style.zIndex = 650;
maskPane.style.pointerEvents = "none";

const boundaryPane = map.createPane("boundaryPane");
boundaryPane.style.zIndex = 651;
boundaryPane.style.pointerEvents = "none";

function lngLatToLatLng(coords) {
  return coords.map((c) => [c[1], c[0]]);
}

function extractHoles(geometry) {
  const holes = [];
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates || [];
    if (rings.length > 0) {
      holes.push(lngLatToLatLng(rings[0]));
    }
  } else if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates || [];
    polys.forEach((poly) => {
      if (poly.length > 0) {
        holes.push(lngLatToLatLng(poly[0]));
      }
    });
  }
  return holes;
}

function extractBoundaryRings(geometry) {
  const rings = [];
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates || [];
    if (coords.length > 0) {
      rings.push(lngLatToLatLng(coords[0]));
    }
  } else if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates || [];
    polys.forEach((poly) => {
      if (poly.length > 0) {
        rings.push(lngLatToLatLng(poly[0]));
      }
    });
  }
  return rings;
}

function createClipPath(boundaryFeature) {
  const svgLayer = L.svg({ pane: "boundaryPane" }).addTo(map);
  const svg = svgLayer._container;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
  clip.setAttribute("id", "zw-clip");
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  clip.appendChild(path);
  defs.appendChild(clip);
  svg.appendChild(defs);

  const rings = extractBoundaryRings(boundaryFeature.geometry);

  function updatePath() {
    const parts = rings.map((ring) => {
      const pts = ring.map((latlng) => map.latLngToLayerPoint(latlng));
      return pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
        .join(" ") + " Z";
    });
    path.setAttribute("d", parts.join(" "));
  }

  updatePath();
  map.on("zoomend moveend", updatePath);

  const tilePane = map.getPane("tilePane");
  tilePane.style.clipPath = "url(#zw-clip)";
  tilePane.style.webkitClipPath = "url(#zw-clip)";
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

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`${url} -> ${response.status}`);
    }
    return response.json();
  });
}

const boundaryPromise = window.ZIMBABWE_BOUNDARY
  ? Promise.resolve(window.ZIMBABWE_BOUNDARY)
  : fetchJson("data/zimbabwe_boundary.geojson");
const schoolsPromise = fetchJson("data/secondary_schools.geojson");

Promise.allSettled([boundaryPromise, schoolsPromise])
  .then((results) => {
    const boundaryResult = results[0];
    const schoolsResult = results[1];

    if (boundaryResult.status === "fulfilled") {
      const boundaryGeo = boundaryResult.value;
      const boundaryFeature = boundaryGeo.features[0];
      createClipPath(boundaryFeature);

      // Mask outside Zimbabwe
      const worldRing = [
        [90, -180],
        [90, 180],
        [-90, 180],
        [-90, -180],
      ];
      const holes = extractHoles(boundaryFeature.geometry);
      const mask = L.polygon([worldRing, ...holes], {
        stroke: false,
        fillColor: "#ffffff",
        fillOpacity: 1,
        interactive: false,
        pane: "maskPane",
      });
      mask.addTo(map);

      try {
        const boundaryLayer = L.geoJSON(boundaryGeo);
        map.fitBounds(boundaryLayer.getBounds(), { padding: [16, 16] });
      } catch (err) {
        // fallback to default view
      }
    }

    if (schoolsResult.status === "fulfilled") {
      const schoolsGeo = schoolsResult.value;
      const schoolsLayer = L.geoJSON(schoolsGeo, {
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

      clusterLayer.addLayer(schoolsLayer);
      map.addLayer(clusterLayer);
    } else {
      // eslint-disable-next-line no-console
      console.error("Failed to load school data:", schoolsResult.reason);
    }
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load map data:", err);
  });
