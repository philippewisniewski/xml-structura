# Current Issues — XML Structura

## Rendering Issues

### 1. `<details>` toggle broken — all nodes open/close together
**Severity:** High
**Component:** `src/views/TreeView.tsx`

When clicking a `<details>` node to collapse or expand it, ALL sibling/related nodes toggle at the same time. The `expandedPaths` Set in `useReducer` state is supposed to control each node individually, but clicking one node seems to trigger state changes that affect others. Likely cause: path keys are colliding or the `onClick` handler with `e.preventDefault()` is interfering with native `<details>` behavior. Need to investigate whether the React-controlled `open` attribute is fighting with the browser's native `<details>` toggle.

**Fix needed:** Ensure each `<details>` node has a unique path and toggles independently. May need to switch away from `e.preventDefault()` on `<summary>` and instead let the browser handle the toggle natively while tracking state separately.

### 2. Horizontal scrolling in tree and XML views
**Severity:** Medium
**Components:** `src/views/TreeView.tsx`, `src/views/XmlView.tsx`

Long attribute values, long text content, and deep nesting cause horizontal overflow. The views need:
- `overflow-x: hidden` or `overflow-wrap: break-word` on content containers
- `word-break: break-all` or `overflow-wrap: anywhere` on text nodes
- Truncation or wrapping for long attribute values
- The XML view's `<pre>` tags inherently prevent wrapping — need a toggle or smart wrapping

### 3. Tree view needs better structure and indentation
**Severity:** Medium
**Component:** `src/views/TreeView.tsx`

Current tree rendering uses simple `ml-4` for indentation. Needs:
- Visual indentation guide lines (vertical lines showing parent-child hierarchy)
- Cleaner nesting structure with consistent spacing
- Better visual distinction between nodes with children vs leaf nodes
- Collapsed nodes should show a summary of their children count or content preview
- Consider using a left-border or pseudo-element approach for tree lines

## What's Working Well
- SAX streaming parser (clean, fast)
- Tree builder (correct structure)
- View switching (Tree/Raw toggle) — improved with React
- Virtual scrolling for XML view
- File System Access API for recent files
- Theme toggle
- Drag and drop
- Resizable panels

## Architecture Status
- **Parser layer**: Complete, clean, no changes needed
- **View layer**: React integration complete, layout working
- **Remaining work**: Mostly rendering/UX polish in TreeView and detail interactions
