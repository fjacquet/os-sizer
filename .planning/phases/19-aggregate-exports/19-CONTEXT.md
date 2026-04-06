# Phase 19: Aggregate Exports - Context

**Gathered:** 2026-04-05 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

All three export formats (PPTX, PDF, CSV) are extended to cover every configured cluster in a single download, with per-cluster sections and an aggregate totals section. Single-cluster exports are unchanged. This phase depends on Phase 16 (PPTX redesign), Phase 17 (PDF redesign), and Phase 18 (Multi-Cluster UI) being complete.

</domain>

<decisions>
## Implementation Decisions

### Single-Cluster Fallback
- **D-01:** When exactly 1 cluster is configured, all three export formats produce output **identical to the Phase 16/17 baseline** — no cluster name headers, no aggregate section. Multi-cluster logic is gated on `clusters.length >= 2`.

### PPTX Multi-Cluster Structure (CLUSTER-04)
- **D-02:** For N ≥ 2 clusters: generate N individual slides (one per cluster, using the Phase 16 single-slide layout) followed by one aggregate summary slide
- **D-03:** Aggregate summary slide contains a **side-by-side totals table**: rows = vCPU / RAM (GB) / Storage (GB); columns = each cluster name + a rightmost `TOTAL` column summing all clusters
- **D-04:** Aggregate totals sourced from `calculationStore.aggregateTotals` (already computed in Phase 13); per-cluster values from `calculationStore.clusterResults[]`
- **D-05:** Aggregate slide title: "Aggregate Summary" — cluster name column headers use `cluster.name` from `inputStore.clusters[]`

### PDF Multi-Cluster Structure (CLUSTER-04)
- **D-06:** For N ≥ 2 clusters: render one jspdf-autotable section per cluster, each preceded by a cluster name header row (bold, RH_RED background, full-width spanning all columns)
- **D-07:** After the last cluster section, append an aggregate totals row in the same table or as a separate styled row — uses `aggregateTotals` for vCPU/RAM/Storage values, label "AGGREGATE TOTAL"
- **D-08:** Chart (Phase 17) rendered per cluster above its BoM section — one chart image per cluster when multiple clusters present

### CSV Multi-Cluster Structure (CLUSTER-04)
- **D-09:** For N ≥ 2 clusters: each cluster section begins with a grouping row containing just the cluster name in column A (remaining columns empty) — visually separates clusters when opened in Excel/Sheets
- **D-10:** After the last cluster section, append an aggregate totals row with label "AGGREGATE TOTAL" in column A and summed values in Count/vCPU/RAM/Storage columns
- **D-11:** CSV structure per cluster: `[cluster name row]` → `[header row]` → `[data rows]` → blank row separator (except before aggregate)

### Export Trigger
- **D-12:** Single download per user action regardless of cluster count — one `.pptx`, one `.pdf`, one `.csv` file containing all clusters. No multiple simultaneous downloads.

### Claude's Discretion
- Exact CSV grouping row formatting (whether to repeat headers per cluster or only show headers once at top)
- PDF cluster header row height and font size within jspdf-autotable
- PPTX aggregate slide: whether to show cluster role badges (hub/spoke/standalone) in column headers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Export composables to modify
- `src/composables/usePptxExport.ts` — `generatePptxReport()` signature and slide generation logic (Phase 16 baseline)
- `src/composables/usePdfExport.ts` — `generatePdfReport()` signature and autoTable logic (Phase 17 baseline — may still be in progress)
- `src/composables/useCsvExport.ts` — CSV generation function

### Data sources
- `src/stores/calculationStore.ts` — `clusterResults[]`, `aggregateTotals` (Phase 13)
- `src/stores/inputStore.ts` — `clusters[]` for cluster names and roles

### Integration point
- `src/components/results/ExportToolbar.vue` — passes cluster data to export composables; no signature changes needed beyond passing all clusters vs. active cluster

### Requirements
- `.planning/REQUIREMENTS.md` §CLUSTER-04 — exact acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `aggregateTotals` computed in calculationStore — direct use for aggregate slide/row/totals
- `clusterResults[i].sizing` + `clusters[i].name` — paired iteration for per-cluster sections
- `buildBomTableRows(sizing)` in usePptxExport.ts — call once per cluster
- `buildPdfTableData(sizing)` in usePdfExport.ts — call once per cluster
- Phase 16 `buildNodeCountChartData`, `shouldShowVcpuChart`, `buildVcpuStackedChartData` — reusable per-cluster chart data

### Established Patterns
- `clusters.length >= 2` guard to activate multi-cluster logic (D-01)
- Dynamic import pattern (`import('pptxgenjs')`, `import('jspdf')`) — retain, call once per export action
- `downloadBlob()` from `src/composables/utils/download.ts` — used by CSV; PPTX uses `pptx.writeFile`, PDF uses `doc.save`

### Integration Points
- All three composables currently use `activeClusterIndex` to pick one cluster — replace with full iteration when `clusters.length >= 2`
- `ExportToolbar.vue` calls each export function — may need to pass `clusters` + `clusterResults` arrays instead of single values

</code_context>

<specifics>
## Specific Ideas

- PPTX aggregate slide layout confirmed: side-by-side table with cluster columns + TOTAL column (preview: rows=vCPU/RAM/Storage, last column=summed TOTAL)

</specifics>

<deferred>
## Deferred Ideas

- Per-cluster chart images in PPTX (Phase 16 chart on each cluster's slide) — may be implicitly included since each cluster slide uses Phase 16 layout; not explicitly requested
- Export format selection (choose which clusters to include) — v2.2+
- Separate files per cluster with ZIP download — v2.2+

</deferred>

---

*Phase: 19-aggregate-exports*
*Context gathered: 2026-04-05*
