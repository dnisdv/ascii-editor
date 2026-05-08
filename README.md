# ASCII Editor

[![CI](https://github.com/dnisdv/ascii-editor/actions/workflows/lint-and-test.yml/badge.svg)](https://github.com/dnisdv/ascii-editor/actions/workflows/lint-and-test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![ASCII Editor Cover](media/Github_Thumbnail.gif)

**ASCII Editor** is a browser-based ASCII art editor built with **SvelteKit** and **CanvasKit (Skia + WebAssembly)**. Create, edit, and manage ASCII-based designs with a structured layer system and a familiar creative tool set.

**[Try it live at dnascii.com](https://dnascii.com)**

---

## Features

- **Drawing tools** — Draw tool with configurable character, Text tool with blinking cursor, Eraser
- **Shape tools** — Rectangle and Line with object rotation support
- **Selection tool** — Region select with move and resize handles
- **Multi-layer system** — Create, group, reorder (drag-and-drop), show/hide, and rename layers
- **Full undo/redo** — History across all operations including layer changes and object transforms
- **Clipboard** — Copy and paste selections
- **Camera** — Pan and zoom the canvas freely
- **Project persistence** — Auto-saves locally; import/export projects as compressed `.dnascii` files
- **Themes** — Light and dark mode
- **Focus mode** — Distraction-free editing

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [SvelteKit](https://kit.svelte.dev) |
| Rendering | [CanvasKit (Skia + WASM)](https://skia.org/docs/user/modules/canvaskit/) |
| State | [Redux Toolkit](https://redux-toolkit.js.org) + [RxJS](https://rxjs.dev) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Build | Vite |

## Installation

**Prerequisites:** Node.js 20+ and npm.

```bash
git clone https://github.com/dnisdv/ascii-editor.git
cd ascii-editor
npm install
```

### Development

```bash
npm run dev
```

App runs at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

### Other Commands

```bash
npm run check    # Svelte type checking
npm run lint     # ESLint + Prettier check
npm run format   # Auto-format code
npm test         # Run tests
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## License

[MIT](LICENSE) — Denis, 2026.

## UI/UX Design

Design references are in the **[Figma file](https://www.figma.com/design/4JswUSJxh2sI9uqZytztSY/ASCII?node-id=15803-10386&t=s29TVqugAXooqLmS-1)**.
