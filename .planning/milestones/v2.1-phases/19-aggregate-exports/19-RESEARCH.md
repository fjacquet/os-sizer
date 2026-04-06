# Phase 19: Aggregate Exports - Research

**Researched:** 2026-04-06
**Domain:** Export composables (PPTX/PDF/CSV) — multi-cluster iteration, aggregate totals sections
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single-cluster fallback — when exactly 1 cluster is configured, all three export formats produce output **identical to the Phase 16/17 baseline** — no cluster name headers, no aggregate section. Multi-cluster logic is gated on `clusters.length >= 2`.
- **D-02:** PPTX: For N >= 2 clusters, generate N individual slides (one per cluster, using the Phase 16 single-slide layout) followed by one aggregate summary slide.
- **D-03:** PPTX aggregate summary slide contains a **side-by-side totals table**: rows = vCPU / RAM (GB) / Storage (GB); columns = each cluster name + a rightmost `TOTAL` column summing all clusters.
- **D-04:** Aggregate totals sourced from `calculationStore.aggregateTotals` (already computed in Phase 13); per-cluster values from `calculationStore.clusterResults[]`.
- **D-05:** Aggregate slide title: "Aggregate Summary" — cluster name column headers use `cluster.name` from `inputStore.clusters[]`.
- **D-06:** PDF: For N >= 2 clusters, render one jspdf-autotable section per cluster, each preceded by a cluster name header row (bold, RH_RED background, full-width spanning all columns).
- **D-07:** After the last cluster section, append an aggregate totals row — uses `aggregateTotals` for vCPU/RAM/Storage values, label "AGGREGATE TOTAL".
- **D-08:** Chart (Phase 17) rendered per cluster above its BoM section — one chart image per cluster when multiple clusters present.
- **D-09:** CSV: For N >= 2 clusters, each cluster section begins with a grouping row containing just the cluster name in column A (remaining columns empty).
- **D-10:** CSV aggregate totals row after last cluster section with label "AGGREGATE TOTAL" in column A and summed values in Count/vCPU/RAM/Storage columns.
- **D-11:** CSV structure per cluster: `[cluster name row]` -> `[header row]` -> `[data rows]` -> blank row separator (except before aggregate).
- **D-12:** Single download per user action regardless of cluster count — one `.pptx`, one `.pdf`, one `.csv` file containing all clusters.

### Claude's Discretion

- Exact CSV grouping row formatting (whether to repeat headers per cluster or only show headers once at top)
- PDF cluster header row height and font size within jspdf-autotable
- PPTX aggregate slide: whether to show cluster role badges (hub/spoke/standalone) in column headers

### Deferred Ideas (OUT OF SCOPE)

- Per-cluster chart images in PPTX (each cluster slide uses Phase 16 layout; not explicitly requested)
- Export format selection (choose which clusters to include) — v2.2+
- Separate files per cluster with ZIP download — v2.2+
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLUSTER-04 | PPTX, PDF, and CSV exports include per-cluster sections and an aggregate totals row summing across all clusters | All three composables are pure TS functions that already accept `ClusterSizing` — extending to iterate over all clusters follows the established pattern. `aggregateTotals` already computed in Phase 13. |
</phase_requirements>

---

## Summary

Phase 19 extends the three export composables (`usePptxExport.ts`, `usePdfExport.ts`, `useCsvExport.ts`) to iterate over all configured clusters instead of the single active cluster. The architecture is already well-suited for this change: all three composables use pure data-mapping helper functions (`buildBomTableRows`, `buildPdfTableData`, `buildCsvContent`) that accept a `ClusterSizing` argument, so wrapping them in a `for` loop over `clusterResults[]` is the natural path.

The key data structures are already in place. Phase 13 added `aggregateTotals` to `calculationStore` — a computed that sums `vcpu`, `ramGB`, and `storageGB` across all cluster results. Phase 16 (PPTX) and Phase 17 (PDF) established the single-cluster layouts that are reused per cluster. The ExportToolbar already imports both stores, so no new dependency wiring is required.

The main implementation work is: (1) adding a `clusters.length >= 2` guard in each composable, (2) looping per-cluster slide/section generation inside that guard, and (3) appending the aggregate section after the loop. Filename conventions change to omit the single cluster name (use a generic `all-clusters` token or similar) when multiple clusters are present.

**Primary recommendation:** Modify each composable's main generate function to branch on `clusters.length >= 2`. Reuse all existing pure helpers — no new helper functions needed except `buildAggregatePptxSlide` for the PPTX side-by-side table, which has no existing parallel and must be written fresh.

---

## Standard Stack

### Core (no changes — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pptxgenjs | ^4.0.1 | PPTX generation | Already installed; Phase 16 baseline [VERIFIED: package.json] |
| jsPDF | ^4.2.1 | PDF generation | Already installed; Phase 17 baseline [VERIFIED: package.json] |
| jspdf-autotable | ^5.0.7 | PDF table rendering | Already installed; Phase 17 baseline [VERIFIED: package.json] |
| chart.js | ^4.5.1 | Offscreen chart images for PDF | Already installed; Phase 17 baseline [VERIFIED: package.json] |
| vitest | ^4.1.2 | Unit tests | Already installed; 331 tests passing [VERIFIED: live run] |

**No new npm packages.** REQUIREMENTS.md explicitly states: "New npm packages — all v2.1 features achievable with pptxgenjs, jsPDF, chart.js, Zod, Pinia already installed." [VERIFIED: .planning/REQUIREMENTS.md]

**Installation:** Nothing to install.

---

## Architecture Patterns

### Existing Project Structure (relevant paths)

```
src/
├── composables/
│   ├── usePptxExport.ts       # modify generatePptxReport() + add buildAggregatePptxSlide()
│   ├── usePdfExport.ts        # modify generatePdfReport()
│   ├── useCsvExport.ts        # modify generateCsvReport() + buildCsvContent() or add new helper
│   └── __tests__/
│       ├── usePptxExport.test.ts   # add aggregate slide tests
│       ├── usePdfExport.test.ts    # add multi-cluster PDF tests
│       └── useCsvExport.test.ts    # add multi-cluster CSV tests
├── stores/
│   ├── calculationStore.ts    # already has aggregateTotals (read-only)
│   └── inputStore.ts          # already has clusters[] and activeClusterIndex (read-only)
└── components/results/
    └── ExportToolbar.vue      # no changes required
```

### Pattern 1: The `clusters.length >= 2` Guard

All three composables follow the same branch pattern:

```typescript
// Source: CONTEXT.md D-01
const clusters = input.clusters
const clusterResults = calc.clusterResults

if (clusters.length >= 2) {
  // Multi-cluster path: iterate per cluster, then append aggregate
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i]
    const result = clusterResults[i]
    // ... per-cluster section ...
  }
  // ... aggregate section ...
} else {
  // Single-cluster path: identical to Phase 16/17 baseline
  const cluster = clusters[0]
  const result = clusterResults[0]
  // ... existing single-cluster code unchanged ...
}
```

[VERIFIED: CONTEXT.md D-01, confirmed against usePptxExport.ts and useCsvExport.ts existing guard pattern]

### Pattern 2: PPTX Per-Cluster Slide (reuse Phase 16 layout)

The `generatePptxReport` function currently builds a single slide. In multi-cluster mode, the inner slide-building block (from `pptx.addSlide()` through `slide.addTable(bomRows, ...)`) moves into the loop body. The `pptx` instance is created once before the loop and `writeFile` called once after.

```typescript
// Source: usePptxExport.ts — existing single-slide pattern, adapted
const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_WIDE'

for (let i = 0; i < clusters.length; i++) {
  const cluster = clusters[i]
  const sizing = clusterResults[i].sizing
  const slide = pptx.addSlide()
  // ... Phase 16 layout for this cluster (title band, KPI strip, chart, BoM table) ...
}

// Aggregate summary slide (new)
buildAggregatePptxSlide(pptx, clusters, clusterResults, aggregateTotals)

await pptx.writeFile({ fileName: filename })
```

[VERIFIED: usePptxExport.ts — `pptx.writeFile` called once; slide creation in loop is standard pptxgenjs API]

### Pattern 3: PPTX Aggregate Slide — Side-by-Side Table

D-03 defines a table with rows = `[vCPU, RAM (GB), Storage (GB)]` and columns = `[...clusterNames, TOTAL]`.

```typescript
// Source: CONTEXT.md D-03 + pptxgenjs addTable API (plain TableRow[][])
export function buildAggregatePptxSlide(
  pptx: PptxGenJS,
  clusters: ClusterConfig[],
  clusterResults: SizingResult[],
  aggregateTotals: { vcpu: number; ramGB: number; storageGB: number },
): void {
  const slide = pptx.addSlide()

  // Title band (same RH_RED pattern as per-cluster slides)
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: RH_RED } })
  slide.addText('Aggregate Summary', { x: 0.3, y: 0, w: 13.0, h: 0.6,
    fontSize: 20, bold: true, color: WHITE, valign: 'middle' })

  // Header row: ['Metric', ...clusterNames, 'TOTAL']
  const headerRow: TableRow = [
    hdrCell('Metric'),
    ...clusters.map((c) => hdrCell(c.name)),
    hdrCell('TOTAL'),
  ]

  // Data rows: vCPU, RAM (GB), Storage (GB)
  const metrics = [
    { label: 'vCPU',        key: 'vcpu' as const },
    { label: 'RAM (GB)',    key: 'ramGB' as const },
    { label: 'Storage (GB)', key: 'storageGB' as const },
  ]

  const dataRows: TableRow[] = metrics.map(({ label, key }) => [
    cell(label),
    ...clusterResults.map((r) => cell(String(r.sizing.totals[key]))),
    cell(String(aggregateTotals[key])),
  ])

  slide.addTable([headerRow, ...dataRows], {
    x: 1.0, y: 1.2, w: 11.33,
    border: { type: 'solid', color: 'CCCCCC', pt: 0.5 },
    fontSize: 12,
    rowH: 0.45,
  })
}
```

[VERIFIED: usePptxExport.ts — `hdrCell`, `cell`, `TableRow`, `TableCell` type are already defined in the file. `slide.addTable(rows, opts)` pattern confirmed.]

**Column-width note:** For up to 5 clusters + 1 metric label + 1 TOTAL = max 7 columns. pptxgenjs `addTable` distributes width evenly when `colW` is omitted and `w` is set. Alternatively, provide a `colW` array computed at runtime based on `clusters.length`. [ASSUMED — exact colW computation not in official docs viewed; runtime width distribution behavior is standard pptxgenjs but not verified against v4 docs]

### Pattern 4: PDF Multi-Cluster (jspdf-autotable repeated sections)

`generatePdfReport` currently calls `autoTable(doc, { head, body, startY })` once. The multi-cluster pattern calls it once per cluster. The `finalY` from `doc.lastAutoTable.finalY` tracks vertical position for the next section.

```typescript
// Source: usePdfExport.ts existing pattern — adapted for loop
let currentY = 80  // initial y after title block

for (let i = 0; i < clusters.length; i++) {
  const cluster = clusters[i]
  const sizing = clusterResults[i].sizing

  // Cluster name header row (D-06: bold, RH_RED background)
  doc.setFillColor(238, 0, 0)
  doc.rect(40, currentY, 760, 20, 'F')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text(cluster.name, 50, currentY + 14)
  currentY += 24

  // Chart image (D-08: one per cluster)
  const chartDataUrl = buildChartImageDataUrl(sizing)
  if (chartDataUrl) {
    doc.addImage(chartDataUrl, 'PNG', 40, currentY, 500, 125)
    currentY += 130
  }

  // KPI strip
  const kpi = buildKpiStripData(sizing)
  doc.setFillColor(240, 240, 240)
  doc.rect(40, currentY, 760, 22, 'F')
  doc.setFontSize(11)
  doc.setTextColor(21, 21, 21)
  doc.text(kpi.label, 50, currentY + 14)
  currentY += 27

  // BoM table
  const { head, body } = buildPdfTableData(sizing)
  autoTable(doc, { head, body, startY: currentY, ... })
  currentY = (doc as ...).lastAutoTable.finalY + 10
}

// Aggregate totals row (D-07)
autoTable(doc, {
  head: [['AGGREGATE TOTAL', '', ...']],
  body: [[
    'AGGREGATE TOTAL', '',
    String(aggregateTotals.vcpu), String(aggregateTotals.ramGB), String(aggregateTotals.storageGB)
  ]],
  startY: currentY,
  headStyles: { fillColor: [238, 0, 0], textColor: 255 },
})
```

**Page overflow:** `jspdf-autotable` handles automatic page breaks internally when content exceeds the page height. [VERIFIED: usePdfExport.ts uses autoTable which is designed for this; phase 17 baseline already has one autoTable call that may overflow]

**Orientation:** The PDF is already set to `landscape` (A4 landscape = 842pt × 595pt in jsPDF units). [VERIFIED: usePdfExport.ts line 145]

### Pattern 5: CSV Multi-Cluster Structure

D-09/D-10/D-11 define the CSV layout. The existing `buildCsvContent(sizing)` is a pure function that returns a string for a single cluster. For multi-cluster, we need a new function `buildMultiClusterCsvContent` that accepts the full arrays.

```typescript
// Source: CONTEXT.md D-09, D-10, D-11
export function buildMultiClusterCsvContent(
  clusters: ClusterConfig[],
  clusterResults: SizingResult[],
  aggregateTotals: { vcpu: number; ramGB: number; storageGB: number },
): string {
  const sections: string[] = []

  for (let i = 0; i < clusters.length; i++) {
    const clusterName = clusters[i].name
    const sizing = clusterResults[i].sizing

    // Cluster name grouping row (D-09): cluster name in col A, rest empty
    sections.push(`${clusterName},,,,`)

    // Header + data rows (reuse existing helpers)
    const header = 'Node Type,Count,vCPU,RAM (GB),Storage (GB)'
    const dataLines = getNodeEntries(sizing).map(
      (e) => `${e.label},${e.spec.count},${e.spec.vcpu},${e.spec.ramGB},${e.spec.storageGB}`
    )
    // rhoaiOverhead row if present
    const rhoaiLines = sizing.rhoaiOverhead
      ? [`RHOAI Overhead (KServe / DS Pipelines / Model Registry),—,+${sizing.rhoaiOverhead.vcpu},+${sizing.rhoaiOverhead.ramGB},—`]
      : []

    sections.push(header)
    sections.push(...dataLines, ...rhoaiLines)
    sections.push('')  // blank row separator (D-11), including before aggregate row too — see discretion below
  }

  // Remove last blank separator (D-11: "except before aggregate")
  if (sections[sections.length - 1] === '') sections.pop()

  // Aggregate totals row (D-10)
  sections.push(`AGGREGATE TOTAL,,${aggregateTotals.vcpu},${aggregateTotals.ramGB},${aggregateTotals.storageGB}`)

  return sections.join('\n')
}
```

**Claude's discretion — CSV header repeat:** D-11 says `[cluster name row] -> [header row] -> [data rows]`. This means headers ARE repeated per cluster, which aids readability in Excel when clusters span many rows. This research recommends repeating headers per cluster as the more useful format for engineers opening in Excel. [ASSUMED — UX judgment; no user preference stated for this discretion item]

### Pattern 6: Filename Convention for Multi-Cluster

Single cluster: `os-sizer-{cluster-name}-{date}.pptx`
Multi-cluster: `os-sizer-all-clusters-{date}.pptx` (avoid listing all names; keeps filename short)

[ASSUMED — convention follows existing pattern in usePptxExport.ts; no explicit spec in CONTEXT.md]

### Anti-Patterns to Avoid

- **Creating multiple pptx/jsPDF instances in a loop:** Always create ONE instance before the loop and call `writeFile`/`save` once after. Creating a new instance per cluster would trigger multiple simultaneous downloads, violating D-12.
- **Calling pptxgenjs `addChart` with shared options objects:** STATE.md documents that pptxgenjs mutates options in-place. Use the factory function pattern (`makeNodeChartOpts = () => ({ ... })`) already established in Phase 16 — call the factory once per chart, not sharing the same object across clusters.
- **Using `activeClusterIndex` in multi-cluster path:** The multi-cluster loop uses index `i` (0..N-1), not `activeClusterIndex`. The active cluster is irrelevant for aggregate exports.
- **Appending to `generatePdfReport` without `resolvedWarnings` param handling:** The current signature is `generatePdfReport(resolvedWarnings = [])`. For multi-cluster, validation warnings are per-cluster. Either pass all clusters' errors merged, or render per-cluster warnings below each cluster's BoM section. D-08 says chart rendered per cluster — similar logic applies to warnings. CONTEXT.md does not specify multi-cluster warning handling; treat as Claude's discretion or append all warnings at end.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aggregate totals computation | Summing vCPU/RAM/Storage manually in the export composable | `calculationStore.aggregateTotals` | Already computed in Phase 13 as a Pinia computed — single source of truth |
| PDF page breaks | Manual Y-coordinate tracking with page overflow detection | `jspdf-autotable` automatic page break | autoTable handles this internally; manual tracking causes off-by-one errors |
| PPTX table cell styling | Direct pptxgenjs shape manipulation | `hdrCell()` / `cell()` factory functions (already in usePptxExport.ts) | Established pattern; avoids raw object literal duplication |

**Key insight:** Phase 13 was explicitly an "enabler phase" that pre-computed `aggregateTotals` for Phase 19 to consume. Do not recompute aggregates in the export composables.

---

## Common Pitfalls

### Pitfall 1: pptxgenjs Options Object Mutation
**What goes wrong:** Calling `slide.addChart('bar', data, opts)` with the same opts object twice causes the second chart to inherit mutations from the first, producing wrong dimensions or styles.
**Why it happens:** pptxgenjs v4 mutates options objects in-place during rendering.
**How to avoid:** Use factory functions — `const makeOpts = () => ({ x: ..., y: ..., ... })` and call `makeOpts()` fresh for each chart. This is already done in Phase 16 (`makeNodeChartOpts`, `makeVcpuChartOpts`). [VERIFIED: STATE.md pitfall entry + usePptxExport.ts lines 260-272]
**Warning signs:** Second cluster's chart appears offset or uses wrong height.

### Pitfall 2: jsPDF `lastAutoTable.finalY` Stale Value
**What goes wrong:** Reading `doc.lastAutoTable?.finalY` to position the next section returns undefined or a stale value when autoTable has not yet been called, or returns the finalY from the previous iteration.
**Why it happens:** `lastAutoTable` is set synchronously by autoTable and persists until the next call; it is always valid after the first autoTable call per doc instance.
**How to avoid:** Initialize `currentY` before the loop. After each `autoTable(doc, ...)` call, update `currentY` from `doc.lastAutoTable.finalY`. [VERIFIED: usePdfExport.ts lines 194-195 show existing usage pattern]
**Warning signs:** Cluster sections overlap, or blank pages appear.

### Pitfall 3: Chart.js Offscreen Canvas in PDF Per-Cluster Loop
**What goes wrong:** Each `buildChartImageDataUrl(sizing)` call creates a new offscreen canvas and Chart.js instance. If `chart.destroy()` is not called after `toDataURL()`, memory leaks accumulate across N clusters.
**Why it happens:** Chart.js registers the canvas as an active chart — `destroy()` is required to release it.
**How to avoid:** The existing `buildChartImageDataUrl` already calls `chart.destroy()` before returning. No change needed — just verify the pattern is preserved when the function is called in a loop. [VERIFIED: usePdfExport.ts lines 106-107]

### Pitfall 4: CSV Comma Escaping in Cluster Names
**What goes wrong:** A cluster name containing a comma (e.g., "Hub, Primary") breaks CSV column alignment.
**Why it happens:** CSV values with commas must be double-quoted: `"Hub, Primary"`.
**How to avoid:** Wrap cluster names in the grouping row with double quotes: `` `"${clusterName}",,,,` ``. The existing `buildCsvContent` does not quote any values — cluster names are the only values at risk since node type labels are hardcoded English strings. [ASSUMED — no comma-escaping utility exists in the codebase; simple quoting of the cluster name field is sufficient]

### Pitfall 5: ExportToolbar `resolvedWarnings` in Multi-Cluster Mode
**What goes wrong:** `handleExportPdf()` in ExportToolbar currently resolves warnings for `activeClusterIndex` only and passes them to `generatePdfReport`. In multi-cluster mode the composable iterates all clusters, but the caller only passes one cluster's warnings.
**Why it happens:** ExportToolbar uses `activeClusterIndex` to pick one result for warnings.
**How to avoid:** Either (a) update `generatePdfReport` to accept warnings per cluster (`resolvedWarnings[][]`), or (b) have the composable resolve its own warnings from `calc.clusterResults` directly. Option (b) is simpler but requires passing an i18n `t()` function or resolved strings. CONTEXT.md is silent; treat as Claude's discretion. Research recommends option (a) — pass `allResolvedWarnings: string[][] = []` aligned by cluster index, maintaining the existing separation of Vue i18n concerns from the pure-TS composable. [ASSUMED — no explicit decision made in CONTEXT.md]

---

## Code Examples

### Verified Pattern: aggregateTotals Access

```typescript
// Source: src/stores/calculationStore.ts lines 53-62
// aggregateTotals is a computed<{ vcpu: number; ramGB: number; storageGB: number }>
const calc = useCalculationStore()
const totals = calc.aggregateTotals  // { vcpu: N, ramGB: N, storageGB: N }
```

### Verified Pattern: clusterResults[] with clusters[] Paired Iteration

```typescript
// Source: CONTEXT.md code_context + src/stores/calculationStore.ts
// clusterResults[i].sizing paired with inputStore.clusters[i].name
const input = useInputStore()
const calc = useCalculationStore()

for (let i = 0; i < input.clusters.length; i++) {
  const cluster = input.clusters[i]       // ClusterConfig — has .name, .role
  const result = calc.clusterResults[i]   // SizingResult — has .sizing
  const sizing = result.sizing            // ClusterSizing — has .totals, .masterNodes, etc.
}
```

### Verified Pattern: PDF `doc.lastAutoTable.finalY`

```typescript
// Source: src/composables/usePdfExport.ts lines 194-196
const finalY =
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 200
```

Cast pattern must be retained — jsPDF types don't include `lastAutoTable` because it's added by the jspdf-autotable plugin side-effect.

### Verified Pattern: pptxgenjs addTable

```typescript
// Source: src/composables/usePptxExport.ts lines 304-313
slide.addTable(bomRows, {
  x: tableX,
  y: contentY,
  w: tableW,
  colW: [2.0, 0.8, 0.9, 0.9, 1.03],
  border: { type: 'solid', color: 'CCCCCC', pt: 0.5 },
  fontSize: 9,
  rowH: 0.28,
})
```

For the aggregate slide's dynamic-width table (column count = clusters.length + 2), compute `colW` at runtime:
```typescript
const metricColW = 1.5
const availW = 11.33 - metricColW
const clusterColW = availW / (clusters.length + 1)  // +1 for TOTAL column
const colW = [metricColW, ...Array(clusters.length + 1).fill(clusterColW)]
```

### Verified Pattern: Factory Function for pptxgenjs Chart Options

```typescript
// Source: src/composables/usePptxExport.ts lines 260-272 (Phase 16 pattern)
// ALWAYS use factory function — pptxgenjs mutates options in-place
const makeNodeChartOpts = () => ({
  x: chartX, y: contentY, w: chartW, h: nodeChartH,
  barDir: 'col' as const,
  chartColors: [RH_RED],
})
slide.addChart('bar', nodeCountData, makeNodeChartOpts())
```

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 19 is not a rename/refactor/migration phase. It modifies existing composable logic without renaming any stored keys, user IDs, or service names.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 19 modifies existing TypeScript composables. All required tools (Node.js, vitest, pptxgenjs, jsPDF) are confirmed installed from the existing test baseline (331 tests passing). No new external dependencies.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single active-cluster export | Per-cluster iteration with aggregate summary | Phase 19 (this phase) | Export files grow proportionally with cluster count |
| `activeClusterIndex` as the only pivot | Full `clusters[]` + `clusterResults[]` iteration | Phase 19 | Multi-cluster composables ignore `activeClusterIndex` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pptxgenjs distributes table column widths evenly when `colW` is omitted and `w` is set (for aggregate slide dynamic columns) | Code Examples | Columns may render at default width; fix: always compute `colW` array explicitly |
| A2 | CSV headers should be repeated per cluster section (Claude's discretion area) | Pattern 5 | If user prefers single header at top, the CSV structure changes; low risk since it's a discretion item |
| A3 | Multi-cluster filenames should use `all-clusters` token | Pattern 6 | Alternative: concatenate first 2 cluster names; either works |
| A4 | `resolvedWarnings` for multi-cluster PDF: pass per-cluster arrays option (a) rather than merging at ExportToolbar | Pitfall 5 | If option (b) is implemented, the composable gains a Vue i18n dependency; breaks the pure-TS constraint |

---

## Open Questions

1. **PDF validation warnings in multi-cluster mode**
   - What we know: `generatePdfReport(resolvedWarnings)` currently takes a single flat array of resolved strings for the active cluster.
   - What's unclear: CONTEXT.md is silent on whether multi-cluster PDF should show per-cluster warnings or merge all warnings at the end.
   - Recommendation: Accept `resolvedWarningsPerCluster: Array<{ text: string; severity: 'error' | 'warning' }[]> = []` in the function signature. Render each cluster's warnings below its own BoM section. ExportToolbar maps all cluster results to build the array.

2. **PPTX aggregate slide: cluster role badges in column headers**
   - What we know: CONTEXT.md marks this as Claude's discretion.
   - What's unclear: Whether `role` field (hub/spoke/standalone) should appear in the column header cell alongside `cluster.name`.
   - Recommendation: Omit role badges from aggregate slide columns. The per-cluster slides' title bands already include the cluster name; the aggregate slide is a summary table and adding role badges increases visual noise. Keep column headers as plain `cluster.name`.

---

## Project Constraints (from CLAUDE.md)

All directives from the project `CLAUDE.md` apply. The sole project-specific coding instruction is:

1. **Always prefix CLI commands with `rtk`** — applies to all `git`, `vitest`, `tsc`, `pnpm`, and other dev tool invocations. This is a tooling/workflow constraint; it does not affect TypeScript code written in composables.

No additional coding conventions, security requirements, or test framework rules are specified in `CLAUDE.md` beyond the RTK token-saving proxy.

---

## Sources

### Primary (HIGH confidence)
- `src/composables/usePptxExport.ts` — Phase 16 baseline; all patterns verified by direct read
- `src/composables/usePdfExport.ts` — Phase 17 baseline; all patterns verified by direct read
- `src/composables/useCsvExport.ts` — current CSV export; verified by direct read
- `src/stores/calculationStore.ts` — `aggregateTotals` and `clusterResults` computed; verified by direct read
- `src/stores/inputStore.ts` — `clusters[]` and `activeClusterIndex`; verified by direct read
- `src/components/results/ExportToolbar.vue` — integration point; verified by direct read
- `src/engine/types.ts` — `ClusterConfig`, `ClusterSizing`, `SizingResult` types; verified by direct read
- `.planning/phases/19-aggregate-exports/19-CONTEXT.md` — all locked decisions
- `.planning/REQUIREMENTS.md` — CLUSTER-04 acceptance criteria; "no new npm packages" constraint
- `.planning/STATE.md` — tech stack, pitfalls, completed phase history

### Secondary (MEDIUM confidence)
- `src/composables/__tests__/usePptxExport.test.ts` — test patterns for fixture factories and pure-function testing
- `src/composables/__tests__/useCsvExport.test.ts` — test patterns for CSV content assertions
- `src/composables/__tests__/usePdfExport.test.ts` — test patterns including `vi.stubGlobal` for document/canvas

### Tertiary (LOW confidence)
- None — all claims sourced from codebase direct reads or CONTEXT.md decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions read from package.json; no new packages
- Architecture: HIGH — all patterns derived from existing composable code; all data structures confirmed present
- Pitfalls: HIGH — most pitfalls are from STATE.md verified project history + direct code inspection
- Assumptions: 4 items flagged — all low-risk and in Claude's discretion areas

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable stack — pptxgenjs, jsPDF, chart.js are stable libraries)
