# Phase 16: PPTX Redesign — Research

**Phase:** 16 — PPTX Redesign
**Researched:** 2026-04-05
**Status:** Complete

---

## Research Summary

This phase replaces the current 2-slide PPTX layout with a single consolidated slide using native pptxgenjs chart APIs. The implementation is purely additive — the existing composable and its pure helpers are well-understood; no new dependencies are needed.

---

## 1. pptxgenjs Chart API

### Vertical Bar Chart (node count)

```typescript
// barDir: "col" = vertical bars (columns). Default "bar" = horizontal.
slide.addChart(pptx.charts.BAR, chartData, {
  x: 0.3, y: 1.8, w: 7.0, h: 2.8,
  barDir: 'col',                    // vertical bars
  showTitle: true,
  title: 'Node Count',
  showLegend: false,                // single series — no legend needed
  showValue: true,
  dataLabelPosition: 'outEnd',
  chartColors: ['EE0000'],          // RH_RED for all bars (single series)
})
```

Data shape (one series, one label per pool):
```typescript
const nodeCountData = [
  {
    name: 'Node Count',
    labels: ['Control Plane', 'Workers', 'ODF Storage'],  // pool labels
    values: [3, 6, 3],                                     // node counts
  }
]
```

### Stacked Bar Chart (vCPU distribution, 3+ pool types)

```typescript
slide.addChart(pptx.charts.BAR, vcpuData, {
  x: 0.3, y: 4.7, w: 7.0, h: 2.5,
  barDir: 'col',
  barGrouping: 'stacked',           // key option for stacked bars
  showTitle: true,
  title: 'vCPU Distribution',
  showLegend: true,
  legendPos: 'b',
})
```

Data shape (one series **per pool**, each with one value per pool label):
```typescript
// For stacked chart, each series = one pool, each with ALL pool labels
// but only one pool's value is non-zero per series (standard pptxgenjs stacked pattern)
// OR: use one series per pool with a single category label
// Simplest: one series per pool, single label = pool name
const vcpuData = [
  { name: 'Control Plane', labels: ['vCPU'], values: [24] },
  { name: 'Workers',       labels: ['vCPU'], values: [96] },
  { name: 'ODF Storage',   labels: ['vCPU'], values: [48] },
]
```

**Important:** For stacked charts showing per-pool breakdown with pool names as legend entries (not X-axis), use one series per pool, single X-axis label "vCPU Distribution". This produces a single stacked bar column per chart with a color-coded legend matching pool names.

### Chart Color Options

- `chartColors: string[]` — array of hex colors (no `#`), one per series
- Single series: `chartColors: ['EE0000']` (RH_RED)
- Multi-series stacked: `chartColors: ['EE0000', 'CC0000', 'AA0000', '880000', '660000', '440000', '220000']` — tonal red variants

---

## 2. Slide Layout Architecture

### WIDE slide dimensions
- Total: 13.33" × 7.5"
- Top title band: y=0, h=0.6" (RH_RED background, white bold text)
- KPI strip: y=0.6", h=1.1" (3 callout boxes side-by-side)
- Content area: y=1.75" to y=7.4" (h≈5.65")
  - Left column (charts): x=0.3", w=7.0"
  - Right column (BoM table): x=7.5", w=5.5"

### KPI Callout Boxes (3 boxes)
Each box: w=3.9", h=1.0", RH_RED fill, white text
- Box 1: x=0.3",  y=0.65" — vCPU
- Box 2: x=4.57", y=0.65" — RAM (GB)
- Box 3: x=8.84", y=0.65" — Storage (GB)
- Label row (top): fontSize=10, bold, white
- Value row (bottom): fontSize=22, bold, white

Alternatively, use `slide.addShape` for the box background + `slide.addText` for label + value layered on top, or use a single `addText` with line breaks. The `addShape` + `addText` layered approach is cleaner.

---

## 3. Existing Code Assets to Reuse

### From `usePptxExport.ts`
- `RH_RED = 'EE0000'`, `RH_DARK = '151515'`, `HEADER_BG = 'E8E8E8'`, `WHITE = 'FFFFFF'`
- `buildBomTableRows(sizing)` — unchanged, reuse verbatim
- `buildArchSummaryData()` — retained but no longer called from main export function
- `pptx.layout = 'LAYOUT_WIDE'` — keep
- `generatePptxReport()` signature unchanged (uses store internally)
- Dynamic `import('pptxgenjs')` pattern — keep

### From `useChartData.ts`
- `buildChartRows(sizing)` — returns all pool rows (including zero-count)
- `buildNodeCountData(rows)` — `rows.map(r => r.spec.count)`
- `buildVcpuData(rows)` — `rows.map(r => r.spec.count * r.spec.vcpu)`
- **Zero-count filter:** `rows.filter(r => r.spec.count > 0)` BEFORE passing to builders (per PPTX-03 / success criterion 4)

---

## 4. Test Patterns to Follow

File: `src/composables/__tests__/usePptxExport.test.ts`

Existing tests cover `buildArchSummaryData` and `buildBomTableRows`. New tests for Phase 16 should cover:

1. **`buildNodeCountChartData(sizing)`** — pure helper that returns pptxgenjs-ready series data
   - Returns one series with labels=pool names, values=node counts (zero-count pools excluded)
   - Fixture: makeSizing() with known pool counts

2. **`buildVcpuStackedChartData(sizing)`** — pure helper for stacked chart
   - Returns one series per non-zero pool
   - Returns `null` or empty array when < 3 distinct pool types

3. **`shouldShowVcpuChart(sizing)`** — predicate
   - Returns `true` when 3+ distinct non-zero pool types exist
   - Returns `false` when < 3 pool types

All new helpers must be pure functions (no pptxgenjs dependency) — same pattern as existing `buildBomTableRows`.

---

## 5. Architecture Decision — New Pure Helpers vs. Inline Logic

**Recommendation:** Extract three new exported pure helpers from `usePptxExport.ts`:
- `buildNodeCountChartData(sizing: ClusterSizing): ChartData[]`
- `buildVcpuStackedChartData(sizing: ClusterSizing): ChartData[] | null`
- `shouldShowVcpuChart(sizing: ClusterSizing): boolean`

Where `ChartData = { name: string; labels: string[]; values: number[] }`.

This matches the existing pattern (testable without pptxgenjs) and keeps `generatePptxReport()` as an orchestrator that only calls `slide.addChart()`.

---

## 6. Key Implementation Risks

| Risk | Mitigation |
|------|-----------|
| `barGrouping` spelling varies by pptxgenjs version | Use `'stacked'` (documented v3.x); verify with `pptx.charts.BAR` + options |
| Zero-count pools appearing as 0-height bars | Filter `buildChartRows` result BEFORE passing to chart data builders |
| BoM table overflow in right column (5.5" wide) | Reduce font size to 9pt if needed; colW proportional to right column width |
| KPI box text overflow | Use `fit: 'shrink'` on value text boxes |
| `downloadPptx` vs `generatePptxReport` name discrepancy | CONTEXT.md says `downloadPptx()` — check current export function name in source |

**Note:** The current source uses `generatePptxReport()`, not `downloadPptx()`. The CONTEXT.md reference to `downloadPptx()` is a naming inconsistency in the context doc. The actual function signature is `generatePptxReport(): Promise<void>`.

---

## RESEARCH COMPLETE

Phase 16 is well-scoped with minimal unknowns:
- pptxgenjs chart API is straightforward: `barDir: 'col'` for vertical bars, `barGrouping: 'stacked'` for stacked
- Slide geometry fits comfortably on WIDE layout (13.33" × 7.5")
- All data already available via existing `useChartData.ts` builders
- Two PLAN.md files match the roadmap split: 16-01 (1-slide layout + node count chart) and 16-02 (stacked vCPU chart + chart options factory)
