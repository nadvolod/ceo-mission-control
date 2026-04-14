#!/usr/bin/env python3
"""
Garmin Connect → Dashboard API sync script.

Usage:
  # First-time authentication (saves tokens to ~/.garth/):
  python3 garmin-sync.py --login

  # Sync last 7 days (default):
  python3 garmin-sync.py --api-key <key>

  # Sync last 14 days to a custom API:
  python3 garmin-sync.py --days 14 --api-url https://my-dashboard.com/api/garmin --api-key <key>

Environment variables:
  GARMIN_EMAIL    - Garmin Connect email (used with --login)
  GARMIN_PASSWORD - Garmin Connect password (used with --login)
  SYNC_API_KEY    - Dashboard API key (overridden by --api-key flag)
"""

import argparse
import json
import logging
import os
import sys
from datetime import date, timedelta, datetime, timezone

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Garmin helpers
# ---------------------------------------------------------------------------

def garmin_login(email: str, password: str) -> None:
    """Perform interactive first-time Garmin Connect login and persist tokens."""
    try:
        import garth
    except ImportError:
        log.error("garth is not installed. Run: pip install garth>=0.4.0")
        sys.exit(1)

    log.info("Logging in to Garmin Connect as %s …", email)
    garth.login(email, password)
    garth.save("~/.garth")
    log.info("Tokens saved to ~/.garth/. Future syncs will use these tokens.")


def get_garth_client():
    """Return an authenticated garth client, loading tokens from ~/.garth/."""
    try:
        import garth
    except ImportError:
        log.error("garth is not installed. Run: pip install garth>=0.4.0")
        sys.exit(1)

    token_dir = os.path.expanduser("~/.garth")
    if not os.path.isdir(token_dir):
        log.error(
            "No saved Garmin tokens found at %s. "
            "Run the script with --login first.",
            token_dir,
        )
        sys.exit(1)

    garth.resume(token_dir)
    return garth


def connectapi(garth_client, path: str):
    """Call the Garmin Connect API and return parsed JSON (or None on error)."""
    try:
        return garth_client.connectapi(path)
    except Exception as exc:
        log.warning("Garmin API call failed for %s: %s", path, exc)
        return None


# ---------------------------------------------------------------------------
# Per-metric fetchers
# ---------------------------------------------------------------------------


def _to_hhmm(value) -> str:
    """Convert an epoch-ms timestamp, ISO string, or existing HH:MM to HH:MM format."""
    if value is None:
        return ""
    s = str(value).strip()
    # Already in HH:MM format
    if len(s) == 5 and s[2] == ":":
        return s
    # Epoch milliseconds (numeric or numeric string)
    try:
        epoch_ms = int(s)
        dt = datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc)
        return dt.strftime("%H:%M")
    except (ValueError, TypeError, OSError):
        pass
    # ISO 8601 string (e.g. "2026-04-13T22:30:00.000")
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            continue
    # Fallback: return as-is (best effort)
    log.warning("Could not parse sleep timestamp to HH:MM: %s", value)
    return s


def fetch_sleep(garth_client, date_str: str) -> dict:
    """Fetch sleep data for the given date."""
    data = connectapi(
        garth_client,
        f"/wellness-service/wellness/dailySleepData/{date_str}",
    )
    if not data:
        return {}

    daily = data.get("dailySleepDTO", data)  # some responses wrap in dailySleepDTO
    scores = data.get("sleepScores") or daily.get("sleepScores") or {}

    def seconds_to_minutes(val):
        if val is None:
            return None
        try:
            return round(int(val) / 60)
        except (TypeError, ValueError):
            return None

    sleep_time = daily.get("sleepTimeSeconds")
    deep = daily.get("deepSleepSeconds")
    light = daily.get("lightSleepSeconds")
    rem = daily.get("remSleepSeconds")
    awake = daily.get("awakeSleepSeconds")
    score = scores.get("overallScore") if isinstance(scores, dict) else None

    result = {}
    if score is not None:
        result["sleepScore"] = score
    if sleep_time is not None:
        result["sleepDurationMinutes"] = seconds_to_minutes(sleep_time)
    if deep is not None:
        result["deepSleepMinutes"] = seconds_to_minutes(deep)
    if light is not None:
        result["lightSleepMinutes"] = seconds_to_minutes(light)
    if rem is not None:
        result["remSleepMinutes"] = seconds_to_minutes(rem)
    if awake is not None:
        result["awakeDuringMinutes"] = seconds_to_minutes(awake)

    # Optional start/end times — normalize to HH:MM format
    start = daily.get("sleepStartTimestampGMT") or daily.get("sleepStartTimestampLocal")
    end = daily.get("sleepEndTimestampGMT") or daily.get("sleepEndTimestampLocal")
    if start:
        result["sleepStartTime"] = _to_hhmm(start)
    if end:
        result["sleepEndTime"] = _to_hhmm(end)

    return result


def fetch_resting_hr(garth_client, date_str: str) -> dict:
    """Fetch resting heart rate for the given date."""
    data = connectapi(
        garth_client,
        f"/usersummary-service/stats/heartRate/daily/{date_str}/{date_str}",
    )
    if not data:
        return {}

    # Response is a list; take the first item
    items = data if isinstance(data, list) else [data]
    if not items:
        return {}

    first = items[0]
    value = first.get("value") or {}
    rhr = value.get("restingHeartRate") if isinstance(value, dict) else None
    if rhr is None:
        # flat response shape
        rhr = first.get("restingHeartRate")

    if rhr is not None:
        return {"restingHeartRate": rhr}
    return {}


def fetch_hrv(garth_client, date_str: str) -> dict:
    """Fetch HRV status for the given date."""
    data = connectapi(garth_client, f"/hrv-service/hrv/{date_str}")
    if not data:
        return {}

    summary = data.get("hrvSummary") or {}
    weekly_avg = summary.get("weeklyAvg")
    if weekly_avg is not None:
        return {"hrvStatus": weekly_avg}
    return {}


def fetch_stress_and_steps(garth_client, date_str: str) -> dict:
    """Fetch stress level, steps, and active minutes from the daily user summary."""
    data = connectapi(
        garth_client,
        f"/usersummary-service/usersummary/daily/{date_str}",
    )
    if not data:
        return {}

    result = {}
    stress = data.get("averageStressLevel")
    steps = data.get("totalSteps")
    moderate = data.get("moderateIntensityMinutes")
    vigorous = data.get("vigorousIntensityMinutes")

    if stress is not None:
        result["averageStressLevel"] = stress
    if steps is not None:
        result["steps"] = steps
    if moderate is not None or vigorous is not None:
        result["activeMinutes"] = (moderate or 0) + (vigorous or 0)

    return result


def fetch_body_battery(garth_client, date_str: str) -> dict:
    """Fetch body battery high/low for the given date."""
    data = connectapi(
        garth_client,
        f"/wellness-service/wellness/bodyBattery/dates/{date_str}/{date_str}",
    )
    if not data:
        return {}

    readings = data if isinstance(data, list) else []
    charged_values = [
        r.get("charged") for r in readings if r.get("charged") is not None
    ]
    if not charged_values:
        return {}

    return {
        "bodyBatteryHigh": max(charged_values),
        "bodyBatteryLow": min(charged_values),
    }


def fetch_weight(garth_client, date_str: str) -> dict:
    """Fetch weight for the given date (converts grams → lbs)."""
    data = connectapi(
        garth_client,
        f"/weight-service/weight/dateRange/{date_str}/{date_str}",
    )
    if not data:
        return {}

    items = data if isinstance(data, list) else []
    if not items:
        return {}

    last = items[-1]
    weight_grams = last.get("weight")
    if weight_grams is not None:
        try:
            weight_lbs = round(float(weight_grams) / 453.592, 1)
            return {"weight": weight_lbs}
        except (TypeError, ValueError):
            pass

    return {}


# ---------------------------------------------------------------------------
# Core sync logic
# ---------------------------------------------------------------------------

FETCHERS = [
    ("sleep", fetch_sleep),
    ("restingHR", fetch_resting_hr),
    ("hrv", fetch_hrv),
    ("stressAndSteps", fetch_stress_and_steps),
    ("bodyBattery", fetch_body_battery),
    ("weight", fetch_weight),
]


def build_day_metrics(garth_client, date_obj: date) -> dict:
    """Aggregate all metrics for a single date into one dict."""
    date_str = date_obj.isoformat()
    metrics = {"date": date_str, "syncedAt": datetime.now(timezone.utc).isoformat()}

    for name, fetcher in FETCHERS:
        try:
            result = fetcher(garth_client, date_str)
            metrics.update(result)
            if result:
                log.debug("  [%s] %s: %s", date_str, name, result)
            else:
                log.debug("  [%s] %s: no data", date_str, name)
        except Exception as exc:
            log.warning("[%s] %s fetch error (skipping): %s", date_str, name, exc)

    return metrics


def post_metrics(api_url: str, api_key: str, metrics_list: list) -> bool:
    """POST the collected metrics to the dashboard API. Returns True on success."""
    payload = {"action": "sync", "metrics": metrics_list}
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-sync-api-key"] = api_key

    try:
        resp = requests.post(api_url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        log.info("POST %s → %d", api_url, resp.status_code)
        try:
            log.debug("Response body: %s", resp.json())
        except ValueError:
            log.debug("Response body: %s", resp.text[:200])
        return True
    except requests.exceptions.Timeout:
        log.error("Request to %s timed out.", api_url)
    except requests.exceptions.ConnectionError as exc:
        log.error("Connection error posting to %s: %s", api_url, exc)
    except requests.exceptions.HTTPError as exc:
        log.error(
            "HTTP error posting to %s: %s — response: %s",
            api_url,
            exc,
            exc.response.text[:500] if exc.response is not None else "N/A",
        )
    except Exception as exc:
        log.error("Unexpected error posting to %s: %s", api_url, exc)

    return False


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Sync Garmin health data to the CEO Mission Control dashboard API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--login",
        action="store_true",
        help=(
            "Perform first-time Garmin Connect authentication. "
            "Reads GARMIN_EMAIL and GARMIN_PASSWORD from environment."
        ),
    )
    def positive_int(value):
        ivalue = int(value)
        if ivalue <= 0:
            raise argparse.ArgumentTypeError(f"--days must be a positive integer, got {value}")
        return ivalue

    parser.add_argument(
        "--days",
        type=positive_int,
        default=7,
        metavar="N",
        help="Number of past days to sync (default: 7). Must be positive.",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:3000/api/garmin",
        help="Dashboard API endpoint URL (default: http://localhost:3000/api/garmin).",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="API key for the dashboard (falls back to SYNC_API_KEY env var).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and print metrics as JSON without posting to the API.",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose/debug logging.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # --login flow
    if args.login:
        email = os.environ.get("GARMIN_EMAIL")
        password = os.environ.get("GARMIN_PASSWORD")
        if not email:
            log.error("GARMIN_EMAIL environment variable is not set.")
            sys.exit(1)
        if not password:
            log.error("GARMIN_PASSWORD environment variable is not set.")
            sys.exit(1)
        garmin_login(email, password)
        return

    # Resolve API key
    api_key = args.api_key or os.environ.get("SYNC_API_KEY", "")
    if not api_key:
        log.warning(
            "No API key provided (--api-key or SYNC_API_KEY). "
            "The request may be rejected by the dashboard."
        )

    # Authenticate with saved tokens
    garth_client = get_garth_client()

    # Determine date range (today inclusive, going back N days)
    today = date.today()
    dates = [today - timedelta(days=i) for i in range(args.days - 1, -1, -1)]

    log.info(
        "Syncing %d day(s): %s → %s",
        len(dates),
        dates[0].isoformat(),
        dates[-1].isoformat(),
    )

    metrics_list = []
    for d in dates:
        log.info("Fetching data for %s …", d.isoformat())
        day_metrics = build_day_metrics(garth_client, d)
        metrics_list.append(day_metrics)

    if args.dry_run:
        print(json.dumps({"action": "sync", "metrics": metrics_list}, indent=2))
        log.info("Dry-run complete. No data posted.")
        return

    success = post_metrics(args.api_url, api_key, metrics_list)
    if not success:
        log.error("Sync failed. Check the errors above.")
        sys.exit(1)

    log.info("Sync complete. %d day(s) submitted.", len(metrics_list))


if __name__ == "__main__":
    main()
