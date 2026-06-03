# 9. Virt target utilization and VM Storage line

Date: 2026-06-03

## Status

Accepted

## Context

v2.2.0 OVE sizing packed virt workers to ~100% of allocatable RAM (`byRam = ceil(demand / capacity)`), so reported RAM utilization sat at ~95% with no headroom for live-migration drains, maintenance, or growth. Separately, the VM disk demand (e.g. 51 TB) was invisible in the BOM: per-node `storageGB` showed only the 100 GB OS root disk, and the storage plan was dropped for external-rwx backends.

## Decision

1. **Target utilization.** Add `VirtConfig.targetUtilization` (fraction, default 0.8). `sizeVirtWorkers` counts nodes as `ceil(demand / (capacity × target))` for both RAM and CPU. `nodeVmCapacity` still returns true allocatable capacity, so `ramUtilizationPct`/`cpuUtilizationPct` report the honest steady-state. Redundancy spares (n+1/n+2) remain additive for failover. The engine clamps the target to [0.5, 1.0]; the UI exposes 50–95%.

2. **VM Storage line.** Promote the existing `virtStorage()` result onto `ClusterSizing.virtStorage` and render a dedicated line in BomTable, CSV, PDF, and PPTX: ODF shows usable + raw (replica-3 @ 85%); external-rwx shows usable (provider-managed). `totals.storageGB` is unchanged (node-attached + ODF raw); external-rwx usable is shown only as its own line, never folded into procurement totals.

## Consequences

- Worker counts increase for RAM-bound sizings (the reference 650-VM case: 17→21 base nodes; RAM 97%→~79%).
- The 51 TB storage requirement is always visible regardless of backend.
- `targetUtilization` is optional on the type for back-compat; old sessions fall back to 0.8.
