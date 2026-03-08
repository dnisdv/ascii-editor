# Copilot Instructions for ASCII Editor

## Project Overview

- **ASCII Editor** is a browser-based ASCII art editor built with SvelteKit, CanvasKit (Skia + WebAssembly), Redux Toolkit, and TypeScript.
- The app is structured for multi-layer ASCII drawing, selection/transformation tools, clipboard support, undo/redo, and local storage project management.

## Architecture & Key Patterns

- **src/editor/**: Core editor logic (canvas, tools, history, rendering, font, smart objects, spatial hashing, etc.).
  - `app.ts` is the main entry for editor orchestration.
  - Tooling is modular: see `tool-manager.ts`, `tools-event-manager.ts`, and `tools/` for extensibility.
- **src/components/**: UI primitives (buttons, dialogs, menus, tooltips, etc.) are Svelte components, often grouped by type.
- **src/store/**: State management via Redux Toolkit. Use slices and selectors for state access.
- **src/api/documents/**: Local storage and document APIs for project persistence.
- **src/project/**: Project sync and layer management logic.
- **src/routes/**: SvelteKit routing and top-level UI composition.
- **src/theme/**: Theming logic and providers.

## Developer Workflows

- **Dev server**: `npm run dev` (SvelteKit, Vite)
- **Build**: `npm run build`
- **Lint**: `npm run lint` (uses ESLint config)
- **Type-check**: `npm run check`
- **No formal test suite**: If adding tests, follow SvelteKit conventions and place in `src/__tests__/` or near relevant modules.

## Conventions & Patterns

- **TypeScript everywhere**: All logic and components use strict typing.
- **Svelte components**: Use `<script lang="ts">` and Tailwind CSS for styling.
- **Redux slices**: State is organized by feature in `src/store/slices/`.
- **API boundaries**: Document and layer APIs are in `src/api/documents/` and `src/project/`.
- **Extensible tools**: New editor tools should be added in `src/editor/tools/` and registered via `tool-manager.ts`.
- **Local storage**: Use `db-localstorage.ts` for persistence.
- **Theming**: Use `ThemeProvider.svelte` and related hooks for UI theming.

## Integration Points

- **CanvasKit**: Loaded via WASM for high-performance rendering (see `font-manager.ts`, `render-manager.ts`).
- **Redux Toolkit**: Centralized state, actions, and selectors.
- **SvelteKit**: Routing, SSR, and component composition.
- **Tailwind CSS**: Utility-first styling via `app.css` and `tailwind.config.ts`.

## Examples

- To add a new tool: create in `src/editor/tools/`, update `tool-manager.ts`.
- To persist a document: use APIs in `src/api/documents/`.
- To add a UI component: place in `src/components/`, use Tailwind for styles.

---

_If any section is unclear or missing, please provide feedback for further refinement._
