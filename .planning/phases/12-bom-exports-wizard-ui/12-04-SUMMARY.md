---
phase: 12-bom-exports-wizard-ui
plan: "04"
subsystem: exports
tags: [bom, csv, pptx, pdf, gpu, virt, rhoai, exports]
dependency_graph:
  requires: [12-01, 12-02, 12-03]
  provides: [GPU-03, RHOAI-04, VIRT-01]
  affects: [useCsvExport, usePptxExport, usePdfExport, BomTable]
tech_stack:
  added: []
  patterns: [null-guard spread-conditional, post-dispatch add-on pattern]
key_files:
  created: []
  modified:
    - src/composables/useCsvExport.ts
    - src/composables/usePptxExport.ts
    - src/composables/usePdfExport.ts
decisions:
  - "RHOAI annotation row uses em-dash placeholder for Count and Storage columns — rhoaiOverhead is { vcpu, ramGB } not a NodeSpec"
  - "All 3 exports committed atomically per plan anti-pattern guidance — partial export updates produce inconsistent BoMs"
metrics:
  duration: "~8 min"
  completed: "2026-04-04"
  tasks: 1
  files: 3
requirements: [GPU-03, RHOAI-04, VIRT-01]
---

# Phase 12 Plan 04: BoM Exports — Virt/GPU/RHOAI Rows Summary

One-liner: CSV, PPTX, and PDF exports now include Virt Workers, GPU Nodes, and RHOAI Overhead rows with null-guard pattern matching BomTable.vue.

## What Was Done

Task 1 (BomTable.vue) was already complete (commit `c52dd50`). This execution completed Task 2 only.

### Task 2: Update all three export composables (commit `9e303e0`)

**Files modified:**
- `src/composables/useCsvExport.ts`
- `src/composables/usePptxExport.ts`
- `src/composables/usePdfExport.ts`

**Pattern applied in all three:**

`getNodeEntries()` / `entries` array extended with:
```typescript
...(sizing.virtWorkerNodes ? [{ label: 'Virt Workers', spec: sizing.virtWorkerNodes }] : []),
...(sizing.gpuNodes ? [{ label: 'GPU Nodes', spec: sizing.gpuNodes }] : []),
```

RHOAI annotation row added to each export's output function using:
```typescript
const rhoaiRows = sizing.rhoaiOverhead
  ? [[ 'RHOAI Overhead (KServe / DS Pipelines / Model Registry)', '—', `+${sizing.rhoaiOverhead.vcpu}`, `+${sizing.rhoaiOverhead.ramGB}`, '—' ]]
  : []
```

The `—` placeholder is used for Count and Storage columns because `rhoaiOverhead` is `{ vcpu, ramGB }` — not a full `NodeSpec`.

## Verification Results

- `tsc --noEmit`: exits 0
- `vitest run src/composables/__tests__/`: 37 PASS, 0 FAIL
- `vitest run` (full suite): 248 PASS, 0 FAIL (up from 245 — 3 previously failing tests now pass)
- All 4 files (`BomTable.vue` + 3 composables) contain `virtWorkerNodes`, `gpuNodes`, `rhoaiOverhead` references

## Decisions Made

1. **RHOAI row uses em-dash for Count/Storage columns** — `rhoaiOverhead` type is `{ vcpu: number; ramGB: number }` with no count or storage fields; em-dash clearly signals "not applicable" rather than zero.
2. **Atomic commit across all 3 composables** — plan explicitly warned that partial export updates produce inconsistent BoMs across display and download formats.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three export formats now fully wire virtWorkerNodes, gpuNodes, and rhoaiOverhead from ClusterSizing to their respective output.

## Self-Check: PASSED

Files verified present:
- `src/composables/useCsvExport.ts` — FOUND, contains `virtWorkerNodes`, `gpuNodes`, `rhoaiOverhead`
- `src/composables/usePptxExport.ts` — FOUND, contains `virtWorkerNodes`, `gpuNodes`, `rhoaiOverhead`
- `src/composables/usePdfExport.ts` — FOUND, contains `virtWorkerNodes`, `gpuNodes`, `rhoaiOverhead`

Commits verified:
- `9e303e0` — feat(12-04): add virtWorkerNodes, gpuNodes, rhoaiOverhead rows to all 3 exports — FOUND
- `c52dd50` — feat(12-04): add virtWorkerNodes, gpuNodes rows and RHOAI annotation to BomTable.vue — FOUND (Task 1, prior session)
