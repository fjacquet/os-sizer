---
phase: 09
plan: "03"
subsystem: engine
tags:
  - calculators
  - recommendation
  - sno-virt
  - kubevirt
  - virt-04
  - sno-01
dependency_graph:
  requires:
    - "09-01 (SNO_VIRT_MIN constant + snoVirtMode type field + RecommendationConstraints.addOns.virt)"
    - "09-02 (calcVirt() + post-dispatch virt augmentation)"
  provides:
    - "calcSNO() snoVirtMode conditional branch — 14 vCPU / 32 GB / 170 GB override when snoVirtMode=true"
    - "SNO_VIRT_NO_HA warning emitted on SNO+Virt deployments"
    - "scoreStandardHa() virt score boost (+25) and virtWorkloads justificationKey"
  affects:
    - "src/engine/calculators.ts — calcSNO()"
    - "src/engine/recommendation.ts — scoreStandardHa()"
tech_stack:
  added: []
  patterns:
    - "Conditional spec override: ternary on config.addOns.snoVirtMode to select SNO_VIRT_MIN vs profile base"
    - "Score boost pattern: additive flag check (c.addOns.virt) before clampScore()"
    - "justificationKey ternary: different i18n key returned based on constraint flag"
key_files:
  created: []
  modified:
    - src/engine/calculators.ts
    - src/engine/calculators.test.ts
    - src/engine/recommendation.ts
    - src/engine/recommendation.test.ts
decisions:
  - "SNO_VIRT_NO_HA warning severity is 'warning' (not 'error') — SNO+Virt is supported, not forbidden; the warning signals that live migration and HA are unavailable"
  - "snoVirtMode branch uses SNO_VIRT_MIN regardless of snoProfile — spec override takes full precedence (SNO-01 requirement)"
  - "virt score test uses edge environment to avoid datacenter+haRequired clamping that would obscure the true 25-point delta"
  - "justificationKey 'recommendation.standardHa.virtWorkloads' is a string token only — translation will be added in Phase 12"
metrics:
  duration: "8 min"
  completed: "2026-04-01"
  tasks: 2
  files: 4
---

# Phase 9 Plan 03: SNO-with-Virt Profile + Recommendation Engine Summary

Pure engine changes: calcSNO() extended with SNO_VIRT_MIN override when snoVirtMode=true, and scoreStandardHa() boosted by +25 points with a virt-specific justificationKey when VM workloads are present.

## What Was Built

### Task 1: calcSNO() snoVirtMode Branch (SNO-01)

`src/engine/calculators.ts` — `calcSNO()` now applies `SNO_VIRT_MIN` (14 vCPU / 32 GB / 170 GB) when `config.addOns.snoVirtMode === true`, overriding the profile-based lookup entirely. The profileMap and `base` resolution are preserved — snoVirtMode only activates when explicitly enabled, leaving all normal SNO profile paths (standard, edge, telecom-vdu) unchanged.

A `SNO_VIRT_NO_HA` warning is emitted when snoVirtMode is true. This is an implicit behavioral constraint of SNO-01: the boosted hardware minimums are required, and the warning signals to users that live migration and HA (which depend on multiple nodes) are unavailable on single-node deployments.

**Implementation details:**
- `SNO_VIRT_MIN` imported from `./constants` (added in 09-01: `{ count: 1, vcpu: 14, ramGB: 32, storageGB: 170 }`)
- Ternary selection: `const spec = config.addOns.snoVirtMode ? SNO_VIRT_MIN : base`
- Warning: `{ code: 'SNO_VIRT_NO_HA', severity: 'warning', messageKey: 'warnings.sno.virtNoHa' }`

### Task 2: scoreStandardHa() Virt Score Boost (VIRT-04)

`src/engine/recommendation.ts` — `scoreStandardHa()` adds +25 to the fit score when `c.addOns.virt === true` and switches the justificationKey to `'recommendation.standardHa.virtWorkloads'`. When virt is false, the score formula and justificationKey are unchanged.

**Score formula (updated):**
```
base 70 + 20 datacenter + 10 haRequired − 50 if maxNodes < 5 + 25 if virt workloads
```

**Why +25:** Standard-ha is the only topology that supports live migration (VIRT-03 requirement). When VM workloads are present, the recommendation engine must surface standard-ha above compact-3node and SNO alternatives that cannot provide the same capabilities. +25 is large enough to dominate over compact-3node (base 50 + 30 = 80) even in minimal configurations.

## SNO_VIRT_NO_HA Warning Rationale

The `SNO_VIRT_NO_HA` warning is an implicit behavioral constraint of SNO-01, not a separate requirement. SNO-01 mandates the boosted hardware minimums (14/32/170); the warning is the user-facing signal that explains the consequence: on a single-node deployment, there is no second node for live migration or HA failover.

This traceability is documented in the warning comment and in the PLAN.md traceability note. If SNO-01 requirements change, the warning should be re-evaluated for promotion to a first-class requirement ID.

## Test Coverage

**Task 1 (calculators.test.ts):** 5 new tests added
- `snoVirtMode=true` returns 14/32/170 (SNO_VIRT_MIN)
- `snoVirtMode=true` emits SNO_VIRT_NO_HA warning
- `snoVirtMode=false, standard` returns 8/16/120 with no warnings
- `snoVirtMode=false, edge` returns vcpu=8, ramGB=32
- `snoVirtMode=false, telecom` returns vcpu=24

**Task 2 (recommendation.test.ts):** 5 new tests added
- `virt=true` justificationKey is `recommendation.standardHa.virtWorkloads`
- `virt=false` justificationKey is `recommendation.standardHa.production`
- `virt=true` score is 25 points higher (using edge env to avoid clamping)
- `datacenter + haRequired + virt=true` score capped at 100
- `virt=true` standard-ha ranked first in results

**makeConfig helper** updated with Phase 9 addOn defaults (virtEnabled, vmCount, vmsPerWorker, virtAvgVmVcpu, virtAvgVmRamGB, snoVirtMode) and environment fields (environment, haRequired, airGapped, maxNodes).

## Verification

```
TSC: 0 errors
Engine tests: PASS (97) FAIL (0)
calculators.test.ts: PASS (51)
recommendation.test.ts: PASS (13)
```

All pre-existing tests remain green (no regressions).

```
grep checks:
- calculators.ts: snoVirtMode (2), SNO_VIRT_MIN (2), SNO_VIRT_NO_HA (2) — all present
- recommendation.ts: addOns.virt (2), virtWorkloads (1) — all present
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test score delta used clamping-prone environment**

- **Found during:** Task 2 GREEN phase
- **Issue:** The test "virt=true: standard-ha fitScore is 25 points higher" used `environment: 'datacenter'` which adds +20, pushing the virt score to 115 → clamped to 100, producing only a 10-point observable delta instead of 25
- **Fix:** Changed test to use `environment: 'edge'` (no environment bonus), giving base 70 vs 95 — observable delta = 25 as intended
- **Files modified:** `src/engine/recommendation.test.ts`
- **Commit:** `95ff0fc`

## Known Stubs

None — all changes are functional engine logic with no UI dependency. The `justificationKey: 'recommendation.standardHa.virtWorkloads'` is a string token that will be wired to i18n translations in Phase 12.

## Self-Check: PASSED

- FOUND: src/engine/calculators.ts
- FOUND: src/engine/recommendation.ts
- FOUND: .planning/phases/09-virt-engine-foundation/09-03-SUMMARY.md
- FOUND: commit 71a6f94 (Task 1 — calcSNO snoVirtMode branch)
- FOUND: commit 95ff0fc (Task 2 — scoreStandardHa virt boost)
