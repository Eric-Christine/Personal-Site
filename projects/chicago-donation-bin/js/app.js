import { ITEM_CATEGORIES, LOCATIONS as SEEDED_LOCATIONS, ZIP_COORDS } from "./locations.js";

const CHICAGO_CENTER = { lat: 41.8781, lng: -87.6298 };
const LOCAL_REPORTS_KEY = "chicago_dropoff_local_reports_v1";

const state = {
  locations: [],
  userCoords: CHICAGO_CENTER,
  selectedItems: [],
  selectedBinType: "all",
  selectedAccess: "all",
  selectedEnvironment: "all",
  openNowOnly: false,
  results: [],
  selectedLocationId: null,
};

const map = L.map("map", {
  zoomControl: true,
  scrollWheelZoom: true,
}).setView([CHICAGO_CENTER.lat, CHICAGO_CENTER.lng], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

const elements = {
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  nearMeButton: document.getElementById("nearMeButton"),
  itemFilters: document.getElementById("itemFilters"),
  binTypeFilter: document.getElementById("binTypeFilter"),
  accessFilter: document.getElementById("accessFilter"),
  environmentFilter: document.getElementById("environmentFilter"),
  openNowFilter: document.getElementById("openNowFilter"),
  resultsMeta: document.getElementById("resultsMeta"),
  resultsList: document.getElementById("resultsList"),
  detailCard: document.getElementById("detailCard"),
  detailStreetViewLink: document.getElementById("detailStreetViewLink"),
  detailStreetViewImage: document.getElementById("detailStreetViewImage"),
  detailName: document.getElementById("detailName"),
  detailAddress: document.getElementById("detailAddress"),
  detailInfo: document.getElementById("detailInfo"),
  detailItems: document.getElementById("detailItems"),
  detailRestrictions: document.getElementById("detailRestrictions"),
  detailHours: document.getElementById("detailHours"),
  detailLastVerified: document.getElementById("detailLastVerified"),
  detailDirections: document.getElementById("detailDirections"),
  detailReport: document.getElementById("detailReport"),
  reportDialog: document.getElementById("reportDialog"),
  reportForm: document.getElementById("reportForm"),
  reportLocationName: document.getElementById("reportLocationName"),
  reportType: document.getElementById("reportType"),
  reportNote: document.getElementById("reportNote"),
  cancelReport: document.getElementById("cancelReport"),
  toast: document.getElementById("toast"),
};

function initItemFilters() {
  const chips = ITEM_CATEGORIES.map(
    (item) => `
      <label class="chip">
        <input type="checkbox" value="${item.id}" />
        <span>${item.label}</span>
      </label>
    `
  ).join("");
  elements.itemFilters.insertAdjacentHTML("beforeend", chips);
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceMiles(from, to) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function getChicagoDayAndMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dayKey: values.weekday.toLowerCase().slice(0, 3),
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function parseHourRange(range) {
  if (!range || range.toLowerCase() === "closed") {
    return null;
  }

  const [start, end] = range.split("-");
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return {
    startMinutes: startHour * 60 + startMinute,
    endMinutes: endHour * 60 + endMinute,
  };
}

function isOpenNow(location) {
  const { dayKey, minutes } = getChicagoDayAndMinutes();
  const range = parseHourRange(location.hours[dayKey]);
  if (!range) {
    return false;
  }
  return minutes >= range.startMinutes && minutes <= range.endMinutes;
}

function locationMatchesFilters(location) {
  const matchesItems =
    state.selectedItems.length === 0 ||
    state.selectedItems.every((item) => location.acceptedItems.includes(item));

  const matchesBinType =
    state.selectedBinType === "all" || location.binType === state.selectedBinType;
  const matchesAccess =
    state.selectedAccess === "all" || location.accessType === state.selectedAccess;
  const matchesEnvironment =
    state.selectedEnvironment === "all" ||
    location.environmentType === state.selectedEnvironment;
  const matchesOpenNow = !state.openNowOnly || isOpenNow(location);

  return (
    matchesItems &&
    matchesBinType &&
    matchesAccess &&
    matchesEnvironment &&
    matchesOpenNow
  );
}

function formatHoursForToday(location) {
  const { dayKey } = getChicagoDayAndMinutes();
  const today = location.hours[dayKey] || "closed";
  return today.toLowerCase() === "closed" ? "Closed today" : `Today: ${today}`;
}

function formatDate(dateIso) {
  const date = dateIso.includes("T")
    ? new Date(dateIso)
    : new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapPinLabel(location) {
  const openText = isOpenNow(location) ? "Open now" : "Closed now";
  return `
    <strong>${location.name}</strong><br />
    ${location.address}<br />
    ${openText}<br />
    ${location.acceptedItems.slice(0, 3).join(", ")}
  `;
}

function directionsLink(location, useApple = false) {
  if (useApple) {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(location.address)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    location.address
  )}`;
}

function streetViewLink(location) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${location.lat},${location.lng}`;
}

function streetViewImageUrl(location, width = 640, height = 320) {
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${location.lat},${location.lng}`,
    fov: "82",
    pitch: "0",
    heading: "0",
  });
  return `/api/streetview?${params.toString()}`;
}

function streetViewMarkup(location, width = 420, height = 210) {
  const imageUrl = streetViewImageUrl(location, width, height);
  const hasImage = Boolean(imageUrl);
  const unavailableClass = hasImage ? "" : " streetview-unavailable";
  const imgMarkup = hasImage
    ? `<img
        class="streetview-image"
        src="${imageUrl}"
        alt="Street View of ${location.address}"
        loading="lazy"
      />`
    : "";
  return `
    <a class="streetview-frame${unavailableClass}" href="${streetViewLink(
      location
    )}" target="_blank" rel="noreferrer">
      ${imgMarkup}
      <span class="streetview-fallback">Street View unavailable for this address</span>
    </a>
  `;
}

function updateResults() {
  const withDistance = state.locations.map((location) => ({
    ...location,
    distanceMiles: distanceMiles(state.userCoords, { lat: location.lat, lng: location.lng }),
    openNow: isOpenNow(location),
  }));

  state.results = withDistance
    .filter(locationMatchesFilters)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  renderResults();
  renderMap();
  renderDetailCard();
}

function renderResults() {
  const resultCount = state.results.length;
  elements.resultsMeta.textContent =
    resultCount === 0
      ? "No matches found. Try fewer filters."
      : `${resultCount} match${resultCount === 1 ? "" : "es"} sorted by distance`;

  if (resultCount === 0) {
    elements.resultsList.innerHTML = `
      <article class="empty-state">
        <p>No locations match your current filters.</p>
        <p>Try toggling off "Open now" or selecting fewer donation categories.</p>
      </article>
    `;
    return;
  }

  elements.resultsList.innerHTML = state.results
    .map((location) => {
      const acceptsAllSelected =
        state.selectedItems.length === 0 ||
        state.selectedItems.every((item) => location.acceptedItems.includes(item));
      return `
      <article class="result-card">
        ${streetViewMarkup(location, 520, 260)}
        <h3>${location.name}</h3>
        <p class="result-org">${location.organization}</p>
        <p>${location.address}</p>
        <p class="meta-row">
          <span>${location.distanceMiles.toFixed(1)} mi</span>
          <span>${location.openNow ? "Open now" : "Closed now"}</span>
          <span>${acceptsAllSelected ? "Accepts your items" : "Partial match"}</span>
        </p>
        <p class="meta-row">
          <span>${location.binType.replace("_", " ")}</span>
          <span>${location.accessType}</span>
          <span>${location.environmentType}</span>
        </p>
        <p>${formatHoursForToday(location)}</p>
        <div class="card-actions">
          <button type="button" data-action="details" data-id="${location.id}">View details</button>
          <a href="${directionsLink(location)}" target="_blank" rel="noreferrer">Google Maps</a>
          <a href="${directionsLink(location, true)}" target="_blank" rel="noreferrer">Apple Maps</a>
          <button type="button" data-action="report" data-id="${location.id}" class="ghost">Report issue</button>
        </div>
      </article>
    `;
    })
    .join("");
}

function renderMap() {
  markerLayer.clearLayers();
  if (state.results.length === 0) {
    return;
  }

  const latLngBounds = [];
  state.results.forEach((location) => {
    const marker = L.marker([location.lat, location.lng]);
    marker.bindPopup(mapPinLabel(location));
    marker.on("click", () => {
      state.selectedLocationId = location.id;
      renderDetailCard();
    });
    markerLayer.addLayer(marker);
    latLngBounds.push([location.lat, location.lng]);
  });

  if (state.userCoords) {
    latLngBounds.push([state.userCoords.lat, state.userCoords.lng]);
    const icon = L.divIcon({
      className: "user-dot",
      html: "<span></span>",
      iconSize: [14, 14],
    });
    L.marker([state.userCoords.lat, state.userCoords.lng], { icon })
      .bindPopup("Your search center")
      .addTo(markerLayer);
  }

  map.fitBounds(latLngBounds, { padding: [30, 30], maxZoom: 13 });
}

function renderDetailCard() {
  const selectedLocation =
    state.results.find((location) => location.id === state.selectedLocationId) ||
    state.results[0];

  if (!selectedLocation) {
    elements.detailCard.classList.add("detail-card-hidden");
    return;
  }

  state.selectedLocationId = selectedLocation.id;
  elements.detailCard.classList.remove("detail-card-hidden");
  elements.detailCard.dataset.locationId = selectedLocation.id;
  const detailStreetViewUrl = streetViewImageUrl(selectedLocation, 960, 480);
  elements.detailStreetViewLink.href = streetViewLink(selectedLocation);
  elements.detailStreetViewImage.alt = `Street View of ${selectedLocation.address}`;
  if (detailStreetViewUrl) {
    elements.detailStreetViewLink.classList.remove("streetview-unavailable");
    elements.detailStreetViewImage.src = detailStreetViewUrl;
  } else {
    elements.detailStreetViewLink.classList.add("streetview-unavailable");
    elements.detailStreetViewImage.removeAttribute("src");
  }
  elements.detailName.textContent = selectedLocation.name;
  elements.detailAddress.textContent = selectedLocation.address;
  elements.detailInfo.textContent = `${selectedLocation.organization} • ${selectedLocation.binType.replace(
    "_",
    " "
  )} • ${selectedLocation.accessType} • ${selectedLocation.environmentType}`;
  elements.detailItems.textContent = `Accepts: ${selectedLocation.acceptedItems.join(", ")}`;
  elements.detailRestrictions.textContent = `Restrictions: ${selectedLocation.restrictions.join(
    "; "
  )}`;
  elements.detailHours.textContent = `Hours today: ${selectedLocation.hours[getChicagoDayAndMinutes().dayKey] || "closed"} (${selectedLocation.holidayNotes})`;
  const verifiedDateText = selectedLocation.lastVerifiedAt
    ? formatDate(selectedLocation.lastVerifiedAt)
    : "Unknown";
  const verifiedByText = selectedLocation.verifiedBy || "Unknown verifier";
  elements.detailLastVerified.textContent = `Last verified ${verifiedDateText} by ${verifiedByText}`;
  elements.detailDirections.href = directionsLink(selectedLocation);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("toast-visible");
  setTimeout(() => {
    elements.toast.classList.remove("toast-visible");
  }, 2600);
}

function saveReportToLocalFallback(reportPayload) {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    existing.unshift({
      ...reportPayload,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      source: "local-fallback",
    });
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(existing));
    return true;
  } catch {
    return false;
  }
}

function markStreetViewUnavailable(imageElement) {
  if (!(imageElement instanceof HTMLImageElement)) {
    return;
  }
  const frame = imageElement.closest(".streetview-frame");
  if (!frame) {
    return;
  }
  frame.classList.add("streetview-unavailable");
  imageElement.removeAttribute("src");
}

async function geocodeSearch(query) {
  const zip = query.trim();
  if (/^\d{5}$/.test(zip) && ZIP_COORDS[zip]) {
    return ZIP_COORDS[zip];
  }

  const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(
    `${query}, Chicago, Illinois`
  )}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error("Unable to geocode search input.");
  }
  const results = await response.json();
  if (results.length === 0) {
    throw new Error("No matching address found in Chicago.");
  }
  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
  };
}

async function loadLocationsFromApi() {
  const response = await fetch("/api/locations?status=active");
  if (!response.ok) {
    throw new Error("Unable to load location data.");
  }
  const payload = await response.json();
  const records = Array.isArray(payload.data) ? payload.data : [];
  return records;
}

async function submitReportToApi(reportPayload) {
  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(reportPayload),
    });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Static-host fallback handled below.
  }

  const stored = saveReportToLocalFallback(reportPayload);
  if (!stored) {
    throw new Error("Unable to submit issue report.");
  }
  return {
    data: {
      ...reportPayload,
      source: "local-fallback",
    },
  };
}

function syncFilterState() {
  state.selectedItems = Array.from(
    elements.itemFilters.querySelectorAll("input:checked")
  ).map((input) => input.value);
  state.selectedBinType = elements.binTypeFilter.value;
  state.selectedAccess = elements.accessFilter.value;
  state.selectedEnvironment = elements.environmentFilter.value;
  state.openNowOnly = elements.openNowFilter.checked;
}

function openReportDialog(locationId) {
  const location = state.locations.find((entry) => entry.id === locationId);
  if (!location) {
    return;
  }
  elements.reportDialog.dataset.locationId = location.id;
  elements.reportLocationName.textContent = location.name;
  elements.reportForm.reset();
  elements.reportDialog.showModal();
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = elements.searchInput.value.trim();
    if (!query) {
      showToast("Enter a ZIP or address to search.");
      return;
    }

    try {
      const coords = await geocodeSearch(query);
      state.userCoords = coords;
      updateResults();
      showToast("Search location updated.");
    } catch (error) {
      showToast(error.message || "Could not find that location.");
    }
  });

  elements.nearMeButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.userCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        updateResults();
        showToast("Showing closest drop-offs from your location.");
      },
      () => {
        showToast("Unable to access your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  elements.itemFilters.addEventListener("change", () => {
    syncFilterState();
    updateResults();
  });
  elements.binTypeFilter.addEventListener("change", () => {
    syncFilterState();
    updateResults();
  });
  elements.accessFilter.addEventListener("change", () => {
    syncFilterState();
    updateResults();
  });
  elements.environmentFilter.addEventListener("change", () => {
    syncFilterState();
    updateResults();
  });
  elements.openNowFilter.addEventListener("change", () => {
    syncFilterState();
    updateResults();
  });

  elements.resultsList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) {
      return;
    }
    if (action === "details") {
      state.selectedLocationId = id;
      renderDetailCard();
      return;
    }
    if (action === "report") {
      openReportDialog(id);
    }
  });

  elements.detailReport.addEventListener("click", () => {
    const locationId = elements.detailCard.dataset.locationId;
    if (locationId) {
      openReportDialog(locationId);
    }
  });

  elements.reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const locationId = elements.reportDialog.dataset.locationId;
    const location = state.locations.find((entry) => entry.id === locationId);
    if (!location) {
      return;
    }

    try {
      await submitReportToApi({
        locationId,
        locationName: location.name,
        reportType: elements.reportType.value,
        note: elements.reportNote.value.trim(),
      });
      elements.reportDialog.close();
      showToast("Issue report submitted. Thanks for helping verify data.");
      updateResults();
    } catch (error) {
      showToast(error.message || "Could not submit report right now.");
    }
  });

  elements.cancelReport.addEventListener("click", () => {
    elements.reportDialog.close();
  });

  document.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) {
        return;
      }
      if (!target.classList.contains("streetview-image")) {
        return;
      }
      markStreetViewUnavailable(target);
    },
    true
  );
}

async function init() {
  initItemFilters();
  bindEvents();
  try {
    state.locations = await loadLocationsFromApi();
  } catch {
    state.locations = SEEDED_LOCATIONS;
    showToast("Using bundled location data (API unavailable).");
  }
  updateResults();
}

init();
