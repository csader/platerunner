# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

PlateRunner is a self-hosted 3MF processor for Bambu Lab A1 Mini PlateCycler automation. It combines multiple sliced 3MF print jobs with automatic plate swapping G-code sequences for unattended batch printing. All processing happens client-side in the browser.

## Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build (Next.js standalone output)
npm start        # Start production server
npm run lint     # Run Next.js linter
```

Docker: `docker-compose up -d` or `docker build -t platerunner . && docker run -p 3000:3000 platerunner`

## Architecture

Next.js 15 app (App Router) with React 19, TypeScript, Tailwind CSS, and shadcn/ui. Single-page app — all logic lives in one route (`app/page.tsx`).

### Core Processing Pipeline (`lib/`)

The processing pipeline takes uploaded 3MF files (which are ZIP archives containing G-code and metadata) and combines them into a single 3MF with plate swap sequences injected:

- **`processor.ts`** — Main orchestrator. `parse3MF()` extracts G-code, metadata, and thumbnails from 3MF ZIP archives using JSZip. `combineGcode()` concatenates jobs with swap sequences. `create3MF()` repackages into a valid 3MF with updated checksums (SparkMD5) and filament totals.
- **`gcode-parser.ts`** — Extracts print metadata (time, filament, layers) from G-code header comments via regex. Also handles `slice_info.config` XML parsing/updating for filament totals.
- **`plate-swap.ts`** — Manages the G-code swap sequence (default is Chitu PlateCycler C1M compatible). Presets are stored in localStorage.

Key processing detail: swap sequences are injected after the `; EXECUTABLE_BLOCK_END` marker in each job's G-code. The code detects if a swap sequence already exists to avoid duplication.

### UI Components (`components/`)

- **`dropzone.tsx`** — Drag-and-drop file upload for 3MF files
- **`print-queue.tsx` / `print-item.tsx`** — Job list with reordering and copy count controls
- **`settings-panel.tsx`** — G-code swap sequence editor with preset save/load
- **`stats-display.tsx`** — Aggregated print time, filament usage, plate swap count
- **`theme-provider.tsx` / `theme-toggle.tsx`** — Dark mode via class-based toggling
- **`ui/`** — shadcn/ui primitives (button, card, input, textarea)

### Key Conventions

- Path alias `@/*` maps to project root
- shadcn/ui theming via CSS variables in `app/globals.css`, dark mode via `class` strategy
- App version is injected from `package.json` via `next.config.ts` env
- No backend/API routes — everything runs client-side
- No test framework is configured
