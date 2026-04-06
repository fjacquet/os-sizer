---
plan: 02-03
status: complete
---
# Plan 02-03 Summary

## What was implemented

Created `/Users/fjacquet/Projects/os-sizer/src/engine/calculators.ts` (230+ lines) with all 9 exported functions:

- `calcStandardHA` — 3 CP nodes (sized via CP_SIZING_TABLE) + N workers (sized by workload formula, min 2), optional infra nodes when `addOns.infraNodesEnabled`.
- `calcCompact3Node` — 3 master nodes that double as workers; `workerNodes` is null.
- `calcSNO` — Single-node topology; routes `snoProfile` to SNO_STD_MIN / SNO_EDGE_MIN / SNO_TELECOM_MIN.
- `calcTNA` — 2 CP nodes (TNA_CP_MIN) + 1 arbiter (TNA_ARBITER_MIN) stored in `infraNodes`; emits `TNA_TECH_PREVIEW` warning.
- `calcTNF` — 2 CP nodes (TNF_CP_MIN); emits `TNF_TECH_PREVIEW` (warning) and `TNF_REDFISH_REQUIRED` (error).
- `calcHCP` — Derives management cluster worker count from `hcpHostedClusters × (idle CPU/RAM + QPS-scaled overhead)` at 70% utilisation; min 3 workers; 3 CP nodes from CP_MIN.
- `calcMicroShift` — Single-node; vCPU/RAM = max(system minimum, workload-derived value + 2 overhead); storage ≥ 100 GB.
- `calcManagedCloud` — Zero-hardware result; emits `MANAGED_CLOUD_NO_HARDWARE` warning.
- `calcCluster` — Dispatcher switch routing to all 8 topology calculators.

Updated `/Users/fjacquet/Projects/os-sizer/src/engine/calculators.test.ts` with real assertions replacing all `it.todo()` stubs, covering topology-specific specs, warnings (codes, severities, messageKeys), null/non-null node groups, totals arithmetic, scaling behaviour, and the dispatcher.

## Test results

```
Test Files  7 passed | 1 skipped (8)
     Tests  79 passed | 1 todo (80)
  Duration  271ms
```

All 79 active tests pass; the 1 todo is unrelated (pre-existing in another test file).
