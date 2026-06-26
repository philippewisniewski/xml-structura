# xml2json

Desktop app to parse XML/GPX files into JSON with a live preview editor.

Built with Electron, React, TypeScript, CodeMirror 6, and Tailwind CSS.

## Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run package
```

## Features

- Open XML/GPX files via file dialog or drag-and-drop
- Fetch XML from a remote URL
- Parse Apple Health XML and GPX files with route analysis
- View parsed JSON as a tree or raw text
- CodeMirror editors with syntax highlighting
- Copy/download the JSON output
- Open JSON in VS Code / Cursor / Zed
- MCP server integration (auto-starts on port 4283)
- Dark/light theme
- Recent files sidebar
