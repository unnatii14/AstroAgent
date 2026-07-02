"""compute_birth_chart - real planetary positions via Swiss Ephemeris.

Uses pyswisseph with the built-in Moshier ephemeris (FLG_MOSEPH): no external
data files needed, accuracy well within our eval tolerance (+-1 deg; Moshier is
accurate to arcseconds for planets).

Same contract as every tool: returns {"ok": bool, ...}, never raises.
If birth time is unknown, computes planet-in-sign only (noon chart) and says
so - it does NOT invent an ascendant or houses, since those need exact time.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

import swisseph as swe
from langchain_core.tools import tool
from timezonefinder import TimezoneFinder

_tzfinder = TimezoneFinder()

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

PLANETS = {
    "sun": swe.SUN, "moon": swe.MOON, "mercury": swe.MERCURY,
    "venus": swe.VENUS, "mars": swe.MARS, "jupiter": swe.JUPITER,
    "saturn": swe.SATURN, "uranus": swe.URANUS, "neptune": swe.NEPTUNE,
    "pluto": swe.PLUTO, "north_node": swe.MEAN_NODE,
}

FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED


def _sign_of(lon: float) -> dict:
    return {"sign": SIGNS[int(lon // 30) % 12], "degree_in_sign": round(lon % 30, 2)}


def _house_of(lon: float, cusps: list) -> int:
    """Which of the 12 houses (1-12) a longitude falls in."""
    for i in range(12):
        start, end = cusps[i], cusps[(i + 1) % 12]
        if start <= end:
            if start <= lon < end:
                return i + 1
        else:  # house spans 0 deg Aries
            if lon >= start or lon < end:
                return i + 1
    return 1  # unreachable, but never crash


def validate_birth_input(date: str, time: str | None) -> tuple[datetime | None, str | None]:
    """Parse and sanity-check. Returns (datetime, None) or (None, error_message)."""
    try:
        if time:
            dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
        else:
            dt = datetime.strptime(date, "%Y-%m-%d").replace(hour=12, minute=0)
    except ValueError:
        return None, (
            f"'{date}' + '{time}' is not a valid date/time. It may be an impossible "
            "date (like February 30th) or a formatting problem. Expected YYYY-MM-DD and HH:MM."
        )
    now = datetime.now()
    if dt > now:
        return None, f"The birth date {date} is in the future - please ask the user to double-check."
    if dt.year < 1500:
        return None, f"Year {dt.year} is outside the supported range (1500 onwards)."
    return dt, None


def compute_birth_chart_impl(
    date: str,
    time: str | None,
    latitude: float,
    longitude: float,
    timezone: str | None = None,
) -> dict:
    """Compute natal chart. Never raises."""
    try:
        dt_local, err = validate_birth_input(date, time)
        if err:
            return {"ok": False, "error": "invalid_birth_data", "message": err}

        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            return {"ok": False, "error": "invalid_coordinates",
                    "message": f"Coordinates ({latitude}, {longitude}) are out of range."}

        # Self-heal a missing timezone: derive it from the coordinates.
        if not timezone:
            timezone = _tzfinder.timezone_at(lat=latitude, lng=longitude) or "UTC"

        try:
            tzinfo = ZoneInfo(timezone)
        except Exception:
            try:
                ZoneInfo("Asia/Kolkata")  # known-valid name: if THIS fails, the tz database itself is missing
                return {"ok": False, "error": "invalid_timezone",
                        "message": f"Unknown timezone '{timezone}'. Geocode the place first."}
            except Exception:
                return {"ok": False, "error": "tzdata_missing",
                        "message": "The timezone database is unavailable on this system. "
                                   "Fix: pip install tzdata, then restart the server."}
        dt_utc = dt_local.replace(tzinfo=tzinfo).astimezone(ZoneInfo("UTC"))

        jd = swe.julday(
            dt_utc.year, dt_utc.month, dt_utc.day,
            dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600,
        )

        planets = {}
        for name, pid in PLANETS.items():
            (lon, _lat, _dist, speed, *_), _ = swe.calc_ut(jd, pid, FLAGS)
            planets[name] = {
                "longitude": round(lon, 2),
                **_sign_of(lon),
                "retrograde": speed < 0,
            }

        chart = {
            "ok": True,
            "utc_datetime": dt_utc.strftime("%Y-%m-%d %H:%M UTC"),
            "timezone_used": timezone,
            "time_known": time is not None,
            "planets": planets,
        }

        if time is not None:
            cusps, ascmc = swe.houses(jd, latitude, longitude, b"P")  # Placidus
            cusps = list(cusps[:12])
            asc, mc = ascmc[0], ascmc[1]
            chart["ascendant"] = {"longitude": round(asc, 2), **_sign_of(asc)}
            chart["midheaven"] = {"longitude": round(mc, 2), **_sign_of(mc)}
            for p in planets.values():
                p["house"] = _house_of(p["longitude"], cusps)
        else:
            chart["note"] = (
                "Birth time unknown: positions computed for local noon. Signs are "
                "reliable (Moon may be off if near a sign change), but ascendant and "
                "houses CANNOT be determined - do not state them."
            )

        return chart

    except Exception as e:  # absolute safety net
        return {"ok": False, "error": "unexpected", "message": str(e)[:200]}


@tool
def compute_birth_chart(date: str, time: str | None, latitude: float, longitude: float, timezone: str | None = None) -> dict:
    """Compute a natal birth chart from real ephemeris data. Requires the place
    to be geocoded first (pass latitude, longitude and timezone exactly as
    returned by geocode_place). `date` is YYYY-MM-DD; `time` is HH:MM 24h local
    time, or null if unknown. If timezone is omitted it is derived from the
    coordinates. Returns planetary positions, signs, houses, ascendant and
    midheaven. If ok=false, relay the problem warmly and ask the user to fix it."""
    return compute_birth_chart_impl(date, time, latitude, longitude, timezone)
