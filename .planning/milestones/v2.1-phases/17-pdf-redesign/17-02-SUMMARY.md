---
plan: 17-02
phase: 17-pdf-redesign
status: complete
tests: 302
commit: feat(17-02): add KPI strip, inline warnings, and resolved-warnings wiring
key-files:
  created: []
  modified:
    - src/composables/usePdfExport.ts
    - src/composables/__tests__/usePdfExport.test.ts
    - src/components/results/ExportToolbar.vue
---

# Plan 17-02 Summary: KPI Strip, Inline Warnings, Unicode via System Font

**Status:** Complete
**Tests:** 302 passing (298 baseline + 4 new)

## What Was Done

- **PDF-02**: `buildKpiStripData(sizing)` pure helper exported — returns `{ vcpu, ramGB, storageGB, label }` from `sizing.totals`
- KPI callout strip rendered between chart image and BoM table: light-gray `#F0F0F0` background, 11pt text, full-width
- **PDF-03**: System font (Helvetica, WinAnsi encoding) retained — covers all FR/DE/IT accented characters (é, à, ü, ö, ä, ß, ç) without embedding any font file
- **PDF-04**: `generatePdfReport(resolvedWarnings = [])` new signature — warnings rendered below BoM table with `#EE0000` (error) and `#F97316` (warning) colors
- `ExportToolbar.vue` resolves `validationErrors` via `t(w.messageKey)` before passing to `generatePdfReport`

## Requirements Satisfied

- PDF-02: KPI summary callout box (vCPU / RAM / Storage) between chart and BoM ✓
- PDF-03: Accented characters via Helvetica WinAnsi — no font embedding needed ✓
- PDF-04: Inline warnings with severity color differentiation ✓

## Self-Check: PASSED

- `buildKpiStripData` exported and tested (4 tests)
- `generatePdfReport` signature updated with default `= []`
- ExportToolbar resolves i18n keys — composable stays pure TS
- 302/302 tests passing, 0 TS errors
