# os-sizer

Browser-based OpenShift cluster sizing tool. Guides users through a 3-step wizard (Environment, Workload, Architecture) and produces a Bill of Materials exportable as CSV, PPTX, or PDF.

## Features

- **Multi-topology sizing** -- Standard HA, Compact 3-node, SNO, HCP, MicroShift, and more
- **Add-on engines** -- ODF storage, RHACM, OpenShift Virtualization, GPU node pools, RHOAI
- **Multi-cluster** -- Size up to 5 clusters with hub/spoke/standalone roles and side-by-side comparison
- **Session portability** -- Save/load sizing sessions as JSON files
- **Exports** -- CSV, PPTX (with charts), PDF (with charts, KPI summary, Unicode support)
- **i18n** -- English, French, German, Italian
- **Dark mode** -- Tailwind v4 class-based dark mode

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173 in your browser.

## Build

```bash
pnpm build
```

Output goes to `dist/` -- deployable as a static site (e.g., GitHub Pages).

## Test

```bash
pnpm test
```

349 tests covering the sizing engine, stores, composables, and components.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3.5 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind v4 |
| State | Pinia |
| i18n | vue-i18n v11 |
| Validation | Zod |
| PDF | jsPDF + jspdf-autotable |
| PPTX | pptxgenjs |
| Charts | Chart.js |
| Tests | Vitest |

## Documentation

- [Product Requirements](docs/PRD.md)
- [Changelog](CHANGELOG.md)
- [Architecture Decision Records](docs/adr/)

## License

Private
