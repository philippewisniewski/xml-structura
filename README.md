# running-data-xml-parser

Parses an Apple Health `export.xml` and outputs a structured `runs.json` with biomechanics, recovery metrics, and a natural language summary per run.

## Install

```bash
npm install
```

## Run

```bash
node --experimental-strip-types parse.ts /path/to/export.xml
```

Outputs `runs.json` in the current directory.

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
node dist/parse.js /path/to/export.xml
```

> Requires Node 22+.
