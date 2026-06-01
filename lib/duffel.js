// lib/duffel.js
// Server-only Duffel client. NEVER import into a client component — the token
// lives in .env.local and must never reach the browser.
//
// SEARCH ONLY. We create an offer request and read the offers back. We do NOT
// create orders / book anything — FareWise redirects users to book direct
// (per the project model). There is deliberately no order/payment code here.

const OFFER_REQUESTS_URL = "https://api.duffel.com/air/offer_requests?return_offers=true";

// Our form's cabin values -> Duffel's cabin_class values.
const CABIN_MAP = {
  economy: "economy",
  premium: "premium_economy",
  business: "business",
  first: "first",
};

export async function searchDuffel(search) {
  const token = process.env.DUFFEL_API_TOKEN;
  if (!token) {
    throw new Error("DUFFEL_API_TOKEN is not set. Add it to .env.local.");
  }

  // One slice for a one-way; add the return slice if a return date was given.
  const slices = [
    { origin: search.origin, destination: search.destination, departure_date: search.depart },
  ];
  if (search.returnDate) {
    slices.push({
      origin: search.destination,
      destination: search.origin,
      departure_date: search.returnDate,
    });
  }

  const body = {
    data: {
      slices,
      passengers: [{ type: "adult" }],
      cabin_class: CABIN_MAP[search.cabin] || "economy",
    },
  };

  const res = await fetch(OFFER_REQUESTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Duffel search failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  return json.data?.offers || [];
}
