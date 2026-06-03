# OpenShift Virtualization Sizer — Phase 1: Engine Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the VM-centric sizing engine for the new Virtualization mode — pure, tested TypeScript with zero UI wiring — as the foundation the later phases build on.

**Architecture:** Add new engine types and constants, an `engine/shared/` module for mode-agnostic primitives (per-VM memory overhead, system-reserved CPU), and an `engine/virtualization/` module (aggregate demand → per-node capacity → worker count + metrics → storage). Phase 1 is **non-breaking**: it adds standalone modules and types only; it does NOT yet touch `ClusterConfig`, the container calculators, the store, or the UI. All existing 352 tests must still pass.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, decimal.js (already used in `formulas.ts`). Source-of-truth for math: `docs/superpowers/specs/2026-06-03-openshift-virtualization-sizer-redesign-design.md`.

---

## Reference design

This plan implements **Section 1 — Engine & sizing model** of the spec. Best-practice constants (overcommit 10/4, overhead `218 + 8·vcpu + 0.2%·ramGB`, system-reserved `60m + 12m/thread` min 500m, KubeVirt ~2 cores/node, ODF replica-3 / 85% fullness) are cited in the spec's "Best-practice grounding" section.

## File structure

| File | Responsibility |
|------|----------------|
| `src/engine/types.ts` *(modify)* | Add `SizingMode`, `VmClass`, `NodeShape`, `StorageBackend`, `VirtConfig`, `VmDemand`, `NodeVmCapacity`, `LimitingResource`, `VirtWorkerSizing`. No change to `ClusterConfig` yet. |
| `src/engine/constants.ts` *(modify)* | Add virtualization constants (overcommit defaults, system-reserved coefficients, KubeVirt infra RAM/node, density cap, min virt workers, ODF replica/fullness). |
| `src/engine/shared/reservations.ts` *(create)* | `perVmMemoryOverheadMiB`, `systemReservedCpuCores`, re-export `allocatableRamGB`. |
| `src/engine/shared/reservations.test.ts` *(create)* | Tests for the above. |
| `src/engine/virtualization/aggregate.ts` *(create)* | `aggregateVmDemand(vmClasses)`. |
| `src/engine/virtualization/aggregate.test.ts` *(create)* | Tests. |
| `src/engine/virtualization/capacity.ts` *(create)* | `nodeVmCapacity(nodeShape, ratio)`. |
| `src/engine/virtualization/capacity.test.ts` *(create)* | Tests. |
| `src/engine/virtualization/sizeVirtWorkers.ts` *(create)* | `sizeVirtWorkers(config)` → worker count, limiting resource, achieved metrics. |
| `src/engine/virtualization/sizeVirtWorkers.test.ts` *(create)* | Tests (cpu/ram/density-bound cases). |
| `src/engine/virtualization/storage.ts` *(create)* | `virtStorage(totalDiskGB, backend)`. |
| `src/engine/virtualization/storage.test.ts` *(create)* | Tests. |
| `src/engine/index.ts` *(modify)* | Barrel-export the new public functions. |

**Convention notes (match existing code):** tests use `import { describe, it, expect } from 'vitest'`; integer results asserted with `toEqual`, floats with `toBeCloseTo(value, precision)`. Run a single file with `npm run test -- <path>` (the `test` script is `vitest run`). Commits use Conventional Commits and **must** be made with `rtk` (per `CLAUDE.md`), ending with the `Co-Authored-By` trailer.

---

### Task 1: New engine types

**Files:**
- Modify: `src/engine/types.ts` (append after the existing `TopologyRecommendation` interface)

- [ ] **Step 1: Add the types**

Append to `src/engine/types.ts`:

```ts
// ── Virtualization mode (Phase 1) ────────────────────────────────────────────

export type SizingMode = 'container' | 'virtualization'

/** One row in the VM size-classes table (e.g. Small/Medium/Large). */
export interface VmClass {
  id: string
  name: string
  vcpu: number // vCPUs per VM
  ramGB: number // guest RAM per VM
  diskGB: number // primary disk per VM
  count: number // number of VMs in this class
}

/** Physical bare-metal worker node shape (OVE favours dense dual-socket). */
export interface NodeShape {
  physicalCores: number // sockets × cores/socket
  threadsPerCore: number // 2 = hyperthreading on, 1 = off
  ramGB: number // installed RAM per node
}

export type StorageBackend = 'odf' | 'external-rwx'

export interface VirtConfig {
  vmClasses: VmClass[]
  cpuOvercommitRatio: number // vCPU per thread; 10 default, 4 conservative, 1 = dedicated
  redundancy: 'none' | 'n+1' | 'n+2'
  nodeShape: NodeShape
  storageBackend: StorageBackend
}

/** Aggregate VM demand across all classes. */
export interface VmDemand {
  totalVms: number
  totalVcpu: number
  totalGuestRamGB: number
  totalOverheadRamGB: number
  totalDiskGB: number
}

/** Per-node capacity available to VMs after reservations. */
export interface NodeVmCapacity {
  allocThreads: number // schedulable CPU threads after system-reserved + KubeVirt infra
  vcpuCapacity: number // allocThreads × overcommit ratio
  ramCapacityGB: number // allocatable RAM after reservations
}

export type LimitingResource = 'cpu' | 'ram' | 'density'

export interface VirtWorkerSizing {
  baseNodes: number
  spareNodes: number
  totalNodes: number
  limitingResource: LimitingResource
  achievedOvercommit: number // realised vCPU : thread ratio
  vmsPerNode: number
  cpuUtilizationPct: number
  ramUtilizationPct: number
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: PASS (no errors). These are additive type declarations; nothing consumes them yet.

- [ ] **Step 3: Commit**

```bash
rtk git add src/engine/types.ts
rtk git commit -m "feat(engine): add virtualization-mode types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Virtualization constants

**Files:**
- Modify: `src/engine/constants.ts` (append at end of file)

- [ ] **Step 1: Add the constants**

Append to `src/engine/constants.ts`:

```ts
// ── Virtualization-mode sizing constants (Phase 1) ───────────────────────────
// Sources: spec "Best-practice grounding" (KubeVirt HCO vmiCPUAllocationRatio,
// OCP system-reserved, ODF replica-3). See design spec dated 2026-06-03.

/** KubeVirt CPU overcommit (vCPU : thread). HCO default 10; conservative production 4. */
export const DEFAULT_CPU_OVERCOMMIT_RATIO = 10
export const CONSERVATIVE_CPU_OVERCOMMIT_RATIO = 4

/** Per-node RAM reserved for KubeVirt node infra (virt-handler, monitoring). Conservative estimate. */
export const KUBEVIRT_INFRA_RAM_PER_NODE_GB = 2

/** Practical VM-density cap per worker node (Red Hat publishes no fixed number). */
export const MAX_VMS_PER_NODE = 250

/** Minimum virt worker pool size (before spare nodes). */
export const MIN_VIRT_WORKERS = 2

/** OpenShift system-reserved CPU (OCP 4.17+): 60m first thread + 12m per additional, min 500m. In CORES. */
export const SYSTEM_RESERVED_CPU_FIRST = 0.06
export const SYSTEM_RESERVED_CPU_PER_THREAD = 0.012
export const SYSTEM_RESERVED_CPU_MIN = 0.5

/** ODF planning: replica-3 and keep Ceph below ~85% full → raw ≈ usable × 3 / 0.85. */
export const ODF_REPLICA_FACTOR = 3
export const ODF_FULLNESS_TARGET = 0.85
```

Note: `VIRT_OVERHEAD_CPU_PER_NODE = 2` already exists (line 60) and is reused as the KubeVirt infra CPU/node reservation. The per-VM overhead constants (`VIRT_VM_OVERHEAD_BASE_MIB`, `_PER_VCPU_MIB`, `_GUEST_RAM_RATIO`) already exist (lines 65-67).

- [ ] **Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add src/engine/constants.ts
rtk git commit -m "feat(engine): add virtualization sizing constants

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Shared reservations + per-VM overhead

**Files:**
- Create: `src/engine/shared/reservations.ts`
- Test: `src/engine/shared/reservations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/shared/reservations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { perVmMemoryOverheadMiB, systemReservedCpuCores } from './reservations'

describe('perVmMemoryOverheadMiB', () => {
  // 218 + 8·vcpu + 0.002·(ramGB·1024)
  it('2 vCPU / 4 GB → 242.192 MiB', () => {
    expect(perVmMemoryOverheadMiB(2, 4)).toBeCloseTo(242.192, 3)
  })

  it('8 vCPU / 64 GB → 413.072 MiB', () => {
    expect(perVmMemoryOverheadMiB(8, 64)).toBeCloseTo(413.072, 3)
  })
})

describe('systemReservedCpuCores', () => {
  it('128 threads → 1.584 cores', () => {
    expect(systemReservedCpuCores(128)).toBeCloseTo(1.584, 3)
  })

  it('16 threads → 0.5 cores (floor applies)', () => {
    expect(systemReservedCpuCores(16)).toBeCloseTo(0.5, 6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/shared/reservations.test.ts`
Expected: FAIL — cannot resolve `./reservations`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/shared/reservations.ts`:

```ts
// Mode-agnostic node reservation + VM overhead primitives — zero Vue imports (CALC-01)
import {
  VIRT_VM_OVERHEAD_BASE_MIB,
  VIRT_VM_OVERHEAD_PER_VCPU_MIB,
  VIRT_VM_OVERHEAD_GUEST_RAM_RATIO,
  SYSTEM_RESERVED_CPU_FIRST,
  SYSTEM_RESERVED_CPU_PER_THREAD,
  SYSTEM_RESERVED_CPU_MIN,
} from '../constants'

/** KubeVirt virt-launcher per-VM memory overhead in MiB. */
export function perVmMemoryOverheadMiB(vcpu: number, ramGB: number): number {
  return (
    VIRT_VM_OVERHEAD_BASE_MIB +
    VIRT_VM_OVERHEAD_PER_VCPU_MIB * vcpu +
    VIRT_VM_OVERHEAD_GUEST_RAM_RATIO * (ramGB * 1024)
  )
}

/** OpenShift system-reserved CPU in cores: 60m first thread + 12m per additional, floored at 500m. */
export function systemReservedCpuCores(threads: number): number {
  const reserved =
    SYSTEM_RESERVED_CPU_FIRST + SYSTEM_RESERVED_CPU_PER_THREAD * Math.max(threads - 1, 0)
  return Math.max(reserved, SYSTEM_RESERVED_CPU_MIN)
}

// Re-export the existing tiered system-reserved RAM helper so callers import reservations from one place.
export { allocatableRamGB } from '../formulas'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/shared/reservations.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/shared/reservations.ts src/engine/shared/reservations.test.ts
rtk git commit -m "feat(engine): shared per-VM overhead + system-reserved CPU

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Aggregate VM demand

**Files:**
- Create: `src/engine/virtualization/aggregate.ts`
- Test: `src/engine/virtualization/aggregate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/virtualization/aggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aggregateVmDemand } from './aggregate'
import type { VmClass } from '../types'

const CLASSES: VmClass[] = [
  { id: 's', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 120 },
  { id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 },
  { id: 'l', name: 'Large', vcpu: 8, ramGB: 64, diskGB: 300, count: 15 },
]

describe('aggregateVmDemand', () => {
  it('sums counts, vCPU, RAM, disk across classes', () => {
    const d = aggregateVmDemand(CLASSES)
    expect(d.totalVms).toBe(195)
    expect(d.totalVcpu).toBe(600)
    expect(d.totalGuestRamGB).toBe(2400)
    expect(d.totalDiskGB).toBe(15300)
  })

  it('sums per-VM memory overhead → ~51.001 GB', () => {
    const d = aggregateVmDemand(CLASSES)
    expect(d.totalOverheadRamGB).toBeCloseTo(51.001, 2)
  })

  it('empty list → all zeros', () => {
    expect(aggregateVmDemand([])).toEqual({
      totalVms: 0,
      totalVcpu: 0,
      totalGuestRamGB: 0,
      totalOverheadRamGB: 0,
      totalDiskGB: 0,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/virtualization/aggregate.test.ts`
Expected: FAIL — cannot resolve `./aggregate`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/virtualization/aggregate.ts`:

```ts
// Aggregate VM demand across size classes — zero Vue imports (CALC-01)
import type { VmClass, VmDemand } from '../types'
import { perVmMemoryOverheadMiB } from '../shared/reservations'

export function aggregateVmDemand(vmClasses: VmClass[]): VmDemand {
  let totalVms = 0
  let totalVcpu = 0
  let totalGuestRamGB = 0
  let totalOverheadMiB = 0
  let totalDiskGB = 0
  for (const c of vmClasses) {
    totalVms += c.count
    totalVcpu += c.count * c.vcpu
    totalGuestRamGB += c.count * c.ramGB
    totalOverheadMiB += c.count * perVmMemoryOverheadMiB(c.vcpu, c.ramGB)
    totalDiskGB += c.count * c.diskGB
  }
  return {
    totalVms,
    totalVcpu,
    totalGuestRamGB,
    totalOverheadRamGB: totalOverheadMiB / 1024,
    totalDiskGB,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/virtualization/aggregate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/virtualization/aggregate.ts src/engine/virtualization/aggregate.test.ts
rtk git commit -m "feat(engine): aggregate VM demand across size classes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Per-node VM capacity

**Files:**
- Create: `src/engine/virtualization/capacity.ts`
- Test: `src/engine/virtualization/capacity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/virtualization/capacity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nodeVmCapacity } from './capacity'
import type { NodeShape } from '../types'

// 64 physical cores, HT on (128 threads), 512 GB RAM.
const NODE: NodeShape = { physicalCores: 64, threadsPerCore: 2, ramGB: 512 }

describe('nodeVmCapacity', () => {
  it('allocThreads = 128 − systemReserved(1.584) − 2 = 124.416', () => {
    expect(nodeVmCapacity(NODE, 10).allocThreads).toBeCloseTo(124.416, 3)
  })

  it('vcpuCapacity = allocThreads × overcommit (10) = 1244.16', () => {
    expect(nodeVmCapacity(NODE, 10).vcpuCapacity).toBeCloseTo(1244.16, 2)
  })

  it('ramCapacityGB = allocatableRamGB(512)=479.64 − 2 = 477.64', () => {
    expect(nodeVmCapacity(NODE, 10).ramCapacityGB).toBeCloseTo(477.64, 2)
  })

  it('overcommit 1 (dedicated) → vcpuCapacity == allocThreads', () => {
    const cap = nodeVmCapacity(NODE, 1)
    expect(cap.vcpuCapacity).toBeCloseTo(cap.allocThreads, 6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/virtualization/capacity.test.ts`
Expected: FAIL — cannot resolve `./capacity`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/virtualization/capacity.ts`:

```ts
// Per-node VM capacity after reservations — zero Vue imports (CALC-01)
import type { NodeShape, NodeVmCapacity } from '../types'
import { allocatableRamGB, systemReservedCpuCores } from '../shared/reservations'
import { VIRT_OVERHEAD_CPU_PER_NODE, KUBEVIRT_INFRA_RAM_PER_NODE_GB } from '../constants'

export function nodeVmCapacity(nodeShape: NodeShape, cpuOvercommitRatio: number): NodeVmCapacity {
  const threads = nodeShape.physicalCores * nodeShape.threadsPerCore
  const allocThreads = threads - systemReservedCpuCores(threads) - VIRT_OVERHEAD_CPU_PER_NODE
  const vcpuCapacity = allocThreads * cpuOvercommitRatio
  const ramCapacityGB = allocatableRamGB(nodeShape.ramGB) - KUBEVIRT_INFRA_RAM_PER_NODE_GB
  return { allocThreads, vcpuCapacity, ramCapacityGB }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/virtualization/capacity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/virtualization/capacity.ts src/engine/virtualization/capacity.test.ts
rtk git commit -m "feat(engine): per-node VM capacity after reservations

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Worker count, limiting resource & achieved metrics

**Files:**
- Create: `src/engine/virtualization/sizeVirtWorkers.ts`
- Test: `src/engine/virtualization/sizeVirtWorkers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/virtualization/sizeVirtWorkers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sizeVirtWorkers } from './sizeVirtWorkers'
import type { VirtConfig, VmClass } from '../types'

const CLASSES: VmClass[] = [
  { id: 's', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 120 },
  { id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 },
  { id: 'l', name: 'Large', vcpu: 8, ramGB: 64, diskGB: 300, count: 15 },
]

function cfg(over: Partial<VirtConfig> = {}): VirtConfig {
  return {
    vmClasses: CLASSES,
    cpuOvercommitRatio: 10,
    redundancy: 'n+1',
    nodeShape: { physicalCores: 64, threadsPerCore: 2, ramGB: 512 },
    storageBackend: 'odf',
    ...over,
  }
}

describe('sizeVirtWorkers — RAM-bound baseline (3-class example)', () => {
  it('6 base nodes + 1 spare = 7, limited by RAM', () => {
    const r = sizeVirtWorkers(cfg())
    expect(r.baseNodes).toBe(6)
    expect(r.spareNodes).toBe(1)
    expect(r.totalNodes).toBe(7)
    expect(r.limitingResource).toBe('ram')
  })

  it('achieved metrics', () => {
    const r = sizeVirtWorkers(cfg())
    expect(r.vmsPerNode).toBeCloseTo(32.5, 2) // 195 / 6
    expect(r.achievedOvercommit).toBeCloseTo(0.804, 2) // 600 / (6 × 124.416)
    expect(r.ramUtilizationPct).toBeCloseTo(85.5, 1)
  })

  it('redundancy none → no spare; n+2 → 2 spares', () => {
    expect(sizeVirtWorkers(cfg({ redundancy: 'none' })).totalNodes).toBe(6)
    expect(sizeVirtWorkers(cfg({ redundancy: 'n+2' })).totalNodes).toBe(8)
  })
})

describe('sizeVirtWorkers — CPU-bound (dedicated, high-vCPU class)', () => {
  it('28 base nodes, limited by CPU', () => {
    const r = sizeVirtWorkers({
      vmClasses: [{ id: 'c', name: 'CPU', vcpu: 8, ramGB: 1, diskGB: 10, count: 100 }],
      cpuOvercommitRatio: 1,
      redundancy: 'none',
      nodeShape: { physicalCores: 16, threadsPerCore: 2, ramGB: 256 },
      storageBackend: 'external-rwx',
    })
    expect(r.baseNodes).toBe(28)
    expect(r.limitingResource).toBe('cpu')
  })
})

describe('sizeVirtWorkers — density-bound (many tiny VMs)', () => {
  it('3 base nodes, limited by density', () => {
    const r = sizeVirtWorkers({
      vmClasses: [{ id: 't', name: 'Tiny', vcpu: 1, ramGB: 1, diskGB: 10, count: 600 }],
      cpuOvercommitRatio: 10,
      redundancy: 'none',
      nodeShape: { physicalCores: 64, threadsPerCore: 2, ramGB: 512 },
      storageBackend: 'odf',
    })
    expect(r.baseNodes).toBe(3) // ceil(600/250)
    expect(r.limitingResource).toBe('density')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/virtualization/sizeVirtWorkers.test.ts`
Expected: FAIL — cannot resolve `./sizeVirtWorkers`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/virtualization/sizeVirtWorkers.ts`:

```ts
// Virt worker pool sizing: count + limiting resource + achieved metrics — zero Vue imports (CALC-01)
import type { VirtConfig, VirtWorkerSizing, LimitingResource } from '../types'
import { aggregateVmDemand } from './aggregate'
import { nodeVmCapacity } from './capacity'
import { MAX_VMS_PER_NODE, MIN_VIRT_WORKERS } from '../constants'

const SPARE_NODES: Record<VirtConfig['redundancy'], number> = { none: 0, 'n+1': 1, 'n+2': 2 }

export function sizeVirtWorkers(config: VirtConfig): VirtWorkerSizing {
  const demand = aggregateVmDemand(config.vmClasses)
  const cap = nodeVmCapacity(config.nodeShape, config.cpuOvercommitRatio)
  const ramDemand = demand.totalGuestRamGB + demand.totalOverheadRamGB

  const byCpu = cap.vcpuCapacity > 0 ? Math.ceil(demand.totalVcpu / cap.vcpuCapacity) : 0
  const byRam = cap.ramCapacityGB > 0 ? Math.ceil(ramDemand / cap.ramCapacityGB) : 0
  const byDensity = Math.ceil(demand.totalVms / MAX_VMS_PER_NODE)

  // Limiting resource = the constraint with the highest node demand (ties: cpu > ram > density).
  let limitingResource: LimitingResource = 'cpu'
  let max = byCpu
  if (byRam > max) {
    max = byRam
    limitingResource = 'ram'
  }
  if (byDensity > max) {
    max = byDensity
    limitingResource = 'density'
  }

  const baseNodes = Math.max(byCpu, byRam, byDensity, MIN_VIRT_WORKERS)
  const spareNodes = SPARE_NODES[config.redundancy]
  const totalNodes = baseNodes + spareNodes

  const achievedOvercommit =
    baseNodes > 0 && cap.allocThreads > 0 ? demand.totalVcpu / (baseNodes * cap.allocThreads) : 0
  const vmsPerNode = baseNodes > 0 ? demand.totalVms / baseNodes : 0
  const cpuUtilizationPct =
    baseNodes > 0 && cap.vcpuCapacity > 0
      ? (demand.totalVcpu / (baseNodes * cap.vcpuCapacity)) * 100
      : 0
  const ramUtilizationPct =
    baseNodes > 0 && cap.ramCapacityGB > 0 ? (ramDemand / (baseNodes * cap.ramCapacityGB)) * 100 : 0

  return {
    baseNodes,
    spareNodes,
    totalNodes,
    limitingResource,
    achievedOvercommit,
    vmsPerNode,
    cpuUtilizationPct,
    ramUtilizationPct,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/virtualization/sizeVirtWorkers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/virtualization/sizeVirtWorkers.ts src/engine/virtualization/sizeVirtWorkers.test.ts
rtk git commit -m "feat(engine): virt worker sizing with limiting-resource + metrics

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Storage planning

**Files:**
- Create: `src/engine/virtualization/storage.ts`
- Test: `src/engine/virtualization/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/virtualization/storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { virtStorage } from './storage'

describe('virtStorage', () => {
  it('ODF: raw ≈ usable × 3 / 0.85', () => {
    const s = virtStorage(15300, 'odf')
    expect(s.usableGB).toBe(15300)
    expect(s.rawGB).toBeCloseTo(54000, 0) // 15300 × 3 / 0.85
    expect(s.backend).toBe('odf')
  })

  it('external-rwx: raw is 0 (provider-managed)', () => {
    const s = virtStorage(15300, 'external-rwx')
    expect(s.usableGB).toBe(15300)
    expect(s.rawGB).toBe(0)
    expect(s.backend).toBe('external-rwx')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/virtualization/storage.test.ts`
Expected: FAIL — cannot resolve `./storage`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/virtualization/storage.ts`:

```ts
// VM disk storage planning — zero Vue imports (CALC-01)
import type { StorageBackend } from '../types'
import { ODF_REPLICA_FACTOR, ODF_FULLNESS_TARGET } from '../constants'

export interface VirtStorage {
  usableGB: number
  rawGB: number // raw provisioned capacity; 0 for external-rwx (provider-managed)
  backend: StorageBackend
}

export function virtStorage(totalDiskGB: number, backend: StorageBackend): VirtStorage {
  if (backend === 'odf') {
    return {
      usableGB: totalDiskGB,
      rawGB: (totalDiskGB * ODF_REPLICA_FACTOR) / ODF_FULLNESS_TARGET,
      backend,
    }
  }
  return { usableGB: totalDiskGB, rawGB: 0, backend }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/virtualization/storage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/virtualization/storage.ts src/engine/virtualization/storage.test.ts
rtk git commit -m "feat(engine): VM disk storage planning (ODF replica-3 / external RWX)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Barrel exports + full-suite regression

**Files:**
- Modify: `src/engine/index.ts`

- [ ] **Step 1: Add the public exports**

Append to `src/engine/index.ts` (after the existing `validateInputs` export):

```ts
// Virtualization mode (Phase 1)
export { perVmMemoryOverheadMiB, systemReservedCpuCores } from './shared/reservations'
export { aggregateVmDemand } from './virtualization/aggregate'
export { nodeVmCapacity } from './virtualization/capacity'
export { sizeVirtWorkers } from './virtualization/sizeVirtWorkers'
export { virtStorage } from './virtualization/storage'
export type { VirtStorage } from './virtualization/storage'
```

- [ ] **Step 2: Verify type-check + full suite + format + lint**

Run: `npm run type-check`
Expected: PASS.

Run: `npm run test`
Expected: PASS — all prior 352 tests **plus** the 18 new tests (370 total), 0 failures.

Run: `npm run format:check && npm run lint`
Expected: format clean; lint 0 errors.

- [ ] **Step 3: Commit**

```bash
rtk git add src/engine/index.ts
rtk git commit -m "feat(engine): export virtualization sizing API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 1 self-review

- **Spec coverage:** Tasks 1–2 cover the data model + constants; Task 3 covers per-VM overhead + system-reserved CPU; Tasks 4–6 cover aggregate → capacity → worker count + limiting resource + achieved metrics (spec §1 steps 1–3); Task 7 covers storage (spec §1 step 4). Control-plane/infra/ODF *assembly* and `ClusterConfig` discrimination are intentionally deferred to Phase 2 (this phase stays non-breaking).
- **Placeholder scan:** none — every step ships real code and exact expected numbers.
- **Type consistency:** function names/signatures (`perVmMemoryOverheadMiB`, `systemReservedCpuCores`, `aggregateVmDemand`, `nodeVmCapacity`, `sizeVirtWorkers`, `virtStorage`) and types (`VmDemand`, `NodeVmCapacity`, `VirtWorkerSizing`, `LimitingResource`) are defined in Task 1 and used identically in Tasks 3–8.
- **Worked numbers verified:** overhead(2,4)=242.192, overhead(8,64)=413.072; sysReserved(128)=1.584; allocatableRamGB(512)=479.64 → capacity allocThreads 124.416 / vcpu 1244.16 / ram 477.64; 3-class demand 195/600/2400/≈51.001/15300 → 6 base nodes (RAM-bound), 7 with N+1; ODF raw 15300×3/0.85≈54000.

---

## Roadmap — Phases 2–5 (planned in their own docs when reached)

These depend on the exact Phase 1 APIs above and will be expanded into full bite-sized plans at the start of each phase.

- **Phase 2 — Store & plumbing.** Make `ClusterConfig` a discriminated union on `mode` (`workload` vs `virt`); add `createDefaultVirtConfig`; branch `calculationStore`/`calcCluster` to assemble a `ClusterSizing` from `sizeVirtWorkers` + shared control-plane/infra/ODF; validation (RWX-for-live-migration, OVE-ODF licensing, overcommit bounds); versioned session/URL schema defaulting missing `mode` to `'container'`; i18n keys (en/fr/de/it).
- **Phase 3 — Wizard UI.** Mode entry step; virtualization Step 2 (VM-class table, node shape, overcommit, redundancy) + Step 3 (storage & review); results-page virt metrics (limiting resource, achieved overcommit, VMs/node, utilization). Container path untouched.
- **Phase 4 — PPTX executive deck.** `pptx/` reorg, navy `theme.ts`, per-slide builders (`titleSlide`, `summarySlide`, `clusterSlide`, `vmClassSlide`, `aggregateSlide`), mode-branched assembler; restyle container deck to navy; update PDF/CSV for VM classes + metrics.
- **Phase 5 — Docs & polish.** ADRs (overcommit model, OVE assumptions, density cap), PRD update, licensing notes, milestone audit.
