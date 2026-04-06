# Phase 16: PPTX Redesign - Context

**Gathered:** 2026-04-05 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Exported PPTX decks are redesigned from a 2-slide layout to a single consolidated slide containing title, KPI summary callout boxes, a native pptxgenjs BAR chart of node counts, and a BoM table. When 3 or more distinct node pool types are present a second stacked vCPU chart is added to the same slide. Multi-cluster export (Phase 19), PDF redesign (Phase 17), and branding/logo additions (v2.2+) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Slide Layout
- **D-01:** Single slide, WIDE layout (13.33" × 7.5") — replaces previous 2-slide output
- **D-02:** Top band: title text spanning full width (~0.6" height) with KPI callout boxes strip immediately below (~1" height), together occupying the top ~1.7" of the slide
- **D-03:** Content area below the KPI strip splits into two columns: chart column left (~55% = ~7.3" wide), BoM table column right (~45% = ~6" wide)
- **D-04:** When 3+ distinct node pool types are present (PPTX-03), the stacked vCPU chart stacks below the node count BAR chart inside the left column — both charts share the left ~7.3" column, split vertically

### Architecture Summary Table
- **D-05:** The existing Architecture Summary table (topology, environment, HA Required) is **dropped** from the new slide — no metadata strip, no subtitle folding
- **D-06:** `buildArchSummaryData()` helper is retained in source (has existing tests) but is no longer called from `downloadPptx()`

### KPI Summary Style
- **D-07:** KPI strip renders 3 side-by-side callout boxes: **vCPU** / **RAM (GB)** / **Storage (GB)** — each box shows a label row and a large value row
- **D-08:** KPI boxes use RH_RED (`EE0000`) as background fill with white text — consistent with existing brand palette in `usePptxExport.ts`

### Chart Implementation
- **D-09:** Node count chart: native pptxgenjs `BAR` chart type (vertical bars), one series of node counts, categories = node pool labels from `buildChartRows()` (zero-count pools excluded per success criterion 4)
- **D-10:** Stacked vCPU chart (when 3+ types): native pptxgenjs `BAR` chart with `barGrouping: 'stacked'` (or equivalent pptxgenjs option), vCPU per pool from `buildVcpuData()` as multiple series
- **D-11:** Chart data comes from `useChartData.ts` builders (`buildChartRows`, `buildNodeCountData`, `buildVcpuData`) — no new data computation in the composable

### Claude's Discretion
- Exact inch/point coordinates for all positioned elements on the WIDE slide
- Bar colors for node count chart (single color vs. per-pool — use RH_RED as primary; Claude may differentiate pools with tonal variants)
- Chart axis label visibility, data label on bars, legend placement
- Whether to show chart title labels ("Node Count" / "vCPU Distribution") above each chart area
- KPI box exact dimensions, font sizes, padding within the top band

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current PPTX implementation
- `src/composables/usePptxExport.ts` — current 2-slide layout to replace; `buildBomTableRows()` (reuse verbatim), `buildArchSummaryData()` (retained but uncalled), color constants `RH_RED`, `RH_DARK`, `HEADER_BG`, `WHITE`, dynamic `import('pptxgenjs')` pattern
- `src/composables/useChartData.ts` — `buildChartRows()`, `buildNodeCountData()`, `buildVcpuData()` — call directly from the PPTX composable

### Test patterns
- `src/composables/__tests__/usePptxExport.test.ts` — existing test structure for `buildArchSummaryData` and `buildBomTableRows`; new chart tests follow same fixture pattern

### Requirements
- `.planning/REQUIREMENTS.md` §PPTX-01, PPTX-02, PPTX-03 — exact acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildBomTableRows(sizing)` — unchanged; returns pptxgenjs cell array for the BoM table column
- `buildChartRows(sizing)` → filter zero-count → `buildNodeCountData(rows)` — node count bar chart data
- `buildChartRows(sizing)` → filter zero-count → `buildVcpuData(rows)` — stacked vCPU chart data (one series per pool)
- Color constants in `usePptxExport.ts`: `RH_RED = 'EE0000'`, `RH_DARK = '151515'`, `HEADER_BG = 'E8E8E8'`, `WHITE = 'FFFFFF'`
- `pptx.layout = 'LAYOUT_WIDE'` — already set; retain
- Dynamic `import('pptxgenjs')` pattern — retain for bundle-splitting

### Established Patterns
- pptxgenjs `addSlide()` → `slide.addText()`, `slide.addTable()`, `slide.addChart()` with `{x, y, w, h}` positioning in inches
- All pptxgenjs positioning uses inches (decimal); WIDE slide = 13.33" × 7.5"

### Integration Points
- `downloadPptx()` is the public export function — signature stays the same (`cluster: ClusterConfig, sizing: ClusterSizing`)
- `ExportToolbar.vue` calls `downloadPptx()` — no changes needed there

</code_context>

<deferred>
## Deferred Ideas

- Red Hat branding (red header band, logo, date/author footer) — v2.2+ per REQUIREMENTS.md
- Architecture metadata in slide subtitle — dropped per D-05; not deferred to future phase
- Per-pool distinct colors in bar chart — left to Claude's discretion

</deferred>

---

*Phase: 16-pptx-redesign*
*Context gathered: 2026-04-05*
