# xml2json

Desktop app to parse XML/GPX files into JSON with a live split-pane editor and AI-agent integration via the Model Context Protocol (MCP).

Built with **Electron**, **React**, **TypeScript**, **CodeMirror 6**, and **Tailwind CSS**.

> ![_Screenshot_](https://github.com/user-attachments/assets/00000000-0000-0000-0000-000000000000)
> *Replace the URL above with a screenshot of the app in light/dark mode*

---

## Features

- **Open files** — File dialog, drag-and-drop, or fetch from a remote URL
- **Parse XML & GPX** — Apple Health XML and GPX route files with km splits, elevation gain/loss, and polyline
- **Live preview** — Side-by-side CodeMirror editors with syntax highlighting
- **Tree view** — Browse parsed JSON structure with expand/collapse
- **Raw JSON** — Full JSON editor with formatting
- **Copy / Download** — One-click copy to clipboard or save as `.json`
- **Open in Editor** — Launch JSON in VS Code, Cursor, or Zed
- **MCP Server** — Exposes parsed data to AI agents (Claude Desktop, Cursor, etc.)
- **Dark / Light theme** — Toggle with one click
- **Recent files** — Sidebar with recently opened files

---

## Install

```bash
npm install
```

## Dev

```bash
npm run dev
```

Launches an Electron window with hot-reload.

## Build

```bash
npm run build        # build for production
npm run package      # package into .dmg (macOS), .exe (Windows), .AppImage (Linux)
```

Outputs go to `dist/`.

## Clean

```bash
npm run clean        # remove build artifacts
```

---

## MCP Integration

The app automatically starts an MCP server on `http://127.0.0.1:4283` whenever a file is parsed. It falls back through ports 4284–4293 if the default port is in use.

### Resources

| URI | Description |
|---|---|
| `xml2json://current/raw` | Full parsed JSON |
| `xml2json://current/stats` | Element counts and statistics |

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
    "xml2json": {
      "url": "http://127.0.0.1:4283"
    }
  }
}
```

The MCP status indicator (green dot) in the bottom-right shows whether the server is running.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 35 |
| UI framework | React 19 |
| Build tool | electron-vite + Vite 6 |
| Text editors | CodeMirror 6 |
| XML parsing | fast-xml-parser |
| Styling | Tailwind CSS 3 |
| MCP SDK | @modelcontextprotocol/sdk |
| Packaging | electron-builder |
