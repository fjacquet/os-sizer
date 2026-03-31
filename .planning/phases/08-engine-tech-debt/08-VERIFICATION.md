---
phase: 08-engine-tech-debt
verified: 2026-03-31T22:57:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification: []
---

# Phase 08: Engine Tech Debt Verification Report

**Phase Goal:** Fix three deferred tech-debt items: use allocatableRamGB() in HCP calculator, enforce hardware minimums in all topology functions, and show infra nodes for all applicable topologies.
**Verified:** 2026-03-31T22:57:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                              | Status     | Evidence                                                                                               |
|-----|------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------------|
| 1   | calcHCP uses allocatableRamGB(WORKER_RAM_GB) — the inline 28.44 constant is gone   | VERIFIED   | Line 278: `Math.ceil(totalRAM / (allocatableRamGB(WORKER_RAM_GB) * UTIL))`. Zero matches for WORKER_ALLOC_RAM. |
| 2   | calcHCP worker node vcpu/ramGB are clamped with Math.max() against WORKER_MIN      | VERIFIED   | Line 284: `Math.max(WORKER_VCPU, WORKER_MIN.vcpu)`. Line 285: `Math.max(WORKER_RAM_GB, WORKER_MIN.ramGB)`. Exactly 1 match each. |
| 3   | calcHCP returns non-null infraNodes with count=3 when infraNodesEnabled=true       | VERIFIED   | Lines 289-298: conditional `infraNodes` block. Test at line 295-311 passes. |
| 4   | calcHCP totals include infraNodes resources when infraNodesEnabled=true            | VERIFIED   | Line 306: `sumTotals([masterNodes, workerNodes, infraNodes])`. Test at line 319-329 passes. |
| 5   | npm run test passes with all 179+ tests green                                      | VERIFIED   | 186 tests pass across 18 test files. Zero failures. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                          | Expected                                                                   | Status   | Details                                                                                                       |
|-----------------------------------|----------------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------|
| `src/engine/calculators.ts`       | Fixed calcHCP with allocatableRamGB import, Math.max guards, infraNodes branch | VERIFIED | Contains `allocatableRamGB` at import (line 22) and call site (line 278). Math.max guards at lines 284-285. infraNodes branch lines 289-298. |
| `src/engine/calculators.test.ts`  | New test cases for ENG-04, ENG-06, RES-04                                  | VERIFIED | describe block `calcHCP — tech debt gaps (ENG-04, ENG-06, RES-04)` at lines 266-330. Contains `infraNodesEnabled: true`. 7 new test cases added. |

### Key Link Verification

| From                          | To                            | Via                              | Status   | Details                                                                                 |
|-------------------------------|-------------------------------|----------------------------------|----------|-----------------------------------------------------------------------------------------|
| `src/engine/calculators.ts`   | `src/engine/formulas.ts`      | `import { allocatableRamGB }`    | WIRED    | Line 22 imports `allocatableRamGB`; line 278 calls it with `WORKER_RAM_GB`              |
| `calcHCP`                     | `infraNodeSizing(workerNodes.count)` | `addOns.infraNodesEnabled` branch | WIRED | Line 290 checks `addOns.infraNodesEnabled`; line 291 calls `infraNodeSizing(workerNodes.count)` |
| `sumTotals call in calcHCP`   | `infraNodes variable`         | array argument                   | WIRED    | Line 306: `sumTotals([masterNodes, workerNodes, infraNodes])` — infraNodes variable included |

### Data-Flow Trace (Level 4)

Not applicable — `calculators.ts` is a pure TypeScript engine module with no Vue/React rendering and no async data fetching. All data flows through synchronous function arguments and return values, which are covered by the test suite.

### Behavioral Spot-Checks

| Behavior                                                | Command                             | Result            | Status |
|---------------------------------------------------------|-------------------------------------|-------------------|--------|
| All 186 tests pass including 7 new ENG-04/ENG-06/RES-04 | `npm run test`                      | 186 passed, 0 failed | PASS  |
| WORKER_ALLOC_RAM constant absent from calculators.ts   | `grep WORKER_ALLOC_RAM calculators.ts` | 0 matches        | PASS   |
| allocatableRamGB imported and called in calcHCP        | `grep allocatableRamGB calculators.ts` | 3 matches (import, jsdoc, call) | PASS |
| Math.max guards present (vcpu and ramGB)               | `grep "Math.max(WORKER"` | 1 match each | PASS |
| infraNodesEnabled branch exists in calcHCP             | `grep addOns.infraNodesEnabled calculators.ts` | 2 matches (lines 96, 290 — calcStandardHA + calcHCP) | PASS |
| sumTotals in calcHCP includes infraNodes               | `grep sumTotals calculators.ts` | Line 306 confirmed | PASS |

### Requirements Coverage

| Requirement | Source Plan    | Description                                                            | Status    | Evidence                                                                                                        |
|-------------|----------------|------------------------------------------------------------------------|-----------|-----------------------------------------------------------------------------------------------------------------|
| ENG-04      | 08-01-PLAN.md  | Allocatable RAM formula with tiered kernel reservation used in calcHCP | SATISFIED | allocatableRamGB() replaces hardcoded 28.44 at line 278; test at line 267-275 confirms behavior                 |
| ENG-06      | 08-01-PLAN.md  | Minimum hardware constants enforced in calcHCP worker NodeSpec         | SATISFIED | Math.max guards at lines 284-285; storageGB uses WORKER_MIN.storageGB at line 286; 4 tests confirm               |
| RES-04      | 08-01-PLAN.md  | Infra nodes displayed as separate line item when enabled (HCP topology) | SATISFIED | infraNodes branch in calcHCP lines 289-298; sumTotals includes infraNodes; 3 tests confirm including totals diff |

No orphaned requirements: all three IDs (ENG-04, ENG-06, RES-04) are mapped in the plan, implemented in the code, and verified by passing tests. REQUIREMENTS.md traceability table confirms all three are marked Complete under Phase 8 gap closure.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/engine/calculators.ts` | 51, 132, 220, 361 | `infraNodes: null` | Info | Expected — these are in `emptySizing()`, `calcCompact3Node`, `calcTNF`, and `calcManagedCloud` respectively. These topologies legitimately do not support infra nodes. The calcHCP function uses the variable `infraNodes` (not a literal null) at line 303. No false stub. |

No blocker or warning anti-patterns found.

### Human Verification Required

None. All phase-08 changes are pure TypeScript engine logic with full test coverage. No UI rendering, no external services, no visual behavior to verify.

### Gaps Summary

No gaps. All five must-have truths are verified:

1. `allocatableRamGB()` is imported from `./formulas` and called at line 278 — the hardcoded `WORKER_ALLOC_RAM = 28.44` constant has been removed.
2. Math.max guards enforce `WORKER_MIN.vcpu` and `WORKER_MIN.ramGB` minimums in the calcHCP worker NodeSpec (lines 284-285). `storageGB` uses `WORKER_MIN.storageGB` (line 286).
3. The infraNodes branch (lines 289-298) correctly returns a non-null NodeSpec with count=3 when `addOns.infraNodesEnabled` is true.
4. The `sumTotals` call at line 306 includes the `infraNodes` variable so totals grow when infra nodes are enabled.
5. 186 tests pass (7 new tests added for this phase on top of the 179 baseline).

Requirements ENG-04, ENG-06, and RES-04 are all satisfied. calcTNA was correctly left untouched — its `infraNodes` slot holds the arbiter node with different semantics, which is working as intended.

---

_Verified: 2026-03-31T22:57:00Z_
_Verifier: Claude (gsd-verifier)_
