"""get_daily_transits — where the planets are on a given date, and how they
aspect the user's natal chart.

Positions come from the same Swiss Ephemeris as the natal chart (FLG_MOSEPH).
Aspects use standard angles with a tight 3° orb for transits.
Contract: returns {"ok": bool, ...}, never raises.
"""

from datetime import datetime

import swisseph as swe
from langchain_core.tools import tool

from .chart import FLAGS, PLANETS, _sign_of

ASPECTS = {
    "conjunction": 0, "sextile": 60, "square": 90, "trine": 120, "opposition": 180,
}
ORB = 3.0  # degrees


def _angle_diff(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def get_daily_transits_impl(date: str | None = None, natal_longitudes: dict | None = None) -> dict:
    """Transit positions for `date` (default: today), plus aspects to natal points."""
    try:
        if date:
            try:
                dt = datetime.strptime(date, "%Y-%m-%d")
            except ValueError:
                return {"ok": False, "error": "invalid_date",
                        "message": f"'{date}' is not a valid YYYY-MM-DD date."}
        else:
            dt = datetime.utcnow()

        if abs(dt.year - datetime.utcnow().year) > 5:
            return {"ok": False, "error": "date_out_of_range",
                    "message": "Transits are meant for dates near today (within ~5 years)."}

        jd = swe.julday(dt.year, dt.month, dt.day, 12.0)  # noon UTC snapshot

        transits = {}
        for name, pid in PLANETS.items():
            (lon, _lat, _dist, speed, *_), _ = swe.calc_ut(jd, pid, FLAGS)
            transits[name] = {
                "longitude": round(lon, 2),
                **_sign_of(lon),
                "retrograde": speed < 0,
            }

        result = {
            "ok": True,
            "date": dt.strftime("%Y-%m-%d"),
            "transits": transits,
        }

        # Relate to the natal chart if provided
        if natal_longitudes:
            aspects = []
            for t_name, t in transits.items():
                for n_name, n_lon in natal_longitudes.items():
                    try:
                        n_lon = float(n_lon)
                    except (TypeError, ValueError):
                        continue
                    for a_name, a_angle in ASPECTS.items():
                        orb = abs(_angle_diff(t["longitude"], n_lon) - a_angle)
                        if orb <= ORB:
                            aspects.append({
                                "transit": t_name, "aspect": a_name,
                                "natal": n_name, "orb": round(orb, 2),
                            })
            aspects.sort(key=lambda a: a["orb"])
            result["aspects_to_natal"] = aspects[:10]  # tightest 10, keep payload small
            if not aspects:
                result["aspects_to_natal"] = []
                result["note"] = "No tight aspects (within 3°) to natal points today — a quieter sky."

        return result

    except Exception as e:  # absolute safety net
        return {"ok": False, "error": "unexpected", "message": str(e)[:200]}


@tool
def get_daily_transits(date: str | None = None, natal_longitudes: dict | None = None) -> dict:
    """Get planetary transits for a date (YYYY-MM-DD; omit for today). Pass
    `natal_longitudes` as {planet_name: longitude} from a computed birth chart
    to also get the aspects between today's sky and the user's natal chart —
    always do this when the user's chart is known, it makes readings personal.
    If ok=false, relay the problem warmly."""
    return get_daily_transits_impl(date, natal_longitudes)
