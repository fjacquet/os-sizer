---
phase: 06-addon-integration
plan: "06-01"
subsystem: sizing-engine, wizard-ui, i18n
tags: [gap-closure, addons, odf, rhacm, calcCluster, i18n, maxNodes]
dependency_graph:
  requires: []
  provides: [calcODF-dispatch, calcRHACM-dispatch, maxNodes-ui-binding]
  affects: [BomTable, charts, exports-pptx-pdf-csv, recommendation-engine]
tech_stack:
  added: []
  patterns: [post-dispatch-augmentation, clusterField-binding, tdd-red-green]
key_files:
  created: []
  modified:
    - src/engine/calculators.ts
    - src/engine/calculators.test.ts
    - src/components/wizard/Step1EnvironmentForm.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
decisions:
  - "Post-dispatch augmentation pattern in calcCluster() isolates add-on logic from topology functions"
  - "French maxNodes keys use nœuds ligature (consistent with existing FR locale)"
  - "German maxNodes hint uses proper umlaut (für) per Phase 05 decision"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-31"
  tasks: 3
  files_modified: 7
requirements_closed: [ENG-07, ENG-08, REC-02, FORM-05, RES-01, RES-05]
---

# Phase 06 Plan 01: ODF/RHACM Add-on Dispatch + maxNodes UI Summary

**One-liner:** Wired calcODF()/calcRHACM() into calcCluster() post-dispatch and added maxNodes number input to Step1EnvironmentForm with 4-locale i18n support.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for ODF/RHACM dispatch | 4347cee | src/engine/calculators.test.ts |
| 1 (GREEN) | Wire calcODF/calcRHACM into calcCluster | 3f9d2ac | src/engine/calculators.ts |
| 2 | Add maxNodes input + i18n keys | b1ce9e8 | Step1EnvironmentForm.vue, 4x locale JSON |
| 3 | End-to-end verification | (no commit — verification only) | — |

## What Was Done

### Task 1: calcCluster Add-on Dispatch (TDD)

**RED phase:** Added `describe('calcCluster add-on dispatch')` with 6 failing tests in `calculators.test.ts` covering:

- `odfEnabled=true` returns `odfNodes !== null` with count=3, vcpu=16, ramGB=64
- `odfExtraOsdCount=2` scales odfNodes vcpu to 20 and ramGB to 74
- `rhacmEnabled=true` with 50 managed clusters returns small tier (vcpu=8, ramGB=32)
- `rhacmEnabled=true` with 200 managed clusters returns large tier (vcpu=16, ramGB=64)
- Both add-ons enabled returns both non-null with correct totals
- `odfEnabled=false` regression test confirms null returns

**GREEN phase:** Modified `calcCluster()` in `calculators.ts` to:

1. Import `{ calcODF, calcRHACM }` from `./addons`
2. Use a `let result` + switch pattern (instead of direct returns) to enable post-dispatch mutation
3. After dispatch, conditionally assign `sizing.odfNodes = calcODF(...)` when `odfEnabled`
4. After dispatch, conditionally assign `sizing.rhacmWorkers = calcRHACM(...)` when `rhacmEnabled`
5. Recalculate `sizing.totals` via existing `sumTotals()` helper when any add-on is enabled

No topology functions (calcStandardHA, etc.) were modified — add-on augmentation is exclusively in the dispatcher.

### Task 2: maxNodes UI + i18n

Added to `Step1EnvironmentForm.vue`:

- `const maxNodes = clusterField('maxNodes')` computed binding in `<script setup>`
- Number input (`id="max-nodes-input"`, `type="number"`, `min="1"`) in template after HA Level section
- Input converts empty string to `null` and non-empty to `Number()` for `number | null` type

Added to all 4 locale JSON files under the `"environment"` object:

- `"maxNodes"`: label
- `"maxNodesPlaceholder"`: "No limit" / "Aucune limite" / "Keine Begrenzung" / "Nessun limite"
- `"maxNodesHint"`: description

### Task 3: End-to-end Verification

All checks passed:

- `vue-tsc --noEmit`: 0 type errors
- `vitest run`: 123/123 tests passing (117 original + 6 new)
- `vite build`: clean production build, dist/ produced

## Verification Results

```
vue-tsc --noEmit       EXIT 0
vitest run             PASS (123) FAIL (0)
vite build             built in 428ms, EXIT 0
```

Grep verifications:

- `grep 'calcODF\|calcRHACM' calculators.ts` shows import + 2 usage sites
- `grep 'maxNodes' Step1EnvironmentForm.vue` shows binding + 3 template references
- `grep 'maxNodes' en.json` shows 3 keys

## Deviations from Plan

### Auto-applied adjustments

**1. [Rule 2 - Convention] French nœuds ligature applied**

- **Found during:** Task 2 i18n key authoring
- **Issue:** Plan text used "noeuds" (without ligature) but STATE.md decision records "French nœud ligature used consistently for 'nœuds' throughout FR locale"
- **Fix:** Used nœuds (with œ ligature) in fr.json keys per STATE.md decision
- **Files modified:** src/i18n/locales/fr.json

None other — plan executed as written.

## Impact

With this plan complete:

- ODF/RHACM add-on toggles in Step 3 (workload form) now produce actual sizing output
- `BomTable` conditional rows for `odfNodes`/`rhacmWorkers` now render when add-ons are enabled
- Charts and all 3 export formats (PPTX/PDF/CSV) will include add-on node data automatically
- `maxNodes` field in `inputStore` is now settable from Step 1, activating recommendation engine node-budget scoring

## Self-Check: PASSED

Files exist:

- FOUND: src/engine/calculators.ts
- FOUND: src/engine/calculators.test.ts
- FOUND: src/components/wizard/Step1EnvironmentForm.vue
- FOUND: src/i18n/locales/en.json (with maxNodes keys)

Commits exist:

- FOUND: 4347cee (test RED)
- FOUND: 3f9d2ac (feat GREEN)
- FOUND: b1ce9e8 (feat Task 2)
