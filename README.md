# running-data-xml-parser

Parses an Apple Health `export.xml` and outputs a structured `runs.json` with biomechanics, recovery metrics, and GPX route data.

## Output format

Each run record includes:
- Core metrics: `distanceKm`, `paceSeconds` (integer seconds per km, e.g. `306` = 5:06/km), `durationSeconds`, `heartRateAvgBpm`, `cadenceStepsPerMin`, `groundContactTimeMs`, etc.
- Recovery data: HRV, sleep, resting HR, VO2 max and more for the night before, run day, and day after
- Route data: `startLat`, `startLon`, `kmSplits` (integer seconds per km), `routePolyline` (downsampled coordinates for map rendering)

## Install

```bash
npm install
```

## Run

```bash
npx tsx parse.ts export.xml
```

Outputs `runs.json` in the current directory.

By default the parser looks for a `workout-routes/` folder in the project root containing GPX files exported from Apple Health. If found, each run is matched to its GPX file by timestamp and enriched with route data.

To use a different GPX folder location:

```bash
npx tsx parse.ts export.xml --routes /path/to/workout-routes
```

If no GPX folder is found or a run has no matching GPX file, the `route` field will be `null` for that run.

## Test with mock data

```bash
npx tsx parse.ts test/mock-export.xml
```

## Type check

```bash
npx tsc --noEmit
```

> Requires Node 18+.
