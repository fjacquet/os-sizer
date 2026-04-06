---
phase: 09-virt-engine-foundation
plan: "04"
subsystem: engine-tests
tags: [vitest, tdd, calcVirt, WARN-02, SNO-virt, recommendation, acceptance-gate]
dependency_graph:
  requires: [09-02, 09-03]
  provides: [phase-9-acceptance-tests]
  affects: [src/engine/addons.test.ts, src/engine/validation.test.ts, src/engine/recommendation.test.ts]
tech_stack:
  added: []
  patterns: [vitest-describe-blocks, TDD-additive-extension]
key_files:
  created: []
  modified:
    - src/engine/addons.test.ts
    - src/engine/recommendation.test.ts
    - src/engine/validation.test.ts
decisions:
  - Existing recommendation virt tests (from P09-03) are in main describe block — no new describe block needed as all VIRT-04 cases already covered
  - Mandatory Step 0 executed — all 8 pre-virt recommendation fixtures updated with virt:false
  - calcVirt tests confirm +1 live migration reserve makes minimum count 4, not 3
  - WARN-02 test for SNO topology verifies VIRT_RWX_REQUIRES_ODF is suppressed AND SNO_VIRT_NO_LIVE_MIGRATION is emitted
metrics:
  duration: "8 min"
  completed_date: "2026-04-01"
  tasks: 3
  files_modified: 3
---

# Phase 9 Plan 4: Unit Tests Summary

**One-liner:** Phase 9 acceptance gate — 8 new Vitest tests covering calcVirt formula, WARN-02 trigger/suppression, with existing SNO-virt and recommendation tests verified passing.

## Test Counts Before and After

| File | Before | After | Delta |
|------|--------|-------|-------|
| addons.test.ts | 8 tests | 12 tests | +4 (calcVirt describe) |
| validation.test.ts | 5 tests | 9 tests | +4 (WARN-02 describe) |
| recommendation.test.ts | 11 tests | 11 tests | 0 (virt tests added in P09-03) |
| calculators.test.ts | 30 tests | 30 tests | 0 (snoVirtMode tests added in P09-03) |
| **Engine total** | **97 tests** | **105 tests** | **+8** |
| **Full suite** | **196 tests** | **204 tests** | **+8** |

## Fixture Updates (Step 0)

All 7 pre-existing `addOns: { odf: false, rhacm: false }` fixtures in `recommendation.test.ts` were updated to `addOns: { odf: false, rhacm: false, virt: false }` to conform with the `RecommendationConstraints.addOns.virt: boolean` required field added in Plan 09-01.

Files updated:
- `src/engine/recommendation.test.ts` — 7 fixtures updated, commit `4f73ac9`

## New Test Cases

### SC1 — calcVirt() Formula (addons.test.ts, commit `5b2d492`)

| Test | Assertion |
|------|-----------|
| Worker count exceeds raw density minimum | `count > 1` for vmCount=10, vmsPerWorker=10 |
| Per-node vCPU = nodeVcpu + 2 | `vcpu === 18` (16 + VIRT_OVERHEAD_CPU_PER_NODE=2) |
| Minimum 4 workers even for 1 VM | `count >= 4` (min 3 + 1 live migration reserve) |
| Density constraint at 100 VMs | `count >= 10` at 10 VMs/worker |

### SC4 — WARN-02 (validation.test.ts, commit `74d4a8f`)

| Test | Assertion |
|------|-----------|
| Trigger: virtEnabled=true, odfEnabled=false, standard-ha | `VIRT_RWX_REQUIRES_ODF` with `severity=warning` emitted |
| Suppress: virtEnabled=true, odfEnabled=true | No `VIRT_RWX_REQUIRES_ODF` |
| Suppress: virtEnabled=false | No `VIRT_RWX_REQUIRES_ODF` |
| SNO topology: dual assertion | No `VIRT_RWX_REQUIRES_ODF` AND `SNO_VIRT_NO_LIVE_MIGRATION` emitted |

### SC2 (recommendation) and SC3 (SNO-virt) — Pre-existing from P09-03

These tests were already committed in Plan 09-03:
- `recommendation.test.ts`: virt=true → +25 score delta, virtWorkloads justificationKey, production key on virt=false, ranked first
- `calculators.test.ts`: snoVirtMode=true → 14/32/170 minimums, SNO_VIRT_NO_HA warning, standard profile unchanged

## Final Vitest Run

```
PASS (204) FAIL (0)
Time: 551ms
```

Engine suite alone: `PASS (105) FAIL (0)` — no pre-existing test regressions.

## Phase 9 Success Criteria Verification

| # | Criterion | Test Location | Status |
|---|-----------|---------------|--------|
| SC1 | calcVirt() returns count > density min with KubeVirt overhead | addons.test.ts `calcVirt` | PASS |
| SC2 | Recommendation gives +25 to standard-ha when virt=true | recommendation.test.ts | PASS |
| SC3 | SNO-virt enforces 14/32/170 minimums | calculators.test.ts `calcSNO` | PASS |
| SC4 | VIRT_RWX_REQUIRES_ODF warning on virtEnabled + no ODF + non-SNO | validation.test.ts `WARN-02` | PASS |
| SC5 | SNO_VIRT_NO_LIVE_MIGRATION on virtEnabled + SNO topology | validation.test.ts `WARN-02` | PASS |

All 5 Phase 9 success criteria are now verifiably proven by automated tests.

## Deviations from Plan

**Step 0 discovery:** The `calculators.test.ts` already contained `snoVirtMode` tests and `recommendation.test.ts` already contained VIRT-04 virt boost tests — both were added during P09-03. The plan's task list for `calculators.test.ts` and a separate VIRT-04 `describe` block in `recommendation.test.ts` were thus not needed. Only `addons.test.ts` (calcVirt) and `validation.test.ts` (WARN-02) required new test blocks.

No functional deviations. All required assertions are covered.

## Known Stubs

None — all test assertions exercise real engine implementations from P09-02 and P09-03.

## Commits

| Hash | Description |
|------|-------------|
| `4f73ac9` | chore(09-04): update recommendation.test.ts fixtures to add virt: false |
| `5b2d492` | test(09-04): add calcVirt describe block with 4 test cases (SC1) |
| `74d4a8f` | test(09-04): add WARN-02 VIRT_RWX_REQUIRES_ODF describe block with 4 test cases (SC4) |

## Self-Check: PASSED
