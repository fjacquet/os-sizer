---
phase: 02-sizing-engine
plan: 05
subsystem: engine
tags: [recommendation, engine, tdd, topology-scoring]
dependency_graph:
  requires: ["02-01"]
  provides: ["recommendation-engine"]
  affects: ["wizard-step-3", "calculation-store"]
tech_stack:
  added: []
  patterns: ["constraint-scoring", "hard-exclusion", "fitness-ranking"]
key_files:
  created:
    - src/engine/recommendation.ts
  modified:
    - src/engine/recommendation.test.ts
decisions:
  - "fitScore=0 used as hard-exclusion sentinel — excluded from results array entirely"
  - "scoreTopology dispatches via switch to 8 dedicated scoring functions for clarity"
  - "MicroShift gets +50 (not +40 like SNO) for far-edge — reflects lighter footprint advantage"
metrics:
  duration_minutes: 2
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  completed_date: "2026-03-31"
requirements: [REC-01, REC-02, REC-03]
---

# Phase 02 Plan 05: Recommendation Engine Summary

**One-liner:** Constraint-to-topology scoring engine ranking all 8 OpenShift topologies by fitness with hard exclusions for air-gap and HA incompatibilities.

## What Was Built

`src/engine/recommendation.ts` — exports a single `recommend(constraints)` function that:
1. Scores all 8 OpenShift topologies using dedicated scoring functions
2. Applies hard exclusions (fitScore=0) for incompatible combinations
3. Filters out zero-score topologies
4. Returns results sorted by fitScore descending

Topology scoring rules implemented:
- **standard-ha**: base 70, +20 datacenter, +10 haRequired, -50 if maxNodes < 5
- **compact-3node**: base 50, +30 if maxNodes <= 3, +10 datacenter, -30 if workers > 20
- **sno**: base 40, +40 far-edge/edge, +10 if maxNodes=1; fitScore=0 if haRequired
- **two-node-arbiter**: base 30, +20 if maxNodes <= 3, +10 haRequired; tech preview warning
- **two-node-fencing**: base 25, +20 if maxNodes <= 2, +10 haRequired; tech preview + BMC warning
- **hcp**: base 40, +30 if workers >= 20, +10 rhacm, -20 if maxNodes < 6
- **microshift**: base 30, +50 far-edge, +10 if maxNodes=1; fitScore=0 if haRequired
- **managed-cloud**: base 60, +30 cloud, -40 non-cloud; fitScore=0 if airGapped

## Test Coverage

7 test cases, all passing (38 total in full suite):
1. Datacenter + HA required → standard-ha ranked first
2. Far-edge → SNO or MicroShift in top 2
3. Air-gapped → managed-cloud excluded entirely
4. Budget-constrained (maxNodes<=3) → compact-3node in top 2
5. Cloud environment → managed-cloud ranked first
6. Every justificationKey is a non-empty string without spaces
7. Results always sorted by fitScore descending

Plus implicit test: HA required excludes SNO and MicroShift from results.

## Commits

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| RED phase | test | ff071e7 | Add failing tests for recommendation engine |
| GREEN phase | feat | d1cf52f | Implement recommendation engine |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 8 topologies fully scored, all justificationKeys populated with valid i18n keys.

## Self-Check: PASSED

- FOUND: src/engine/recommendation.ts
- FOUND: src/engine/recommendation.test.ts
- FOUND: 02-05-SUMMARY.md
- FOUND: ff071e7 (RED phase commit)
- FOUND: d1cf52f (GREEN phase commit)
