# Phase 4 Validation: Results, Exports & Sharing

**Phase:** 04-results-exports
**Requirements:** RES-01 – RES-07, SHARE-01 – SHARE-03, EXP-01 – EXP-03, QA-05

---

## Automated Gate (run after all 5 plans complete)

```bash
cd /Users/fjacquet/Projects/os-sizer

# 1. TypeScript — zero errors required
npm run type-check

# 2. Unit tests — all green required
npm run test -- --reporter=verbose

# 3. Production build — no chunk errors
npm run build

# 4. Verify dynamic imports (pptxgenjs and jsPDF must NOT be in main chunk)
# Check dist/assets/ — main chunk should be < 500KB
ls -lh dist/assets/*.js | sort -k5 -h
```

---

## Per-Requirement Traceability

| Requirement | Plan | Verification |
|-------------|------|-------------|
| RES-01: BoM table (type, count, vCPU, RAM, storage) | 04-01 Task 2 | BomTable renders rows from SizingResult.sizing |
| RES-02: Total resource summary | 04-01 Task 2 | TotalsSummaryCard renders totals.vcpu/ramGB/storageGB |
| RES-03: Architecture overview card | 04-01 Task 2 | ArchOverviewCard shows topology name + HA badge |
| RES-04: Infra nodes as separate line item | 04-01 Task 2 | BomTable renders infraNodes row when non-null |
| RES-05: ODF nodes as separate line item | 04-01 Task 2 | BomTable renders odfNodes row when non-null |
| RES-06: Warnings for below-minimum inputs | 04-01 Task 1 | WarningBanner renders ValidationWarning items |
| RES-07: Charts for resource distribution | 04-02 | VcpuChart, RamChart, StorageChart in ChartsSection |
| SHARE-01: Compressed URL encoding | 04-03 Task 1 | useUrlState.generateShareUrl() compresses with lz-string |
| SHARE-02: URL decode on page load | 04-03 Task 2 | main.ts calls hydrateFromUrl() before app.mount() |
| SHARE-03: Copy-to-clipboard button | 04-03 Task 2 | ExportToolbar share button with "Copied!" feedback |
| EXP-01: PPTX export via pptxgenjs | 04-04 | generatePptxReport() — 2 slides, dynamic import |
| EXP-02: PDF export via jsPDF+autotable | 04-05 | generatePdfReport() — A4 landscape table, dynamic import |
| EXP-03: CSV export | 04-05 | generateCsvReport() — blob download, no dependencies |
| QA-05: Edge case coverage | 04-01 + 04-03 | WarningBanner for validation errors; URL hydration silent failure |

---

## Manual Acceptance Checklist

Run through this checklist after automated gates pass.

### Results Page

- [ ] Complete wizard (Steps 1–3) and reach Step 4
- [ ] BoM table shows at least one row (Control Plane nodes)
- [ ] For standard-ha topology with ODF enabled: ODF Storage row appears in table
- [ ] For standard-ha topology with infra nodes enabled: Infra Nodes row appears in table
- [ ] TotalsSummaryCard shows non-zero values for vCPU, RAM, Storage
- [ ] ArchOverviewCard shows the topology name (not raw enum value like "standard-ha")
- [ ] ArchOverviewCard shows "HA" badge when haRequired=true

### Charts

- [ ] Three charts visible on results page (vCPU bar, RAM bar, Storage donut)
- [ ] Charts reflect node type data (e.g., control plane bars present)
- [ ] Charts do not appear in browser print preview (print:hidden)

### URL Sharing

- [ ] Click "Share URL" button — browser URL updates with ?c= param
- [ ] Browser clipboard contains the full URL
- [ ] Button shows "Copied!" for ~1.5 seconds then reverts
- [ ] Copy the URL, open new browser tab, paste URL → wizard shows same inputs
- [ ] Navigate to bare URL (no ?c= param) → app loads with default state (no errors)
- [ ] Navigate to URL with corrupted ?c= param (edit one character) → app loads with default state (no console errors shown to user)

### PPTX Export

- [ ] Click "Download PPTX" — button shows "Generating..." briefly
- [ ] File downloads with name pattern `os-sizer-{cluster-name}-{date}.pptx`
- [ ] Open file in PowerPoint/LibreOffice → 2 slides present
- [ ] Slide 1: "OpenShift Sizing Report" title, architecture summary table with 6 rows
- [ ] Slide 2: "Bill of Materials" title, table with correct node count and hardware values

### PDF Export

- [ ] Click "Export PDF" — file downloads
- [ ] File downloads with name pattern `os-sizer-{cluster-name}-{date}.pdf`
- [ ] Open PDF — "OpenShift Sizing Report" title present
- [ ] BoM table visible with correct headers and data rows
- [ ] Total vCPU/RAM/Storage summary line at bottom of table

### CSV Export

- [ ] Click "Export CSV" — file downloads immediately (no loading state needed)
- [ ] Open in text editor — first row is: `Node Type,Count,vCPU,RAM (GB),Storage (GB)`
- [ ] Import into Excel — data in correct columns, no extra blank rows
- [ ] CSV row count matches BoM table row count (same non-null NodeSpec entries)

### Build Validation

- [ ] Run `npm run build` — completes without errors
- [ ] Check `dist/assets/` — main JS chunk is < 500KB (heavy libs are lazy-loaded)
- [ ] Verify pptxgenjs, jspdf are in separate chunk files (not vendor.js or index.js)

---

## Unit Test Coverage Summary

Tests written in this phase:

| Test File | Tests | Covers |
|-----------|-------|--------|
| `src/components/shared/__tests__/WarningBanner.test.ts` | 2 | severity color mapping |
| `src/components/results/__tests__/BomTable.test.ts` | 2 | null NodeSpec filtering, row rendering |
| `src/composables/__tests__/useUrlState.test.ts` | 5 | round-trip, malformed input silent failure |
| `src/composables/__tests__/usePptxExport.test.ts` | 3 | buildArchSummaryData, buildBomTableRows |
| `src/composables/__tests__/useCsvExport.test.ts` | 2 | header row, null entry skipping |
| `src/composables/__tests__/usePdfExport.test.ts` | 3 | head columns, body rows, string values |

---

## Architecture Invariants (must remain true after Phase 4)

- **CALC-01 / CALC-02**: Zero imports from `src/engine/` in any `.vue` component file. Components read from Pinia stores only.
- **I18N**: Zero hardcoded English strings in `.vue` templates — all use `t('key')`.
- **Dynamic imports**: `pptxgenjs`, `jspdf`, `jspdf-autotable` loaded only via `await import(...)` inside async functions.
- **Zod schemas**: All URL hydration input validated via `InputStateSchema.safeParse()` — never `JSON.parse()` directly into store.

---

## Rollback Criteria

If any of the following are true after Phase 4, do NOT proceed to Phase 5:

- `npm run type-check` has errors
- `npm run test` has failing tests
- `npm run build` fails
- Main JS bundle > 1MB (indicates dynamic imports not working)
- URL share/hydration round-trip corrupts store state
