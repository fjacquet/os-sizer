# OVE Headroom + Storage Visibility — Design

**Date:** 2026-06-03
**Mode affected:** Virtualization (OVE), shipped in v2.2.0
**Status:** Approved for planning

## Problem

A v2.2.0 Virtualization-mode sizing (650 VMs — 2000 vCPU, 8000 GB guest RAM, 51,000 GB VM disk — onto 19 Virt Workers of 128 threads / 512 GB) exposed two defects in the OVE sizing output:

1. **Storage is invisible.** The 51 TB of VM disk demand never reaches the node BOM. `assembleVirtCluster.ts` hard-codes every Virt Worker's `storageGB` to `WORKER_MIN.storageGB` (100 GB OS root disk). The real VM storage lives only in `virtStorageGB`, which is `0` for an `external-rwx` backend (`storage.ts`), and the CSV export (`useCsvExport.ts`) has no storage line for it. A reader sees ~2.2 TB of storage when 51 TB usable (≈180 TB raw under ODF replica-3) is required. For `external-rwx`, the requirement is omitted from `totals.storageGB` entirely.

2. **RAM pegged at ~95% by design.** `sizeVirtWorkers.ts` sizes the worker pool with `byRam = ceil(ramDemand / ramCapacityGB)` — it packs to 100% of allocatable RAM with no headroom buffer. RAM is the limiting resource here (~17 base nodes for ~8.2 TB demand), so utilization always lands at ~95–100%. The rest of the engine uses `TARGET_UTILIZATION = 0.7`, but the virt worker path ignores it. The n+1/n+2 spares cover a node failure, but steady-state at 95% leaves no room for live-migration drains, maintenance, or growth.

Both are design gaps in the new mode.

## Goals

- Provision virt workers against a configurable steady-state **target utilization** (default 80%) so reported RAM/CPU utilization is honest and leaves operational headroom.
- Surface the VM disk storage requirement as an explicit, always-visible **VM Storage** line (usable + raw) in every output, regardless of backend.
- Expose the target utilization as a **user-adjustable UI control** alongside overcommit and redundancy.

## Non-goals

- Changing the redundancy (n+1/n+2 spare) model.
- Changing the per-node OS-disk sizing (stays at `WORKER_MIN.storageGB`).
- Changing container-mode sizing.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Headroom mechanism | Steady-state target utilization (`nodes = ceil(demand / (capacity × target))`); spares remain on top for failover |
| Default target | 80% (`0.8`) |
| CPU treatment | Target applies to **both** RAM and CPU |
| Configurability | **UI knob** wired through `VirtConfig` + defaults + i18n + tests |
| Storage output | **Dedicated "VM Storage" line** (usable + raw), per backend |
| `external-rwx` in totals | **Not** folded into `totals.storageGB` (provider-managed); always shown as its own line |

## Design

### Part A — Target utilization (RAM + CPU headroom)

**Type.** Add to `VirtConfig` (`src/engine/types.ts`):

```ts
targetUtilization?: number // fraction; UI 50–95%, engine clamps [0.5, 1.0]; steady-state RAM/CPU target, default 0.8
```

**Constant** (`src/engine/constants.ts`):

```ts
/** Steady-state RAM/CPU utilization target for virt workers. Headroom for drains/maintenance/growth. */
export const DEFAULT_TARGET_VIRT_UTILIZATION = 0.8
export const MIN_TARGET_VIRT_UTILIZATION = 0.5
export const MAX_TARGET_VIRT_UTILIZATION = 1.0 // 1.0 = explicit full-pack; UI restricts to 0.95
```

**Sizing** (`src/engine/virtualization/sizeVirtWorkers.ts`). Apply the target when counting nodes; leave `nodeVmCapacity` returning **true** allocatable capacity so the utilization metrics stay honest:

```ts
const target = config.targetUtilization
const byCpu = cap.vcpuCapacity > 0 ? Math.ceil(demand.totalVcpu / (cap.vcpuCapacity * target)) : 0
const byRam = cap.ramCapacityGB > 0 ? Math.ceil(ramDemand / (cap.ramCapacityGB * target)) : 0
const byDensity = Math.ceil(demand.totalVms / MAX_VMS_PER_NODE) // unchanged — hard cap
```

`cpuUtilizationPct` and `ramUtilizationPct` continue to divide demand by `baseNodes × true capacity`, so they report the achieved steady-state (~79% for the reference scenario) rather than the packing ceiling.

`capacity.ts` (`nodeVmCapacity`) is **unchanged**.

**Reference scenario result:** base workers 17 → **21**; RAM utilization 97% → **~79%**; with default n+2 redundancy, total nodes 19 → 23.

### Part B — VM Storage visibility

`virtStorage()` (`src/engine/virtualization/storage.ts`) already returns `{ usableGB, rawGB, backend }`. Promote it onto the sizing result instead of discarding it.

**Type** (`src/engine/types.ts`). Add to `ClusterSizing`:

```ts
/** VM disk storage plan (virtualization mode); null in container mode. */
virtStorage: { usableGB: number; rawGB: number; backend: StorageBackend } | null
```

Retain the existing `virtStorageGB` field for backward compatibility (it equals `Math.round(virtStorage.rawGB)`).

**Assembly** (`src/engine/virtualization/assembleVirtCluster.ts`). Populate `virtStorage` from the existing `virtStorage(...)` call. `totals.storageGB` behavior unchanged: node-attached storage + (for ODF) raw VM storage; `external-rwx` raw is `0` and stays out of totals.

**Rendering — a dedicated line in every output:**

- **ODF:** two rows
  - `VM Storage (usable)` → `usableGB`
  - `VM Storage (raw, replica-3 @ 85%)` → `rawGB`
- **external-rwx:** one row
  - `VM Storage (usable, provider-managed array)` → `usableGB` (raw shown as `—`)

Touch points:
- `src/components/results/BomTable.vue` — render as a special non-`NodeSpec` row (mirror the existing RHOAI overhead row pattern): label in col 1, `—` for count/vCPU/RAM, storage value in the storage column. One or two rows per the backend rule above.
- `src/composables/useCsvExport.ts` — append the same row(s) in both `buildCsvContent` and `buildMultiClusterCsvContent`, format `<label>,—,—,—,<GB>`.
- `src/composables/usePptxExport.ts` and `src/composables/usePdfExport.ts` — include the VM Storage line in the BOM table/section.

### Part C — UI knob

`src/components/wizard/VirtWorkloadSection.vue`. Add a **"Target utilization"** control next to overcommit/redundancy using the existing `NumberSliderInput` (min 50, max 95, step 5, displayed as percent). Stored as a fraction in `VirtConfig.targetUtilization`:

```ts
// slider works in whole percent; convert on patch
@update:model-value="(v: number) => patch({ targetUtilization: v / 100 })"
:model-value="Math.round(virt.targetUtilization * 100)"
```

**Defaults** (`src/engine/defaults.ts`). Add `targetUtilization: DEFAULT_TARGET_VIRT_UTILIZATION` to `createDefaultVirtConfig()`.

**i18n** (`src/i18n/index.ts`). New keys across en/fr/de/it: `virt.targetUtilization` (label), `virt.targetUtilizationHelp` (one-line explanation of headroom for maintenance/failover/growth).

## Architecture & data flow

```
VirtWorkloadSection.vue  ──patch──▶ VirtConfig.targetUtilization
                                          │
                          assembleVirtCluster(virt)
                          ├─ sizeVirtWorkers(config)  ── applies target → baseNodes, honest util %
                          └─ virtStorage(demand, backend) ── usable + raw
                                          │
                                ClusterSizing { virtWorkerNodes, virtStorage, virtMetrics, totals }
                                          │
        ┌─────────────────┬──────────────┼───────────────┬────────────────┐
   BomTable.vue     VirtMetricsCard   useCsvExport    usePptxExport    usePdfExport
   (+VM Storage row) (~79% util)      (+VM Storage)   (+VM Storage)    (+VM Storage)
```

Each unit keeps a single purpose: `sizeVirtWorkers` decides node count + metrics; `virtStorage` plans disk; `assembleVirtCluster` composes; renderers/exporters present. No Vue imports in the engine (CALC-01 preserved).

## Error handling / edge cases

- `targetUtilization` clamped to `[0.5, 1.0]` on read in the engine (defensive) so a malformed session file cannot produce `Infinity`/negative node counts.
- `target = 0` guard: division already gated by `cap.* > 0`; clamp prevents `target = 0`.
- Backward compatibility: sessions saved before this change lack `targetUtilization`; `createDefaultVirtConfig()` merge and an engine-side fallback to `DEFAULT_TARGET_VIRT_UTILIZATION` cover loaded sessions.
- `external-rwx`: `rawGB = 0`; render raw as `—`, never `0 GB`.

## Testing

| File | Coverage added |
|---|---|
| `sizeVirtWorkers.test.ts` | target lowers utilization & raises node count; clamping; CPU + RAM both affected; density still wins when it should |
| `assembleVirtCluster.test.ts` | `virtStorage` populated for both backends; totals unchanged for external-rwx |
| `storage.test.ts` | (existing) usable/raw math — verify still green |
| `useCsvExport.test.ts` | VM Storage row(s) present per backend; multi-cluster path |
| `BomTable.test.ts` | VM Storage row rendered; two rows for ODF, one for external-rwx |
| `virtBindings.test.ts` | target utilization control patches `VirtConfig` (percent↔fraction) |
| `defaults.test.ts` | default `targetUtilization === 0.8` |
| i18n | new keys present in all four locales |

## Documentation

- New ADR `docs/adr/0009-virt-target-utilization-and-storage-line.md` recording the target-utilization model and the VM Storage line contract.
- `CHANGELOG.md` Unreleased entry.
- PRD virtualization-mode section: note target-utilization knob and storage line.
