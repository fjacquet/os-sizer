# Phase 9: Virt Engine Foundation — Research

**Researched:** 2026-04-01
**Domain:** KubeVirt/OpenShift Virtualization overhead modeling, SNO-virt profile, recommendation engine extension, ValidationWarning system
**Confidence:** HIGH — all patterns derived directly from live codebase; KubeVirt overhead constants from official Red Hat docs

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIRT-02 | `calcVirt()` applies KubeVirt per-worker overhead: +2 vCPU/node plus per-VM formula (0.002 × guestRAM + 218 MiB + 8 MiB × vCPUs) | Overhead formula verified from Red Hat memory management article; post-dispatch pattern from calcODF() |
| VIRT-04 | Virt topology surfaced as a recommendation option in the recommendation engine | `recommend()` function and `scoreTopology()` switch fully understood; new `scoreVirt()` function follows existing scorer shape |
| SNO-01 | SNO-with-Virt option: 14 vCPU, 32 GB RAM, 170 GB total storage (120 GB root + 50 GB second disk) | `calcSNO()` profileMap pattern confirmed; SNO_STD_MIN is 8/16/120; boost logic is a simple conditional branch |
| WARN-02 | Emit `ValidationWarning` when virt topology active and ODF not enabled: RWX storage required for live migration | `validateInputs()` pattern confirmed; new check mirrors ODF_INCOMPATIBLE_TOPOLOGY pattern |
</phase_requirements>

---

## Summary

Phase 9 is a pure engine extension — zero UI work, zero new npm packages. The existing codebase provides an exact template for every piece of work required. The `calcODF()` / `calcRHACM()` post-dispatch pattern in `addons.ts` is the template for `calcVirt()`. The `calcSNO()` profileMap is the template for the SNO-virt profile. The `validateInputs()` pattern is the template for WARN-02. The `recommend()` and `scoreTopology()` switch is the template for surfacing virt as a topology recommendation.

The single highest-risk prerequisite is extending `ClusterSizing` and `AddOnConfig` in `src/engine/types.ts` **before any calculator code is written**. This must be the first commit of the phase because the type flows through the dispatcher (`calcCluster()`), the totals recalculation in `sumTotals()`, and the Zod schema in URL state. TypeScript will catch downstream type gaps immediately if the type extension lands first and all test fixtures are strictly typed.

**Primary recommendation:** Type extension first (commit 1), then constants (commit 2), then `calcVirt()` + wiring (commit 3), then `calcSNO()` SNO-virt branch + recommendation engine (commit 4), then WARN-02 + tests (commit 5).

---

## 1. Type Changes Required

### 1.1 `ClusterSizing` Extension (src/engine/types.ts)

Current `ClusterSizing` (confirmed from live file):
```typescript
export interface ClusterSizing {
  masterNodes: NodeSpec
  workerNodes: NodeSpec | null
  infraNodes: NodeSpec | null
  odfNodes: NodeSpec | null
  rhacmWorkers: NodeSpec | null
  totals: { vcpu: number; ramGB: number; storageGB: number }
}
```

Required additions for Phase 9:
```typescript
export interface ClusterSizing {
  masterNodes: NodeSpec
  workerNodes: NodeSpec | null
  infraNodes: NodeSpec | null
  odfNodes: NodeSpec | null
  rhacmWorkers: NodeSpec | null
  virtWorkerNodes: NodeSpec | null   // NEW Phase 9: dedicated VM-hosting worker pool
  gpuNodes: NodeSpec | null          // NEW Phase 9: placeholder for Phase 10 (must land here)
  virtStorageGB: number              // NEW Phase 9: estimated storage for VM PVCs
  totals: { vcpu: number; ramGB: number; storageGB: number }
}
```

**Critical:** `gpuNodes: NodeSpec | null` must land in this commit even though Phase 10 implements the GPU calculator. The field appears in `ClusterSizing` which flows into the BoM table, CSV, PPTX, and PDF exports. Deferring to Phase 10 would require re-reviewing every export consumer.

**Impact ripple:** The `emptySizing()` helper in `calculators.ts` constructs a scaffold `ClusterSizing`. It must be updated to include the new fields (`virtWorkerNodes: null`, `gpuNodes: null`, `virtStorageGB: 0`). Similarly, every topology calculator that constructs a `ClusterSizing` literal (all 8 calculators) must be updated in the same commit — TypeScript will enforce this at compile time.

### 1.2 `AddOnConfig` Extension (src/engine/types.ts)

Current `AddOnConfig` (confirmed from live file):
```typescript
export interface AddOnConfig {
  odfEnabled: boolean
  odfExtraOsdCount: number
  infraNodesEnabled: boolean
  rhacmEnabled: boolean
  rhacmManagedClusters: number
}
```

Phase 9 additions:
```typescript
export interface AddOnConfig {
  odfEnabled: boolean
  odfExtraOsdCount: number
  infraNodesEnabled: boolean
  rhacmEnabled: boolean
  rhacmManagedClusters: number
  // NEW Phase 9
  virtEnabled: boolean          // OpenShift Virtualization / CNV
  vmsPerWorker: number          // target VM density per worker node (default 10)
  virtAvgVmVcpu: number         // average vCPU per VM (default 4)
  virtAvgVmRamGB: number        // average RAM per VM in GB (default 8)
  snoVirtMode: boolean          // SNO-with-Virt profile (SNO-01)
}
```

Note: `vmsPerWorker` drives the worker count derivation — it represents the user-declared target packing density, not an auto-computed value. `virtAvgVmVcpu` and `virtAvgVmRamGB` are used for the per-VM overhead formula.

### 1.3 `RecommendationConstraints` Extension (src/engine/types.ts)

Current `RecommendationConstraints` (confirmed from live file):
```typescript
export interface RecommendationConstraints {
  environment: EnvironmentType
  haRequired: boolean
  maxNodes: number | null
  airGapped: boolean
  estimatedWorkers: number
  addOns: { odf: boolean; rhacm: boolean }
}
```

Phase 9 addition:
```typescript
export interface RecommendationConstraints {
  environment: EnvironmentType
  haRequired: boolean
  maxNodes: number | null
  airGapped: boolean
  estimatedWorkers: number
  addOns: { odf: boolean; rhacm: boolean; virt: boolean }  // add virt flag
}
```

The `virt: boolean` flag in the `addOns` sub-object allows `scoreTopology()` to boost the virt topology score when VM workloads are present without changing the scorer function signatures.

### 1.4 `defaults.ts` Extension

`createDefaultClusterConfig()` must be updated to include defaults for all new `AddOnConfig` fields:
```typescript
addOns: {
  odfEnabled: false,
  odfExtraOsdCount: 0,
  infraNodesEnabled: false,
  rhacmEnabled: false,
  rhacmManagedClusters: 0,
  // NEW Phase 9
  virtEnabled: false,
  vmsPerWorker: 10,
  virtAvgVmVcpu: 4,
  virtAvgVmRamGB: 8,
  snoVirtMode: false,
},
```

---

## 2. New Constants (src/engine/constants.ts)

All new constants follow the existing pattern: named exports, typed, single source annotation comment.

```typescript
// KubeVirt worker node per-node overhead
// Source: Red Hat OpenShift Virtualization docs + community — "2 additional cores per virt-enabled node"
export const VIRT_OVERHEAD_CPU_PER_NODE = 2          // vCPU reserved per virt-enabled worker

// KubeVirt per-VM overhead formula constants (virt-launcher pod overhead)
// Source: developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization
// Formula: overheadMiB = VIRT_VM_OVERHEAD_BASE_MIB + VIRT_VM_OVERHEAD_PER_VCPU_MIB * vCPUs + 0.002 * guestRAM_MiB
export const VIRT_VM_OVERHEAD_BASE_MIB = 218
export const VIRT_VM_OVERHEAD_PER_VCPU_MIB = 8
export const VIRT_VM_OVERHEAD_GUEST_RAM_RATIO = 0.002  // 0.2% of guest RAM

// SNO-with-Virt minimum (SNO-01)
// Source: Red Hat SNO docs + access.redhat.com/solutions/7014308 — boosted minimums for virt-enabled SNO
// Base SNO_STD_MIN is 8 vCPU / 16 GB / 120 GB — virt requires 14 vCPU / 32 GB / 170 GB
export const SNO_VIRT_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 14, ramGB: 32, storageGB: 170 }
export const SNO_VIRT_STORAGE_EXTRA_GB = 50           // second disk for VM PVCs (hostpath-provisioner)
```

**Why `SNO_VIRT_MIN` as a complete `NodeSpec`?** Consistency with existing pattern (`SNO_STD_MIN`, `SNO_EDGE_MIN`, `SNO_TELECOM_MIN` are all `Readonly<NodeSpec>`). The profileMap in `calcSNO()` does a lookup by profile name and spreads the constant — adding `SNO_VIRT_MIN` to this map requires it to be a `NodeSpec`.

---

## 3. `calcVirt()` Implementation

### 3.1 Worker Count Derivation

`calcVirt()` is a **post-dispatch add-on** in `addons.ts`, identical in structure to `calcODF()` and `calcRHACM()`. It returns a `NodeSpec` for the dedicated VM-hosting worker pool.

The worker count formula has two constraints — take the maximum:

```
// Worker count needed to meet target VM density
workersByDensity = ceil(vmCount / vmsPerWorker)

// Worker count needed to meet VM RAM demand with per-VM overhead applied
vmOverheadMiB(vm) = VIRT_VM_OVERHEAD_BASE_MIB
                  + VIRT_VM_OVERHEAD_PER_VCPU_MIB * avgVmVcpu
                  + VIRT_VM_OVERHEAD_GUEST_RAM_RATIO * (avgVmRamGB * 1024)
totalRamDemandGB  = vmCount * (avgVmRamGB + vmOverheadMiB / 1024)
workersByRam      = ceil(totalRamDemandGB / (allocatableRamGB(nodeRamGB) * TARGET_UTILIZATION))

// Workers needed to meet VM CPU demand with per-node virt overhead applied
// Note: the per-node overhead is applied AFTER worker count is determined
// Pattern: first compute raw CPU demand workers, then add overhead
totalVcpuDemand  = vmCount * avgVmVcpu
workersByCpu     = ceil(totalVcpuDemand / (nodeVcpu * TARGET_UTILIZATION))

// Final worker count: max of density, RAM, CPU constraints + 1 live migration reserve
workerCount = Math.max(workersByDensity, workersByRam, workersByCpu, 3) + 1
```

The `+1` live migration reserve is the KubeVirt standard — one node can be drained for maintenance without losing VMs.

**Per-node CPU overhead application:** After the worker count is determined, the per-node KubeVirt overhead is accounted for in the `vcpu` field of the returned `NodeSpec`:
```
NodeSpec.vcpu = nodeVcpu + VIRT_OVERHEAD_CPU_PER_NODE
```
This ensures each returned worker node spec already includes the 2 vCPU reservation for KubeVirt management processes. This is the correct model: the overhead is per-node, not a separate node count addend.

**Why this approach satisfies VIRT-02:** The success criterion states "worker count exceeds the raw VM-count-derived minimum by the KubeVirt overhead." The raw minimum is `ceil(vmCount / vmsPerWorker)`. The returned count is that value + 1 (migration reserve) + potentially more from RAM/CPU constraints. The per-node CPU overhead (2 vCPU) is captured in the node vcpu spec. Both components of the overhead formula (per-node CPU and per-VM memory) are applied.

### 3.2 Function Signature

```typescript
// src/engine/addons.ts — add after calcRHACM()
/**
 * OpenShift Virtualization worker pool sizing.
 *
 * Sizes a dedicated virt-enabled worker pool to host the specified VM count.
 * Applies KubeVirt per-node CPU overhead (VIRT_OVERHEAD_CPU_PER_NODE) and
 * per-VM memory overhead (218 MiB + 8 MiB × vCPUs + 0.2% guest RAM).
 * Adds +1 worker as live migration headroom.
 *
 * @param vmCount       - total VMs to host across the worker pool
 * @param vmsPerWorker  - target VM density per node
 * @param avgVmVcpu     - average vCPUs per VM (for overhead formula)
 * @param avgVmRamGB    - average RAM per VM in GiB (for overhead formula)
 * @param nodeVcpu      - worker node vCPU count (before overhead)
 * @param nodeRamGB     - worker node total RAM in GiB
 * @returns NodeSpec for the virt worker pool (includes per-node CPU overhead in vcpu field)
 */
export function calcVirt(
  vmCount: number,
  vmsPerWorker: number,
  avgVmVcpu: number,
  avgVmRamGB: number,
  nodeVcpu: number,
  nodeRamGB: number,
): NodeSpec
```

### 3.3 Wiring into `calcCluster()` Dispatcher

The post-dispatch section of `calcCluster()` currently reads:

```typescript
// Post-dispatch add-on augmentation
if (config.addOns.odfEnabled) {
  sizing.odfNodes = calcODF(config.addOns.odfExtraOsdCount)
}
if (config.addOns.rhacmEnabled) {
  sizing.rhacmWorkers = calcRHACM(config.addOns.rhacmManagedClusters)
}

// Recalculate totals
if (config.addOns.odfEnabled || config.addOns.rhacmEnabled) {
  sizing.totals = sumTotals([...])
}
```

Phase 9 extends this block:
```typescript
// NEW Phase 9: virt worker pool
if (config.addOns.virtEnabled) {
  sizing.virtWorkerNodes = calcVirt(
    config.addOns.vmsPerWorker * /* estimated worker count from topology */ (sizing.workerNodes?.count ?? 3),
    config.addOns.vmsPerWorker,
    config.addOns.virtAvgVmVcpu,
    config.addOns.virtAvgVmRamGB,
    config.workload.nodeVcpu,
    config.workload.nodeRamGB,
  )
}
```

**Design decision on vmCount:** The virt pool is additive to the base topology workers. `vmCount` is the total VM count, which is `vmsPerWorker × targetWorkerCount`. The user sets `vmsPerWorker`; the total is derived by multiplying by the topology-derived worker count. This makes the virt pool scale proportionally with the cluster.

**Alternative:** Accept an absolute `vmCount` input from the user. This is simpler and will be required in Phase 12 when the wizard provides a direct VM count input. For Phase 9, derive vmCount from `vmsPerWorker × workerNodes.count` as a reasonable default until the wizard input lands.

**Totals recalculation:** After all post-dispatch add-ons are applied, `sumTotals()` must include `virtWorkerNodes` and the new `virtStorageGB` must be set:
```typescript
sizing.virtStorageGB = config.addOns.virtEnabled
  ? (sizing.virtWorkerNodes?.count ?? 0) * config.addOns.vmsPerWorker * config.addOns.virtAvgVmRamGB
  : 0

sizing.totals = sumTotals([
  sizing.masterNodes,
  sizing.workerNodes,
  sizing.infraNodes,
  sizing.odfNodes,
  sizing.rhacmWorkers,
  sizing.virtWorkerNodes,  // NEW
])
```

The condition for totals recalculation in the existing code (`if (odfEnabled || rhacmEnabled)`) must be expanded to also trigger when `virtEnabled`.

---

## 4. SNO-with-Virt Changes (SNO-01)

### 4.1 Pattern

`calcSNO()` uses a `profileMap: Record<string, Readonly<NodeSpec>>` to select the node spec:
```typescript
const profileMap: Record<string, Readonly<NodeSpec>> = {
  'standard': SNO_STD_MIN,
  'edge': SNO_EDGE_MIN,
  'telecom-vdu': SNO_TELECOM_MIN,
}
const base = profileMap[config.snoProfile] ?? SNO_STD_MIN
```

### 4.2 Required Change

The SNO-virt profile is **not a new `SnoProfile` union member** — it is a conditional override applied when `snoVirtMode` is true in `AddOnConfig`. This keeps the `SnoProfile` type clean and avoids a wizard step change in Phase 9 (UI is Phase 12).

```typescript
export function calcSNO(config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const profileMap: Record<string, Readonly<NodeSpec>> = {
    'standard': SNO_STD_MIN,
    'edge': SNO_EDGE_MIN,
    'telecom-vdu': SNO_TELECOM_MIN,
  }

  const base = profileMap[config.snoProfile] ?? SNO_STD_MIN

  // SNO-01: boost minimums when virt is enabled on SNO
  const spec = config.addOns.snoVirtMode
    ? SNO_VIRT_MIN  // 14 vCPU / 32 GB / 170 GB (120 GB root + 50 GB second disk)
    : base

  const masterNodes: NodeSpec = { ...spec }
  const sizing: ClusterSizing = emptySizing(masterNodes)

  const warnings: ValidationWarning[] = []
  if (config.addOns.snoVirtMode) {
    warnings.push({
      code: 'SNO_VIRT_NO_HA',
      severity: 'warning',
      messageKey: 'warnings.sno.virtNoHa',
    })
  }

  return { sizing, warnings }
}
```

**Why `SNO_VIRT_MIN` overrides the profileMap entirely?** The SNO-virt profile has specific minimums (14 vCPU / 32 GB / 170 GB) that apply regardless of whether the base profile is `standard` or `edge`. Using `Math.max()` across the fields would work but is more complex and harder to read — a direct constant lookup is the established pattern in this codebase.

**The `SNO_VIRT_NO_HA` warning** is important because SNO provides no HA for VMs (no live migration, no node failover). This informs the user they are accepting single-point-of-failure for their VMs.

---

## 5. Recommendation Engine Changes (VIRT-04)

### 5.1 Topology List Extension

The `topologies` array in `recommend()` must include `'standard-ha'` as the topology that maps to the virt use case. OpenShift Virtualization is not a separate topology — it runs on top of `standard-ha`. The recommendation engine's role is to surface `standard-ha` as the preferred topology **when VM workload constraints are present**, not to add a new topology type.

**VIRT-04 interpretation:** "Virt topology is surfaced as a recommendation option" means the recommendation engine recognizes VM workload constraints and boosts the score for topologies that support virt (standard-ha), not that a new `'virt'` entry appears in `TopologyType`.

This avoids a breaking change to `TopologyType` and the wizard `allTopologies` array (which is Phase 12 UI work).

### 5.2 `RecommendationConstraints` Update

The `addOns` sub-object in `RecommendationConstraints` gains `virt: boolean`. The `calculationStore.ts` passes this from `config.addOns.virtEnabled`.

### 5.3 Score Modification for `scoreStandardHa()`

```typescript
function scoreStandardHa(c: RecommendationConstraints): TopologyRecommendation {
  let score = 70
  if (c.environment === 'datacenter') score += 20
  if (c.haRequired) score += 10
  if (c.maxNodes !== null && c.maxNodes < 5) score -= 50
  // NEW Phase 9: boost standard-ha when VM workloads are present
  if (c.addOns.virt) score += 25
  return {
    topology: 'standard-ha',
    fitScore: clampScore(score),
    justificationKey: c.addOns.virt
      ? 'recommendation.standardHa.virtWorkloads'
      : 'recommendation.standardHa.production',
    warningKeys: [],
  }
}
```

The +25 score boost ensures `standard-ha` rises to the top of recommendations when `virtEnabled=true`, making it the clear first choice. The `justificationKey` switches to a virt-specific i18n key when virt is active — this key will be added to locale files in Phase 12. For Phase 9 (engine-only), the key just needs to exist as a string; the actual translation string is Phase 12 work.

**SNO with virt:** `scoreSno()` should NOT be boosted for virt — SNO-virt is a supported but constrained configuration, not a recommended one for VM workloads. The recommendation engine correctly excludes SNO when `haRequired=true` (which is the normal virt use case).

---

## 6. WARN-02 Implementation

### 6.1 Pattern

The existing `validateInputs()` in `validation.ts` follows this pattern:
```typescript
if (config.addOns.odfEnabled && ['sno', 'microshift', 'managed-cloud'].includes(config.topology)) {
  warnings.push({ code: 'ODF_INCOMPATIBLE_TOPOLOGY', severity: 'error', messageKey: 'validation.odfIncompatibleTopology' })
}
```

### 6.2 New Check for WARN-02

```typescript
// WARN-02: RWX storage required for live migration when virt is enabled without ODF
if (config.addOns.virtEnabled && !config.addOns.odfEnabled) {
  warnings.push({
    code: 'VIRT_RWX_REQUIRES_ODF',
    severity: 'warning',
    messageKey: 'warnings.virt.rwxRequiresOdf',
  })
}
```

**Severity is `warning`, not `error`:** ODF is not mandatory for OpenShift Virtualization itself — it is required only for live migration (VM migration between nodes). A cluster without ODF can still run VMs (with local storage for VM disks, no live migration). Using `error` severity would be incorrect and would block users from creating virt-only clusters on existing storage solutions. `warning` correctly communicates: "you can proceed but live migration will not work."

**Placement in `validateInputs()`:** Add after the ODF topology check. The check reads only `config.addOns.virtEnabled` and `config.addOns.odfEnabled` — no new parameters needed.

**Note on `snoVirtMode`:** SNO topology does not support live migration at all. The WARN-02 check should apply when `config.addOns.virtEnabled` is true OR `config.addOns.snoVirtMode` is true (SNO-virt also involves VMs that benefit from the storage warning). However, for SNO specifically, the severity should remain `warning` because SNO has its own `SNO_VIRT_NO_HA` warning that is more directly informative. Consider combining: trigger WARN-02 on `virtEnabled || snoVirtMode`.

---

## 7. Test Strategy

### 7.1 Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vite.config.ts` (test section) |
| Quick run | `npx vitest run src/engine/addons.test.ts` |
| Full suite | `npx vitest run` |

### 7.2 Test File Location

New tests go in `src/engine/addons.test.ts` (new `describe('calcVirt', ...)` block) and `src/engine/validation.test.ts` (new `describe('WARN-02', ...)` block). The calculators test covers the SNO-virt branch: `src/engine/calculators.test.ts` gets a new `describe('calcSNO with virt', ...)` block.

### 7.3 Tests Required per Success Criterion

**SC1 — calcVirt() overhead formula:**
```typescript
describe('calcVirt', () => {
  it('worker count exceeds raw VM-count minimum by overhead', () => {
    // 10 VMs, 10 VMs/worker → raw minimum = 1 worker
    // With live migration reserve: minimum = 2 workers
    // calcVirt must return count > 1
    const result = calcVirt(10, 10, 4, 8, 16, 32)
    expect(result.count).toBeGreaterThan(1)
  })

  it('per-node vCPU includes KubeVirt overhead (VIRT_OVERHEAD_CPU_PER_NODE=2)', () => {
    const result = calcVirt(10, 10, 4, 8, 16, 32)
    // vcpu field must be nodeVcpu + VIRT_OVERHEAD_CPU_PER_NODE
    expect(result.vcpu).toBe(16 + 2)  // 18
  })

  it('per-VM RAM overhead applied: 218 MiB base + 8 MiB×vCPUs + 0.2% guest RAM', () => {
    // 100 VMs of 4 vCPU / 8 GB RAM
    // VM overhead = (218 + 8*4 + 0.002 * 8192) MiB = (218 + 32 + 16.38) ≈ 266 MiB per VM
    // Total overhead = 100 * 266 MiB ≈ 26.6 GB
    // Workers needed for RAM: ceil((100 * 8 + 26.6) / (allocatableRamGB(32) * 0.70))
    const result = calcVirt(100, 10, 4, 8, 16, 32)
    // Should require more workers than density alone (ceil(100/10) = 10)
    expect(result.count).toBeGreaterThanOrEqual(10)
  })

  it('minimum 3 workers + 1 live migration reserve enforced', () => {
    // Only 1 VM: density would say 1 worker, but minimum is 3+1=4
    const result = calcVirt(1, 10, 4, 8, 16, 32)
    expect(result.count).toBeGreaterThanOrEqual(4)
  })
})
```

**SC3 — SNO-virt minimums:**
```typescript
describe('calcSNO with snoVirtMode', () => {
  it('SNO-virt returns 14 vCPU, 32 GB RAM, 170 GB storage', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'sno'
    config.addOns.snoVirtMode = true
    const { sizing } = calcSNO(config)
    expect(sizing.masterNodes.vcpu).toBe(14)
    expect(sizing.masterNodes.ramGB).toBe(32)
    expect(sizing.masterNodes.storageGB).toBe(170)
  })

  it('SNO-virt emits SNO_VIRT_NO_HA warning', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'sno'
    config.addOns.snoVirtMode = true
    const { warnings } = calcSNO(config)
    expect(warnings.some(w => w.code === 'SNO_VIRT_NO_HA')).toBe(true)
  })

  it('SNO standard profile unchanged when snoVirtMode=false', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'sno'
    config.addOns.snoVirtMode = false
    const { sizing } = calcSNO(config)
    expect(sizing.masterNodes.vcpu).toBe(8)
    expect(sizing.masterNodes.storageGB).toBe(120)
  })
})
```

**SC4 — WARN-02 RWX storage warning:**
```typescript
describe('WARN-02: VIRT_RWX_REQUIRES_ODF', () => {
  it('emits warning when virtEnabled=true and odfEnabled=false', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = false
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_REQUIRES_ODF' && w.severity === 'warning')).toBe(true)
  })

  it('no warning when virtEnabled=true and odfEnabled=true', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = true
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_REQUIRES_ODF')).toBe(false)
  })

  it('no warning when virtEnabled=false', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.virtEnabled = false
    config.addOns.odfEnabled = false
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_REQUIRES_ODF')).toBe(false)
  })
})
```

**SC5 — TypeScript compilation:**
```bash
npx tsc --noEmit
```
This is a pass/fail gate: all new types must be used consistently. No test file needed — the CI pipeline catches this.

### 7.4 Existing Test Zero-Vue-Import Guard

`validation.test.ts` includes a test that scans all `src/engine/*.ts` files and asserts no imports from `vue`, `pinia`, or `vue-i18n`. New engine files added in Phase 9 (`calcVirt()` additions to `addons.ts`, etc.) must maintain this constraint or the existing test will fail.

### 7.5 Wave 0 Test Gaps

All test infrastructure exists. No new test files need to be created — extend the three existing engine test files:

- [ ] `src/engine/addons.test.ts` — add `describe('calcVirt', ...)` block
- [ ] `src/engine/calculators.test.ts` — add `describe('calcSNO with snoVirtMode', ...)` block
- [ ] `src/engine/validation.test.ts` — add `describe('WARN-02', ...)` block

---

## 8. Architecture Patterns

### 8.1 Post-Dispatch Add-On Pattern

The established pattern (confirmed from `calcODF()` and `calcRHACM()`):

1. Pure function in `addons.ts` — takes primitive inputs, returns `NodeSpec`
2. No import of `ClusterConfig` — only imports constants and `NodeSpec`
3. Called from `calcCluster()` post-dispatch section
4. Result assigned to a dedicated field on `ClusterSizing`
5. `sumTotals()` in `calcCluster()` includes the new field

`calcVirt()` breaks step 2 slightly: it needs `allocatableRamGB()` from `formulas.ts` for the RAM constraint calculation. This is acceptable — `calcODF()` already imports from `./constants`. Importing from `./formulas` is equally valid as long as there are no circular imports (`formulas.ts` has no imports from `addons.ts`).

### 8.2 `emptySizing()` Helper Update Pattern

Every topology calculator that constructs `ClusterSizing` via `emptySizing()` will automatically get the new fields via the helper update. Calculators that construct `ClusterSizing` as literals (none in the current codebase — all use `emptySizing()` or build up from the scaffold) would need individual updates. **Verify** that all 8 topology calculators use `emptySizing()` or construct the full struct in a way TypeScript will catch the missing fields.

From the code review: `calcStandardHA()`, `calcHCP()` construct the `ClusterSizing` struct as a literal — these will cause TypeScript compile errors when `ClusterSizing` gains new fields, which is the desired compile-time enforcement. `calcCompact3Node()`, `calcManagedCloud()`, `calcTNA()`, `calcTNF()` also construct literals. Only `calcSNO()` and `calcMicroShift()` use `emptySizing()`.

This means **7 out of 8 topology calculators will need explicit null assignments** for the two new fields (`virtWorkerNodes: null, gpuNodes: null`) in their `ClusterSizing` literals. This is mechanical but it must be done atomically in the same commit as the type extension.

### 8.3 Recommendation Engine Pattern

The recommendation engine is a `switch` dispatcher that calls a scorer function per topology. Adding virt awareness to `scoreStandardHa()` requires no structural change — just add an `if (c.addOns.virt)` branch inside the existing scorer. The `justificationKey` switch (production vs virt-workload) uses a conditional expression, not a separate i18n file change (the key is just a string token, not resolved until Phase 12 when locale files are updated).

---

## 9. Risk Areas and Pitfalls

### Pitfall 1: `ClusterSizing` literal construction in 7 topology calculators
**What goes wrong:** TypeScript will produce compile errors in `calcStandardHA()`, `calcHCP()`, `calcTNA()`, `calcTNF()`, `calcCompact3Node()`, `calcManagedCloud()`, and potentially others that construct `ClusterSizing` as a struct literal when `virtWorkerNodes` and `gpuNodes` are added to the interface.
**Why it happens:** These calculators don't use `emptySizing()` — they build the struct inline. Adding fields to the interface requires matching updates to all struct literals.
**How to avoid:** Update all 7 literal constructions in the same commit as the type extension. Run `tsc --noEmit` immediately after the type change to enumerate all errors before writing any calculator code.
**Warning signs:** Any `tsc --noEmit` output showing "Property 'virtWorkerNodes' is missing in type literal."

### Pitfall 2: `vmsPerWorker` × `workerCount` double-counting
**What goes wrong:** If `vmCount` in `calcVirt()` is derived as `vmsPerWorker × sizing.workerNodes.count`, and the base topology's `workerNodes.count` is already inflated by a prior `calcVirt()` call (if called twice), the VM count grows unboundedly.
**Why it happens:** The dispatcher calls `calcVirt()` every time `calcCluster()` runs. If `virtWorkerNodes.count` is accidentally included in the worker count fed back to `vmCount`, it creates a feedback loop.
**How to avoid:** `calcVirt()` must derive `vmCount` from `config.addOns.vmsPerWorker × (sizing.workerNodes?.count ?? 3)` — using only `workerNodes` (the topology workers), never `virtWorkerNodes`. The virt pool is separate and must not feed back into its own count calculation.
**Warning signs:** Test with `vmsPerWorker=10` and 3 topology workers → expect `vmCount=30`. If the count grows on repeated calls, the derivation is wrong.

### Pitfall 3: `sumTotals()` missing `virtWorkerNodes`
**What goes wrong:** The totals display in the BoM table and exports shows incorrect totals if `virtWorkerNodes` is not included in the `sumTotals()` call.
**Why it happens:** The existing totals recalculation guard is `if (odfEnabled || rhacmEnabled)`. If `virtEnabled` is not added to this condition, `virtWorkerNodes` is silently omitted from totals.
**How to avoid:** Update the totals condition to `if (odfEnabled || rhacmEnabled || virtEnabled)` and include `sizing.virtWorkerNodes` in the `sumTotals([...])` call.
**Warning signs:** A test asserting `sizing.totals.vcpu > sizing.masterNodes.vcpu * 3` for a virt-enabled cluster will fail if `virtWorkerNodes` vcpu is not summed.

### Pitfall 4: SNO-virt triggers ODF_INCOMPATIBLE_TOPOLOGY warning
**What goes wrong:** The existing `validateInputs()` check fires `ODF_INCOMPATIBLE_TOPOLOGY` when `odfEnabled=true` and topology is `sno`. A user enabling SNO-virt might also want to enable ODF — but ODF on SNO is not supported by Red Hat.
**Why it happens:** SNO + ODF is genuinely incompatible. The WARN-02 check says "enable ODF for live migration" but the existing check says "ODF incompatible with SNO." This creates a contradictory pair of warnings for SNO-virt users.
**How to avoid:** For `snoVirtMode=true`, suppress WARN-02 and instead emit a different warning: `SNO_VIRT_NO_LIVE_MIGRATION` (live migration not available on SNO regardless of storage). This is more accurate than telling a SNO user to enable ODF.
**Implementation:** WARN-02 condition: `config.addOns.virtEnabled && !config.addOns.odfEnabled && config.topology !== 'sno'`. Add a separate check for `config.addOns.snoVirtMode` that emits `SNO_VIRT_NO_LIVE_MIGRATION` instead.

### Pitfall 5: `defaults.ts` not updated — `validateInputs()` test fails
**What goes wrong:** `validation.test.ts` includes `it('returns empty array for valid default config')` which calls `validateInputs(createDefaultClusterConfig(0))`. If `createDefaultClusterConfig()` doesn't include the new `AddOnConfig` fields, TypeScript will throw a compile error (or worse, the test will silently pass with `undefined` values).
**Why it happens:** `defaults.ts` is often overlooked when extending types.
**How to avoid:** `defaults.ts` update is included in the same commit as the `types.ts` extension. Run `tsc --noEmit` to confirm.

### Pitfall 6: `justificationKey` i18n key not present at runtime
**What goes wrong:** The new `'recommendation.standardHa.virtWorkloads'` justificationKey string is returned by the recommendation engine but no locale file has this key. The UI will display a fallback key string instead of translated text.
**Why it happens:** Phase 9 is engine-only — locale file updates are Phase 12.
**How to avoid:** This is known and acceptable for Phase 9. The key is a string token that the engine returns; it is not resolved until the Vue component layer consumes it. Vitest tests assert on `fitScore` and `topology`, not on `justificationKey` text. The engine test for VIRT-04 should assert `topology === 'standard-ha'` is the top-ranked recommendation when `virt=true`, not that the justification text resolves.
**Warning signs:** If the UI is tested end-to-end in Phase 9, missing i18n keys will appear. This is acceptable — note it as a known gap until Phase 12.

---

## 10. Standard Stack (No Changes)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| TypeScript via vue-tsc | ^3.2.6 | Engine type safety | Unchanged |
| Vitest | ^4.1.2 | Unit tests | Unchanged |
| decimal.js | (transitive) | Precise arithmetic in formulas | Already used in formulas.ts |

**Zero new npm packages for Phase 9.** The `calcVirt()` formula uses `allocatableRamGB()` from `formulas.ts` (which already uses `decimal.js`) and `Math.ceil()`. No additional libraries needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vite.config.ts` |
| Quick run command | `npx vitest run src/engine/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIRT-02 | calcVirt() overhead formula: per-node vCPU + per-VM RAM | unit | `npx vitest run src/engine/addons.test.ts` | Extend existing |
| VIRT-02 | Worker count > raw VM-density minimum | unit | `npx vitest run src/engine/addons.test.ts` | Extend existing |
| VIRT-04 | standard-ha is top recommendation when virt=true | unit | `npx vitest run src/engine/recommendation.test.ts` | Extend existing |
| SNO-01 | calcSNO returns 14/32/170 when snoVirtMode=true | unit | `npx vitest run src/engine/calculators.test.ts` | Extend existing |
| WARN-02 | VIRT_RWX_REQUIRES_ODF emitted when virtEnabled + !odfEnabled | unit | `npx vitest run src/engine/validation.test.ts` | Extend existing |
| WARN-02 | No warning when odfEnabled=true | unit | `npx vitest run src/engine/validation.test.ts` | Extend existing |
| SC5 | tsc --noEmit passes | compile | `npx tsc --noEmit` | CI gate |

### Sampling Rate
- **Per task commit:** `npx vitest run src/engine/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npx tsc --noEmit` passes before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. Extend the three existing engine test files:

- [ ] `src/engine/addons.test.ts` — add `describe('calcVirt')` block (5-7 test cases)
- [ ] `src/engine/calculators.test.ts` — add `describe('calcSNO with snoVirtMode')` block (3 test cases)
- [ ] `src/engine/validation.test.ts` — add `describe('WARN-02 VIRT_RWX_REQUIRES_ODF')` block (3 test cases)
- [ ] `src/engine/recommendation.test.ts` — add `describe('VIRT-04 virt recommendation boost')` block (2 test cases)

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is pure engine code additions with no external service or CLI dependencies beyond the existing Node.js/npm environment already confirmed working (v1.0 shipped).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Floating-point arithmetic in overhead formula | Custom rounding logic | `decimal.js` via `allocatableRamGB()` from `formulas.ts` | Already used in all existing formula functions; consistency + precision |
| Type-safe NodeSpec null guards | Custom null checking | TypeScript `NodeSpec | null` pattern already in `ClusterSizing` | Pattern established; `sumTotals()` already handles null entries |
| Test fixture construction | Duplicated config literals | `createDefaultClusterConfig(0)` with field overrides | Used in all existing tests; keeps test setup DRY |
| Warning code → message resolution | Inline English strings | `messageKey` i18n key pattern | Enforced by existing engine zero-Vue-import test |

---

## Code Examples

### Example: calcODF() — template for calcVirt()

```typescript
// Source: src/engine/addons.ts (live codebase)
export function calcODF(extraOsdCount: number): NodeSpec {
  return {
    count: ODF_MIN_NODES,
    vcpu: ODF_MIN_CPU_PER_NODE + ODF_CPU_PER_OSD * extraOsdCount,
    ramGB: ODF_MIN_RAM_PER_NODE_GB + ODF_RAM_PER_OSD_GB * extraOsdCount,
    storageGB: 0,
  }
}
```

`calcVirt()` follows the same shape: pure function, named constant imports, returns `NodeSpec`.

### Example: Post-dispatch wiring in calcCluster()

```typescript
// Source: src/engine/calculators.ts (live codebase)
if (config.addOns.odfEnabled) {
  sizing.odfNodes = calcODF(config.addOns.odfExtraOsdCount)
}
if (config.addOns.rhacmEnabled) {
  sizing.rhacmWorkers = calcRHACM(config.addOns.rhacmManagedClusters)
}
```

Virt wiring follows the same pattern: `if (config.addOns.virtEnabled) { sizing.virtWorkerNodes = calcVirt(...) }`.

### Example: ValidationWarning in validateInputs()

```typescript
// Source: src/engine/validation.ts (live codebase)
if (config.addOns.odfEnabled && ['sno', 'microshift', 'managed-cloud'].includes(config.topology)) {
  warnings.push({ code: 'ODF_INCOMPATIBLE_TOPOLOGY', severity: 'error', messageKey: 'validation.odfIncompatibleTopology' })
}
```

WARN-02 follows the same shape: condition check, `warnings.push()`, typed severity, i18n messageKey.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| KubeVirt overhead as a single aggregate constant | Per-node CPU overhead (2 vCPU) + per-VM formula (218 MiB + 8 MiB × vCPUs + 0.2% guest RAM) | Jan 2025 (Red Hat memory management article) | Significantly more accurate for heterogeneous VM mixes |
| SNO-virt as a separate topology type | SNO-virt as a profile/mode flag on existing SNO topology | v2.0 design decision | Avoids wizard step proliferation; correct because SNO is a node count, not an architecture choice |

---

## Open Questions

1. **vmCount input source for Phase 9**
   - What we know: Phase 12 will add a wizard input for VM count. Phase 9 is engine-only.
   - What's unclear: In Phase 9, should `calcVirt()` accept an absolute VM count or derive it from `vmsPerWorker × workerNodes.count`?
   - Recommendation: Implement `calcVirt()` to accept `vmCount` as an explicit parameter. In the `calcCluster()` wiring, derive it as `config.addOns.vmsPerWorker × (sizing.workerNodes?.count ?? 3)` for Phase 9. When Phase 12 adds a direct wizard input, the wiring changes but `calcVirt()` signature stays stable.

2. **`virtStorageGB` formula precision**
   - What we know: VM PVC storage = vmCount × avgVmDiskGB. Phase 9 has no `avgVmDiskGB` field in `AddOnConfig`.
   - What's unclear: Should `virtStorageGB` be derived from RAM-as-proxy (common rough estimate) or require a new `virtAvgVmDiskGB` field?
   - Recommendation: Use `vmCount × avgVmRamGB` as a rough proxy for Phase 9 (common industry approximation: disk ≈ RAM). Add `virtAvgVmDiskGB` as a wizard input in Phase 12 when the user can provide it explicitly.

3. **WARN-02 on SNO-virt**
   - What we know: SNO + ODF is incompatible (existing `ODF_INCOMPATIBLE_TOPOLOGY` check). SNO-virt users cannot get live migration regardless of storage.
   - What's unclear: What warning should appear for SNO-virt users — WARN-02 (enable ODF) or a different message (live migration not available on SNO)?
   - Recommendation: Suppress WARN-02 for SNO topology. Emit `SNO_VIRT_NO_LIVE_MIGRATION` warning instead when `snoVirtMode=true`. This is the accurate message and avoids contradicting the existing ODF incompatibility check.

---

## Sources

### Primary (HIGH confidence)
- Live codebase — `src/engine/types.ts`, `addons.ts`, `calculators.ts`, `validation.ts`, `recommendation.ts`, `constants.ts`, `defaults.ts` — direct source analysis confirming all patterns
- Red Hat memory management in OpenShift Virtualization — `developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization` — per-VM overhead formula (218 MiB base + 8 MiB × vCPUs + 0.2% guest RAM)

### Secondary (MEDIUM confidence)
- Red Hat SNO + Virtualization second disk — `access.redhat.com/solutions/7014308` — 50 GiB additional disk for hostpath-provisioner
- Red Hat KubeVirt worker node overhead — community sources + official docs — 2 additional vCPU per virt-enabled worker node
- SNO-with-Virt boosted minimums (14 vCPU / 32 GB / 170 GB) — from planning docs `.planning/ROADMAP.md` success criteria, sourced from Red Hat SNO virt documentation

### Tertiary (LOW confidence — validate if deviating)
- Live migration +1 node reserve — KubeVirt community guidance — standard practice but not a fixed constant in official docs

---

## Metadata

**Confidence breakdown:**
- Type changes: HIGH — directly derived from live codebase interface inspection
- calcVirt() formula: MEDIUM-HIGH — overhead formula from official Red Hat article; +1 migration reserve from community guidance
- SNO-virt constants: MEDIUM — 14/32/170 from roadmap success criteria attributed to Red Hat docs; STACK.md notes base SNO is 8/16/120 with +50 GB second disk
- Post-dispatch wiring: HIGH — exact pattern confirmed from calcODF()/calcRHACM() in live code
- WARN-02: HIGH — pattern from existing ODF_INCOMPATIBLE_TOPOLOGY check; severity choice (warning vs error) is a design decision
- Recommendation engine: HIGH — full source of recommend() reviewed; scoreStandardHa() modification is straightforward

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable domain; KubeVirt overhead constants unlikely to change)
