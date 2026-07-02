"""geocode_place — resolve a place name to latitude/longitude/timezone.

Design rules (apply to every tool in this project):
  * NEVER raise. Always return a dict with "ok": True/False so the agent
    can react conversationally instead of the graph crashing.
  * Pure logic lives in `geocode_place_impl` (easy to unit-test);
    the LangChain @tool wrapper just delegates.

Uses OpenStreetMap Nominatim (free, no API key) via geopy, and
timezonefinder for the IANA timezone at those coordinates.
"""

from functools import lru_cache

from geopy.exc import GeocoderServiceError, GeocoderTimedOut
from geopy.geocoders import Nominatim
from langchain_core.tools import tool
from timezonefinder import TimezoneFinder

_geolocator = Nominatim(user_agent="astroagent-assignment", timeout=10)
_tzfinder = TimezoneFinder()


@lru_cache(maxsize=256)
def geocode_place_impl(place: str) -> dict:
    """Resolve `place` to coordinates + timezone. Cached, never raises."""
    place = (place or "").strip()
    if not place:
        return {"ok": False, "error": "empty_place", "message": "No place name was given."}
    if len(place) > 200:
        return {"ok": False, "error": "invalid_place", "message": "Place name is too long."}

    try:
        # Ask for up to 3 matches so we can detect ambiguity honestly.
        results = _geolocator.geocode(place, exactly_one=False, limit=3, addressdetails=True)
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        return {
            "ok": False,
            "error": "service_unavailable",
            "message": f"Geocoding service unreachable ({type(e).__name__}). Try again shortly.",
        }
    except Exception as e:  # absolute safety net — a tool must never raise
        return {"ok": False, "error": "unexpected", "message": str(e)[:200]}

    if not results:
        return {
            "ok": False,
            "error": "not_found",
            "message": f"Could not find a real place called '{place}'. Ask the user to check the spelling or give a nearby city.",
        }

    top = results[0]
    countries = {
        (r.raw.get("address", {}) or {}).get("country", "?") for r in results
    }
    timezone = _tzfinder.timezone_at(lat=top.latitude, lng=top.longitude)

    return {
        "ok": True,
        "place": top.address,
        "latitude": round(top.latitude, 5),
        "longitude": round(top.longitude, 5),
        "timezone": timezone or "UTC",
        # If matches span multiple countries, the agent should state its
        # assumption or ask the user which one they meant.
        "ambiguous": len(countries) > 1,
        "other_matches": [r.address for r in results[1:]] if len(countries) > 1 else [],
    }


@tool
def geocode_place(place: str) -> dict:
    """Resolve a place name (e.g. 'Jaipur, India') to latitude, longitude and
    IANA timezone. Required before computing a birth chart. If the result has
    ambiguous=true, tell the user which place you assumed or ask them to
    clarify. If ok=false, explain the problem warmly and ask for a valid place."""
    return geocode_place_impl(place)
