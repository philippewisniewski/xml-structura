# running-data-xml-parser

Parses an Apple Health `export.xml` and outputs a structured `runs.json` with biomechanics, recovery metrics, GPX route data, and a natural language summary per run.

## Install

```bash
npm install
```

## Run

```bash
node --experimental-strip-types parse.ts export.xml
```

Outputs `runs.json` in the current directory.

By default the parser looks for a `workout-routes/` folder in the project root containing GPX files exported from Apple Health. If found, each run is matched to its GPX file by timestamp and enriched with route data (start coordinates, km splits, downsampled polyline).

To use a different GPX folder location:

```bash
node --experimental-strip-types parse.ts export.xml --routes /path/to/workout-routes
```

If no GPX folder is found or a run has no matching GPX file, the `route` field will be `null` for that run.

## Test with mock data

```bash
node --experimental-strip-types parse.ts test/mock-export.xml
```

## Type check

```bash
npx tsc --noEmit
```

## Build

```bash
npx tsc
node dist/parse.js export.xml
```

> Requires Node 22+.
