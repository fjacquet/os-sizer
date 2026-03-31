---
plan: 02-04
status: complete
---
# Plan 02-04 Summary

Implemented three add-on calculator functions in `src/engine/addons.ts` and converted all `it.todo()` stubs in `src/engine/addons.test.ts` into real passing assertions.

## Functions implemented

- **calcODF(extraOsdCount)** — Returns a `NodeSpec` for 3 ODF storage nodes. Base sizing is 16 vCPU / 64 GB per node; each extra OSD adds +2 vCPU and +5 GB. `storageGB` is 0 because storage capacity is provided by the OSDs themselves.

- **calcInfraNodes(workerCount)** — Returns a `NodeSpec` for 3 infra nodes by delegating to the existing `infraNodeSizing()` formula for the vCPU/RAM lookup. Each node gets 100 GB of local storage.

- **calcRHACM(managedClusters)** — Returns a `NodeSpec` for 3 RHACM hub workers in two tiers: small (8 vCPU / 32 GB) for fewer than 100 managed clusters, large (16 vCPU / 64 GB) for 100 or more.

## Test results

All 46 tests pass (6 test files, 0 failures). The 8 new addon tests replaced the previous `it.todo()` stubs covering all boundary values from VALIDATION.md.
