# Phase 11: RHOAI Add-On Engine — Research

**Researched:** 2026-04-01
**Domain:** Red Hat OpenShift AI (RHOAI) operator sizing — worker floor enforcement + infra node overhead
**Confidence:** HIGH (worker floor constant confirmed in official RHOAI docs across 2.x, 3.0, 3.3); MEDIUM (infra overhead addend — no single authoritative table, derived from component analysis)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RHOAI-02 | When RHOAI is enabled, each worker node is enforced to meet minimum 8 vCPU / 32 GB RAM | Confirmed: official RHOAI 3.0 and 3.3 installation docs state "A minimum of 2 worker nodes with at least 8 CPUs and 32 GiB RAM each is required" — this is a per-node floor, not an aggregate |
| RHOAI-03 | RHOAI operator overhead is reserved on infra nodes when RHOAI is enabled | MEDIUM confidence: RHOAI operator pods (dashboard, KServe controller, DS Pipelines controller, Model Registry controller) run as platform-level workloads; when infra nodes are present they are the natural landing zone; aggregate overhead estimated at 4 vCPU / 16 GB across operator control pods |

</phase_requirements>

---

## Summary

Phase 11 adds `calcRHOAI()` to `addons.ts` following the identical post-dispatch add-on pattern used by `calcVirt()` and `calcGpuNodes()`. The function's primary job is to enforce a per-worker floor (8 vCPU / 32 GiB): for each field on the existing `workerNodes` NodeSpec, take `Math.max(current, floor)`. It does not create a new node pool — it mutates the existing worker node spec in-place, exactly as the FEATURES.md annotation describes: "enhances existing workerNodes NodeSpec minimum enforcement."

The secondary job is to add a reserved overhead addend to `infraNodes.vcpu` and `infraNodes.ramGB` when `infraNodesEnabled=true` and `rhoaiEnabled=true`. This models the RHOAI operator pods (dashboard, KServe controller, Data Science Pipelines controller, Model Registry) that in production deployments are pinned to infra nodes via nodeSelector. The overhead addend is MEDIUM confidence — it is a reasonable engineering estimate because official RHOAI docs do not publish a single aggregate resource-request table for all operator components at once.

The `ClusterSizing` struct requires NO new fields for Phase 11. RHOAI modifies the existing `workerNodes` and `infraNodes` NodeSpecs. The only new additions are: one `AddOnConfig` field (`rhoaiEnabled: boolean`), two constants (`RHOAI_WORKER_MIN_VCPU`, `RHOAI_WORKER_MIN_RAM_GB`), two optional addend constants (`RHOAI_INFRA_OVERHEAD_VCPU`, `RHOAI_INFRA_OVERHEAD_RAM_GB`), one default, one Zod field, one `calcRHOAI()` function, and wiring in `calcCluster()`.

**Primary recommendation:** Implement `calcRHOAI(workerNodes, infraNodes, config)` as a pure mutation helper that lifts worker vcpu/ramGB to the per-worker floor and adds the infra overhead addend. Mark the infra overhead constants with a source comment noting they are estimated and should be re-validated when a new RHOAI major version ships.

---

## Standard Stack

### Core (unchanged — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.x | Type safety for new constants and function | Already installed; zero-Vue constraint requires pure TS engine |
| Vitest | ^4.1.2 | Unit tests for calcRHOAI() | Existing test framework; 221 tests already passing |
| Zod | ^4.3.6 | AddOnConfigSchema extension (rhoaiEnabled field) | Existing URL-state schema; `.default(false)` preserves URL backward compatibility |

### No New npm Packages Required

All Phase 11 work is pure TypeScript additions. The existing stack handles everything:
- New constants in `constants.ts`
- New function in `addons.ts`
- New field in `types.ts` (AddOnConfig)
- New field in `defaults.ts`
- New field in `useUrlState.ts` (AddOnConfigSchema)
- Wiring in `calculators.ts` (calcCluster post-dispatch block)
- Tests in `addons.test.ts`

---

## Architecture Patterns

### Pattern: Post-Dispatch Add-On Augmentation (already established)

The `calcCluster()` dispatcher in `calculators.ts` uses a post-dispatch add-on block. Phase 11 adds one new block to this sequence. The existing pattern is:

```typescript
// From src/engine/calculators.ts — existing post-dispatch block (Phase 10)
if (config.addOns.gpuEnabled) {
  sizing.gpuNodes = calcGpuNodes(
    config.addOns.gpuNodeCount,
    config.workload.nodeVcpu,
    config.workload.nodeRamGB,
    GPU_NODE_MIN_STORAGE_GB,
  )
}
```

Phase 11 adds an analogous block **after** the GPU block:

```typescript
// Phase 11 addition — RHOAI worker floor + infra overhead
if (config.addOns.rhoaiEnabled) {
  calcRHOAI(sizing, config.addOns.infraNodesEnabled)
}
```

### Pattern: In-Place NodeSpec Mutation (RHOAI differs from GPU/ODF/RHACM)

ODF, RHACM, Virt, and GPU all **create new NodeSpec objects** and assign them to null fields on ClusterSizing. RHOAI is different: it **mutates existing NodeSpecs** (workerNodes and infraNodes). This is intentional and documented in FEATURES.md: "RHOAI overhead enhances workerNodes minimum — RHOAI does not add a new node type; it raises the floor for existing worker nodes."

The mutation pattern uses `Math.max()` on each resource dimension:

```typescript
// Source: FEATURES.md + REQUIREMENTS.md RHOAI-02
// Worker floor enforcement — applies when rhoaiEnabled=true
if (sizing.workerNodes) {
  sizing.workerNodes = {
    ...sizing.workerNodes,
    vcpu:  Math.max(sizing.workerNodes.vcpu,  RHOAI_WORKER_MIN_VCPU),
    ramGB: Math.max(sizing.workerNodes.ramGB, RHOAI_WORKER_MIN_RAM_GB),
  }
}
```

Note: `sizing.workerNodes` is `NodeSpec | null` (compact-3node, SNO, MicroShift return null). When null, no floor can be applied. `calcRHOAI()` must null-guard.

### Pattern: Infra Overhead Addend (when infraNodesEnabled=true)

When infra nodes are present, RHOAI operator pods land on them. The addend adds to existing infra node specs rather than replacing them:

```typescript
// Source: engineering estimate — see Confidence section
if (infraNodesEnabled && sizing.infraNodes) {
  sizing.infraNodes = {
    ...sizing.infraNodes,
    vcpu:  sizing.infraNodes.vcpu  + RHOAI_INFRA_OVERHEAD_VCPU,
    ramGB: sizing.infraNodes.ramGB + RHOAI_INFRA_OVERHEAD_RAM_GB,
  }
}
```

If `infraNodesEnabled=false`, the RHOAI operator pods run on worker nodes. In that case the worker floor enforcement already ensures adequate capacity — no separate addend is needed.

### Recommended calcRHOAI() Signature

```typescript
// src/engine/addons.ts — follows same no-return mutation pattern
export function calcRHOAI(sizing: ClusterSizing, infraNodesEnabled: boolean): void
```

Alternatively it can return a modified sizing copy (pure function style matching how calcGpuNodes returns NodeSpec). Given that the GPU/Virt add-ons are pure functions returning NodeSpec (not void), a consistent API would be:

```typescript
// Option A: void mutation (simplest, matches the "post-dispatch writes into sizing" pattern)
export function calcRHOAI(sizing: ClusterSizing, infraNodesEnabled: boolean): void

// Option B: two pure helper functions (mirrors calcGpuNodes/calcVirt pattern more closely)
export function applyRhoaiWorkerFloor(workerNodes: NodeSpec): NodeSpec
export function applyRhoaiInfraOverhead(infraNodes: NodeSpec): NodeSpec
```

**Recommendation:** Option A (void mutation) is simpler and consistent with how `calcCluster()` already mutates `sizing.odfNodes`, `sizing.rhacmWorkers`, etc. via direct assignment. The worker floor and infra overhead are two writes into the sizing struct, not a new NodeSpec factory.

### Recommended Project Structure for Phase 11

No new files needed. All changes land in existing engine files:

```
src/engine/
├── types.ts         — AddOnConfig: add rhoaiEnabled: boolean (Phase 11 comment)
├── constants.ts     — Add RHOAI_WORKER_MIN_VCPU, RHOAI_WORKER_MIN_RAM_GB,
│                      RHOAI_INFRA_OVERHEAD_VCPU, RHOAI_INFRA_OVERHEAD_RAM_GB
├── addons.ts        — Add calcRHOAI() function
├── calculators.ts   — Add Phase 11 post-dispatch block + totals recalc guard
├── defaults.ts      — Add rhoaiEnabled: false to createDefaultClusterConfig
└── addons.test.ts   — Add describe('calcRHOAI') block with 4 test cases
src/composables/
└── useUrlState.ts   — AddOnConfigSchema: add rhoaiEnabled: z.boolean().default(false)
```

### Anti-Patterns to Avoid

- **Adding a new ClusterSizing field for RHOAI.** There is no `rhoaiOverhead: NodeSpec | null` field needed. RHOAI modifies existing specs in-place. Adding a new field would require updating BomTable, all three exports, and sumTotals — that is Phase 12 work for the RHOAI BoM row (RHOAI-04), not Phase 11 engine work.
- **Creating separate worker nodes for RHOAI.** RHOAI raises the floor of the existing pool — it does not add a second worker pool.
- **Inline literal constants.** The success criteria explicitly require named typed constants. Do not write `Math.max(sizing.workerNodes.vcpu, 8)` — use `RHOAI_WORKER_MIN_VCPU`.
- **Missing null guard on workerNodes.** SNO, compact-3node, and MicroShift return `workerNodes: null`. `calcRHOAI()` must handle this gracefully (no-op when null).
- **Skipping the totals recalc.** The `calcCluster()` post-dispatch totals recalc guard must include `rhoaiEnabled` in its condition, or the totals will remain stale after the worker/infra specs are mutated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker floor enforcement | Custom loop comparing each field | `Math.max(current, floor)` per field | One line per dimension; no iteration logic needed |
| Backward-compatible URL state | Custom migration function | Zod `.default(false)` on new field | Zod `.strip()` + `.default()` is the established pattern; v1.0 URLs missing `rhoaiEnabled` will parse as `false` automatically |
| Constants validation | Runtime assertion | Vitest test asserting `RHOAI_WORKER_MIN_VCPU === 8` | Tests enforce the constant values match the expected RHOAI 3.x minimum |

---

## RHOAI Minimum Requirements — Verified Constants

### Worker Floor (RHOAI-02) — HIGH Confidence

| Constant | Value | Source | Confidence |
|----------|-------|--------|------------|
| `RHOAI_WORKER_MIN_VCPU` | 8 | RHOAI 3.0 install docs: "A minimum of 2 worker nodes with at least 8 CPUs" | HIGH |
| `RHOAI_WORKER_MIN_RAM_GB` | 32 | RHOAI 3.0 install docs: "32 GiB RAM each is required" | HIGH |

These constants are confirmed across:
- RHOAI Self-Managed 2.25 install docs
- RHOAI Self-Managed 3.0 install docs
- RHOAI Self-Managed 3.3 install docs (disconnected)
- RHOAI Cloud Service 1.x install docs
- redhat.com product trial page

The requirement is stated as a per-node floor ("each"), not an aggregate. This validates the RHOAI-02 requirement text directly.

**Minimum worker count:** The docs state "a minimum of 2 worker nodes" — so the floor enforcement must be applied to at least 2 workers. Since most topologies already produce count ≥ 2, the current `workerNodes.count` is not changed by RHOAI — only `vcpu` and `ramGB` are bumped up to the floor.

### Cluster Total for Verification Test (RHOAI-03 success criterion)

The STATE.md note says: "validate 16 vCPU / 64 GB cluster minimum against RHOAI 3.x supported configs." This aggregate (16 vCPU / 64 GB) comes from 2 workers × 8 vCPU / 32 GB. This is the correct cluster minimum derivation: 2 × 8 = 16 total vCPU, 2 × 32 = 64 total GB. The "16 vCPU / 64 GB cluster minimum" is NOT a separate constant — it is the result of applying the per-worker floor to 2 workers. The Vitest test for success criterion 3 should assert the output of a 2-worker cluster with rhoaiEnabled=true has `workerNodes.vcpu = 8` and `workerNodes.ramGB = 32` (i.e., the floor holds for the at-minimum case).

### Infra Overhead (RHOAI-03) — MEDIUM Confidence

| Constant | Value | Source | Confidence |
|----------|-------|--------|------------|
| `RHOAI_INFRA_OVERHEAD_VCPU` | 4 | Community estimate: aggregate CPU requests for dashboard (1), KServe controller (1), DSP controller (1), Model Registry controller (0.5), misc (0.5) ≈ 4 vCPU total request | MEDIUM |
| `RHOAI_INFRA_OVERHEAD_RAM_GB` | 16 | Community estimate: aggregate memory requests for the same operator pods ≈ 8–16 GB total; 16 GB is the conservative (safe) value | MEDIUM |

**Why MEDIUM:** Red Hat does not publish a single authoritative "RHOAI operator aggregate resource request" table for all components at once. The 4 vCPU / 16 GB estimate is from community sources (ai-on-openshift.io), not the official RHOAI sizing guide. The estimate is reasonable for a pre-sales sizing context but should be annotated in the source comment.

**Source comment to add in constants.ts:**
```typescript
// RHOAI operator component overhead on infra nodes (RHOAI-03)
// Source: community estimate (ai-on-openshift.io) — no official aggregate table published by Red Hat.
// Covers: dashboard, KServe controller, DS Pipelines controller, Model Registry controller pods.
// Re-validate against current RHOAI release notes when upgrading beyond RHOAI 3.x.
export const RHOAI_INFRA_OVERHEAD_VCPU = 4
export const RHOAI_INFRA_OVERHEAD_RAM_GB = 16
```

---

## Impact on Existing ClusterSizing and AddOnConfig

### ClusterSizing — NO new fields needed

Phase 11 does not add any new fields to `ClusterSizing`. The RHOAI BoM row (RHOAI-04) with KServe, DSP, and Model Registry breakdown is Phase 12 UI work, not Phase 11 engine work. Phase 11 only modifies existing `workerNodes` and `infraNodes` NodeSpecs in-place.

### AddOnConfig — ONE new field

```typescript
// Phase 11 addition in src/engine/types.ts AddOnConfig
rhoaiEnabled: boolean  // Red Hat OpenShift AI operator add-on enabled (default false)
```

This is the minimal change. Phase 12 may add additional RHOAI configuration fields (e.g., which components to enable) but Phase 11 only needs the boolean gate.

### useUrlState.ts — ONE new Zod field

```typescript
// Phase 11 addition in AddOnConfigSchema
rhoaiEnabled: z.boolean().default(false),
```

The `.default(false)` ensures existing v1.0 shared URLs (which do not have `rhoaiEnabled` in their compressed state) parse successfully with `rhoaiEnabled=false`. This is identical to how all prior phase fields were added.

### defaults.ts — ONE new default value

```typescript
// Phase 11 addition in createDefaultClusterConfig addOns block
rhoaiEnabled: false,
```

---

## RHOAI and GPU Interaction

The question "does RHOAI require GPU nodes for inference workloads?" is out of scope for Phase 11 engine sizing. The answer is: RHOAI supports CPU-only inference (KServe on CPU), but GPU nodes are strongly recommended for model serving. However:

- RHOAI-02 and RHOAI-03 are about the RHOAI operator infrastructure overhead, not about inference workload sizing
- The worker floor (8 vCPU / 32 GB) applies to ALL worker nodes regardless of GPU presence
- GPU node pool (`gpuNodes`) is a separate NodeSpec — the RHOAI worker floor applies to `workerNodes` only, not `gpuNodes`
- There is no Phase 11 interaction between `gpuEnabled` and `rhoaiEnabled` in the engine

The Phase 12 wizard UI may surface a recommendation to enable GPU nodes when RHOAI is enabled, but that is not an engine concern.

---

## Common Pitfalls

### Pitfall 1: Null workerNodes silently skipped without comment
**What goes wrong:** SNO and compact-3node topologies return `workerNodes: null`. If `calcRHOAI()` null-guards without a comment, the planner implementing Phase 12 may not know why RHOAI floor has no effect on SNO.
**How to avoid:** Add an explicit guard: `if (!sizing.workerNodes) return` with a comment noting that SNO/compact-3node have no separate worker pool.
**Note on SNO:** SNO with RHOAI requires 32 vCPU / 128 GB (from FEATURES.md `RHOAI_SNO_MIN_VCPU = 32`, `RHOAI_SNO_MIN_RAM_GB = 128`). These are out of scope for Phase 11 engine work (they appear in FEATURES.md research but are not mapped to RHOAI-02 or RHOAI-03). The FEATURES.md constants are listed there as a planning artifact from v2.0 research; Phase 11 should define only the per-worker floor constants, NOT the SNO minimum. SNO-RHOAI interaction, if needed, would be a separate requirement.

### Pitfall 2: Totals not recalculated after worker/infra mutation
**What goes wrong:** `calcCluster()` has a totals recalc guard that checks `if (config.addOns.odfEnabled || config.addOns.rhacmEnabled || config.addOns.virtEnabled || config.addOns.gpuEnabled)`. If `rhoaiEnabled` is not added to this condition, the totals field will reflect pre-RHOAI worker specs even when the worker vcpu/ramGB were bumped up.
**How to avoid:** Add `|| config.addOns.rhoaiEnabled` to the totals recalc condition in `calcCluster()`.

### Pitfall 3: Applying worker floor before worker pool is sized
**What goes wrong:** If `calcRHOAI()` runs before topology calculators (e.g., before `calcStandardHA()`), there are no workerNodes to modify.
**How to avoid:** The post-dispatch pattern prevents this — `calcRHOAI()` runs after the topology dispatch switch. This is already correct per the established pattern.

### Pitfall 4: Test only covers the "below-minimum" case, not the "at-minimum" case
**What goes wrong:** Success criterion 4 explicitly requires testing "below-minimum and at-minimum input cases." Only testing below-minimum is insufficient — an at-minimum input must produce an unchanged (not bumped further) result.
**How to avoid:** Write two test cases: one where input vcpu < 8 (expect 8), one where input vcpu == 8 (expect 8, not changed), and one where input vcpu > 8 (expect unchanged).

### Pitfall 5: rhoaiEnabled Zod field added but defaults.ts not updated
**What goes wrong:** TypeScript will report a missing field error if `AddOnConfig.rhoaiEnabled` is added to `types.ts` but `defaults.ts` is not updated — the default config object will fail the type check.
**How to avoid:** Both files must be updated in the same task/commit.

---

## Code Examples

### calcRHOAI() Implementation Pattern

```typescript
// Source: post-dispatch add-on pattern from src/engine/addons.ts (calcGpuNodes)
// and FEATURES.md pattern: "bump workerNodes minimum to max(current, 8 vCPU / 32 GB RAM)"

import {
  RHOAI_WORKER_MIN_VCPU,
  RHOAI_WORKER_MIN_RAM_GB,
  RHOAI_INFRA_OVERHEAD_VCPU,
  RHOAI_INFRA_OVERHEAD_RAM_GB,
} from './constants'

/**
 * Apply RHOAI operator constraints to an already-computed ClusterSizing.
 *
 * RHOAI-02: Enforces per-worker minimum (8 vCPU / 32 GB RAM).
 *   Uses Math.max to lift nodes below the floor — never lowers them.
 *   No-op when workerNodes is null (SNO, compact-3node, MicroShift).
 *
 * RHOAI-03: Adds operator overhead to infra nodes when present.
 *   No-op when infraNodes is null (infraNodesEnabled=false).
 *
 * @param sizing            - ClusterSizing produced by topology calculator
 * @param infraNodesEnabled - whether dedicated infra nodes are in the cluster
 */
export function calcRHOAI(sizing: ClusterSizing, infraNodesEnabled: boolean): void {
  // RHOAI-02: enforce per-worker floor
  if (sizing.workerNodes) {
    sizing.workerNodes = {
      ...sizing.workerNodes,
      vcpu:  Math.max(sizing.workerNodes.vcpu,  RHOAI_WORKER_MIN_VCPU),
      ramGB: Math.max(sizing.workerNodes.ramGB, RHOAI_WORKER_MIN_RAM_GB),
    }
  }

  // RHOAI-03: add operator overhead to infra nodes
  if (infraNodesEnabled && sizing.infraNodes) {
    sizing.infraNodes = {
      ...sizing.infraNodes,
      vcpu:  sizing.infraNodes.vcpu  + RHOAI_INFRA_OVERHEAD_VCPU,
      ramGB: sizing.infraNodes.ramGB + RHOAI_INFRA_OVERHEAD_RAM_GB,
    }
  }
}
```

### calcCluster() Post-Dispatch Wiring

```typescript
// In src/engine/calculators.ts — addition to existing post-dispatch block

// Phase 11: RHOAI worker floor + infra overhead
if (config.addOns.rhoaiEnabled) {
  calcRHOAI(sizing, config.addOns.infraNodesEnabled)
}

// Totals recalc — add rhoaiEnabled to the existing condition
if (
  config.addOns.odfEnabled  ||
  config.addOns.rhacmEnabled ||
  config.addOns.virtEnabled  ||
  config.addOns.gpuEnabled   ||
  config.addOns.rhoaiEnabled           // Phase 11
) {
  sizing.totals = sumTotals([...])
}
```

### Vitest Test Cases (addons.test.ts additions)

```typescript
// Source: success criterion 4 — "below-minimum and at-minimum input cases"
describe('calcRHOAI — worker floor enforcement (RHOAI-02)', () => {
  it('lifts worker vcpu below 8 up to RHOAI_WORKER_MIN_VCPU', () => {
    const sizing = /* stub with workerNodes: { vcpu: 4, ramGB: 8, ... } */
    calcRHOAI(sizing, false)
    expect(sizing.workerNodes?.vcpu).toBe(8)
    expect(sizing.workerNodes?.ramGB).toBe(32)
  })

  it('does not change worker vcpu already at 8 (at-minimum case)', () => {
    const sizing = /* stub with workerNodes: { vcpu: 8, ramGB: 32, ... } */
    calcRHOAI(sizing, false)
    expect(sizing.workerNodes?.vcpu).toBe(8)
  })

  it('does not reduce worker vcpu above minimum', () => {
    const sizing = /* stub with workerNodes: { vcpu: 32, ramGB: 64, ... } */
    calcRHOAI(sizing, false)
    expect(sizing.workerNodes?.vcpu).toBe(32)   // unchanged
  })

  it('no-op when workerNodes is null (SNO / compact-3node)', () => {
    const sizing = /* stub with workerNodes: null */
    expect(() => calcRHOAI(sizing, false)).not.toThrow()
    expect(sizing.workerNodes).toBeNull()
  })
})

describe('calcRHOAI — infra node overhead (RHOAI-03)', () => {
  it('adds RHOAI_INFRA_OVERHEAD_VCPU/RAM when infraNodesEnabled=true', () => {
    const sizing = /* stub with infraNodes: { vcpu: 4, ramGB: 24, ... } */
    calcRHOAI(sizing, true)
    expect(sizing.infraNodes?.vcpu).toBe(4 + RHOAI_INFRA_OVERHEAD_VCPU)
  })

  it('no-op on infraNodes when infraNodesEnabled=false', () => {
    const sizing = /* stub with infraNodes: { vcpu: 4, ramGB: 24, ... } */
    calcRHOAI(sizing, false)
    expect(sizing.infraNodes?.vcpu).toBe(4)   // unchanged
  })
})

describe('RHOAI constants — 3.x cluster minimum (success criterion 3)', () => {
  it('RHOAI_WORKER_MIN_VCPU is 8 (matches RHOAI 3.x documented minimum)', () => {
    expect(RHOAI_WORKER_MIN_VCPU).toBe(8)
  })

  it('RHOAI_WORKER_MIN_RAM_GB is 32 (matches RHOAI 3.x documented minimum)', () => {
    expect(RHOAI_WORKER_MIN_RAM_GB).toBe(32)
  })

  it('2 workers at minimum totals 16 vCPU and 64 GB RAM (RHOAI 3.x cluster minimum)', () => {
    expect(2 * RHOAI_WORKER_MIN_VCPU).toBe(16)
    expect(2 * RHOAI_WORKER_MIN_RAM_GB).toBe(64)
  })
})
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | vite.config.ts (vitest inline config) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |
| Current test count | 221 passing |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RHOAI-02 | Worker vcpu lifted from below-floor to floor | unit | `npm test` | ❌ Wave 0 — add to `addons.test.ts` |
| RHOAI-02 | Worker at floor is not changed | unit | `npm test` | ❌ Wave 0 — add to `addons.test.ts` |
| RHOAI-02 | Worker above floor is not changed | unit | `npm test` | ❌ Wave 0 — add to `addons.test.ts` |
| RHOAI-02 | null workerNodes is a no-op | unit | `npm test` | ❌ Wave 0 — add to `addons.test.ts` |
| RHOAI-03 | Infra overhead added when infraEnabled=true | unit | `npm test` | ❌ Wave 0 — add to `addons.test.ts` |
| RHOAI-03 | Infra overhead skipped when infraEnabled=false | unit | `npm test` | ❌ Wave 0 — add to `addons.test.ts` |
| SC-3 | Constants match RHOAI 3.x minimum values | unit | `npm test` | ❌ Wave 0 — add to `addons.test.ts` |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** All 221 + new tests green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/engine/addons.test.ts` — add `describe('calcRHOAI')` block (file exists; extend it)
- [ ] No new test files needed — all new tests go in the existing `addons.test.ts`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RHOAI 2.x: "at least 2 workers × 8 CPU / 32 GiB" | RHOAI 3.0/3.3: same wording, confirmed unchanged | RHOAI 3.0 release (2024) | Constants are stable — HIGH confidence they are correct for v2.0 implementation target |
| RHODS (OpenShift Data Science) | Renamed to RHOAI (Red Hat OpenShift AI) | 2023 | Operator namespace changed from `redhat-ods-*` to `rhoai-*`; sizing requirements unchanged |

**Stable constants:** The per-worker minimum (8 CPU / 32 GiB) has remained unchanged across RHOAI 2.x through 3.3. This is a hardware prerequisite, not a soft recommendation — it is safe to encode as a named constant without a version expiry concern for the v2.0 milestone.

---

## Open Questions

1. **SNO + RHOAI: should Phase 11 handle it?**
   - What we know: FEATURES.md defines `RHOAI_SNO_MIN_VCPU = 32` and `RHOAI_SNO_MIN_RAM_GB = 128` as research constants. Neither RHOAI-02 nor RHOAI-03 explicitly calls out SNO.
   - What's unclear: Is there a use case for RHOAI on SNO? RHOAI on SNO requires a different minimum (32 vCPU / 128 GB), which does not overlap with the per-worker floor (8 vCPU / 32 GB per node).
   - **Recommendation:** Phase 11 should NOT add SNO-RHOAI logic. The `calcRHOAI()` null guard on `workerNodes` is the correct behavior for SNO (no-op). If SNO-RHOAI is needed later, it becomes a new requirement. This keeps Phase 11 scope minimal and the success criteria achievable.

2. **Should the infra overhead addend apply when RHOAI is enabled but infraNodesEnabled=false?**
   - What we know: When no infra nodes exist, RHOAI operator pods land on worker nodes. The worker floor (8 vCPU / 32 GB) is already applied.
   - What's unclear: Is 8 vCPU / 32 GB sufficient to absorb both user workloads and RHOAI operator pods on the same workers?
   - **Recommendation:** Phase 11 does not add a second worker overhead addend for this case. The 8 vCPU / 32 GB floor is the documented minimum — applying the infra addend to workers when infra is absent would be an unverified addition. If customers report under-sizing in this mode, a separate requirement captures it.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 11 is purely engine code changes with no external tool, service, or database dependencies. All work is TypeScript source files and Vitest tests running in the existing Node.js environment (Node 25.8.2, confirmed operational with 221 passing tests).

---

## Sources

### Primary (HIGH confidence)

- RHOAI Self-Managed 3.0 install docs — `docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.0/html/installing_and_uninstalling_openshift_ai_self-managed/installing-and-deploying-openshift-ai_install` — "A minimum of 2 worker nodes with at least 8 CPUs and 32 GiB RAM each is required to install the Operator." (confirmed via search result snippet)
- RHOAI Self-Managed 3.3 disconnected install docs — `docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.3/html/installing_and_uninstalling_openshift_ai_self-managed_in_a_disconnected_environment/...` — same wording confirmed in 3.3
- RHOAI Self-Managed 2.25 install docs — `docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/2.25/html/installing_and_uninstalling_openshift_ai_self-managed/installing-and-deploying-openshift-ai_install` — same wording confirmed across 2.x
- RHOAI Cloud Service 1.x install docs — `docs.redhat.com/en/documentation/red_hat_openshift_ai_cloud_service/1/html/installing_the_openshift_ai_cloud_service/requirements-for-openshift-ai_install` — "At least 2 worker nodes with at least 8 CPUs and 32 GiB RAM available for OpenShift AI to use"
- Live codebase analysis — `src/engine/addons.ts`, `src/engine/calculators.ts`, `src/engine/types.ts`, `src/engine/constants.ts`, `src/engine/defaults.ts`, `src/composables/useUrlState.ts` — all Phase 10 patterns confirmed by direct read

### Secondary (MEDIUM confidence)

- ai-on-openshift.io RHOAI component architecture — infra node overhead estimate for RHOAI operator pods (dashboard, KServe controller, DS Pipelines controller, Model Registry); 4 vCPU / 16 GB aggregate estimate
- FEATURES.md `.planning/research/FEATURES.md` — RHOAI constants table including per-worker floor and SNO minimum; cross-validated against docs

### Tertiary (LOW confidence — not used for implemented constants)

- Community estimates for RHOAI aggregate operator resource requests (specific CPU/RAM per pod per namespace) — no single authoritative Red Hat table found; infra overhead constants flagged as MEDIUM accordingly

---

## Metadata

**Confidence breakdown:**
- Worker floor constants (RHOAI_WORKER_MIN_VCPU, RHOAI_WORKER_MIN_RAM_GB): HIGH — confirmed in 4+ official RHOAI doc pages across 2.x, 3.0, 3.3
- Infra overhead constants (RHOAI_INFRA_OVERHEAD_VCPU, RHOAI_INFRA_OVERHEAD_RAM_GB): MEDIUM — community estimate, no official aggregate table
- Architecture pattern (post-dispatch mutation): HIGH — directly derived from existing codebase
- Test structure: HIGH — follows established addons.test.ts pattern, confirmed by reading existing test file

**Research date:** 2026-04-01
**Valid until:** 2026-10-01 (stable docs; re-validate infra overhead if RHOAI 4.x ships)
