# Project Research Summary

**Project:** os-sizer v2.1 — Export Quality + Multi-Cluster + Session Portability
**Domain:** OpenShift infrastructure pre-sales sizing tool (browser-based, offline-capable)
**Researched:** 2026-04-04
**Confidence:** HIGH — all findings based on direct codebase inspection + verified installed library type definitions

---

## Executive Summary

The os-sizer v2.0 delivered a complete multi-topology sizing engine with Virtualization and RHOAI support. The v2.1 milestone focuses entirely on three user-facing pain points: export quality (charts missing from PPTX and PDF), session portability (no way to save/restore a configuration without the URL), and multi-cluster usability (the data model already supports N clusters but the UI surface does not expose it). None of these features require new npm packages — the full dependency set is already installed.

The recommended approach is infrastructure-first, export-second, UI-last. Three new shared modules must be extracted first: a `useChartData.ts` pure data builder (shared by Vue chart components and export composables), a `downloadBlob` utility (shared by CSV, JSON, and future export formats), and an optional `role` field added to `ClusterConfig`. These prerequisites unlock all parallel work streams. The multi-cluster store infrastructure is already fully implemented in `inputStore` and `calculationStore` — v2.1 adds only the UI surface and aggregate computed values on top of existing reactive data.

The primary technical risks are chart rendering pitfalls in both export formats: a blank canvas bug in jsPDF when `animation: { duration: 0 }` is omitted, and silent chart corruption in pptxgenjs when options objects are reused across `addChart()` calls. A secondary risk is the WARN-02 fix, which requires a schema extension (`rwxStorageAvailable` in `AddOnConfig`) rather than a simple condition change. Both risks are fully documented with specific prevention patterns. The single most important coding discipline to preserve across all v2.1 work is the CALC-02 invariant: `calculationStore` must contain zero `ref()` — all new aggregate values must be `computed()`.

---

## Key Findings

### Stack Additions

**Zero new npm packages required.** All v2.1 features are achievable with the existing dependency set:

| Feature | Libraries Used | Status |
|---------|---------------|--------|
| PPTX charts | pptxgenjs 4.0.1 — `slide.addChart()` native API | Already installed |
| PDF charts | chart.js 4.5.1 offscreen canvas + jsPDF 4.2.1 `addImage()` | Already installed |
| JSON export | `URL.createObjectURL()` + Blob — Browser Web API | No package needed |
| JSON import | `File.text()` + Zod 4.3.6 schema validation | Already installed |
| Multi-cluster state | Extend existing Pinia 3.0.4 stores | Already installed |

**Packages explicitly rejected:**
- `html2canvas` — requires mounted DOM, breaks headless export composable pattern
- `pdfmake` — duplicates PDF capability at ~200 KB extra bundle weight
- `FileSaver.js` — `URL.createObjectURL()` achieves the same with zero dependencies
- `canvas` npm package — Node.js only, not applicable in Vite browser build

### Features: Table Stakes vs Differentiators

**Table stakes (must ship in v2.1):**
- PPTX: at least one chart per deck — a pre-sales PPTX with only tables is considered unfinished
- PPTX: Red Hat branding (red header band, logo, date/author footer) on every slide
- PDF: at least one chart — a PDF sizing report without visuals is considered a draft
- PDF: cover section (topology, environment, date, generated-by)
- Multi-cluster: tab/list navigation between clusters when `clusters.length > 1`
- Multi-cluster: Add/remove cluster controls wired to existing store actions
- Multi-cluster: per-cluster naming with inline editable tab labels
- Multi-cluster: aggregate totals row in exports (sum across all clusters)
- Session JSON export: "Save session" downloads `.json` file
- Session JSON import: "Load session" reads file, validates via Zod, hydrates store
- Session import: user-friendly error feedback on validation failure (not raw Zod errors)
- WARN-02 fix: live migration warning should reference any RWX storage, not ODF exclusively

**Differentiators (add meaningful value, prioritize after table stakes):**
- PPTX: consolidated 1-slide layout (title + summary KPIs + bar chart + BoM table on one slide)
- PPTX: grouped vertical bar chart of node counts by type (native pptxgenjs `BAR`)
- PDF: bar chart image above BoM table — instant visual before the numbers
- PDF: summary KPI callout box (total vCPU / RAM / Storage) between chart and table
- PDF: validation warnings rendered inline with severity icon/color
- Multi-cluster: Hub+Spoke role tagging (`hub` | `spoke` | `standalone` metadata field)
- Multi-cluster: side-by-side comparison table (rows = metrics, columns = clusters, max 5)
- Session JSON: `version` field in exported envelope for forward compatibility
- Session JSON: import preview ("3 clusters: Hub, Spoke-A, Spoke-B") before replacing session

**Deferred to v2.2:**
- Merge-vs-replace import option
- Aggregate BoM in all-clusters PPTX/PDF (per-cluster first, aggregate as follow-up)
- Delta indicators in comparison view (+/- differences from first cluster column)
- Cluster templates or inheritance (Hub settings propagated to spokes)

**Anti-features (explicitly do not build):**
- Do NOT use html2canvas to screenshot Vue chart components for any export
- Do NOT use 3D chart types (`bar3D`) in PPTX — distorts comparative reading
- Do NOT show radar charts for BoM data — inappropriate for hardware counts
- Do NOT implement cloud/server-side session storage — static GitHub Pages app
- Do NOT use localStorage for session persistence — hidden state, bad UX
- Do NOT rebuild the wizard per cluster — reuse existing wizard via `activeClusterIndex`
- Do NOT show more than 5 cluster columns in comparison view (NNGroup cognitive overload limit)
- Do NOT add a table of contents or page numbers to PDF in v2.1

### Architecture: Key Integration Points

The codebase follows a strict 4-layer separation that must be preserved:

```
src/engine/        Pure TypeScript — ZERO Vue imports — formulas + types + validation
src/stores/        Pinia — inputStore (ref) + calculationStore (computed only) + uiStore
src/components/    Vue SFCs — read stores, never call engine directly
src/composables/   Plain TypeScript modules — no Vue lifecycle hooks
```

**Critical invariants:**
- CALC-01: `src/engine/` must never import Vue, Pinia, or Vue ecosystem
- CALC-02: `calculationStore.ts` must contain zero `ref()` — only `computed()`
- Export composables are plain TypeScript, no Vue lifecycle hooks (enables unit testing without DOM)

**New modules required (in build order):**

| Module | Type | Key Responsibility |
|--------|------|--------------------|
| `src/composables/utils/download.ts` | NEW | Shared `downloadBlob` utility — extracted from useCsvExport, reused by useSessionExport |
| `src/composables/useChartData.ts` | NEW | Pure TS chart data builders (`buildVcpuChartData`, etc.) — no Vue imports, accepts `ClusterSizing` |
| `src/engine/types.ts` | Modified | Add optional `role?: 'hub' \| 'spoke'` to `ClusterConfig` |
| `src/stores/calculationStore.ts` | Modified | Add `aggregateTotals` computed (pure arithmetic, no formatting) |
| `src/stores/inputStore.ts` | Modified | Add `copyWorkload(sourceId, targetId)` action |
| `src/composables/useSessionExport.ts` | NEW | JSON export/import — structurally mirrors `hydrateFromUrl()` in useUrlState.ts |
| `src/composables/usePptxExport.ts` | Modified | 1-slide redesign + native pptxgenjs charts via `slide.addChart()` |
| `src/composables/usePdfExport.ts` | Modified | Chart.js offscreen canvas + `doc.addImage()` charts |
| `src/components/results/ComparisonView.vue` | NEW | Side-by-side topology comparison table, max 5 cluster columns |
| `src/components/results/ResultsPage.vue` | Modified | Cluster tab bar + "Add Cluster" button |
| `src/components/results/ExportToolbar.vue` | Modified | JSON import/export buttons |

**Data flow — multi-cluster (already in place):**
```
inputStore.clusters[] (ref, source of truth)
  -> calculationStore.clusterResults[] (computed, one SizingResult per cluster)
  -> calculationStore.aggregateTotals (NEW computed — pure arithmetic sum)
  -> ResultsPage (reads activeClusterIndex to select active result)
  -> ComparisonView (NEW — reads all clusterResults[])
  -> Export composables (iterate clusterResults[] when exporting all clusters)
```

**Chart data flow — new shared util:**
```
useChartData.ts (pure TS, no Vue)
  -> VcpuChart / RamChart / StorageChart (Vue components refactored to delegate)
  -> usePptxExport.ts (maps to pptxgenjs OptsChartData format)
  -> usePdfExport.ts (renders to offscreen canvas for PNG embedding)
```

**Session JSON integration:**
- `useSessionExport.ts` reuses `InputStateSchema` from `useUrlState.ts` directly
- Export: serializes `clusters[]` only — not `ClusterSizing` (recomputable) or uiStore (browser preference)
- Import: `file.text()` -> `JSON.parse` -> `InputStateSchema.safeParse()` -> `clusters.value = [...]` -> `await nextTick()`
- `uiStore` locale and dark mode are intentionally excluded from session JSON

### Top Pitfalls to Watch

**Critical (silent failures with no error thrown):**

1. **Chart.js animation not disabled for PDF export.** If `animation: { duration: 0 }` is omitted, `doc.addImage()` captures the canvas before the first paint and produces a black rectangle. Fix: enforce as a constant in the export helper, not the caller's responsibility. Applies to: PDF redesign phase.

2. **pptxgenjs options object reused across `addChart()` calls.** pptxgenjs mutates option objects in-place (EMU unit conversion). Reusing one options object across multiple calls — common when iterating clusters — silently produces corrupted slide geometry. Fix: factory function returning a fresh object per call. Applies to: PPTX redesign and multi-cluster export phase.

3. **Zero-value node counts passed to pptxgenjs chart.** pptxgenjs treats `0` values as absent data points (GitHub issue #240). Null/absent node pools must be excluded from chart series entirely, not represented as 0. Fix: filter `count > 0` before building chart data. Applies to: PPTX redesign phase.

4. **Pinia array replacement vs index assignment reactivity.** `clusters.value = newArray` (array ref replacement) triggers reactivity; `clusters.value[0] = newCluster` (index assignment) does NOT. Session import must use full array replacement. Applies to: session import phase.

5. **`calculationStore.clusterResults` stale after cluster removal.** Components holding a cached local index variable will access the wrong cluster after `removeCluster()` shifts indices. Components must always read `activeClusterIndex` from the store reactively, never cache it across async operations. Applies to: multi-cluster UI phase.

**Moderate (visible bugs, fixable with care):**

6. **jsPDF `lastAutoTable.finalY` cast broken for multi-cluster tables.** The existing `lastAutoTable` cast only tracks the most recently rendered table. For multi-cluster aggregate PDFs, capture `autoTable()` return value directly: `const { finalY } = autoTable(doc, {...})`. Applies to: PDF redesign phase.

7. **Unicode characters (FR/DE/IT accents) render as boxes in PDF.** jsPDF's default Helvetica font does not support Latin Extended characters. Fix: embed a NotoSans or Roboto Base64 subset using `addFileToVFS()` + `addFont()`. Required for any locale-translated header/footer text. Applies to: PDF redesign phase.

8. **`doc.save()` and `pptx.writeFile()` lose user gesture context after `await`.** Safari iOS and some popup blockers intercept downloads when the async dynamic import is not pre-warmed. Fix: call `import('jspdf')` and `import('pptxgenjs')` eagerly in `onMounted` so the module is cached; the `await import(...)` in the click handler then resolves synchronously. Applies to: PDF and PPTX export phases.

9. **File input does not fire `change` event on second import of same file.** Reset `event.target.value = ''` after every import attempt in the `finally` block. Applies to: session import UI phase.

10. **WARN-02 fix requires schema extension, not just condition change.** Simply removing `!odfEnabled` from the warning condition would fire the warning for all virt-enabled clusters. The correct fix adds `rwxStorageAvailable: boolean` (default `false`) to `AddOnConfig`, updates the wizard Step 3 UI, and changes the condition to `virtEnabled && !odfEnabled && !rwxStorageAvailable`. Rename the warning code to `VIRT_RWX_STORAGE_REQUIRED`. Update all 4 locale files and all tests in the same commit. Applies to: WARN-02 fix phase.

---

## Implications for Roadmap

The build order is driven by three dependency chains: (A) shared infrastructure must precede individual feature work, (B) export composables depend on `useChartData.ts`, and (C) multi-cluster UI must precede aggregate export testing. These chains are independent of each other and can be parallelized within a phase.

### Suggested Phase Structure

**Phase 1: Foundation Infrastructure (no dependencies, build first)**
- Extract `src/composables/utils/download.ts` (shared `downloadBlob`)
- Add `src/composables/useChartData.ts` (pure TS chart data builders, ClusterSizing -> ChartDataRow[])
- Add optional `role?: 'hub' | 'spoke'` to `ClusterConfig` in `engine/types.ts`
- Update `InputStateSchema` in `useUrlState.ts` with `.optional().default('standalone')` for `role`
- Add `aggregateTotals` computed to `calculationStore` (pure arithmetic, CALC-02 compliant)
- Add `copyWorkload(sourceId, targetId)` action to `inputStore`

Rationale: Zero user-visible changes, pure infrastructure. Unlocks all parallel work in Phase 2. CALC-02 compliance must be verified before any other store work begins.
Research flag: Standard patterns — no research phase needed.

**Phase 2A: Session JSON Export/Import (depends on Phase 1 downloadBlob + existing InputStateSchema)**
- Implement `useSessionExport.ts` (export: blob download; import: `file.text()` -> safeParse -> store patch)
- Add JSON import/export buttons to `ExportToolbar.vue`
- Error mapping: Zod errors -> user-readable toast messages
- File input reset pattern (`event.target.value = ''` in `finally`)
- `await nextTick()` after import before navigation
- Session file size guard (100 KB max)

Rationale: Lowest complexity, highest immediate user value. URL sharing breaks for large multi-cluster configs — session JSON unblocks that use case for pre-sales. Estimated effort: 1 day.
Research flag: Standard patterns — no research phase needed.

**Phase 2B: PPTX Redesign with Charts (depends on Phase 1 useChartData)**
- Refactor Vue chart components to delegate data building to `useChartData.ts`
- Redesign `usePptxExport.ts`: consolidated 1-slide layout, pptxgenjs native `slide.addChart()`
- Bar chart: `BAR` (`barDir: 'col'`) — node counts by type
- Stacked bar (if 3+ node types): vCPU contribution per pool
- Doughnut (skip for SNO/compact-3node with <3 slices)
- Red Hat color palette: primary `EE0000`, secondary `151515`, tertiary `CCCCCC`
- Factory function for chart options objects (prevents options reuse pitfall)
- Filter zero-count node pools before chart data construction

Rationale: Single most-requested improvement — pre-sales ship PPTX to customers. Estimated effort: 2 days.
Research flag: Standard patterns — pptxgenjs native chart API is well-documented.

**Phase 2C: WARN-02 Fix (independent, no phase dependencies)**
- Add `rwxStorageAvailable: boolean` (default `false`) to `AddOnConfig` in `engine/types.ts`
- Update wizard Step 3: show "RWX-capable storage available" checkbox when `virtEnabled=true`
- Change validation condition: `virtEnabled && !odfEnabled && !rwxStorageAvailable`
- Rename warning code `VIRT_RWX_REQUIRES_ODF` -> `VIRT_RWX_STORAGE_REQUIRED`
- Update all 4 locale files, all test fixtures, `createDefaultClusterConfig()` in `defaults.ts`
- Add three test cases: ODF enabled, RWX available, neither

Rationale: Self-contained correctness fix, no architectural dependencies. Can be merged independently. Estimated effort: 0.5 days.
Research flag: No research needed — fix semantics are fully specified.

**Phase 3: PDF Redesign with Charts (depends on Phase 1 useChartData)**
- Redesign `usePdfExport.ts`: Chart.js offscreen canvas -> `canvas.toDataURL()` -> `doc.addImage()`
- `animation: { duration: 0 }` enforced as a constant in the export helper
- Replace `lastAutoTable` cast with `autoTable()` return value
- Embed Unicode-capable font (NotoSans Base64 subset) via `addFileToVFS()` + `addFont()`
- Summary KPI callout box between chart and BoM table
- Validation warnings inline with severity color
- Pre-warm dynamic jsPDF import in `onMounted` to preserve user gesture context
- Set `rowPageBreak: 'avoid'` and `showHead: 'everyPage'` for multi-section tables

Rationale: Rounds out the export story after PPTX redesign. Estimated effort: 1-2 days.
Research flag: Standard patterns — document canvas-to-PNG approach in code comments for future maintainers.

**Phase 4: Multi-Cluster UI (depends on Phase 1 store extensions)**
- ResultsPage: horizontal cluster tab bar above wizard, editable labels (double-click), Add (+) and Remove (x) controls
- Tab click -> `inputStore.activeClusterIndex = idx` (zero store changes, purely reactive)
- Wizard reuse: existing wizard operates on `activeClusterIndex` — no duplication needed
- Hub+Spoke role selector in cluster tab or settings panel
- `compareMode` toggle button in results header, visible when `clusters.length > 1`
- `ComparisonView.vue`: sticky first column, scrollable cluster columns, max 5 columns
- Component local state for comparison view (promote to uiStore only if URL sharing of comparison state is needed)

Rationale: Enables the Hub+Spoke pre-sales use case, the primary driver for multi-cluster support. Estimated effort: 2-3 days.
Research flag: Standard patterns — tab strip and comparison table are well-established UI patterns. Use table layout (not cards) per NNGroup research.

**Phase 5: Aggregate Multi-Cluster Exports (depends on Phases 2B, 3, 4)**
- Update `usePptxExport.ts`: optional `mode: 'active' | 'all'` parameter; `'all'` adds one slide per cluster + aggregate summary slide
- Update `usePdfExport.ts`: one autoTable section per cluster (with cluster name header) + aggregate totals row
- Update `useCsvExport.ts`: cluster name as grouping row, single-file output (avoid zip dependency)
- Single download trigger per user action (never loop + download per cluster)
- Guard: validate `clusterIdx` not out-of-bounds before filename construction

Rationale: Builds on individual-cluster redesigns to add aggregate BoM — last export feature because it requires multi-cluster UI to exist for testing. Estimated effort: 1-2 days.
Research flag: No research needed — patterns established in Phases 2B and 3.

### Phase Ordering Summary

| Phase | Delivers | Key Risk to Avoid |
|-------|----------|-------------------|
| 1: Foundation | useChartData, downloadBlob, role field, aggregateTotals | CALC-02 violation in new store computeds |
| 2A: Session JSON | Export/import composable, toolbar buttons | Reactivity bug on import (use `await nextTick()`) |
| 2B: PPTX Charts | Native pptxgenjs charts, 1-slide layout | Options object reuse, zero-value series |
| 2C: WARN-02 | Corrected RWX validation, schema extension | Condition widened too broadly, stale tests |
| 3: PDF Charts | Canvas chart images, Unicode font, KPI callout | Blank canvas (animation not disabled), finalY cast |
| 4: Multi-Cluster UI | Tab strip, comparison view, cluster roles | Stale index after cluster removal |
| 5: Aggregate Exports | Per-cluster + aggregate PPTX/PDF/CSV | Multiple simultaneous downloads (browser blocks) |

Phases 2A, 2B, and 2C can be worked in parallel after Phase 1 completes.
Phase 3 can begin alongside Phase 2B (same `useChartData` dependency, different export format).
Phase 4 can begin alongside Phases 2-3 (different dependency chain: store extensions).
Phase 5 requires all of 2B, 3, and 4 to be done before aggregate export is testable end-to-end.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All features verified against locally installed type definitions; zero new packages |
| Features | HIGH | Official pptxgenjs + jsPDF docs; UX research from NNGroup for comparison table limits |
| Architecture | HIGH | Direct source code analysis; multi-cluster data model already in place |
| Pitfalls | HIGH for rendering pitfalls (reproduced from GitHub issues); MEDIUM for session migration patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **PDF Unicode font delivery:** The correct approach (NotoSans Base64 embedded via `addFileToVFS`) is known, but the specific font subset generation tooling (subsetting to cover FR/DE/IT characters only) is not pre-baked. Phase 3 planning should decide: embed full NotoSans-Regular (~300 KB) or generate a subset (~30 KB) via `pyftsubset` at build time.

- **Safari iOS download limitation for JSON session export:** `<a download>` is not honoured in Safari on iOS. The clipboard fallback (copy JSON to clipboard) is the recommended degradation, but UX design for the fallback UI is not specified. Flag as a known limitation in release notes; implement clipboard fallback if stakeholder feedback indicates iPad usage by the target pre-sales audience.

- **WARN-02 backward compatibility with v2.0 exported sessions:** v2.0 sessions will not have `rwxStorageAvailable` in their `AddOnConfig`. The Zod schema must use `.optional().default(false)` for this field to accept v2.0 imports without error. Verify the existing `InputStateSchema` uses `.optional()` or `.default()` consistently throughout before writing the new field.

- **Comparison view URL sharing:** The current design uses component-local state for comparison view. If pre-sales engineers need to share a "comparison view" URL (e.g., to show a customer), this will not work until `comparisonClusterIds` is promoted to URL state. Defer to v2.2 unless explicitly requested.

---

## Sources

### STACK.md Sources (HIGH confidence — locally verified)
- pptxgenjs type definitions: `node_modules/pptxgenjs/types/index.d.ts` (v4.0.1)
- jsPDF type definitions: `node_modules/jspdf/types/index.d.ts` (v4.2.1)
- chart.js package.json: `node_modules/chart.js/package.json` (v4.5.1)
- Pinia stores: `src/stores/inputStore.ts`, `src/stores/calculationStore.ts`
- Browser File API (`File.text()`, `URL.createObjectURL()`): MDN Web Docs standard

### FEATURES.md Sources
- [PptxGenJS Charts API](https://gitbrent.github.io/PptxGenJS/docs/api-charts/)
- [Table vs Cards vs List — UX Patterns for Developers](https://uxpatterns.dev/pattern-guide/table-vs-list-vs-cards)
- [Comparison Table Pattern](https://uxpatterns.dev/patterns/data-display/comparison-table)
- [Bar vs Pie Chart — Syncfusion](https://www.syncfusion.com/blogs/post/bar-vs-pie-blazor-charts)
- [NNGroup — Comparison tables overwhelm beyond 5 options](https://smart-interface-design-patterns.com/articles/pricing-plans/)

### ARCHITECTURE.md Sources
- Direct code reading: `src/stores/inputStore.ts`, `src/stores/calculationStore.ts`, `src/stores/uiStore.ts`
- Direct code reading: `src/composables/useUrlState.ts`, `usePptxExport.ts`, `usePdfExport.ts`, `useCsvExport.ts`
- Direct code reading: `src/engine/types.ts`, `src/components/results/ResultsPage.vue`, `ExportToolbar.vue`

### PITFALLS.md Sources
- [PptxGenJS object mutation bug](https://github.com/gitbrent/PptxGenJS/issues) — options object mutated in-place
- [PptxGenJS zero values missing in line chart #240](https://github.com/gitbrent/PptxGenJS/issues/240)
- [jsPDF AutoTable UTF-8 support #391](https://github.com/simonbengtsson/jsPDF-AutoTable/issues/391)
- [jsPDF Unicode languages support #2093](https://github.com/parallax/jsPDF/issues/2093)
- [Pinia reactivity: array replacement patterns](https://pinia.vuejs.org/api/pinia/functions/storeToRefs.html)
- [Pinia composing stores — useStore() before await](https://pinia.vuejs.org/cookbook/composing-stores.html)
- [Firefox Blob URL memory release bug #939510](https://bugzilla.mozilla.org/show_bug.cgi?id=939510)
- [Zod safeParse documentation](https://zod.dev/)

---

*Research completed: 2026-04-04*
*Ready for roadmap: yes*
