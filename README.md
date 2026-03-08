# (WIP) ASCII Editor

![ASCII Editor Cover(GHIF)](media/Github_Thumbnail.gif)

**ASCII Editor** is a browser-based ASCII art editor built with **SvelteKit** and **CanvasKit - Skia + WebAssembly**. It provides a structured and efficient environment for creating, editing, and managing ASCII-based designs.

## Features

## Installation and Setup

### LayerApi Composition Helpers

- New helpers in `src/editor/layers/layer-api.ts` simplify temp-layer inserts and index-based moves across composed layers.
- See `docs/layer-api-helpers.md` for usage examples: insert at top/end/between and computing `orderKey` via `getKeyForIndex`.

Ensure that **Node.js** and **npm** are installed on your system.

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/dnisdv/ascii-editor.git
cd ascii-editor
npm install
```

### Running the Development Server

Start the development server with the following command:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Building for Production

To generate an optimized production build, run:

```bash
npm run build
```

## UI/UX Design

For design references and updates, refer to the **[Figma design file](https://www.figma.com/design/4JswUSJxh2sI9uqZytztSY/ASCII?node-id=15803-10386&t=s29TVqugAXooqLmS-1)**.
