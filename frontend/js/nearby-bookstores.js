// =========================================
// Nearby Bookstores Feature
// =========================================

const bookstoresContainer =
    document.getElementById("bookstoresGrid");

const findStoresBtn =
    document.getElementById("findStoresBtn");

const locationStatus =
    document.getElementById("locationStatus");

let bookstoreMap = null;

let userMarker = null;

let storeMarkers = [];

// =========================================
// Mock Bookstore Data
// =========================================

const MOCK_BOOKSTORES = [

    {
        name: "City Book House",
        address: "MG Road, Bangalore",
        distance: "1.2 km",
        rating: 4.5,
        hours: "9 AM - 9 PM",
        lat: 12.975,
        lng: 77.605
    },

    {
        name: "Readers Point",
        address: "Brigade Road, Bangalore",
        distance: "2.4 km",
        rating: 4.2,
        hours: "10 AM - 8 PM",
        lat: 12.971,
        lng: 77.609
    },

    {
        name: "Book Haven",
        address: "Church Street, Bangalore",
        distance: "3.1 km",
        rating: 4.8,
        hours: "8 AM - 10 PM",
        lat: 12.973,
        lng: 77.611
    }

];

// =========================================
// Initialize Feature
// =========================================

window.addEventListener(
    "DOMContentLoaded",
    initializeNearbyBookstores
);

function initializeNearbyBookstores() {

    renderInitialState();

    setupEventListeners();

}

// =========================================
// Setup Events
// =========================================

function setupEventListeners() {

    if (!findStoresBtn) return;

    findStoresBtn.addEventListener(
        "click",
        handleFindStores
    );

    window.addEventListener(
        "resize",
        handleWindowResize
    );

}

// =========================================
// Handle Find Stores
// =========================================

function handleFindStores() {

    if (!navigator.geolocation) {

        showError(
            "Geolocation is not supported by your browser."
        );

        return;
    }

    if (!window.isSecureContext) {

        showError(
            "Location access requires HTTPS or localhost."
        );

        return;
    }

    setLoadingState();

    navigator.geolocation.getCurrentPosition(
        handleLocationSuccess,
        handleLocationError,
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );

}

// =========================================
// Success Handler
// =========================================

function handleLocationSuccess(position) {

    const latitude =
        position.coords.latitude;

    const longitude =
        position.coords.longitude;

    locationStatus.innerHTML = `

        <span class="location-success">

            Location detected successfully

        </span>

    `;

    initializeMap(latitude, longitude);

    renderBookstores(MOCK_BOOKSTORES);

    cacheLocation(latitude, longitude);

    findStoresBtn.disabled = false;

}

// =========================================
// Error Handler
// =========================================

function handleLocationError(error) {

    switch (error.code) {

        case error.PERMISSION_DENIED:

            showError(
                "Location permission denied."
            );

            break;

        case error.POSITION_UNAVAILABLE:

            showError(
                "Location information unavailable."
            );

            break;

        case error.TIMEOUT:

            showError(
                "Location request timed out."
            );

            break;

        default:

            showError(
                "Unable to retrieve your location."
            );

    }

}

// =========================================
// Loading State
// =========================================

function setLoadingState() {

    findStoresBtn.disabled = true;

    locationStatus.innerHTML = `

        <span class="location-status">

            Detecting your location...

        </span>

    `;

    bookstoresContainer.innerHTML = `

        <div class="bookstore-loading">

            Loading nearby bookstores...

        </div>

    `;

}

// =========================================
// Error State
// =========================================

function showError(message) {

    findStoresBtn.disabled = false;

    locationStatus.innerHTML = `

        <span class="location-error">

            ${message}

        </span>

    `;

    bookstoresContainer.innerHTML = `

        <div class="bookstore-empty">

            <p>
                Unable to load bookstores.
            </p>

            <button
                class="find-bookstore-btn"
                onclick="handleFindStores()"
            >
                Retry
            </button>

        </div>

    `;

}

// =========================================
// Initial State
// =========================================

function renderInitialState() {

    bookstoresContainer.innerHTML = `

        <div class="bookstore-empty">

            Click
            "Find Nearby Stores"
            to discover bookstores near you.

        </div>

    `;

}

// =========================================
// Render Bookstores
// =========================================

function renderBookstores(bookstores) {

    bookstoresContainer.innerHTML = "";

    clearStoreMarkers();

    bookstores.forEach(store => {

        const card =
            createBookstoreCard(store);

        bookstoresContainer.appendChild(card);

        addStoreMarker(store);

    });

}

// =========================================
// Create Card
// =========================================

function createBookstoreCard(store) {

    const card =
        document.createElement("div");

    card.classList.add(
        "bookstore-card",
        "fade-in"
    );

    card.innerHTML = `

        <div class="bookstore-name">

            ${store.name}

        </div>

        <div class="bookstore-address">

            ${store.address}

        </div>

        <div class="bookstore-meta">

            <div class="bookstore-distance">

                ${store.distance}

            </div>

            <div class="bookstore-rating">

                ⭐ ${store.rating}

            </div>

        </div>

        <div class="bookstore-hours">

            Open: ${store.hours}

        </div>

        <div class="bookstore-actions">

            <a
                href="https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}"
                target="_blank"
                class="bookstore-btn bookstore-btn-primary"
            >

                Directions

            </a>

            <button
                class="bookstore-btn bookstore-btn-secondary"
                onclick="focusStoreOnMap(${store.lat}, ${store.lng})"
            >

                View on Map

            </button>

        </div>

    `;

    return card;

}

// =========================================
// Initialize Map
// =========================================

function initializeMap(lat, lng) {

    const mapContainer =
        document.getElementById(
            "bookstoreMap"
        );

    if (!mapContainer) return;

    if (bookstoreMap) {

        bookstoreMap.remove();

    }

    bookstoreMap = L.map(
        "bookstoreMap"
    ).setView([lat, lng], 13);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(bookstoreMap);

    userMarker = L.marker([lat, lng])
        .addTo(bookstoreMap)
        .bindPopup("You are here")
        .openPopup();

    setTimeout(() => {

        bookstoreMap.invalidateSize();

    }, 200);

}

// =========================================
// Add Marker
// =========================================

function addStoreMarker(store) {

    if (!bookstoreMap) return;

    const marker = L.marker([
        store.lat,
        store.lng
    ])
    .addTo(bookstoreMap)
    .bindPopup(`

        <b>${store.name}</b><br>

        ${store.address}

    `);

    storeMarkers.push(marker);

}

// =========================================
// Clear Markers
// =========================================

function clearStoreMarkers() {

    if (!bookstoreMap) return;

    storeMarkers.forEach(marker => {

        bookstoreMap.removeLayer(marker);

    });

    storeMarkers = [];

}

// =========================================
// Focus Store On Map
// =========================================

function focusStoreOnMap(lat, lng) {

    if (!bookstoreMap) return;

    bookstoreMap.setView(
        [lat, lng],
        15
    );

}

// =========================================
// Resize Handler
// =========================================

function handleWindowResize() {

    if (!bookstoreMap) return;

    setTimeout(() => {

        bookstoreMap.invalidateSize();

    }, 200);

}

// =========================================
// Cache User Location
// =========================================

function cacheLocation(lat, lng) {

    const locationData = {

        lat,
        lng,
        timestamp: Date.now()

    };

    localStorage.setItem(
        "userLocation",
        JSON.stringify(locationData)
    );

}

// =========================================
// Load Cached Location
// =========================================

function loadCachedLocation() {

    const cached =
        localStorage.getItem(
            "userLocation"
        );

    if (!cached) return null;

    return JSON.parse(cached);

}