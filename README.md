# Daily Check-In

Expo React Native app for daily self-tracking. Rate your sleep quality, alertness, and mood on a 1-5 scale, log dreams and notes, and optionally record sleep/wake times. Data is stored as a local JSON file for easy syncing and backup.

## Features

- **Daily ratings** - Sleep quality, alertness, and mood on a 1-5 star scale
- **Dream journal** - Free-text field for recording dreams
- **Notes** - General daily notes
- **Sleep time slider** - Optional manual sleep/wake time entry
- **Swipe navigation** - Swipe between days; auto-creates today's entry
- **Auto-save** - Changes saved automatically as you type/tap
- **Notifications** - Configurable daily reminder to check in
- **JSON storage** - Human-readable data file, easy to sync with Syncthing or similar
- **Dark theme** - OLED-friendly dark UI

## Quick Start

```bash
cd src
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `a` to open in an Android emulator.

## Building

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) for production builds:

```bash
npx eas build --platform android --profile preview   # APK for testing
npx eas build --platform android --profile production # AAB for Play Store
```

> **Note:** If you fork this project, update the `extra.eas.projectId` and `updates.url` in `app.json` to point to your own EAS project.

## Data Storage

The app stores check-in data as a JSON file using Android's Storage Access Framework (SAF) folder picker. On first launch, you pick a folder; the app reads/writes `daily-checkin.json` there. AsyncStorage is used as a fallback backup.

See [`src/Dailycheckin/daily-checkin.example.json`](src/Dailycheckin/daily-checkin.example.json) for the data format:

```json
{
  "version": 1,
  "entries": {
    "2026-01-01": {
      "date": "2026-01-01",
      "day": 1,
      "sleep_quality": 4,
      "alertness": 3,
      "mood": 4,
      "dreams": "",
      "notes": "Slept well despite staying up late.",
      "sleep_time": "00:30",
      "wake_time": "08:45",
      "created_at": "2026-01-01T09:00:00Z",
      "updated_at": "2026-01-01T09:00:00Z"
    }
  }
}
```

Ratings are 1-5 integers. `sleep_time` and `wake_time` are optional (nullable) HH:MM strings.

## Sleep Data Provider

A Python CLI script (`src/sleep_data_provider.py`) reads the JSON file and returns sleep data for a given date. Useful for integrating with other tools:

```bash
python3 src/sleep_data_provider.py --date 2026-02-19
```

Set `DAILY_CHECKIN_JSON` to override the default file path.

## Tech Stack

- [Expo](https://expo.dev/) SDK 54
- [React Native](https://reactnative.dev/) 0.81
- [TypeScript](https://www.typescriptlang.org/) 5.9
- [expo-router](https://docs.expo.dev/router/introduction/) for file-based routing
- [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) for daily reminders
- [date-fns](https://date-fns.org/) for date handling

## License

[MIT](LICENSE)
