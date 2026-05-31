/**
 * netlify/functions/bookstores-nearby.js
 * ----------------------------------------
 * Netlify serverless function that proxies the Google Places
 * Nearby Search API, keeping the API key server-side.
 *
 * Endpoint (via Netlify redirect):
 *   GET /api/v1/bookstores/nearby?lat=<float>&lng=<float>&radius=<int>
 *
 * Setup:
 *   1. Set GOOGLE_PLACES_API_KEY in Netlify → Site settings → Environment variables
 *   2. Add this redirect to netlify.toml:
 *
 *      [[redirects]]
 *        from = "/api/v1/bookstores/nearby"
 *        to   = "/.netlify/functions/bookstores-nearby"
 *        status = 200
 *
 * The function returns the same JSON shape as the Flask route so
 * the frontend works identically against both backends.
 */

const PLACES_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const MAX_RESULTS = 20;
const MAX_RADIUS  = 10000;
const MIN_RADIUS  = 500;
const DEFAULT_RADIUS = 5000;

function haversineM(lat1, lng1, lat2, lng2) {
  const R   = 6_371_000;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dphi = (lat2 - lat1) * Math.PI / 180;
  const dlam = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*" } };
  }

  const params = event.queryStringParameters || {};

  // Validate lat / lng
  const lat = parseFloat(params.lat);
  const lng = parseFloat(params.lng);
  if (isNaN(lat) || isNaN(lng)) {
    return json(400, { status: "error", message: "lat and lng are required numeric parameters." });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json(400, { status: "error", message: "lat or lng is out of valid range." });
  }

  let radius = parseInt(params.radius, 10);
  if (isNaN(radius)) radius = DEFAULT_RADIUS;
  radius = Math.max(MIN_RADIUS, Math.min(radius, MAX_RADIUS));

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[bookstores-nearby] GOOGLE_PLACES_API_KEY is not set");
    return json(503, { status: "error", message: "Bookstore search is not configured on this server." });
  }

  const url = new URL(PLACES_URL);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius",   String(radius));
  url.searchParams.set("type",     "book_store");
  url.searchParams.set("key",      apiKey);

  let placesResp;
  try {
    const res = await fetch(url.toString());
    placesResp = await res.json();
  } catch (err) {
    console.error("[bookstores-nearby] fetch error:", err);
    return json(502, { status: "error", message: "Could not reach the bookstore search service." });
  }

  const status = placesResp.status;
  if (status === "REQUEST_DENIED") return json(503, { status: "error", message: "API key issue — REQUEST_DENIED." });
  if (status === "OVER_QUERY_LIMIT") return json(429, { status: "error", message: "Search quota exceeded. Try again later." });
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    return json(502, { status: "error", message: `Places API returned: ${status}` });
  }

  const raw = (placesResp.results || []).slice(0, MAX_RESULTS);

  const bookstores = raw.map((place) => {
    const geom = place.geometry?.location || {};
    const pLat = geom.lat ?? null;
    const pLng = geom.lng ?? null;
    const distM = pLat !== null && pLng !== null
      ? Math.round(haversineM(lat, lng, pLat, pLng))
      : null;
    const oh = place.opening_hours;
    return {
      place_id:        place.place_id ?? null,
      name:            place.name ?? "Unknown bookstore",
      address:         place.vicinity ?? "",
      lat:             pLat,
      lng:             pLng,
      distance_m:      distM,
      rating:          place.rating ?? null,
      opening_hours:   oh && "open_now" in oh ? { open_now: oh.open_now } : null,
      google_maps_url: place.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
        : null,
    };
  });

  bookstores.sort((a, b) => {
    const da = a.distance_m ?? Infinity;
    const db = b.distance_m ?? Infinity;
    return da - db;
  });

  return json(200, {
    status:        "success",
    bookstores,
    count:         bookstores.length,
    radius_m:      radius,
    user_location: { lat, lng },
  });
};
