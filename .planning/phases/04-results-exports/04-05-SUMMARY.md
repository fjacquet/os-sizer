---
phase: 04-results-exports
plan: 05
status: complete
completed_at: "2026-03-31"
---

# 04-05 SUMMARY — CSV & PDF Exports

## Files Created / Modified

- `src/composables/useCsvExport.ts` — CSV blob download from BoM table data
- `src/composables/usePdfExport.ts` — PDF via dynamic import of jsPDF + jspdf-autotable (stays out of main bundle)
- `src/components/results/ExportToolbar.vue` — CSV and PDF buttons wired to `handleExportCsv()` / `handleExportPdf()`
- `src/composables/usePdfExport.ts` — removed stale `@ts-expect-error` directive (TypeScript 2578 diagnostic fixed)

## Verification

- `npm run type-check` exits 0
- `npm run test` — 117/117 tests pass (12 test files)
- CSV: synchronous blob download, no loading state needed
- PDF: async with `pdfLoading` ref disabling button during generation
- jsPDF and jspdf-autotable loaded via `await import()` — not in main bundle

## Notes

- `pdfLoading` ref declared after `handleExportPdf` function — hoisting works fine in Vue `<script setup>`
- `@ts-expect-error` on autoTable import was stale and removed post-completion
