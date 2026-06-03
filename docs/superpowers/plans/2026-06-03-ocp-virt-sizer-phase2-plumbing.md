# OpenShift Virtualization Sizer — Phase 2: Store & Plumbing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Phase 1 virtualization engine into the cluster model — add a `mode` to `ClusterConfig`, assemble a full `ClusterSizing` for virtualization mode, validate virt inputs, and round-trip mode/virt through the session + URL schemas — all backward-compatible.

**Architecture:** `ClusterConfig` gains **optional** `mode?: SizingMode` + `virt?: VirtConfig` (NOT a discriminated union — additive fields keep all existing code and tests compiling). `calcCluster` early-returns a virt assembly (`assembleVirtCluster`) when `mode === 'virtualization'`, else runs today's container path. Defaults, validation, Zod schemas, and i18n keys follow. No UI in this phase.

**Tech Stack:** TypeScript (strict), Vitest, Zod 4, lz-string, Pinia. Builds on Phase 1 (`sizeVirtWorkers`, `aggregateVmDemand`, `virtStorage`).

---

## Design decisions for this phase

- **Additive, not discriminated.** `mode`/`virt` are optional; `createDefaultClusterConfig` sets `mode: 'container'` + a full `virt` default; Zod defaults missing `mode` to `'container'`. Old sessions/URLs load unchanged.
- **Virt cluster shape:** 3 control-plane (sized for the virt worker count) + virt worker pool (`sizeVirtWorkers().totalNodes`, node CPU = physical cores × threadsPerCore) + optional ODF (replica-3) when `storageBackend === 'odf'`. `virtStorageGB` carries the raw VM-disk capacity; `totals.storageGB` includes it.
- **Container validations are NOT gated** — virt mode's default container `workload` is benign (10 pods, 32 GB) and never trips them; this avoids churn to existing validation tests.

## File structure

| File | Responsibility |
|------|----------------|
| `src/engine/types.ts` *(modify)* | Add optional `mode?`/`virt?` to `ClusterConfig`. |
| `src/engine/defaults.ts` *(modify)* | `createDefaultVirtConfig()`; set `mode`/`virt` in `createDefaultClusterConfig`. |
| `src/engine/defaults.test.ts` *(create)* | Tests for the defaults. |
| `src/engine/virtualization/assembleVirtCluster.ts` *(create)* | `assembleVirtCluster(virt) → ClusterSizing`. |
| `src/engine/virtualization/assembleVirtCluster.test.ts` *(create)* | Tests. |
| `src/engine/calculators.ts` *(modify)* | `calcCluster` branches on `mode`. |
| `src/engine/calculators.test.ts` *(modify)* | Add a virt-mode dispatch test. |
| `src/engine/validation.ts` *(modify)* | Virt-mode warnings. |
| `src/engine/validation.test.ts` *(modify)* | Tests for virt warnings. |
| `src/composables/useUrlState.ts` *(modify)* | `VmClass`/`NodeShape`/`VirtConfig` schemas + `mode`/`virt` on `ClusterConfigSchema`. |
| `src/composables/__tests__/useUrlState.test.ts` *(modify)* | Round-trip + backward-compat tests. |
| `src/engine/index.ts` *(modify)* | Export `createDefaultVirtConfig`, `assembleVirtCluster`. |
| `src/i18n/locales/{en,fr,de,it}.json` *(modify)* | New validation/warning message keys. |

**Conventions:** tests `import { describe, it, expect } from 'vitest'`; integer node specs via `toEqual`. The repo has a `.git/hooks/pre-commit` running `npm run lint` — **lint must report 0 errors** (warnings OK) or the commit is rejected. Commit with `rtk`, Conventional Commits, `Co-Authored-By` trailer. Run one test file with `npm run test -- <path>`.

---

### Task 1: `ClusterConfig` gains optional mode + virt

**Files:**
- Modify: `src/engine/types.ts:58-73` (the `ClusterConfig` interface)

- [ ] **Step 1: Add the fields**

In `src/engine/types.ts`, change the `ClusterConfig` interface to add two optional fields (place them right after `id`/`name`):

```ts
export interface ClusterConfig {
  id: string
  name: string
  /** Sizing mode. Absent = 'container' (backward compatibility). */
  mode?: SizingMode
  /** Virtualization-mode config (used when mode === 'virtualization'). */
  virt?: VirtConfig
  role?: 'hub' | 'spoke' | 'standalone'
  topology: TopologyType
  snoProfile: SnoProfile // default 'standard'
  hcpHostedClusters: number // default 1
  hcpQpsPerCluster: number // default 1000
  workload: WorkloadProfile
  addOns: AddOnConfig
  // Environment constraint fields — used by recommendation engine
  environment: EnvironmentType // default 'datacenter'
  haRequired: boolean // default true
  airGapped: boolean // default false
  maxNodes: number | null // default null (no limit)
}
```

`SizingMode` and `VirtConfig` already exist in this file (Phase 1).

- [ ] **Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: PASS (optional fields don't break existing `ClusterConfig` literals).

- [ ] **Step 3: Commit**

```bash
rtk git add src/engine/types.ts
rtk git commit -m "feat(engine): add optional mode + virt to ClusterConfig

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Defaults — `createDefaultVirtConfig` + wiring

**Files:**
- Modify: `src/engine/defaults.ts`
- Test: `src/engine/defaults.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/engine/defaults.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createDefaultClusterConfig, createDefaultVirtConfig } from './defaults'

describe('createDefaultVirtConfig', () => {
  it('has 3 VM classes (Small/Medium/Large) with defaults', () => {
    const v = createDefaultVirtConfig()
    expect(v.vmClasses.map((c) => c.name)).toEqual(['Small', 'Medium', 'Large'])
    expect(v.cpuOvercommitRatio).toBe(10)
    expect(v.redundancy).toBe('n+1')
    expect(v.nodeShape).toEqual({ physicalCores: 64, threadsPerCore: 2, ramGB: 512 })
    expect(v.storageBackend).toBe('odf')
  })

  it('gives each VM class a unique id', () => {
    const ids = createDefaultVirtConfig().vmClasses.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('createDefaultClusterConfig', () => {
  it("defaults mode to 'container' and includes a virt config", () => {
    const c = createDefaultClusterConfig(0)
    expect(c.mode).toBe('container')
    expect(c.virt).toBeDefined()
    expect(c.virt?.vmClasses.length).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/defaults.test.ts`
Expected: FAIL — `createDefaultVirtConfig` not exported.

- [ ] **Step 3: Write the implementation**

In `src/engine/defaults.ts`, update the imports and add the factory. Change the top import line to also import `VirtConfig`, then add `createDefaultVirtConfig`, and set `mode`/`virt` in `createDefaultClusterConfig`:

```ts
// Defaults factory functions — NOT exported constants (constants = shared refs = mutation bugs)
// Zero Vue imports (CALC-01)
import type { ClusterConfig, VirtConfig } from './types'
import { DEFAULT_CPU_OVERCOMMIT_RATIO } from './constants'

export function createDefaultVirtConfig(): VirtConfig {
  return {
    vmClasses: [
      { id: crypto.randomUUID(), name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 40 },
      { id: crypto.randomUUID(), name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 20 },
      { id: crypto.randomUUID(), name: 'Large', vcpu: 8, ramGB: 64, diskGB: 300, count: 5 },
    ],
    cpuOvercommitRatio: DEFAULT_CPU_OVERCOMMIT_RATIO,
    redundancy: 'n+1',
    nodeShape: { physicalCores: 64, threadsPerCore: 2, ramGB: 512 },
    storageBackend: 'odf',
  }
}
```

Then in `createDefaultClusterConfig`, add `mode` and `virt` immediately after the `name:` line:

```ts
    id: crypto.randomUUID(),
    name: `Cluster-${index + 1}`,
    mode: 'container',
    virt: createDefaultVirtConfig(),
    topology: 'standard-ha',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/defaults.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/defaults.ts src/engine/defaults.test.ts
rtk git commit -m "feat(engine): default virt config + mode on cluster defaults

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `assembleVirtCluster`

**Files:**
- Create: `src/engine/virtualization/assembleVirtCluster.ts`
- Test: `src/engine/virtualization/assembleVirtCluster.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/virtualization/assembleVirtCluster.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { assembleVirtCluster } from './assembleVirtCluster'
import type { VirtConfig } from '../types'

const VIRT: VirtConfig = {
  vmClasses: [
    { id: 's', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 120 },
    { id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 },
    { id: 'l', name: 'Large', vcpu: 8, ramGB: 64, diskGB: 300, count: 15 },
  ],
  cpuOvercommitRatio: 10,
  redundancy: 'n+1',
  nodeShape: { physicalCores: 64, threadsPerCore: 2, ramGB: 512 },
  storageBackend: 'odf',
}

describe('assembleVirtCluster (ODF)', () => {
  const s = assembleVirtCluster(VIRT)

  it('virt worker pool: 7 nodes (6 + N+1), 128 threads, 512 GB', () => {
    expect(s.virtWorkerNodes).toEqual({ count: 7, vcpu: 128, ramGB: 512, storageGB: 100 })
  })

  it('control plane sized for the worker count', () => {
    expect(s.masterNodes).toEqual({ count: 3, vcpu: 4, ramGB: 16, storageGB: 100 })
  })

  it('ODF storage nodes present; no container worker pool', () => {
    expect(s.odfNodes).toEqual({ count: 3, vcpu: 16, ramGB: 64, storageGB: 0 })
    expect(s.workerNodes).toBeNull()
  })

  it('virtStorageGB = raw ODF capacity 54000', () => {
    expect(s.virtStorageGB).toBe(54000)
  })

  it('totals include node specs + VM disk raw', () => {
    expect(s.totals).toEqual({ vcpu: 956, ramGB: 3824, storageGB: 55000 })
  })
})

describe('assembleVirtCluster (external-rwx)', () => {
  it('no ODF nodes; virtStorageGB 0', () => {
    const s = assembleVirtCluster({ ...VIRT, storageBackend: 'external-rwx' })
    expect(s.odfNodes).toBeNull()
    expect(s.virtStorageGB).toBe(0)
    expect(s.totals).toEqual({ vcpu: 908, ramGB: 3632, storageGB: 1000 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/virtualization/assembleVirtCluster.test.ts`
Expected: FAIL — cannot resolve `./assembleVirtCluster`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/virtualization/assembleVirtCluster.ts`:

```ts
// Assemble a full ClusterSizing for virtualization mode — zero Vue imports (CALC-01)
import type { VirtConfig, ClusterSizing, NodeSpec } from '../types'
import { sizeVirtWorkers } from './sizeVirtWorkers'
import { aggregateVmDemand } from './aggregate'
import { virtStorage } from './storage'
import { cpSizing } from '../formulas'
import { calcODF } from '../addons'
import { CP_MIN, WORKER_MIN } from '../constants'

export function assembleVirtCluster(virt: VirtConfig): ClusterSizing {
  const worker = sizeVirtWorkers(virt)
  const demand = aggregateVmDemand(virt.vmClasses)
  const storage = virtStorage(demand.totalDiskGB, virt.storageBackend)

  const threadsPerNode = virt.nodeShape.physicalCores * virt.nodeShape.threadsPerCore
  const virtWorkerNodes: NodeSpec = {
    count: worker.totalNodes,
    vcpu: threadsPerNode,
    ramGB: virt.nodeShape.ramGB,
    storageGB: WORKER_MIN.storageGB,
  }

  const cpSpec = cpSizing(worker.totalNodes)
  const masterNodes: NodeSpec = {
    count: CP_MIN.count,
    vcpu: Math.max(cpSpec.vcpu, CP_MIN.vcpu),
    ramGB: Math.max(cpSpec.ramGB, CP_MIN.ramGB),
    storageGB: CP_MIN.storageGB,
  }

  const odfNodes: NodeSpec | null = virt.storageBackend === 'odf' ? calcODF(0) : null
  const virtStorageGB = Math.round(storage.rawGB)

  const pools: (NodeSpec | null)[] = [masterNodes, virtWorkerNodes, odfNodes]
  const totals = pools.reduce(
    (acc, n) =>
      n
        ? {
            vcpu: acc.vcpu + n.vcpu * n.count,
            ramGB: acc.ramGB + n.ramGB * n.count,
            storageGB: acc.storageGB + n.storageGB * n.count,
          }
        : acc,
    { vcpu: 0, ramGB: 0, storageGB: 0 },
  )
  totals.storageGB += virtStorageGB

  return {
    masterNodes,
    workerNodes: null,
    infraNodes: null,
    odfNodes,
    rhacmWorkers: null,
    virtWorkerNodes,
    gpuNodes: null,
    virtStorageGB,
    rhoaiOverhead: null,
    totals,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/virtualization/assembleVirtCluster.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/virtualization/assembleVirtCluster.ts src/engine/virtualization/assembleVirtCluster.test.ts
rtk git commit -m "feat(engine): assemble full ClusterSizing for virtualization mode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `calcCluster` branches on mode

**Files:**
- Modify: `src/engine/calculators.ts` (imports + start of `calcCluster`, ~line 457)
- Test: `src/engine/calculators.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/engine/calculators.test.ts`:

```ts
import { createDefaultVirtConfig } from './defaults'

describe('calcCluster — virtualization mode', () => {
  it("mode 'virtualization' routes to virt assembly", () => {
    const base = createDefaultClusterConfig(0)
    const config = {
      ...base,
      mode: 'virtualization' as const,
      virt: {
        ...createDefaultVirtConfig(),
        vmClasses: [{ id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 }],
      },
    }
    const { sizing } = calcCluster(config)
    expect(sizing.virtWorkerNodes).not.toBeNull()
    expect(sizing.workerNodes).toBeNull()
    expect(sizing.masterNodes.count).toBe(3)
    expect(sizing.totals.vcpu).toBeGreaterThan(0)
  })
})
```

(`createDefaultClusterConfig` and `calcCluster` are already imported at the top of this test file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/calculators.test.ts`
Expected: FAIL — virt mode currently falls through to the container path (`virtWorkerNodes` null / `workerNodes` not null).

- [ ] **Step 3: Write the implementation**

In `src/engine/calculators.ts`, add imports near the other engine imports at the top of the file:

```ts
import { assembleVirtCluster } from './virtualization/assembleVirtCluster'
import { createDefaultVirtConfig } from './defaults'
```

Then make `calcCluster` early-return for virt mode — insert at the very start of the function body, before `let result`:

```ts
export function calcCluster(config: ClusterConfig): {
  sizing: ClusterSizing
  warnings: ValidationWarning[]
} {
  if (config.mode === 'virtualization') {
    return { sizing: assembleVirtCluster(config.virt ?? createDefaultVirtConfig()), warnings: [] }
  }
  let result: { sizing: ClusterSizing; warnings: ValidationWarning[] }
  switch (config.topology) {
    // ... unchanged ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/calculators.test.ts`
Expected: PASS (existing container tests + the new virt-mode test).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/calculators.ts src/engine/calculators.test.ts
rtk git commit -m "feat(engine): route virtualization mode through virt assembly

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Virtualization validation warnings

**Files:**
- Modify: `src/engine/validation.ts` (before `return warnings`)
- Test: `src/engine/validation.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/engine/validation.test.ts` (it already imports `validateInputs` and `createDefaultClusterConfig`; if not, add `import { createDefaultClusterConfig } from './defaults'`):

```ts
import { createDefaultVirtConfig } from './defaults'

describe('validateInputs — virtualization mode', () => {
  function virtConfig(over = {}) {
    return {
      ...createDefaultClusterConfig(0),
      mode: 'virtualization' as const,
      virt: { ...createDefaultVirtConfig(), ...over },
    }
  }

  it('warns VIRT_ODF_NOT_IN_OVE when storageBackend is odf', () => {
    const codes = validateInputs(virtConfig({ storageBackend: 'odf' })).map((w) => w.code)
    expect(codes).toContain('VIRT_ODF_NOT_IN_OVE')
  })

  it('warns VIRT_NO_VMS when all class counts are zero', () => {
    const codes = validateInputs(
      virtConfig({ vmClasses: [{ id: 'x', name: 'X', vcpu: 2, ramGB: 4, diskGB: 10, count: 0 }] }),
    ).map((w) => w.code)
    expect(codes).toContain('VIRT_NO_VMS')
  })

  it('warns VIRT_OVERCOMMIT_OUT_OF_RANGE when ratio > 10', () => {
    const codes = validateInputs(virtConfig({ cpuOvercommitRatio: 12 })).map((w) => w.code)
    expect(codes).toContain('VIRT_OVERCOMMIT_OUT_OF_RANGE')
  })

  it('external-rwx with valid VMs → no VIRT_ODF_NOT_IN_OVE', () => {
    const codes = validateInputs(virtConfig({ storageBackend: 'external-rwx' })).map((w) => w.code)
    expect(codes).not.toContain('VIRT_ODF_NOT_IN_OVE')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/engine/validation.test.ts`
Expected: FAIL — the virt codes aren't emitted yet.

- [ ] **Step 3: Write the implementation**

In `src/engine/validation.ts`, insert this block immediately before `return warnings`:

```ts
  // Virtualization-mode checks (Phase 2)
  if (config.mode === 'virtualization' && config.virt) {
    const v = config.virt
    if (v.vmClasses.length === 0 || v.vmClasses.every((c) => c.count === 0)) {
      warnings.push({
        code: 'VIRT_NO_VMS',
        severity: 'warning',
        messageKey: 'validation.virtNoVms',
      })
    }
    if (v.cpuOvercommitRatio < 1 || v.cpuOvercommitRatio > 10) {
      warnings.push({
        code: 'VIRT_OVERCOMMIT_OUT_OF_RANGE',
        severity: 'warning',
        messageKey: 'validation.virtOvercommitRange',
      })
    }
    if (v.storageBackend === 'odf') {
      warnings.push({
        code: 'VIRT_ODF_NOT_IN_OVE',
        severity: 'warning',
        messageKey: 'warnings.virt.odfNotInOve',
      })
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/engine/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/validation.ts src/engine/validation.test.ts
rtk git commit -m "feat(engine): virtualization-mode validation warnings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Session + URL schema (backward-compatible)

**Files:**
- Modify: `src/composables/useUrlState.ts` (add schemas + fields)
- Test: `src/composables/__tests__/useUrlState.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/composables/__tests__/useUrlState.test.ts` (it already imports schemas from `../useUrlState`; add `ClusterConfigSchema` to that import if not present):

```ts
import { ClusterConfigSchema } from '../useUrlState'

describe('ClusterConfigSchema — mode + virt', () => {
  it("old config without mode defaults to 'container' and gets a virt default", () => {
    const parsed = ClusterConfigSchema.parse({ name: 'Legacy' })
    expect(parsed.mode).toBe('container')
    expect(parsed.virt.storageBackend).toBe('odf')
    expect(parsed.virt.vmClasses).toEqual([])
  })

  it('round-trips a virtualization cluster', () => {
    const input = {
      name: 'Virt',
      mode: 'virtualization',
      virt: {
        vmClasses: [{ id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 }],
        cpuOvercommitRatio: 4,
        redundancy: 'n+2',
        nodeShape: { physicalCores: 32, threadsPerCore: 2, ramGB: 256 },
        storageBackend: 'external-rwx',
      },
    }
    const parsed = ClusterConfigSchema.parse(input)
    expect(parsed.mode).toBe('virtualization')
    expect(parsed.virt.cpuOvercommitRatio).toBe(4)
    expect(parsed.virt.redundancy).toBe('n+2')
    expect(parsed.virt.vmClasses[0]?.count).toBe(60)
    expect(parsed.virt.storageBackend).toBe('external-rwx')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/composables/__tests__/useUrlState.test.ts`
Expected: FAIL — `parsed.mode`/`parsed.virt` are undefined (schema strips them).

- [ ] **Step 3: Write the implementation**

In `src/composables/useUrlState.ts`, add these schemas just above `export const ClusterConfigSchema`:

```ts
const VmClassSchema = z
  .object({
    id: z.string().default(() => crypto.randomUUID()),
    name: z.string().default('VM'),
    vcpu: z.number().int().min(1).default(2),
    ramGB: z.number().int().min(1).default(4),
    diskGB: z.number().int().min(0).default(40),
    count: z.number().int().min(0).default(0),
  })
  .strip()

const NodeShapeSchema = z
  .object({
    physicalCores: z.number().int().min(1).default(64),
    threadsPerCore: z.number().int().min(1).max(2).default(2),
    ramGB: z.number().int().min(8).default(512),
  })
  .strip()

const VirtConfigSchema = z
  .object({
    vmClasses: z.array(VmClassSchema).default(() => []),
    cpuOvercommitRatio: z.number().min(1).max(10).default(10),
    redundancy: z.enum(['none', 'n+1', 'n+2']).default('n+1'),
    nodeShape: NodeShapeSchema.default(() => NodeShapeSchema.parse({})),
    storageBackend: z.enum(['odf', 'external-rwx']).default('odf'),
  })
  .strip()
```

Then, inside `ClusterConfigSchema`'s object (e.g. right after the `name:` line), add:

```ts
    mode: z.enum(['container', 'virtualization']).optional().default('container'),
    virt: VirtConfigSchema.optional().default(() => VirtConfigSchema.parse({})),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/composables/__tests__/useUrlState.test.ts`
Expected: PASS — including the existing URL round-trip tests.

- [ ] **Step 5: Commit**

```bash
rtk git add src/composables/useUrlState.ts src/composables/__tests__/useUrlState.test.ts
rtk git commit -m "feat(state): round-trip mode + virt config through URL/session schema

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: i18n message keys (4 locales)

**Files:**
- Modify: `src/i18n/locales/en.json`, `fr.json`, `de.json`, `it.json`

- [ ] **Step 1: Add the keys**

The engine now emits `validation.virtNoVms`, `validation.virtOvercommitRange`, and `warnings.virt.odfNotInOve`. Add them to each locale.

In `src/i18n/locales/en.json`, add to the `validation` object:

```json
    "virtNoVms": "No VMs defined — add at least one VM class with a non-zero count.",
    "virtOvercommitRange": "CPU overcommit ratio should be between 1 and 10 (KubeVirt maximum)."
```

and to the existing `warnings.virt` object (alongside `rwxStorageRequired`):

```json
    "odfNotInOve": "ODF is not included in the OpenShift Virtualization Engine subscription — license and size it separately."
```

In `src/i18n/locales/fr.json` — `validation`:

```json
    "virtNoVms": "Aucune VM définie — ajoutez au moins une classe de VM avec un nombre non nul.",
    "virtOvercommitRange": "Le ratio de surallocation CPU doit être compris entre 1 et 10 (maximum KubeVirt)."
```

`warnings.virt`:

```json
    "odfNotInOve": "ODF n'est pas inclus dans l'abonnement OpenShift Virtualization Engine — à licencier et dimensionner séparément."
```

In `src/i18n/locales/de.json` — `validation`:

```json
    "virtNoVms": "Keine VMs definiert — fügen Sie mindestens eine VM-Klasse mit einer Anzahl größer null hinzu.",
    "virtOvercommitRange": "Das CPU-Overcommit-Verhältnis sollte zwischen 1 und 10 liegen (KubeVirt-Maximum)."
```

`warnings.virt`:

```json
    "odfNotInOve": "ODF ist nicht im OpenShift Virtualization Engine-Abonnement enthalten — separat lizenzieren und dimensionieren."
```

In `src/i18n/locales/it.json` — `validation`:

```json
    "virtNoVms": "Nessuna VM definita — aggiungi almeno una classe di VM con un conteggio diverso da zero.",
    "virtOvercommitRange": "Il rapporto di overcommit della CPU deve essere compreso tra 1 e 10 (massimo KubeVirt)."
```

`warnings.virt`:

```json
    "odfNotInOve": "ODF non è incluso nell'abbonamento OpenShift Virtualization Engine — da licenziare e dimensionare separatamente."
```

(Add a trailing comma to the preceding line in each object as needed so the JSON stays valid.)

- [ ] **Step 2: Verify JSON is valid + build still works**

Run: `npm run type-check`
Expected: PASS (vue-i18n JSON imports type-check).

Run: `node -e "['en','fr','de','it'].forEach(l=>JSON.parse(require('fs').readFileSync('src/i18n/locales/'+l+'.json','utf8')));console.log('all locales valid JSON')"`
Expected: `all locales valid JSON`

- [ ] **Step 3: Commit**

```bash
rtk git add src/i18n/locales/en.json src/i18n/locales/fr.json src/i18n/locales/de.json src/i18n/locales/it.json
rtk git commit -m "i18n: virtualization validation + licensing message keys (en/fr/de/it)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Barrel exports + full regression

**Files:**
- Modify: `src/engine/index.ts`

- [ ] **Step 1: Add exports**

In `src/engine/index.ts`, update the defaults export line and the virtualization block:

Change:

```ts
export { createDefaultClusterConfig } from './defaults'
```

to:

```ts
export { createDefaultClusterConfig, createDefaultVirtConfig } from './defaults'
```

and add to the virtualization export block:

```ts
export { assembleVirtCluster } from './virtualization/assembleVirtCluster'
```

- [ ] **Step 2: Full regression**

Run: `npm run type-check`
Expected: PASS (exit 0).

Run: `npm run test`
Expected: PASS — all prior tests **plus** Phase 2's new tests (370 + ~18 = ~388), 0 failures.

Run: `npm run format:check && npm run lint`
Expected: format clean; lint 0 errors.

- [ ] **Step 3: Commit**

```bash
rtk git add src/engine/index.ts
rtk git commit -m "feat(engine): export createDefaultVirtConfig + assembleVirtCluster

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 self-review

- **Spec coverage:** discriminator (`mode`) added (additive variant, documented); virt cluster assembly (control plane + virt workers + ODF + storage); validation (no-VMs, overcommit bounds, OVE-ODF licensing); versioned-by-default session/URL schema with backward compatibility; i18n in all four locales. Wizard UI is Phase 3 (out of scope here).
- **Placeholder scan:** none — every step has real code and exact expected numbers.
- **Type consistency:** `createDefaultVirtConfig`, `assembleVirtCluster` signatures consistent across defaults/calculators/index; `VirtConfig`/`ClusterSizing`/`NodeSpec` reused from Phase 1 types; warning codes (`VIRT_NO_VMS`, `VIRT_OVERCOMMIT_OUT_OF_RANGE`, `VIRT_ODF_NOT_IN_OVE`) match their i18n keys.
- **Worked numbers verified:** virt assembly of the 3-class example → 7 virt workers (vcpu 128/node), masters 3×(4/16), ODF 3×(16/64), virtStorageGB 54000, totals {956, 3824, 55000} (ODF) / {908, 3632, 1000} (external-rwx).

## Next: Phase 3 (Wizard UI), Phase 4 (PPTX), Phase 5 (Docs) — planned when reached.
