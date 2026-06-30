# Structura

> Desktop app to parse XML/GPX files into structured JSON with live preview, tree browsing, and AI-agent integration via the Model Context Protocol (MCP).

Built with **Electron**, **React**, **TypeScript**, **CodeMirror 6**, and **Tailwind CSS**.

---

## Features

- **Open files** — File dialog, drag-and-drop, or remote URL fetch
- **Parse XML & GPX** — Apple Health XML and GPX route files with km splits, elevation gain/loss, and polyline extraction
- **Side-by-side editors** — CodeMirror XML/JSON editors with syntax highlighting
- **Tree view** — Browse parsed JSON with expand/collapse; index-based structural tree for files > 50 MB (no OOM)
- **Raw JSON** — Full JSON view with progressive loading for large files
- **Copy / Download** — One-click copy to clipboard or save as `.json`
- **Open in Editor** — Launch JSON in VS Code, Cursor, or Zed
- **MCP Server** — Exposes parsed data to AI agents (Claude Desktop, Cursor, etc.)
- **Dark / Light theme** — Toggle with one click
- **Recent files** — Sidebar with recently opened files

---

## Dev

```bash
npm install
npm run dev        # hot-reload Electron window
```

## Build

```bash
npm run build      # production build into out/
npm run package    # package into .dmg (macOS), .exe (Windows), .AppImage (Linux)
```

## Clean

```bash
npm run clean      # remove build artifacts
```

---

## MCP Integration

The app automatically starts an MCP server on `http://127.0.0.1:4283` whenever a file is parsed. It falls back through ports 4284–4293 if the default port is in use.

### Resources

| URI | Description |
|---|---|
| `structura://current/raw` | Full parsed JSON |
| `structura://current/stats` | Element counts and statistics |

### Tools

| Tool | Arguments | Description |
|---|---|---|
| `search` | `query` (string) | Find values matching text (case-insensitive) |
| `query` | `path` (string) | JSONPath-like expression, e.g. `$.Workout[0]` |
| `schema` | — | Infer the structure of the parsed data |

### Connect from Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "structura": {
      "url": "http://127.0.0.1:4283"
    }
  }
}
```

The MCP status indicator (bottom-right of the app) shows whether the server is running.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 35 |
| UI framework | React 19 |
| Build tool | electron-vite + Vite 6 |
| Text editors | CodeMirror 6 |
| XML parsing | fast-xml-parser (SAX streaming) |
| Styling | Tailwind CSS 3 |
| MCP SDK | @modelcontextprotocol/sdk |
| Packaging | electron-builder |
