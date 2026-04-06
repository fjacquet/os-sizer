# Features Research

**Domain:** Export quality, multi-cluster sizing, and session portability for OpenShift sizing tool
**Milestone:** v2.1 Export
**Researched:** 2026-04-04
**Confidence:** HIGH (official library docs + UX research + codebase inspection)

---

## Context: Already Built (do not rebuild)

- PPTX export: 2-slide layout (slide 1: summary table, slide 2: BoM table) via pptxgenjs — no charts
- PDF export: BoM table only via jsPDF + jspdf-autotable — no charts
- CSV export: flat BoM rows
- URL sharing: lz-string + Zod `InputStateSchema` covering full multi-cluster state
- Charts in UI: 3 bar charts (vCPU/RAM/Storage by node type) via chart.js + vue-chartjs
- Multi-cluster store: `inputStore.clusters[]` array already supports N clusters; `calculationStore.clusterResults[]` computes all of them reactively
- `InputStateSchema` (Zod) already serializes the full `clusters[]` array — used by URL sharing

---

## Feature Area 1: PPTX Redesign

**Table stakes:**
- At least one chart in the slide deck. A pre-sales PPTX with only tables is considered unfinished — charts are expected in any 2025-era proposal template.
- Branding consistency: Red Hat red header band, logo placement, date/author footer on every slide.
- BoM table remains — architects need the numbers, not just visuals.

**Differentiators:**
- Consolidated 1-slide layout (title + summary key-values + bar chart + BoM table on one slide) — reduces the deck from 2 slides to 1 actionable slide. Pre-sales can drop it directly into a customer deck without restructuring.
- Bar chart of node counts by type (grouped vertical bar): shows how many masters, workers, infra, ODF, GPU nodes at a glance. This is the most readable chart for hardware count data with 2-7 categories. Supported natively by pptxgenjs (`pres.charts.BAR` with `barDir: 'col'`).
- Stacked bar chart of total resource distribution (vCPU + RAM by node type): allows the customer to see which node pool dominates the resource footprint. Effective with 2-5 segments; the current codebase has at most 7 node types making this borderline — limit to the 4-5 most resource-heavy pools.
- Pie/donut chart for node-type share of total nodes: works well when there are 3-6 slices. If only 2 node types are present (e.g. compact-3node), skip it — pie with 2 slices adds no information.

**Anti-features:**
- Do NOT add a slide per node type — one-slide-per-subject is a PowerPoint antipattern for a BoM summary.
- Do NOT use 3D charts (bar3d, bubble3d) — pptxgenjs supports them but they distort comparative reading and are considered unprofessional in technical proposals.
- Do NOT embed vue-chartjs canvas screenshots via html2canvas — this is fragile (DOM-dependent, timing issues, font rendering varies). pptxgenjs has native chart support; use it.
- Do NOT attempt radar charts for BoM data — they are for multi-dimensional performance comparison, not hardware counts.

**Chart recommendations (pptxgenjs native):**
- Primary: `BAR` chart (`barDir: 'col'`) with node-count-per-type labels. Simple, immediately readable, no legend needed if labels are on bars.
- Secondary (if 3+ node types): Stacked `BAR` chart showing vCPU contribution per node type. Limit to clusters with 3+ node types.
- Tertiary (optional): `DOUGHNUT` for percentage share of total nodes. Skip for SNO and compact-3node (too few slices).
- All charts: Red Hat color palette — primary series `EE0000`, secondary `151515`, tertiary `CCCCCC`.

**Complexity:** MEDIUM
- pptxgenjs native chart API is well-documented. The data already exists in `ClusterSizing`. The work is layout arithmetic (x/y/w/h positioning on 10×7.5 in slide) and choosing which chart fits in the 1-slide constraint.
- The 1-slide layout requires careful column splitting: left column = summary key-values table + bar chart; right column = BoM table. At LAYOUT_WIDE (13.33×7.5 in) this is feasible.

**Dependencies:** Existing `buildBomTableRows`, `buildArchSummaryData`, `generatePptxReport`.

---

## Feature Area 2: PDF Redesign

**Table stakes:**
- Charts in PDF. A PDF sizing report without charts looks like a draft. Pre-sales architects delivering customer proposals expect a polished layout with at least one visual.
- Cover section with topology, environment, date, generated-by.
- BoM table remains (it is the primary deliverable).

**Differentiators:**
- Bar chart image embedded above the BoM table showing node counts by type. This gives the customer an instant visual before they read the numbers.
- Summary KPI row (total vCPU / RAM / Storage) as a highlighted callout box between the chart and the table — not buried in table footer text.
- Validation warnings rendered inline (with severity icon/color) so the recipient sees any architectural constraints without opening the app.

**Anti-features:**
- Do NOT use html2canvas to screenshot the Vue chart components. This approach is fragile (JSDOM vs browser differences, font loading races, file size bloat from PNG images). It also makes the PDF non-portable (text not selectable, font rendering inconsistent).
- Do NOT switch from jsPDF + jspdf-autotable to pdfmake for v2.1. The existing jsPDF investment is solid for this use case; pdfmake would require a full rewrite of `usePdfExport.ts` with no user-visible benefit.
- Do NOT add a table of contents or page numbering in v2.1 — complexity not justified for a 1-2 page BoM report.

**Chart implementation for PDF:**
- Use chart.js `Chart` in a detached OffscreenCanvas (or a hidden `<canvas>`) to generate PNG data URLs, then embed via `doc.addImage()`. This keeps the chart generation pure TypeScript, no DOM dependency, and avoids html2canvas entirely.
- Alternatively, draw the bar chart manually using jsPDF `doc.rect()` + `doc.text()` calls (pure geometry). For a simple bar chart with ≤8 bars, this is ~50 lines and avoids any canvas dependency. Recommended for testability.
- Chart dimensions: full-width bar chart at ~600×180 pt in landscape A4 leaves room for the BoM table below it on the same page.

**Complexity:** MEDIUM
- jsPDF `addImage()` with a canvas data URL is well-established. The challenge is generating the chart without Vue reactivity (pure TypeScript canvas draw or chart.js headless render).
- The manual rect-draw approach is simpler and fully testable — no async canvas rendering, no font loading.

**Dependencies:** Existing `buildPdfTableData`, `generatePdfReport`, `getNodeEntries`.

---

## Feature Area 3: Multi-Cluster Sizing UX

**Table stakes:**
- Tab or list navigation between clusters. When `inputStore.clusters.length > 1`, the UI must provide a way to switch between configurations. A tab strip (matching existing wizard step pattern) is the standard pattern in configurator tools.
- Add cluster / remove cluster controls. These already exist in `inputStore` (`addCluster`, `removeCluster`) but need UI surfaces.
- Per-cluster naming. `ClusterConfig.name` already exists. An inline editable label on the tab is expected.
- Aggregate BoM export: when exporting with multiple clusters, the export must either show each cluster separately or show a combined total — both are expected. The combined total row is the table-stakes minimum.

**Differentiators:**
- Side-by-side topology comparison view: display all clusters in a comparison table where rows are node types and columns are clusters. Allows pre-sales to show a customer "Hub cluster needs X, each spoke needs Y" in a single screen.
- Hub+Spoke role tagging: let the user mark one cluster as "Hub" and others as "Spoke N". Purely a labeling concern — affects display name and export section headers, not sizing logic.
- Aggregate BoM row in exports: a final row (or separate section) summing totals across all clusters. Useful for procurement: total vCPU, RAM, Storage across the full deployment.

**Anti-features:**
- Do NOT implement cluster templates or inheritance (spoke inherits from hub settings). Too complex for v2.1, and the Hub cluster is typically sized differently from spokes anyway.
- Do NOT show more than 5 clusters side-by-side in the comparison view — Nielsen Norman research establishes cognitive overload beyond 5 comparison columns. Cap the comparison view at 5 and show a note if more are defined.
- Do NOT rebuild the wizard per cluster — the existing wizard already works on `activeClusterIndex`. The multi-cluster UX should reuse the existing wizard by switching `activeClusterIndex`, not duplicating wizard state.
- Do NOT add cluster-level topology recommendation "winner" aggregation — each cluster has its own topology and that is correct.

**UX layout recommendation:**
- Cluster selector: horizontal tab strip above the existing wizard. Tab label = cluster name (editable on double-click or via settings icon). Add (+) button at right end of tab strip. Remove (×) on each tab except when only 1 cluster exists.
- Comparison view: accessible as a second view mode (toggle button in results area). Table format: rows = metric (topology, total vCPU, total RAM, total storage, node counts by type), columns = clusters. Sticky first column (metric labels). This pattern is consistent with UX research showing tables outperform cards for structured side-by-side comparison.
- Aggregate totals: shown as a final column in the comparison table labeled "Total" — not a separate page.

**Complexity:** MEDIUM-HIGH
- The store already supports multi-cluster. The work is entirely UI: tab strip component, comparison table component, and updating all export composables to iterate `clusterResults[]` instead of `clusterResults[clusterIdx]`.
- Export changes: `generatePptxReport` and `generatePdfReport` must accept an optional `mode: 'active' | 'all'` parameter. In `'all'` mode they iterate all clusters.

**Dependencies:** `inputStore.clusters[]`, `calculationStore.clusterResults[]`, existing wizard, existing export composables.

---

## Feature Area 4: Session JSON Export / Import

**Table stakes:**
- Download session as JSON file. User clicks "Save session" and gets a `.json` file. The file contains the full `InputState` (clusters array). This is the minimum expected by any configurator tool that supports "save your work".
- Load session from JSON file. User clicks "Load session" and selects a `.json` file. The file is parsed, validated against `InputStateSchema`, and loaded into `inputStore`.
- Error feedback on malformed import. If the file fails schema validation, show a user-readable error (not a raw console warning).

**Differentiators:**
- Version field in exported JSON for forward compatibility. Add a `version: '2.1'` field to `InputState` so future schema changes can apply migration logic.
- Import preview: before replacing the current session, show a brief summary of what will be loaded ("3 clusters: Hub, Spoke-A, Spoke-B") and ask for confirmation. Prevents accidental data loss.
- Merge vs replace option: on import, offer "Replace current session" or "Add clusters to current session". Merge is a differentiator; replace is table stakes.

**Anti-features:**
- Do NOT implement cloud save / server-side session storage. This is a static GitHub Pages app — no backend. Session JSON is the correct offline-first approach.
- Do NOT use localStorage for persistence. URL sharing already covers the "share a config" use case. localStorage adds hidden state that confuses users who expect a fresh start on each visit. JSON export is explicit and user-controlled.
- Do NOT create a proprietary binary format. Plain JSON validated by the existing Zod schema is the right approach — it is human-readable, diffable, and reuses existing `InputStateSchema`.

**Implementation notes:**
- Export: `JSON.stringify(inputState, null, 2)` + `Blob` + `URL.createObjectURL` + synthetic `<a>` click. ~10 lines of code.
- Import: `FileReader` reads the file, `JSON.parse`, `InputStateSchema.safeParse`, then `store.clusters = result.data.clusters.map(c => ({ ...c, id: crypto.randomUUID() }))`. This is identical in structure to `hydrateFromUrl()` already in `useUrlState.ts`.
- The Zod schemas (`InputStateSchema`, `ClusterConfigSchema`) already cover the full state shape. Re-use them directly — do not write a second validation layer.
- File extension: `.json`. MIME type: `application/json`. Filename pattern: `os-sizer-session-YYYY-MM-DD.json`.

**Complexity:** LOW
- The serialization infrastructure already exists in `useUrlState.ts`. Session export/import is a thin wrapper around the same Zod schemas with file I/O instead of URL param I/O.
- Estimated effort: 1 composable (`useSessionExport.ts`), 1 small UI component (import/export buttons in ExportToolbar or a new SessionToolbar).

**Dependencies:** `InputStateSchema` from `useUrlState.ts`, `inputStore`, `ExportToolbar.vue`.

---

## Feature Area 5: Side-by-Side Topology Comparison

**Table stakes:**
- Comparison table showing all configured clusters in columns. Rows: topology, environment, node counts by type, total vCPU/RAM/Storage.
- Accessible from the results page without leaving the current workflow.

**Differentiators:**
- Highlight column with best fit score (highest total fit score from recommendations). Subtle background accent on the "recommended" cluster column.
- Delta indicators: if two clusters are the same topology, show +/- difference from the first cluster in subsequent columns for quantitative metrics (e.g. "Workers: 6 (+2)").
- Export comparison as PDF or CSV — one page/file showing all clusters side by side.

**Anti-features:**
- Do NOT use card layout for comparison. Research from Nielsen Norman Group and UX pattern studies consistently shows tables outperform cards for structured side-by-side attribute comparison. Cards are for browsing; tables are for comparing.
- Do NOT attempt a radar/spider chart for topology comparison. Radar charts require normalized axes across incomparable dimensions (vCPU, RAM, node count) and produce misleading visuals when scales differ by orders of magnitude.
- Do NOT make the comparison view the default — keep single-cluster results as the landing state. Comparison view is a secondary mode.

**Layout recommendation:**
- Toggle button "Compare all clusters" in results header, only visible when `clusters.length > 1`.
- Table: sticky left column with metric labels, scrollable right columns for each cluster. Max 5 cluster columns before scrolling kicks in.
- Mobile: horizontal scroll with sticky first column is the correct pattern (matches comparison table UX research for dense data).

**Complexity:** LOW-MEDIUM
- Pure UI work: a `ComparisonTable.vue` component consuming `clusterResults[]` and `clusters[]`. No engine changes required.
- The data is already computed in `calculationStore.clusterResults`.

**Dependencies:** `calculationStore.clusterResults[]`, `inputStore.clusters[]`.

---

## Feature Dependencies

```
Multi-cluster UX (tab strip)
  → Session JSON export (exports all clusters)
  → Side-by-side comparison (displays all clusters)
  → PPTX/PDF redesign in 'all' mode (iterates all clusters)

Session JSON export
  → InputStateSchema (already exists in useUrlState.ts)

PPTX chart redesign
  → pptxgenjs native chart API (already a dependency)

PDF chart redesign
  → jsPDF addImage OR manual rect drawing (no new dependencies)
```

---

## MVP Recommendation for v2.1

Prioritize in this order:

1. **Session JSON export/import** — lowest complexity, highest user value (URL sharing breaks for large configs with many clusters). ~1 day.
2. **PPTX redesign with bar chart** — single most-requested improvement (pre-sales ship PPTX to customers). ~2 days.
3. **PDF redesign with chart** — rounds out the export story. ~1-2 days.
4. **Multi-cluster tab strip UX** — enables the Hub+Spoke use case. ~2-3 days.
5. **Side-by-side comparison view** — adds value but depends on multi-cluster UX. ~1-2 days.
6. **Bug fix WARN-02** — live migration requires any RWX storage, not ODF exclusively. ~0.5 days. Can be done first as a standalone fix.

Defer to v2.2:
- Merge-vs-replace import option (import preview is sufficient for v2.1)
- Aggregate BoM export in 'all-clusters' PPTX/PDF (do per-cluster pages first, aggregate as a follow-up)
- Delta indicators in comparison view

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| PPTX chart types (pptxgenjs) | HIGH | Official pptxgenjs docs + charts API page |
| PDF chart embedding (jsPDF) | HIGH | Official jsPDF docs + community patterns confirmed |
| Session JSON export/import | HIGH | Codebase inspection — Zod schemas already exist |
| Multi-cluster UX patterns | MEDIUM | UX research (NNGroup, uxpatterns.dev) + codebase inspection |
| Side-by-side comparison layout | HIGH | Multiple UX research sources agree on table > cards for comparison |
| Chart type selection (bar over pie) | HIGH | Multiple data viz sources + sizing data characteristics |

---

## Sources

- [PptxGenJS Charts API](https://gitbrent.github.io/PptxGenJS/docs/api-charts/) — native bar/pie/doughnut chart support
- [Stacked Bar Charts — Atlassian](https://www.atlassian.com/data/charts/stacked-bar-chart-complete-guide) — when stacked bar outperforms pie
- [Table vs Cards vs List — UX Patterns for Developers](https://uxpatterns.dev/pattern-guide/table-vs-list-vs-cards) — tables win for side-by-side comparison
- [Comparison Table Pattern](https://uxpatterns.dev/patterns/data-display/comparison-table) — column-per-option, row-per-attribute
- [Using jsPDF, html2Canvas, and Vue](https://dev.to/jringeisen/using-jspdf-html2canvas-and-vue-to-generate-pdfs-1f8l) — html2canvas pitfalls documented
- [Bar vs Pie Chart — Syncfusion](https://www.syncfusion.com/blogs/post/bar-vs-pie-blazor-charts) — bar preferred for multi-category hardware data
- [NNGroup — Comparison tables overwhelm beyond 5 options](https://smart-interface-design-patterns.com/articles/pricing-plans/) — cap comparison at 5 columns
