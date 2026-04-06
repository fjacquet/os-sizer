---
phase: 10-gpu-node-engine
plan: "02"
subsystem: engine
tags: [gpu, addons, validation, warnings, calcGpuNodes]
dependency_graph:
  requires: [10-01]
  provides: [calcGpuNodes, GPU wiring in calcCluster, WARN-01, WARN-03]
  affects: [src/engine/addons.ts, src/engine/calculators.ts, src/engine/validation.ts]
tech_stack:
  added: []
  patterns: [post-dispatch add-on pattern, hardware minimum enforcement]
key_files:
  modified:
    - src/engine/addons.ts
    - src/engine/calculators.ts
    - src/engine/validation.ts
decisions:
  - calcGpuNodes uses Math.max(gpuNodeCount, 1) safety guard — zero-node GPU pools are nonsensical
  - GPU node storage passed as GPU_NODE_MIN_STORAGE_GB from caller (calculators.ts) — not re-derived
  - WARN-01 fires on passthrough regardless of virtEnabled — vfio-pci is a node-level constraint
  - WARN-03 checks migProfile!=='' + virtEnabled (NOT gpuMode=vgpu) — incompatibility is MIG+KubeVirt
metrics:
  duration: "~5 min"
  completed: "2026-04-01T08:27:51Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 10 Plan 02: calcGpuNodes() + Integration + WARN-01/WARN-03 Summary

**One-liner:** GPU node pool sizing via user-specified count with hardware minimum enforcement, wired into calcCluster() post-dispatch, plus WARN-01 (passthrough blocks live migration) and WARN-03 (MIG+KubeVirt unsupported) validation warnings.

## What Was Built

### Task 1 — calcGpuNodes() in addons.ts (commit a10bd0f)

Added `calcGpuNodes(gpuNodeCount, nodeVcpu, nodeRamGB, nodeStorageGB): NodeSpec` to `src/engine/addons.ts`. The function:

- Enforces `count >= 1` via `Math.max(gpuNodeCount, 1)` safety guard
- Lifts undersized nodes to GPU hardware minimums: `GPU_NODE_MIN_VCPU=16`, `GPU_NODE_MIN_RAM_GB=64`, `GPU_NODE_MIN_STORAGE_GB=200`
- Follows identical JSDoc + return style as `calcVirt()` and `calcODF()`

### Task 2 — Wire + Warnings (commit 5dade4c)

**calculators.ts:**
- Added `calcGpuNodes` to the addons import
- Added `GPU_NODE_MIN_STORAGE_GB` to the constants import
- Post-dispatch block: `if (config.addOns.gpuEnabled) { sizing.gpuNodes = calcGpuNodes(...) }`
- Updated `sumTotals` condition to include `|| config.addOns.gpuEnabled`
- Updated `sumTotals` nodes array to include `sizing.gpuNodes`

**validation.ts:**
- WARN-01 (`GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION`): fires when `gpuEnabled && gpuMode === 'passthrough'`
- WARN-03 (`MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED`): fires when `gpuEnabled && migProfile !== '' && virtEnabled`

## Success Criteria Verification

| Criterion | Result |
|-----------|--------|
| `calcGpuNodes(3, 8, 16, 200)` returns `{count:3, vcpu:16, ramGB:64, storageGB:200}` | Pass (min enforcement on vcpu 8→16, ramGB 16→64) |
| `calcGpuNodes(3, 32, 128, 200)` returns `{count:3, vcpu:32, ramGB:128, storageGB:200}` | Pass (user values above min) |
| `calcGpuNodes(0, 16, 64, 200)` returns `{count:1, vcpu:16, ramGB:64, storageGB:200}` | Pass (count clamped to 1) |
| `sizing.gpuNodes` populated when `gpuEnabled=true` | Pass |
| `sizing.gpuNodes` is null when `gpuEnabled=false` | Pass |
| `sumTotals` includes `sizing.gpuNodes` | Pass |
| WARN-01 fires on passthrough mode | Pass |
| WARN-03 fires on MIG + virt | Pass |
| `tsc --noEmit`: 0 errors | Pass |
| All pre-existing Vitest tests pass (204) | Pass |

## Decisions Made

- `calcGpuNodes` enforces `Math.max(gpuNodeCount, 1)` — zero-node GPU pools are invalid; `gpuEnabled=false` is the correct way to disable
- Storage passed from caller as `GPU_NODE_MIN_STORAGE_GB` constant — no re-derivation needed since storage for GPU nodes is fixed by driver/image requirements
- WARN-01 fires on `gpuMode === 'passthrough'` regardless of `virtEnabled` — vfio-pci PCI device binding is a node-level hardware constraint that affects ALL VMs, not only KubeVirt-managed ones
- WARN-03 condition: `migProfile !== '' && virtEnabled` (NOT checking `gpuMode === 'vgpu'`) — the MIG+KubeVirt incompatibility is orthogonal to vGPU mode

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `calcGpuNodes` returns fully computed `NodeSpec` from user input and hardware constants. No placeholder data flows to any render path.

## Self-Check: PASSED

- `src/engine/addons.ts` — FOUND, contains `export function calcGpuNodes`
- `src/engine/calculators.ts` — FOUND, contains `gpuEnabled` and `sizing.gpuNodes`
- `src/engine/validation.ts` — FOUND, contains `GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION` and `MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED`
- Commit a10bd0f — FOUND: `feat(10-02): implement calcGpuNodes() in addons.ts`
- Commit 5dade4c — FOUND: `feat(10-02): wire calcGpuNodes() into calcCluster() + WARN-01 + WARN-03`
