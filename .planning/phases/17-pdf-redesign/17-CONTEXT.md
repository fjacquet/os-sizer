# Phase 17: PDF Redesign - Context

**Gathered:** 2026-04-05 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Exported PDFs are enhanced with a bar chart of node counts, a KPI summary callout box, and inline validation warnings with severity colors. Unicode font embedding for FR/DE/IT accented characters is explicitly deferred (PDF-03) — the PDF will use Helvetica (jsPDF default). PPTX redesign (Phase 16), multi-cluster exports (Phase 19), and session portability are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Chart Implementation (PDF-01)
- **D-01:** Use Chart.js offscreen canvas → `doc.addImage()` for the node count bar chart
- **D-02:** Chart.js must be initialized with `animation: { duration: 0 }` — per STATE.md pitfall, canvas captures blank on first paint without this
- **D-03:** Chart data sourced from `useChartData.ts` builders (`buildChartRows`, `buildNodeCountData`) — zero-count pools excluded before passing to Chart.js
- **D-04:** Bar chart placed above the BoM table; KPI callout box placed between chart and BoM table (per PDF-02 success criterion ordering)

### Font Strategy (PDF-03 — Deferred)
- **D-05:** No embedded font — use Helvetica (jsPDF default). Accented and special characters for FR/DE/IT locales will NOT render correctly
- **D-06:** PDF-03 acceptance criterion is explicitly deferred to v2.2+. Known limitation: FR/DE/IT exports may display boxes or dropped characters in locale-specific strings
- **D-07:** All PDF-generated text uses English strings only (node type labels, header text, KPI labels) — these are already in ASCII and unaffected

### Validation Warnings (PDF-04)
- **D-08:** `generatePdfReport()` function signature extended to accept pre-resolved warning strings: `resolvedWarnings: { text: string; severity: 'error' | 'warning' }[]`
- **D-09:** `ExportToolbar.vue` resolves `validationErrors` using `useI18n().t(w.messageKey)` and passes the array to `generatePdfReport()` — PDF composable stays pure TS with no Vue dependency
- **D-10:** Warnings rendered inline after the BoM table, one per line with severity color: `error` → Red Hat red (#EE0000), `warning` → orange (#F97316)

### KPI Callout Box (PDF-02)
- **D-11:** KPI summary placed between chart and BoM table — shows total vCPU, total RAM (GB), total Storage (GB) as a compact horizontal row with labeled values
- **D-12:** KPI section uses jsPDF `setFillColor` + `rect` for a colored background strip (light gray `#F0F0F0`) with black text — consistent with existing striped table aesthetic

### Claude's Discretion
- Exact pixel/point dimensions for the chart image (width × height), KPI strip height, and warning section font size
- Whether to add a chart title ("Node Count by Pool") above the chart area
- Bar colors for Chart.js (use Red Hat red `#EE0000` as primary)
- Whether to show data value labels on bars

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current PDF implementation
- `src/composables/usePdfExport.ts` — current `generatePdfReport()` signature, `buildPdfTableData()` helper, jsPDF + jspdf-autotable usage pattern

### Chart data builders
- `src/composables/useChartData.ts` — `buildChartRows()`, `buildNodeCountData()` — call directly; zero-count filtering must happen before passing to Chart.js

### Validation warnings
- `src/engine/validation.ts` — `validateInputs()` returns `ValidationWarning[]`
- `src/engine/types.ts` — `ValidationWarning` interface: `{ code, severity: 'error'|'warning', messageKey }`
- `src/components/results/ExportToolbar.vue` — caller of `generatePdfReport()`; must be updated to resolve i18n and pass resolved warnings

### Test patterns
- `src/composables/__tests__/usePdfExport.test.ts` — existing test for `buildPdfTableData`; new tests follow same fixture pattern

### Requirements
- `.planning/REQUIREMENTS.md` §PDF-01, PDF-02, PDF-04 — exact acceptance criteria (PDF-03 deferred)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildPdfTableData(sizing)` — unchanged; returns `{ head, body }` for jspdf-autotable
- `buildChartRows(sizing)` + `buildNodeCountData(rows)` — from `useChartData.ts`; call directly
- Color constants to replicate in PDF: Red Hat red = `#EE0000`, dark = `#151515`

### Established Patterns
- Dynamic `import('jspdf')` + `import('jspdf-autotable')` — retain for bundle-splitting
- Pure function `buildPdfTableData` exported and unit-tested without jsPDF — same pattern for any new pure helpers
- `doc.save(filename)` at end — unchanged

### Integration Points
- `ExportToolbar.vue` calls `generatePdfReport()` — must be updated to pass resolved warnings array
- `SizingResult.validationErrors` is the source of warnings (`calc.clusterResults[idx].validationErrors`)

### Known Pitfalls (STATE.md)
- Chart.js animation must be `{ duration: 0 }` — canvas captures blank on first paint otherwise
- jsPDF unit is `pt` (points), A4 landscape = 841.9 × 595.3 pt

</code_context>

<specifics>
## Specific Ideas

- Font strategy: "Use Helvetica by default, I don't know NotoSans" — user explicitly chose jsPDF default over custom font embedding

</specifics>

<deferred>
## Deferred Ideas

- **PDF-03 (Unicode font)**: Accented character rendering for FR/DE/IT deferred to v2.2+. User preference: Helvetica default rather than font subsetting/embedding.
- Stacked vCPU chart in PDF (analogous to PPTX-03) — not in v2.1 scope for PDF

</deferred>

---

*Phase: 17-pdf-redesign*
*Context gathered: 2026-04-05*
