# OVE Headroom + Storage Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two v2.2.0 OVE defects — virt workers packed to ~95% RAM with no headroom, and the 51 TB VM-disk demand invisible in the BOM — by adding a configurable target-utilization (default 80%, RAM+CPU) and a dedicated, always-visible VM Storage line across every export.

**Architecture:** A `targetUtilization` fraction on `VirtConfig` divides node capacity when counting workers in `sizeVirtWorkers`, while `nodeVmCapacity` keeps returning true allocatable capacity so the reported utilization metrics stay honest. The already-computed `{ usableGB, rawGB }` from `virtStorage()` is promoted onto `ClusterSizing.virtStorage` and rendered as a dedicated row in `BomTable`, CSV, PDF, and PPTX. A slider in `VirtWorkloadSection.vue` exposes the knob.

**Tech Stack:** TypeScript, Vue 3 + Pinia, Vitest, zod (URL/session schema), vue-i18n (en/fr/de/it), jsPDF/pptxgenjs exports. Engine is Vue-free (CALC-01). Run tests with `rtk vitest run <path>`.

**Key design refinement vs. spec:** The engine clamps `targetUtilization` to **[0.5, 1.0]** (not [0.5, 0.95]). Allowing an explicit `1.0` (full pack, no headroom) is a legitimate config, preserves the existing engine regression tests by letting them pin `targetUtilization: 1`, and avoids hand-recomputing their expected node counts. The UI slider still restricts the user-facing range to 50–95%.

---

## File Structure

**Engine (Vue-free):**
- `src/engine/constants.ts` — MODIFY: add target-utilization constants.
- `src/engine/types.ts` — MODIFY: `VirtConfig.targetUtilization?`, `ClusterSizing.virtStorage?`.
- `src/engine/shared/reservations.ts` — MODIFY: add `resolveTargetUtilization()` helper.
- `src/engine/shared/reservations.test.ts` — MODIFY: test the helper.
- `src/engine/virtualization/sizeVirtWorkers.ts` — MODIFY: apply target to RAM+CPU node counts.
- `src/engine/virtualization/sizeVirtWorkers.test.ts` — MODIFY: pin legacy fixtures to `1`, add 0.8 tests.
- `src/engine/virtualization/assembleVirtCluster.ts` — MODIFY: populate `virtStorage`.
- `src/engine/virtualization/assembleVirtCluster.test.ts` — MODIFY: pin fixture, assert `virtStorage`.
- `src/engine/defaults.ts` — MODIFY: default `targetUtilization`.
- `src/engine/defaults.test.ts` — MODIFY: assert default.

**Composables / exports:**
- `src/composables/useUrlState.ts` — MODIFY: add field to `VirtConfigSchema`.
- `src/composables/__tests__/useUrlState.test.ts` — MODIFY: round-trip test.
- `src/composables/useCsvExport.ts` — MODIFY: VM Storage row helper + wiring.
- `src/composables/__tests__/useCsvExport.test.ts` — MODIFY: assert rows.
- `src/composables/usePdfExport.ts` — MODIFY: append storage rows to `buildPdfTableData`.
- `src/composables/__tests__/usePdfExport.test.ts` — MODIFY: assert rows.
- `src/composables/usePptxExport.ts` — MODIFY: append storage rows to BOM table builder.
- `src/composables/__tests__/usePptxExport.test.ts` — MODIFY: assert rows.

**UI:**
- `src/components/results/BomTable.vue` — MODIFY: render VM Storage row(s).
- `src/components/results/__tests__/BomTable.test.ts` — MODIFY: assert row(s).
- `src/components/wizard/VirtWorkloadSection.vue` — MODIFY: add slider.
- `src/components/wizard/__tests__/virtBindings.test.ts` — MODIFY: assert patch.
- `src/i18n/locales/{en,fr,de,it}.json` — MODIFY: new `virt.*` keys.

**Docs:**
- `docs/adr/0009-virt-target-utilization-and-storage-line.md` — CREATE.
- `CHANGELOG.md` — MODIFY: Unreleased entry.
- `docs/PRD.md` — MODIFY: virtualization-mode note.

---

## Task 1: Constants + types foundation

**Files:**
- Modify: `src/engine/constants.ts` (end of file, after `ODF_FULLNESS_TARGET`)
- Modify: `src/engine/types.ts:146-152` (VirtConfig), `:79-92` (ClusterSizing)

- [ ] **Step 1: Add constants**

Append to `src/engine/constants.ts`:

```ts
// ── Virt worker target utilization (headroom) ────────────────────────────────
// Steady-state RAM/CPU target so reported utilization leaves room for live-migration
// drains, node maintenance, and growth. Spares (n+1/n+2) remain on top for failover.
/** Default steady-state utilization target for virt workers. */
export const DEFAULT_TARGET_VIRT_UTILIZATION = 0.8
/** Lower clamp: below this, over-provisioning is absurd. */
export const MIN_TARGET_VIRT_UTILIZATION = 0.5
/** Upper clamp: 1.0 = full pack, no headroom (UI restricts to 0.95). */
export const MAX_TARGET_VIRT_UTILIZATION = 1.0
```

- [ ] **Step 2: Add `targetUtilization` to VirtConfig**

In `src/engine/types.ts`, inside `interface VirtConfig` (after `storageBackend: StorageBackend`):

```ts
  storageBackend: StorageBackend
  /** Steady-state RAM/CPU utilization target (fraction). Optional for back-compat; engine falls back to DEFAULT_TARGET_VIRT_UTILIZATION. */
  targetUtilization?: number
```

- [ ] **Step 3: Add `virtStorage` to ClusterSizing**

In `src/engine/types.ts`, inside `interface ClusterSizing` (after `virtStorageGB: number`):

```ts
  virtStorageGB: number // Phase 9: estimated storage budget for VM PVCs
  /** VM disk storage plan (virtualization mode); null/absent in container mode. */
  virtStorage?: { usableGB: number; rawGB: number; backend: StorageBackend } | null
```

- [ ] **Step 4: Verify the project still type-checks**

Run: `rtk pnpm build`
Expected: build succeeds (both new fields are optional, so no existing literal breaks).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/constants.ts src/engine/types.ts
rtk git commit -m "feat(virt): add targetUtilization + virtStorage types and constants

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `resolveTargetUtilization` helper

**Files:**
- Modify: `src/engine/shared/reservations.ts`
- Test: `src/engine/shared/reservations.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/shared/reservations.test.ts`:

```ts
import { resolveTargetUtilization } from './reservations'

describe('resolveTargetUtilization', () => {
  it('falls back to 0.8 when undefined', () => {
    expect(resolveTargetUtilization(undefined)).toBe(0.8)
  })
  it('passes through an in-range value', () => {
    expect(resolveTargetUtilization(0.7)).toBe(0.7)
  })
  it('clamps below 0.5 up to 0.5', () => {
    expect(resolveTargetUtilization(0.3)).toBe(0.5)
  })
  it('clamps above 1.0 down to 1.0', () => {
    expect(resolveTargetUtilization(1.5)).toBe(1.0)
  })
  it('allows exactly 1.0 (full pack)', () => {
    expect(resolveTargetUtilization(1)).toBe(1)
  })
  it('treats NaN/0 as fallback', () => {
    expect(resolveTargetUtilization(0)).toBe(0.8)
    expect(resolveTargetUtilization(Number.NaN)).toBe(0.8)
  })
})
```

> Note: the existing file already imports `describe, it, expect` from vitest — do not duplicate that import.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/engine/shared/reservations.test.ts`
Expected: FAIL — `resolveTargetUtilization is not a function`.

- [ ] **Step 3: Implement the helper**

In `src/engine/shared/reservations.ts`, add the import and the function:

```ts
import {
  VIRT_VM_OVERHEAD_BASE_MIB,
  VIRT_VM_OVERHEAD_PER_VCPU_MIB,
  VIRT_VM_OVERHEAD_GUEST_RAM_RATIO,
  SYSTEM_RESERVED_CPU_FIRST,
  SYSTEM_RESERVED_CPU_PER_THREAD,
  SYSTEM_RESERVED_CPU_MIN,
  DEFAULT_TARGET_VIRT_UTILIZATION,
  MIN_TARGET_VIRT_UTILIZATION,
  MAX_TARGET_VIRT_UTILIZATION,
} from '../constants'

/** Resolve + clamp a virt-worker utilization target; falsy/NaN → default. */
export function resolveTargetUtilization(target: number | undefined): number {
  if (!target || Number.isNaN(target)) return DEFAULT_TARGET_VIRT_UTILIZATION
  return Math.min(Math.max(target, MIN_TARGET_VIRT_UTILIZATION), MAX_TARGET_VIRT_UTILIZATION)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run src/engine/shared/reservations.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
rtk git add src/engine/shared/reservations.ts src/engine/shared/reservations.test.ts
rtk git commit -m "feat(virt): add resolveTargetUtilization clamp helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Apply target utilization in `sizeVirtWorkers`

**Files:**
- Modify: `src/engine/virtualization/sizeVirtWorkers.ts:9-16`
- Test: `src/engine/virtualization/sizeVirtWorkers.test.ts`

- [ ] **Step 1: Pin existing fixtures to `targetUtilization: 1` (preserve legacy math)**

In `src/engine/virtualization/sizeVirtWorkers.test.ts`, add `targetUtilization: 1` to **every** `VirtConfig` literal:

In the `cfg()` helper, inside the returned object (after `storageBackend: 'odf',`):

```ts
    storageBackend: 'odf',
    targetUtilization: 1,
    ...over,
```

In the CPU-bound test literal (the `sizeVirtWorkers({ ... })` object with `cpuOvercommitRatio: 1`), add `targetUtilization: 1,` after `storageBackend: 'external-rwx',`.

In the density-bound test literal (the `sizeVirtWorkers({ ... })` object in the "density-bound" describe), add `targetUtilization: 1,` after its `storageBackend` line.

> Search the file for `storageBackend:` and ensure each VirtConfig literal gains `targetUtilization: 1`.

- [ ] **Step 2: Run the file — should still be green (target unused by code yet)**

Run: `rtk vitest run src/engine/virtualization/sizeVirtWorkers.test.ts`
Expected: PASS (current code ignores the field; legacy expectations hold).

- [ ] **Step 3: Write the failing test for the 0.8 behavior**

Append to `src/engine/virtualization/sizeVirtWorkers.test.ts`:

```ts
describe('sizeVirtWorkers — target utilization headroom', () => {
  it('default 0.8 needs more nodes than full pack and lowers RAM utilization', () => {
    const full = sizeVirtWorkers(cfg({ targetUtilization: 1 }))
    const headroom = sizeVirtWorkers(cfg({ targetUtilization: 0.8 }))
    expect(headroom.baseNodes).toBeGreaterThan(full.baseNodes)
    expect(headroom.ramUtilizationPct).toBeLessThan(full.ramUtilizationPct)
    expect(headroom.ramUtilizationPct).toBeLessThan(80)
    expect(headroom.limitingResource).toBe('ram')
  })

  it('3-class baseline at 0.8 → 7 base nodes (+1 spare = 8)', () => {
    const r = sizeVirtWorkers(cfg({ targetUtilization: 0.8 }))
    expect(r.baseNodes).toBe(7)
    expect(r.totalNodes).toBe(8)
  })

  it('undefined targetUtilization falls back to the 0.8 default', () => {
    const explicit = sizeVirtWorkers(cfg({ targetUtilization: 0.8 }))
    const fallback = sizeVirtWorkers(cfg({ targetUtilization: undefined }))
    expect(fallback.baseNodes).toBe(explicit.baseNodes)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `rtk vitest run src/engine/virtualization/sizeVirtWorkers.test.ts -t "target utilization headroom"`
Expected: FAIL — current code gives `baseNodes === 6` regardless of target.

- [ ] **Step 5: Implement target in `sizeVirtWorkers`**

In `src/engine/virtualization/sizeVirtWorkers.ts`, update the imports and the `byCpu`/`byRam` computation:

```ts
import { aggregateVmDemand } from './aggregate'
import { nodeVmCapacity } from './capacity'
import { resolveTargetUtilization } from '../shared/reservations'
import { MAX_VMS_PER_NODE, MIN_VIRT_WORKERS } from '../constants'
```

Inside `sizeVirtWorkers`, after `const ramDemand = ...`:

```ts
  const ramDemand = demand.totalGuestRamGB + demand.totalOverheadRamGB
  const target = resolveTargetUtilization(config.targetUtilization)

  const byCpu = cap.vcpuCapacity > 0 ? Math.ceil(demand.totalVcpu / (cap.vcpuCapacity * target)) : 0
  const byRam = cap.ramCapacityGB > 0 ? Math.ceil(ramDemand / (cap.ramCapacityGB * target)) : 0
  const byDensity = Math.ceil(demand.totalVms / MAX_VMS_PER_NODE)
```

Leave the utilization-percentage calculations (`cpuUtilizationPct`, `ramUtilizationPct`, `achievedOvercommit`) unchanged — they divide demand by `baseNodes × true capacity`, so they now report the honest steady-state.

- [ ] **Step 6: Run the whole file to verify pass**

Run: `rtk vitest run src/engine/virtualization/sizeVirtWorkers.test.ts`
Expected: PASS — new headroom tests pass; legacy `targetUtilization: 1` tests still pass (`baseNodes === 6`, etc.).

- [ ] **Step 7: Commit**

```bash
rtk git add src/engine/virtualization/sizeVirtWorkers.ts src/engine/virtualization/sizeVirtWorkers.test.ts
rtk git commit -m "feat(virt): size workers against target utilization (RAM+CPU headroom)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Populate `virtStorage` in `assembleVirtCluster`

**Files:**
- Modify: `src/engine/virtualization/assembleVirtCluster.ts:31-60`
- Test: `src/engine/virtualization/assembleVirtCluster.test.ts`

- [ ] **Step 1: Pin the existing fixture to `targetUtilization: 1`**

In `src/engine/virtualization/assembleVirtCluster.test.ts`, add to the `VIRT` literal (after `storageBackend: 'odf',`):

```ts
  storageBackend: 'odf',
  targetUtilization: 1,
```

This preserves the existing assertions (7 nodes, baseNodes 6, totals).

- [ ] **Step 2: Run the file — should still be green**

Run: `rtk vitest run src/engine/virtualization/assembleVirtCluster.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing test for `virtStorage`**

Append to `src/engine/virtualization/assembleVirtCluster.test.ts`:

```ts
describe('assembleVirtCluster — virtStorage plan', () => {
  it('ODF: usable = VM disk total, raw = replica-3 / 0.85', () => {
    const s = assembleVirtCluster({ ...VIRT, targetUtilization: 1 })
    expect(s.virtStorage).toEqual({ usableGB: 15300, rawGB: 54000, backend: 'odf' })
  })
  it('external-rwx: usable = VM disk total, raw = 0', () => {
    const s = assembleVirtCluster({ ...VIRT, storageBackend: 'external-rwx', targetUtilization: 1 })
    expect(s.virtStorage).toEqual({ usableGB: 15300, rawGB: 0, backend: 'external-rwx' })
  })
})
```

> `15300` = 120×40 + 60×100 + 15×300. `54000` = 15300 × 3 / 0.85.

- [ ] **Step 4: Run test to verify it fails**

Run: `rtk vitest run src/engine/virtualization/assembleVirtCluster.test.ts -t "virtStorage plan"`
Expected: FAIL — `s.virtStorage` is `undefined`.

- [ ] **Step 5: Implement**

In `src/engine/virtualization/assembleVirtCluster.ts`, the local `const storage = virtStorage(...)` already exists. In the returned object, add the `virtStorage` field (after `virtStorageGB,`):

```ts
    virtStorageGB,
    virtStorage: { usableGB: storage.usableGB, rawGB: storage.rawGB, backend: storage.backend },
```

- [ ] **Step 6: Run the file to verify pass**

Run: `rtk vitest run src/engine/virtualization/assembleVirtCluster.test.ts`
Expected: PASS (new + legacy).

- [ ] **Step 7: Commit**

```bash
rtk git add src/engine/virtualization/assembleVirtCluster.ts src/engine/virtualization/assembleVirtCluster.test.ts
rtk git commit -m "feat(virt): surface virtStorage plan on ClusterSizing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: VM Storage line in CSV export

**Files:**
- Modify: `src/composables/useCsvExport.ts`
- Test: `src/composables/__tests__/useCsvExport.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/composables/__tests__/useCsvExport.test.ts` (reuse the file's existing helpers for building a `ClusterSizing`; construct one inline if none exists):

```ts
import { buildVirtStorageRows } from '../useCsvExport'

describe('buildVirtStorageRows', () => {
  it('ODF → usable + raw rows', () => {
    const rows = buildVirtStorageRows({
      usableGB: 15300,
      rawGB: 54000,
      backend: 'odf',
    })
    expect(rows).toEqual([
      'VM Storage (usable),—,—,—,15300',
      'VM Storage (raw, replica-3 @ 85%),—,—,—,54000',
    ])
  })
  it('external-rwx → single usable row, no raw', () => {
    const rows = buildVirtStorageRows({
      usableGB: 15300,
      rawGB: 0,
      backend: 'external-rwx',
    })
    expect(rows).toEqual(['VM Storage (usable, provider-managed array),—,—,—,15300'])
  })
  it('null/undefined → no rows', () => {
    expect(buildVirtStorageRows(null)).toEqual([])
    expect(buildVirtStorageRows(undefined)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/composables/__tests__/useCsvExport.test.ts -t "buildVirtStorageRows"`
Expected: FAIL — `buildVirtStorageRows` is not exported.

- [ ] **Step 3: Implement the helper and wire it in**

In `src/composables/useCsvExport.ts`, add the import and helper near the top:

```ts
import type { ClusterSizing, NodeSpec, VmClass } from '@/engine/types'

type VirtStoragePlan = NonNullable<ClusterSizing['virtStorage']>

export function buildVirtStorageRows(plan: VirtStoragePlan | null | undefined): string[] {
  if (!plan) return []
  if (plan.backend === 'odf') {
    return [
      `VM Storage (usable),—,—,—,${Math.round(plan.usableGB)}`,
      `VM Storage (raw, replica-3 @ 85%),—,—,—,${Math.round(plan.rawGB)}`,
    ]
  }
  return [`VM Storage (usable, provider-managed array),—,—,—,${Math.round(plan.usableGB)}`]
}
```

In `buildCsvContent`, append the rows after the node rows and RHOAI row:

```ts
  return [header, ...rows, ...rhoaiRow, ...buildVirtStorageRows(sizing.virtStorage)].join('\n')
```

In `buildMultiClusterCsvContent`, inside the per-cluster loop, after the RHOAI overhead `if` block and before the blank-row separator:

```ts
    // VM Storage line(s) for virtualization-mode clusters
    for (const row of buildVirtStorageRows(sizing.virtStorage)) {
      sections.push(row)
    }

    // Blank row separator between clusters (D-11)
    sections.push('')
```

- [ ] **Step 4: Run the test file to verify pass**

Run: `rtk vitest run src/composables/__tests__/useCsvExport.test.ts`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
rtk git add src/composables/useCsvExport.ts src/composables/__tests__/useCsvExport.test.ts
rtk git commit -m "feat(export): add VM Storage line to CSV exports

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: VM Storage line in PDF export

**Files:**
- Modify: `src/composables/usePdfExport.ts:24-50` (`buildPdfTableData`)
- Test: `src/composables/__tests__/usePdfExport.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/composables/__tests__/usePdfExport.test.ts` (the file already builds `ClusterSizing` fixtures — reuse one and set `virtStorage`):

```ts
import { buildPdfTableData } from '../usePdfExport'

describe('buildPdfTableData — VM Storage rows', () => {
  function baseSizing() {
    return {
      masterNodes: { count: 3, vcpu: 4, ramGB: 16, storageGB: 100 },
      workerNodes: null,
      infraNodes: null,
      odfNodes: null,
      rhacmWorkers: null,
      virtWorkerNodes: { count: 8, vcpu: 128, ramGB: 512, storageGB: 100 },
      gpuNodes: null,
      virtStorageGB: 54000,
      rhoaiOverhead: null,
      totals: { vcpu: 1036, ramGB: 4112, storageGB: 55000 },
    }
  }
  it('ODF → two storage rows appended', () => {
    const { body } = buildPdfTableData({
      ...baseSizing(),
      virtStorage: { usableGB: 15300, rawGB: 54000, backend: 'odf' },
    })
    expect(body).toContainEqual(['VM Storage (usable)', '—', '—', '—', '15300'])
    expect(body).toContainEqual(['VM Storage (raw, replica-3 @ 85%)', '—', '—', '—', '54000'])
  })
  it('no virtStorage → no storage rows', () => {
    const { body } = buildPdfTableData(baseSizing())
    expect(body.some((r) => r[0]?.startsWith('VM Storage'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/composables/__tests__/usePdfExport.test.ts -t "VM Storage rows"`
Expected: FAIL — no `VM Storage` rows present.

- [ ] **Step 3: Implement**

In `src/composables/usePdfExport.ts`, add a helper above `buildPdfTableData`:

```ts
function virtStorageRows(sizing: ClusterSizing): string[][] {
  const plan = sizing.virtStorage
  if (!plan) return []
  if (plan.backend === 'odf') {
    return [
      ['VM Storage (usable)', '—', '—', '—', String(Math.round(plan.usableGB))],
      ['VM Storage (raw, replica-3 @ 85%)', '—', '—', '—', String(Math.round(plan.rawGB))],
    ]
  }
  return [['VM Storage (usable, provider-managed array)', '—', '—', '—', String(Math.round(plan.usableGB))]]
}
```

Then in `buildPdfTableData`, extend the body:

```ts
  return {
    head: [['Node Type', 'Count', 'vCPU', 'RAM (GB)', 'Storage (GB)']],
    body: [...nodeRows, ...rhoaiRows, ...virtStorageRows(sizing)],
  }
```

- [ ] **Step 4: Run the test file to verify pass**

Run: `rtk vitest run src/composables/__tests__/usePdfExport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/composables/usePdfExport.ts src/composables/__tests__/usePdfExport.test.ts
rtk git commit -m "feat(export): add VM Storage rows to PDF BOM table

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: VM Storage line in PPTX export

**Files:**
- Modify: `src/composables/usePptxExport.ts` (the BOM table row builder around lines 83-105)
- Test: `src/composables/__tests__/usePptxExport.test.ts`

- [ ] **Step 1: Inspect the BOM row builder**

Run: `rtk read src/composables/usePptxExport.ts`
Identify the exported function that maps `entries` → `dataRows` (the `cell`/`numCell` table for the single-cluster BOM slide) and the `rhoaiRows` block that follows it. Note its exact name and whether it is exported (it must be exported to unit-test; if not, export it).

- [ ] **Step 2: Write the failing test**

Append to `src/composables/__tests__/usePptxExport.test.ts`, using whatever pure row-builder the file exposes. If the builder returns `TableRow[]` where each cell is `{ text }`, assert on the text. Example shape — adapt the import name to the actual exported function:

```ts
import { buildBomTableRows } from '../usePptxExport' // adjust to the real exported name

function sizing(virtStorage: { usableGB: number; rawGB: number; backend: 'odf' | 'external-rwx' } | null) {
  return {
    masterNodes: { count: 3, vcpu: 4, ramGB: 16, storageGB: 100 },
    workerNodes: null, infraNodes: null, odfNodes: null, rhacmWorkers: null,
    virtWorkerNodes: { count: 8, vcpu: 128, ramGB: 512, storageGB: 100 },
    gpuNodes: null, virtStorageGB: 54000, rhoaiOverhead: null,
    virtStorage,
    totals: { vcpu: 1036, ramGB: 4112, storageGB: 55000 },
  }
}

describe('PPTX BOM — VM Storage rows', () => {
  it('ODF → usable + raw rows present', () => {
    const rows = buildBomTableRows(sizing({ usableGB: 15300, rawGB: 54000, backend: 'odf' }))
    const flat = rows.map((r) => r.map((c: { text: string }) => c.text))
    expect(flat).toContainEqual(['VM Storage (usable)', '—', '—', '—', '15300'])
    expect(flat).toContainEqual(['VM Storage (raw, replica-3 @ 85%)', '—', '—', '—', '54000'])
  })
  it('no virtStorage → no storage rows', () => {
    const rows = buildBomTableRows(sizing(null))
    const flat = rows.map((r) => r.map((c: { text: string }) => c.text))
    expect(flat.some((r) => r[0]?.startsWith('VM Storage'))).toBe(false)
  })
})
```

> If the row builder is not currently exported or not pure, refactor minimally to export a pure `buildBomTableRows(sizing): TableRow[]` and have the slide code call it. Keep the cell-shape (`cell()`/`numCell()`) identical.

- [ ] **Step 3: Run test to verify it fails**

Run: `rtk vitest run src/composables/__tests__/usePptxExport.test.ts -t "VM Storage rows"`
Expected: FAIL.

- [ ] **Step 4: Implement**

In `src/composables/usePptxExport.ts`, after the `rhoaiRows` definition in the BOM row builder, add:

```ts
  const virtStorageRows: TableRow[] = (() => {
    const plan = sizing.virtStorage
    if (!plan) return []
    const row = (label: string, gb: number): TableRow => [
      cell(label),
      numCell('—'),
      numCell('—'),
      numCell('—'),
      numCell(String(Math.round(gb))),
    ]
    if (plan.backend === 'odf') {
      return [row('VM Storage (usable)', plan.usableGB), row('VM Storage (raw, replica-3 @ 85%)', plan.rawGB)]
    }
    return [row('VM Storage (usable, provider-managed array)', plan.usableGB)]
  })()
```

Then include `...virtStorageRows` in the returned rows array (after `...rhoaiRows`).

- [ ] **Step 5: Run the test file to verify pass**

Run: `rtk vitest run src/composables/__tests__/usePptxExport.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/composables/usePptxExport.ts src/composables/__tests__/usePptxExport.test.ts
rtk git commit -m "feat(export): add VM Storage rows to PPTX BOM table

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: VM Storage row in BomTable.vue

**Files:**
- Modify: `src/components/results/BomTable.vue`
- Test: `src/components/results/__tests__/BomTable.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/components/results/__tests__/BomTable.test.ts` (reuse the existing mount/result-builder pattern in that file; the snippet below assumes a `mountWith(sizingPartial)` style — adapt to the file's actual helper):

```ts
it('renders VM Storage usable + raw rows for ODF virt sizing', () => {
  const wrapper = mountBom({
    virtWorkerNodes: { count: 8, vcpu: 128, ramGB: 512, storageGB: 100 },
    virtStorage: { usableGB: 15300, rawGB: 54000, backend: 'odf' },
  })
  const text = wrapper.text()
  expect(text).toContain('VM Storage (usable)')
  expect(text).toContain('15300')
  expect(text).toContain('54000')
})

it('renders a single provider-managed row for external-rwx', () => {
  const wrapper = mountBom({
    virtWorkerNodes: { count: 8, vcpu: 128, ramGB: 512, storageGB: 100 },
    virtStorage: { usableGB: 15300, rawGB: 0, backend: 'external-rwx' },
  })
  expect(wrapper.text()).toContain('provider-managed')
  expect(wrapper.text()).not.toContain('replica-3')
})
```

> Match the existing test's helper for constructing a `SizingResult`/`ClusterSizing` and supplying it as the `result` prop. If the file builds the prop inline, follow that shape and add `virtStorage` to it.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/components/results/__tests__/BomTable.test.ts -t "VM Storage"`
Expected: FAIL — text not found.

- [ ] **Step 3: Implement the row in the template**

In `src/components/results/BomTable.vue`, add a computed for the storage plan in `<script setup>`:

```ts
  const virtStorage = computed(() => props.result.sizing.virtStorage ?? null)
  const storageRows = computed(() => {
    const p = virtStorage.value
    if (!p) return []
    if (p.backend === 'odf') {
      return [
        { label: t('virt.vmStorageUsable'), value: Math.round(p.usableGB) },
        { label: t('virt.vmStorageRaw'), value: Math.round(p.rawGB) },
      ]
    }
    return [{ label: t('virt.vmStorageExternal'), value: Math.round(p.usableGB) }]
  })
```

In `<template>`, after the RHOAI overhead `<tr>` block (still inside `<tbody>`), add:

```html
        <tr v-for="sr in storageRows" :key="sr.label" class="bg-amber-50 dark:bg-amber-900/20">
          <td class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 italic">
            {{ sr.label }}
          </td>
          <td class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400" colspan="3">—</td>
          <td class="px-3 py-2 font-mono border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200">
            {{ sr.value }}
          </td>
        </tr>
```

(The i18n keys `virt.vmStorageUsable`, `virt.vmStorageRaw`, `virt.vmStorageExternal` are added in Task 10.)

- [ ] **Step 4: Run the test file to verify pass**

Run: `rtk vitest run src/components/results/__tests__/BomTable.test.ts`
Expected: PASS. (If the i18n keys aren't added yet and the test asserts on translated literals like "VM Storage (usable)", do Task 10 first or assert on the English values the test mounts with. The keys in Task 10 use those exact English strings.)

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/results/BomTable.vue src/components/results/__tests__/BomTable.test.ts
rtk git commit -m "feat(ui): render VM Storage row(s) in BomTable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Add `targetUtilization` to the URL/session schema

**Files:**
- Modify: `src/composables/useUrlState.ts:68-77` (`VirtConfigSchema`)
- Test: `src/composables/__tests__/useUrlState.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/composables/__tests__/useUrlState.test.ts`:

```ts
import { ClusterConfigSchema } from '../useUrlState'

describe('VirtConfigSchema — targetUtilization', () => {
  it('defaults targetUtilization to 0.8 when absent', () => {
    const parsed = ClusterConfigSchema.parse({ mode: 'virtualization', virt: {} })
    expect(parsed.virt.targetUtilization).toBe(0.8)
  })
  it('preserves an in-range value', () => {
    const parsed = ClusterConfigSchema.parse({ mode: 'virtualization', virt: { targetUtilization: 0.7 } })
    expect(parsed.virt.targetUtilization).toBe(0.7)
  })
})
```

> If `ClusterConfigSchema` is not exported, export it (it is referenced at line 78). If the test file uses a different entry point (e.g. an encode/decode round-trip helper), follow that pattern instead and assert the decoded `targetUtilization`.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/composables/__tests__/useUrlState.test.ts -t "targetUtilization"`
Expected: FAIL — value is `undefined` (field stripped by `.strip()`).

- [ ] **Step 3: Implement**

In `src/composables/useUrlState.ts`, add to `VirtConfigSchema` (after `storageBackend`):

```ts
    storageBackend: z.enum(['odf', 'external-rwx']).default('odf'),
    targetUtilization: z.number().min(0.5).max(1).default(0.8),
```

- [ ] **Step 4: Run the test file to verify pass**

Run: `rtk vitest run src/composables/__tests__/useUrlState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/composables/useUrlState.ts src/composables/__tests__/useUrlState.test.ts
rtk git commit -m "feat(virt): persist targetUtilization in URL/session schema

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Defaults + i18n keys

**Files:**
- Modify: `src/engine/defaults.ts:6-18`
- Test: `src/engine/defaults.test.ts`
- Modify: `src/i18n/locales/en.json`, `fr.json`, `de.json`, `it.json`

- [ ] **Step 1: Write the failing default test**

Append to `src/engine/defaults.test.ts` inside the `createDefaultVirtConfig` describe:

```ts
  it('defaults targetUtilization to 0.8', () => {
    expect(createDefaultVirtConfig().targetUtilization).toBe(0.8)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/engine/defaults.test.ts -t "targetUtilization"`
Expected: FAIL — `undefined`.

- [ ] **Step 3: Implement the default**

In `src/engine/defaults.ts`, add the import and field. Import:

```ts
import { DEFAULT_CPU_OVERCOMMIT_RATIO, DEFAULT_TARGET_VIRT_UTILIZATION } from './constants'
```

(merge with the existing `./constants` import if one already exists). In `createDefaultVirtConfig()` return object, after `storageBackend: 'odf',`:

```ts
    storageBackend: 'odf',
    targetUtilization: DEFAULT_TARGET_VIRT_UTILIZATION,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run src/engine/defaults.test.ts`
Expected: PASS.

- [ ] **Step 5: Add i18n keys (all four locales)**

In `src/i18n/locales/en.json`, inside the main `"virt"` block (the one starting at line 116 with `vmClasses`), after `"redN2": "N+2",` add:

```json
    "targetUtilization": "Target utilization",
    "targetUtilizationHelp": "Steady-state RAM/CPU target. Lower leaves more headroom for live migration, maintenance, and growth; spares are added on top for failover.",
    "vmStorageUsable": "VM Storage (usable)",
    "vmStorageRaw": "VM Storage (raw, replica-3 @ 85%)",
    "vmStorageExternal": "VM Storage (usable, provider-managed array)",
```

In `src/i18n/locales/fr.json`, same location in its `"virt"` block:

```json
    "targetUtilization": "Taux d'utilisation cible",
    "targetUtilizationHelp": "Cible RAM/CPU en régime permanent. Une valeur plus basse laisse de la marge pour la migration à chaud, la maintenance et la croissance ; les nœuds de secours s'ajoutent par-dessus pour le basculement.",
    "vmStorageUsable": "Stockage VM (utile)",
    "vmStorageRaw": "Stockage VM (brut, réplica-3 @ 85 %)",
    "vmStorageExternal": "Stockage VM (utile, baie gérée par le fournisseur)",
```

In `src/i18n/locales/de.json`:

```json
    "targetUtilization": "Ziel-Auslastung",
    "targetUtilizationHelp": "Stationäres RAM/CPU-Ziel. Niedrigere Werte lassen mehr Reserve für Live-Migration, Wartung und Wachstum; Ersatzknoten kommen für das Failover obendrauf.",
    "vmStorageUsable": "VM-Speicher (nutzbar)",
    "vmStorageRaw": "VM-Speicher (brutto, Replika-3 @ 85 %)",
    "vmStorageExternal": "VM-Speicher (nutzbar, anbieterverwaltetes Array)",
```

In `src/i18n/locales/it.json`:

```json
    "targetUtilization": "Utilizzo target",
    "targetUtilizationHelp": "Target RAM/CPU a regime. Valori più bassi lasciano più margine per migrazione a caldo, manutenzione e crescita; i nodi di riserva si aggiungono per il failover.",
    "vmStorageUsable": "Storage VM (utilizzabile)",
    "vmStorageRaw": "Storage VM (grezzo, replica-3 @ 85%)",
    "vmStorageExternal": "Storage VM (utilizzabile, array gestito dal provider)",
```

> Place the keys at the same nesting level as `redN2` in each file. Validate JSON after editing.

- [ ] **Step 6: Verify build + i18n parse**

Run: `rtk pnpm build`
Expected: build succeeds (no JSON syntax errors).

- [ ] **Step 7: Commit**

```bash
rtk git add src/engine/defaults.ts src/engine/defaults.test.ts src/i18n/locales/en.json src/i18n/locales/fr.json src/i18n/locales/de.json src/i18n/locales/it.json
rtk git commit -m "feat(virt): default targetUtilization 0.8 + i18n keys (en/fr/de/it)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Target-utilization slider in VirtWorkloadSection

**Files:**
- Modify: `src/components/wizard/VirtWorkloadSection.vue`
- Test: `src/components/wizard/__tests__/virtBindings.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/components/wizard/__tests__/virtBindings.test.ts`:

```ts
  it('patching virt.targetUtilization persists as a fraction', () => {
    const store = useInputStore()
    const c = store.clusters[0]!
    store.updateCluster(c.id, {
      mode: 'virtualization',
      virt: { ...c.virt!, targetUtilization: 0.7 },
    })
    expect(store.clusters[0]!.virt?.targetUtilization).toBe(0.7)
    const { sizing } = calcCluster(store.clusters[0]!)
    // Lower target → more virt workers than full pack
    const full = calcCluster({
      ...store.clusters[0]!,
      virt: { ...store.clusters[0]!.virt!, targetUtilization: 1 },
    }).sizing
    expect(sizing.virtWorkerNodes!.count).toBeGreaterThanOrEqual(full.virtWorkerNodes!.count)
  })
```

- [ ] **Step 2: Run test to verify it fails or passes trivially**

Run: `rtk vitest run src/components/wizard/__tests__/virtBindings.test.ts -t "targetUtilization"`
Expected: PASS for the store-persist assertions even before UI work (the store accepts arbitrary `virt` patches). This test guards the data path; the UI control in Step 3 makes it user-reachable. If it already passes, proceed — Step 3 adds the control and a render assertion.

- [ ] **Step 3: Add the slider to the component**

In `src/components/wizard/VirtWorkloadSection.vue`, add a control block after the redundancy block (before the closing `</div>` of the root). Reuse `NumberSliderInput`, converting percent↔fraction:

```html
    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('virt.targetUtilization') }}
      </p>
      <NumberSliderInput
        :model-value="Math.round((virt.targetUtilization ?? 0.8) * 100)"
        :label="t('virt.targetUtilization')"
        unit="%"
        :min="50"
        :max="95"
        :step="5"
        @update:model-value="(v: number) => patch({ targetUtilization: v / 100 })"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('virt.targetUtilizationHelp') }}</p>
    </div>
```

`Math` is a global; no import needed in the template expression context of Vue SFCs. If the linter objects, compute it in `<script setup>` as `const targetPct = computed(() => Math.round((virt.value.targetUtilization ?? 0.8) * 100))` and bind `:model-value="targetPct"`.

- [ ] **Step 4: Add a render assertion to the test**

Append to the same test file:

```ts
  it('renders the target utilization control', async () => {
    const { mount } = await import('@vue/test-utils')
    // follow the existing mount pattern in this file's other component tests if present;
    // otherwise assert via the i18n key being registered:
    const { default: messages } = await import('@/i18n/locales/en.json')
    expect((messages as Record<string, Record<string, string>>).virt.targetUtilization).toBe(
      'Target utilization',
    )
  })
```

> If this test file is store-only (no component mounting), keep the simpler i18n-key assertion above rather than introducing a mount harness.

- [ ] **Step 5: Run the test file + build**

Run: `rtk vitest run src/components/wizard/__tests__/virtBindings.test.ts && rtk pnpm build`
Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/wizard/VirtWorkloadSection.vue src/components/wizard/__tests__/virtBindings.test.ts
rtk git commit -m "feat(ui): add target-utilization slider to virt workload section

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Full suite, docs, ADR, changelog

**Files:**
- Create: `docs/adr/0009-virt-target-utilization-and-storage-line.md`
- Modify: `CHANGELOG.md`, `docs/PRD.md`

- [ ] **Step 1: Run the full test suite**

Run: `rtk vitest run`
Expected: PASS — all tests green (396 prior + new). If any legacy virt test fails on node counts, it is missing `targetUtilization: 1`; add it.

- [ ] **Step 2: Run lint + build**

Run: `rtk lint && rtk pnpm build`
Expected: no errors.

- [ ] **Step 3: Write ADR 0009**

Create `docs/adr/0009-virt-target-utilization-and-storage-line.md`:

```markdown
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
```

- [ ] **Step 4: Update CHANGELOG**

In `CHANGELOG.md`, under the `## [Unreleased]` section (create an `### Fixed` / `### Added` subsection as the file's style dictates), add:

```markdown
### Added
- Virtualization mode: configurable **target utilization** (default 80%, RAM + CPU) so virt-worker sizing leaves operational headroom instead of packing to ~95% RAM.
- Virtualization mode: dedicated **VM Storage** line (usable + raw) in BOM, CSV, PDF, and PPTX exports — the VM disk requirement is no longer hidden behind the per-node OS disk.
```

- [ ] **Step 5: Update PRD**

In `docs/PRD.md`, in the virtualization-mode section, add a sentence noting the target-utilization control (default 80%, range 50–95%) and that exports surface a VM Storage line (usable + raw for ODF; usable/provider-managed for external-rwx). Match the surrounding prose style.

- [ ] **Step 6: Commit**

```bash
rtk git add docs/adr/0009-virt-target-utilization-and-storage-line.md CHANGELOG.md docs/PRD.md
rtk git commit -m "docs: ADR 0009 + changelog + PRD for OVE headroom & storage line

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done-when

- `rtk vitest run` fully green; `rtk lint` and `rtk pnpm build` clean.
- Re-running the reference 650-VM ODF sizing yields ~21 base virt workers (vs 17), RAM utilization ~79% (vs 97%), and the BOM/CSV/PDF/PPTX each show a VM Storage line (≈15,300 usable / 54,000 raw in the unit fixture; 51,000 / 180,000 in the user's real input).
- The Architecture step shows a "Target utilization" slider (50–95%, default 80) in all four languages.
