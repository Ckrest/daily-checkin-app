#!/usr/bin/env python3
"""
Sleep data provider for daily-checkin.

Reads the Syncthing-synced daily-checkin.json and returns subjective
sleep data (quality, alertness, mood, dreams) for a given date.

Usage:
    python3 sleep_data_provider.py --date 2026-02-19

Output: JSON to stdout with diary entry data.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

PACKAGE_DIR = Path(__file__).resolve().parent.parent

# Default path to the synced JSON file
DEFAULT_JSON_PATH = PACKAGE_DIR / "src" / "Dailycheckin" / "daily-checkin.json"


def find_json_path() -> Path:
    """Find the daily-checkin.json file."""
    # Check environment variable first
    import os
    env_path = os.environ.get("DAILY_CHECKIN_JSON")
    if env_path:
        return Path(env_path).expanduser()
    return DEFAULT_JSON_PATH


def load_entries(json_path: Path) -> Optional[dict]:
    """Load and parse the JSON file.

    Handles truncated/corrupted files (e.g. from Syncthing partial writes)
    by using raw_decode to extract the first valid JSON object.
    """
    if not json_path.exists():
        return None

    with open(json_path) as f:
        content = f.read()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # File may have trailing garbage from Syncthing; try raw_decode
        try:
            decoder = json.JSONDecoder()
            data, _ = decoder.raw_decode(content)
        except json.JSONDecodeError:
            return None

    return data.get("entries", {})


def map_dreams(dreams_text: str) -> tuple[str, Optional[str]]:
    """Map free-text dreams field to enum + dream_text.

    Returns (dreams_enum, dream_text).
    """
    if not dreams_text or dreams_text.strip().lower() in ("none", ""):
        return "none", None
    return "vivid", dreams_text.strip()


def clean_notes(notes: str) -> Optional[str]:
    """Clean notes field, returning None for placeholder values."""
    if not notes or notes.strip().lower() in ("na", "n/a", ""):
        return None
    return notes.strip()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sleep data provider: subjective diary entries"
    )
    parser.add_argument("--date", required=True, help="Date to query (YYYY-MM-DD)")
    parser.add_argument("--version", action="version", version="daily-checkin-sleep-provider 0.1.0")
    args = parser.parse_args()

    json_path = find_json_path()
    entries = load_entries(json_path)

    if entries is None:
        json.dump({"status": "error", "error": f"Cannot read {json_path}"}, sys.stdout)
        return 1

    entry = entries.get(args.date)
    if entry is None:
        json.dump({"status": "no_data", "date": args.date}, sys.stdout)
        return 0

    dreams_enum, dream_text = map_dreams(entry.get("dreams", ""))
    notes = clean_notes(entry.get("notes", ""))

    result = {
        "status": "ok",
        "date": args.date,
        "entry": {
            "quality": entry.get("sleep_quality"),
            "alertness": entry.get("alertness"),
            "mood": entry.get("mood"),
            "dreams": dreams_enum,
            "dream_text": dream_text,
            "notes": notes,
            "sleep_time": entry.get("sleep_time"),   # HH:MM or None
            "wake_time": entry.get("wake_time"),     # HH:MM or None
        },
    }

    json.dump(result, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
