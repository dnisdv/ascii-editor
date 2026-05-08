# Contributing to ASCII Editor

Thanks for your interest!

## Setup

**Prerequisites:** Node.js 20+ and npm.

```bash
git clone https://github.com/dnisdv/ascii-editor.git
cd ascii-editor
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Useful Commands

```bash
npm run lint     # check code style
npm run format   # auto-fix formatting
npm run check    # Svelte type checking
npm test         # run tests
```

## Issues & PRs

- Open an issue for bugs or feature ideas
- PRs are welcome — include a short description of what and why
- For UI changes, a screenshot helps a lot

## Architecture

The editor is organized around a central `CoreApi` (`src/editor/core.ts`). See `.github/copilot-instructions.md` for a full walkthrough.
