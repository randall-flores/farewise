// app/api/places/route.js
// Server-side proxy for airport/city autocomplete. The browser calls THIS route;
// the Duffel token never leaves the server (per the project's security rule).
import { searchPlaces } from "@/lib/duffel";
import { normalizePlaces } from "@/lib/normalize-duffel";

export async function GET(request) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim();

  // Don't bother Duffel for 1 character — too broad to be useful.
  if (q.length < 2) return Response.json({ places: [] });

  try {
    const raw = await searchPlaces(q);
    // A bit higher than before so a city plus its airports fit without being cut.
    return Response.json({ places: normalizePlaces(raw).slice(0, 8) });
  } catch (err) {
    console.error("places route error:", err);
    // Fail soft: an empty list just means "no suggestions", not a broken form.
    return Response.json({ places: [] });
  }
}
