# Phase 8: Engine Tech Debt - Research

**Researched:** 2026-03-31
**Domain:** TypeScript sizing engine — formulas, constants, topology calculators
**Confidence:** HIGH

## Summary

Phase 8 closes three deferred tech-debt items identified in the v1.0 audit. All three items are
surgical edits inside `src/engine/calculators.ts`, supported by `src/engine/formulas.ts` and
`src/engine/constants.ts`. No new files or dependencies are needed.

The HCP calculator (`calcHCP`) uses an inline `WORKER_ALLOC_RAM = 28.44` local constant instead
of calling `allocatableRamGB(32)`. This is exactly what `allocatableRamGB()` was built to
compute — `allocatableRamGB(32) = 28.44` per the tiered reservation formula. The fix is a
one-line replacement.

For minimum hardware enforcement, the audit found that only `calcStandardHA` and `calcMicroShift`
fully apply `Math.max()` against their respective minimum constants. The four fixed-spec
topologies (`calcCompact3Node`, `calcSNO`, `calcTNA`, `calcTNF`) return direct copies of
constant `NodeSpec` objects — they have no workload-derived dimensions to clamp, so no
`Math.max()` is structurally required. `calcHCP` already applies `Math.max()` on the worker
count but not on per-node vcpu/ramGB (which are constants, not workload-derived). `calcManagedCloud`
returns zero-specs by design.

For infra-nodes, only `calcStandardHA` currently honours `addOns.infraNodesEnabled`. Among the
remaining topologies, `calcHCP` is the most applicable candidate — HCP management clusters
run regular workers and can offload infrastructure workloads to dedicated infra nodes. Compact
3-node and TNF are technically capable per Red Hat docs but rarely used with infra nodes.
`calcTNA`, `calcSNO`, `calcMicroShift`, and `calcManagedCloud` should not have infra nodes.

**Primary recommendation:** Three targeted edits to `calculators.ts` — replace inline constant
in `calcHCP`, add `Math.max()` guards to every workload-derived topology function, and extend
the `infraNodesEnabled` branch to `calcHCP` (and optionally `calcCompact3Node`, `calcTNF`).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-04 | Allocatable RAM formula with tiered kernel reservation (25%/20%/10%/6% model) | `allocatableRamGB()` already implemented in `formulas.ts`; ENG-04 gap is that `calcHCP` bypasses it with inline 28.44 |
| ENG-06 | Minimum hardware constants per topology enforced in all topology functions | `Math.max()` pattern exists in `calcStandardHA` and `calcMicroShift`; missing in `calcHCP` worker node specs and implicitly in fixed-spec topologies |
| RES-04 | Infra nodes displayed as separate line item when infraNodesEnabled | `calcStandardHA` sets `infraNodes`; `calcHCP` always nulls it regardless of `infraNodesEnabled` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Engine type safety | Already in project; zero-Vue-import constraint |
| Vitest | latest | Unit testing | Already configured; `npm run test` command confirmed |
| decimal.js | latest | Floating-point safe arithmetic | Already used in `formulas.ts` for all intermediate math |

No new dependencies required. All changes are pure TypeScript edits.

## Architecture Patterns

### Recommended Project Structure
No structural changes. All edits target existing files:
```
src/engine/
├── calculators.ts   — 3 edits: calcHCP (2 changes), infraNodes extension
├── formulas.ts      — READ ONLY (source of allocatableRamGB)
└── constants.ts     — READ ONLY (source of WORKER_MIN etc.)
```

### Pattern 1: Replacing an inline constant with allocatableRamGB()
**What:** `calcHCP` computes `workersByRAM` using a hardcoded `WORKER_ALLOC_RAM = 28.44`.
`allocatableRamGB(32)` produces exactly this value.

**When to use:** Anytime a per-node allocatable RAM figure is needed for worker sizing.

**Current code (lines 273-281 in calculators.ts):**
```typescript
const WORKER_VCPU = 16
const WORKER_RAM_GB = 32
// Allocatable RAM from a 32GB node ≈ 28.44 GB (after system reservation)
const WORKER_ALLOC_RAM = 28.44
const UTIL = 0.70

const workersByCPU = Math.ceil(totalCPU / (WORKER_VCPU * UTIL))
const workersByRAM = Math.ceil(totalRAM / (WORKER_ALLOC_RAM * UTIL))
```

**Fixed code:**
```typescript
import { cpSizing, workerCount as calcWorkerCount, infraNodeSizing, allocatableRamGB } from './formulas'
// ...
const WORKER_VCPU = 16
const WORKER_RAM_GB = 32
const UTIL = 0.70

const workersByCPU = Math.ceil(totalCPU / (WORKER_VCPU * UTIL))
const workersByRAM = Math.ceil(totalRAM / (allocatableRamGB(WORKER_RAM_GB) * UTIL))
```

Note: `allocatableRamGB` is already exported from `formulas.ts` but NOT yet imported in
`calculators.ts`. The import line at the top of `calculators.ts` must be updated.

### Pattern 2: Math.max() minimum enforcement
**What:** Worker node vcpu/ramGB should be clamped to `WORKER_MIN` values.
`calcHCP` sets worker node dimensions as bare constants `WORKER_VCPU=16` and `WORKER_RAM_GB=32`.
These happen to exceed `WORKER_MIN.vcpu=2` and `WORKER_MIN.ramGB=8`, so the clamp has no
functional effect today, but it makes the enforcement explicit and future-proof.

**Existing pattern (from calcStandardHA):**
```typescript
const workerNodes: NodeSpec = {
  count: Math.max(wCount, WORKER_MIN.count),
  vcpu: Math.max(workload.nodeVcpu, WORKER_MIN.vcpu),
  ramGB: Math.max(workload.nodeRamGB, WORKER_MIN.ramGB),
  storageGB: WORKER_MIN.storageGB,
}
```

**Applied to calcHCP worker nodes:**
```typescript
const workerNodes: NodeSpec = {
  count: workers,                                    // already Math.max(..., 3)
  vcpu: Math.max(WORKER_VCPU, WORKER_MIN.vcpu),
  ramGB: Math.max(WORKER_RAM_GB, WORKER_MIN.ramGB),
  storageGB: WORKER_MIN.storageGB,                   // was hardcoded 100
}
```

### Pattern 3: infraNodes for HCP management cluster
**What:** After sizing workers, if `addOns.infraNodesEnabled` is true, add an infra node spec
via `infraNodeSizing(workerNodes.count)`. Follows identical pattern to `calcStandardHA`.

**Existing pattern (from calcStandardHA, lines 95-104):**
```typescript
let infraNodes: NodeSpec | null = null
if (addOns.infraNodesEnabled) {
  const infraSpec = infraNodeSizing(workerNodes.count)
  infraNodes = {
    count: 3,
    vcpu: infraSpec.vcpu,
    ramGB: infraSpec.ramGB,
    storageGB: 100,
  }
}
```

**Applied to calcHCP:** Add identical block after `workerNodes` is defined. Update `sizing`
object to pass `infraNodes` instead of hardcoded `null`. Update totals to include `infraNodes`.

### Which topologies need infraNodes extension (scope clarification)

| Topology | infraNodesEnabled supported? | Reasoning |
|----------|------------------------------|-----------|
| standard-ha | YES (already done) | Has dedicated worker pool |
| compact-3node | Edge case | RH docs allow but unusual; masters are workers — no separate worker count to drive `infraNodeSizing()`; SKIP |
| sno | NO | Single node — cannot add infra nodes |
| two-node-arbiter (TNA) | NO | infraNodes slot is used for the arbiter node |
| two-node-fencing (TNF) | Edge case | Only 2 CPs, no workers — skip |
| hcp | YES (gap to fix) | Has worker pool; infra nodes are standard |
| microshift | NO | Single-node edge device |
| managed-cloud | NO | Managed service |

**Decision:** Extend `infraNodesEnabled` support to `calcHCP` only. Compact-3Node and TNF lack
a worker pool count to drive `infraNodeSizing()` meaningfully and are out of scope for this
phase per the plan description.

### Anti-Patterns to Avoid
- **Hardcoding allocatable RAM as a decimal literal:** Use `allocatableRamGB(nodeRamGB)` — the
  formula accounts for the exact tiered reservation model. Never hard-code the result.
- **Forgetting to update `totals` after adding `infraNodes`:** `sumTotals()` helper already
  handles null entries; just pass `infraNodes` in the array.
- **Forgetting to update the `sizing` object literal:** `calcHCP` constructs `ClusterSizing`
  with `infraNodes: null` — must change to `infraNodes`.
- **Forgetting the `allocatableRamGB` import:** `calculators.ts` imports from `./formulas`
  but currently only imports `cpSizing`, `workerCount as calcWorkerCount`, and `infraNodeSizing`.
  `allocatableRamGB` must be added to that import.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Allocatable RAM | Inline decimal constant | `allocatableRamGB()` from `formulas.ts` | Tiered formula already implemented and tested |
| Infra node sizing | Manual vcpu/ramGB values | `infraNodeSizing(workerCount)` from `formulas.ts` | Table lookup already implemented |
| Minimum clamping | Custom if/else guard | `Math.max(computed, MIN.field)` | One-liner, readable, matches existing pattern |

## Common Pitfalls

### Pitfall 1: allocatableRamGB not imported in calculators.ts
**What goes wrong:** TypeScript compile error — `allocatableRamGB is not exported` or `cannot
find name allocatableRamGB`.
**Why it happens:** `calculators.ts` line 22 only imports 3 functions from `./formulas`:
`cpSizing`, `workerCount as calcWorkerCount`, `infraNodeSizing`. `allocatableRamGB` is exported
from `formulas.ts` but not listed in the import.
**How to avoid:** Update import line 22 to include `allocatableRamGB`.
**Warning signs:** TypeScript compiler error on the `workersByRAM` line.

### Pitfall 2: TNA infraNodes slot collision
**What goes wrong:** If `infraNodesEnabled` is extended to TNA, the arbiter node would be
overwritten — TNA uses `infraNodes` to store its arbiter node.
**Why it happens:** The `ClusterSizing` interface has no `arbiterNode` field; `calcTNA`
repurposes the `infraNodes` slot for the arbiter.
**How to avoid:** Do NOT extend `infraNodesEnabled` support to TNA. Tests confirm
`sizing.infraNodes` for TNA contains the arbiter spec `{ count: 1, vcpu: 2, ramGB: 8, storageGB: 50 }`.
**Warning signs:** `calcTNA` test `"returns 2 CP nodes + 1 arbiter"` would fail.

### Pitfall 3: HCP totals not including infraNodes
**What goes wrong:** `infraNodes` resources omitted from the totals row in results display.
**Why it happens:** `calcHCP` currently constructs totals as `sumTotals([masterNodes, workerNodes])`
with infraNodes not in the array (it's hard-coded to null today).
**How to avoid:** Change to `sumTotals([masterNodes, workerNodes, infraNodes])` — `sumTotals`
already handles null entries safely.
**Warning signs:** Test checking totals with infraNodesEnabled would show a lower-than-expected
total vCPU/RAM.

### Pitfall 4: Compact-3Node has no worker count for infraNodeSizing()
**What goes wrong:** If `infraNodesEnabled` is extended to `calcCompact3Node`, calling
`infraNodeSizing(0)` returns the smallest infra tier (4 vCPU / 24 GB) but is architecturally
meaningless — infra nodes on compact-3node are unsupported in practice.
**Why it happens:** Compact-3node masters double as workers; there is no separate `workerNodes.count`.
**How to avoid:** Do not extend infraNodesEnabled to compact-3node in this phase.

### Pitfall 5: Numeric precision — allocatableRamGB(32) must equal 28.44
**What goes wrong:** Replacing 28.44 with `allocatableRamGB(32)` changes the arithmetic result
if the function returns a slightly different float.
**Why it happens:** Floating-point representation. However, the STATE.md decision entry confirms:
`allocatableRamGB(16) is 13.4 GB not 12.4 GB — formula (2.6 GB reserved) is correct`.
**How to avoid:** Add a test asserting `allocatableRamGB(32) === 28.44` OR verify manually.
The formula uses `decimal.js`, so result should be exact. Verification:
  - 25% of 4 GiB = 1.0
  - 20% of 4 GiB = 0.8
  - 10% of 8 GiB = 0.8
  - 6% of 16 GiB (32-16) = 0.96
  - Total reserved = 3.56; allocatable = 32 - 3.56 = **28.44** ✓

## Code Examples

### Full calcHCP after all three fixes
```typescript
// Source: src/engine/calculators.ts — annotated diff
export function calcHCP(config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const { hcpHostedClusters, hcpQpsPerCluster, addOns } = config   // ADD: addOns destructure
  const qpsFactor = hcpQpsPerCluster / 1000

  const cpuPerCP = HCP_CPU_PER_CP_IDLE + qpsFactor * HCP_CPU_PER_1000_QPS
  const ramPerCP = HCP_RAM_PER_CP_IDLE + qpsFactor * HCP_RAM_PER_1000_QPS

  const totalCPU = hcpHostedClusters * cpuPerCP
  const totalRAM = hcpHostedClusters * ramPerCP

  const WORKER_VCPU = 16
  const WORKER_RAM_GB = 32
  const UTIL = 0.70

  const workersByCPU = Math.ceil(totalCPU / (WORKER_VCPU * UTIL))
  const workersByRAM = Math.ceil(totalRAM / (allocatableRamGB(WORKER_RAM_GB) * UTIL))  // FIX 1
  const workers = Math.max(workersByCPU, workersByRAM, 3)

  const masterNodes: NodeSpec = { ...CP_MIN }
  const workerNodes: NodeSpec = {
    count: workers,
    vcpu: Math.max(WORKER_VCPU, WORKER_MIN.vcpu),    // FIX 2a
    ramGB: Math.max(WORKER_RAM_GB, WORKER_MIN.ramGB), // FIX 2b
    storageGB: WORKER_MIN.storageGB,                  // FIX 2c (was hardcoded 100)
  }

  // FIX 3: infra nodes support
  let infraNodes: NodeSpec | null = null
  if (addOns.infraNodesEnabled) {
    const infraSpec = infraNodeSizing(workerNodes.count)
    infraNodes = {
      count: 3,
      vcpu: infraSpec.vcpu,
      ramGB: infraSpec.ramGB,
      storageGB: 100,
    }
  }

  const sizing: ClusterSizing = {
    masterNodes,
    workerNodes,
    infraNodes,                                        // FIX 3 (was null)
    odfNodes: null,
    rhacmWorkers: null,
    totals: sumTotals([masterNodes, workerNodes, infraNodes]),  // FIX 3 (was without infraNodes)
  }

  return { sizing, warnings: [] }
}
```

### Updated import line in calculators.ts
```typescript
// Line 22 — current:
import { cpSizing, workerCount as calcWorkerCount, infraNodeSizing } from './formulas'

// Line 22 — after fix:
import { cpSizing, workerCount as calcWorkerCount, infraNodeSizing, allocatableRamGB } from './formulas'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `WORKER_ALLOC_RAM = 28.44` | `allocatableRamGB(WORKER_RAM_GB)` | Phase 8 | Formula-driven, consistent with rest of engine |
| HCP infraNodes always null | infraNodes set when infraNodesEnabled | Phase 8 | RES-04 gap closed |
| No explicit minimums in HCP worker spec | Math.max() against WORKER_MIN | Phase 8 | ENG-06 gap closed |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest) |
| Config file | `vite.config.ts` (vitest config embedded) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

Current baseline: 179 tests passing across 18 test files (confirmed 2026-03-31).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENG-04 | `calcHCP` calls `allocatableRamGB(32)` not inline 28.44 | unit | `npm run test -- --reporter=verbose` | ✅ `calculators.test.ts` (extend existing HCP suite) |
| ENG-06 | All topology functions enforce minimums via Math.max() | unit | `npm run test -- --reporter=verbose` | ✅ `calculators.test.ts` (extend HCP suite) |
| RES-04 | infraNodes non-null for HCP when infraNodesEnabled=true | unit | `npm run test -- --reporter=verbose` | ✅ `calculators.test.ts` (add new HCP infra test) |

### New test cases needed (inside `calculators.test.ts`)

**For ENG-04 (allocatableRamGB use):**
```typescript
it('uses allocatable RAM formula for workersByRAM — not inline constant', () => {
  // Verify result matches what allocatableRamGB(32) would produce.
  // With 1 cluster at 0 QPS: totalRAM=18 GB
  // allocatableRamGB(32) = 28.44; workersByRAM = ceil(18 / (28.44 * 0.70)) = ceil(0.903) = 1 → min=3
  const config = makeConfig({ topology: 'hcp', hcpHostedClusters: 1, hcpQpsPerCluster: 0 })
  const { sizing } = calcHCP(config)
  expect(sizing.workerNodes!.count).toBe(3)
})
```

**For RES-04 (infraNodes in HCP):**
```typescript
it('includes infra nodes when infraNodesEnabled=true', () => {
  const config = makeConfig({
    topology: 'hcp',
    addOns: {
      odfEnabled: false,
      odfExtraOsdCount: 0,
      infraNodesEnabled: true,
      rhacmEnabled: false,
      rhacmManagedClusters: 0,
    },
  })
  const { sizing } = calcHCP(config)
  expect(sizing.infraNodes).not.toBeNull()
  expect(sizing.infraNodes!.count).toBe(3)
})

it('infraNodes null when infraNodesEnabled=false (default)', () => {
  const config = makeConfig({ topology: 'hcp' })
  const { sizing } = calcHCP(config)
  expect(sizing.infraNodes).toBeNull()
})
```

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green (179+ tests) before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure (`calculators.test.ts`) is the correct target for new tests.
Only new test cases need to be added, not new test files.

## Environment Availability

Step 2.6: No external dependencies. Phase is purely TypeScript source code edits within
`src/engine/calculators.ts` and test additions in `src/engine/calculators.test.ts`.

Node.js and npm are available (confirmed: test suite runs at 2026-03-31 22:25).

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/engine/calculators.ts` — all 8 topology functions read line-by-line
- Direct code inspection: `src/engine/formulas.ts` — `allocatableRamGB()` signature confirmed
- Direct code inspection: `src/engine/constants.ts` — all minimum constants enumerated
- Direct code inspection: `src/engine/types.ts` — `ClusterSizing.infraNodes: NodeSpec | null` confirmed
- Direct code inspection: `src/engine/calculators.test.ts` — test helper pattern and coverage gaps
- `.planning/STATE.md` decision log — `allocatableRamGB(16) = 13.4 GB` arithmetic cross-check

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — ENG-04, ENG-06, RES-04 requirement text
- `.planning/ROADMAP.md` — Phase 8 scope description

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; pure code analysis
- Architecture: HIGH — code read directly, all findings verifiable line-by-line
- Pitfalls: HIGH — found by code analysis (import gap, TNA slot collision, totals omission)
- Test gaps: HIGH — identified by reading existing test file

**Research date:** 2026-03-31
**Valid until:** Indefinite — all findings based on static code analysis, not external services
