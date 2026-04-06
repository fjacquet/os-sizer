# Phase 19 Discussion Log

**Date:** 2026-04-05
**Phase:** 19 — Aggregate Exports
**Status:** Context complete, ready for planning

## Gray Areas Discussed

### 1. Single-Cluster Fallback Behavior (D-01)
- **Decision:** When exactly 1 cluster configured, all three export formats produce output identical to Phase 16/17 baseline — no cluster name headers, no aggregate section
- **Guard:** `clusters.length >= 2` activates multi-cluster logic
- **Rationale:** Avoids regressions for the common single-cluster case; pre-sales engineers shouldn't see extra boilerplate when sizing a single site

### 2. PPTX Multi-Cluster Structure (D-02–D-05)
- **Decision:** N cluster slides (one per cluster using Phase 16 single-slide layout) + one aggregate summary slide
- **Aggregate slide:** Side-by-side totals table — rows = vCPU / RAM / Storage, columns = each cluster name + rightmost TOTAL column
- **Data sources:** `aggregateTotals` from calculationStore (Phase 13); per-cluster from `clusterResults[]`
- **Slide title:** "Aggregate Summary"; cluster column headers use `cluster.name` from inputStore.clusters[]
- **Rationale:** Mirrors Phase 16 layout per cluster for consistency; aggregate slide gives pre-sales a single "total" view

### 3. PDF Multi-Cluster Structure (D-06–D-08)
- **Decision:** One jspdf-autotable section per cluster, each preceded by a bold cluster name header row (RH_RED background, full-width)
- **Aggregate:** Append aggregate totals row after last cluster section — "AGGREGATE TOTAL" label, values from aggregateTotals
- **Charts:** One chart image per cluster when multiple clusters present (renders per-cluster above BoM section)
- **Rationale:** Consistent with PDF autoTable patterns already established in Phase 17

### 4. CSV Multi-Cluster Structure (D-09–D-11)
- **Decision:** Cluster name grouping row (column A, remaining columns empty) → header row → data rows → blank separator row per cluster
- **Aggregate:** Single aggregate totals row at end with "AGGREGATE TOTAL" label
- **Header repetition:** Headers repeated per cluster section (not once at top) — clearer when opened in Excel/Sheets
- **Rationale:** Excel-friendly grouping; blank row separators prevent visual merging of sections

### 5. Single Download Per Action (D-12)
- **Decision:** One `.pptx`, one `.pdf`, one `.csv` per user click regardless of cluster count
- **Rationale:** Multi-file ZIP downloads deferred to v2.2+ per scope control

## Deferred Items
- Per-cluster chart images in PPTX (may be implicit if each slide uses Phase 16 layout)
- Export format selection (choose which clusters to include) → v2.2+
- Separate files per cluster with ZIP download → v2.2+

## Next Steps
1. `/gsd-plan-phase 19` — creates 19-01 and 19-02 PLAN.md files
2. `/gsd-execute-phase 19` — implements changes
