# Phase 2: Sizing Engine - Research

**Researched:** 2026-03-31
**Domain:** TypeScript sizing engine for OpenShift topology calculators
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | TypeScript types for all 8 topologies, NodeSpec, ClusterConfig, SizingResult | types.ts already has TopologyType + NodeSpec + base shapes — needs WorkloadProfile fields added |
| ENG-02 | Control plane node sizing formula (CP scaling table: 24/120/252/501 workers) | CP table fully documented in hardware-sizing.md section 6 |
| ENG-03 | Worker count formula: max(cpu_limited, ram_limited, pod_density_limited) at 70% utilization | Formula fully documented in hardware-sizing.md section 3.2 |
| ENG-04 | Allocatable RAM formula with tiered kernel reservation (25%/20%/10%/6%) | JavaScript function already spelled out in hardware-sizing.md section 6 |
| ENG-05 | Infra node sizing formula (scales with worker count: 27→4CPU/24GB, 120→8CPU/48GB, 252→16CPU/128GB) | Infra table in hardware-sizing.md section 4 |
| ENG-06 | Minimum hardware constants per topology (CP, worker, SNO, TNA, TNF, HCP, MicroShift) | All constants documented in hardware-sizing.md sections 2.1–2.8 |
| ENG-07 | ODF add-on sizing: 16vCPU/64GB × 3 storage nodes + per-OSD scaling | ODF formula in hardware-sizing.md section 5.1 |
| ENG-08 | RHACM hub sizing: 3 workers × 16vCPU/64GB for up to 500 clusters | RHACM table in hardware-sizing.md section 5.2 |
| ENG-09 | All engine functions pure TypeScript, zero Vue imports, fully unit-tested | Architecture constraint CALC-01 enforced via vitest.config.ts (node environment) |
| REC-01 | Recommendation engine: takes user constraints, returns ranked topology suggestions | Recommendation logic derived from hardware-sizing.md topology constraints + research below |
| REC-02 | Constraints driving recommendations: HA, node budget, environment type, connectivity, workload size | Constraint-to-topology mapping fully researchable from hardware specs |
| REC-03 | Each recommendation includes i18n justification key | ValidationWarning pattern from vcf-sizer applies — messageKey only |
| QA-01 | Unit tests for all engine sizing formulas (vitest) | vitest configured, node environment, test pattern established |
| QA-02 | Unit tests for recommendation engine | Same vitest node environment |
| QA-03 | Unit tests for Zod validation schemas | Same vitest node environment |
| QA-05 | Edge cases: minimums enforcement, topology-specific constraints | Covered by test coverage plan below |

</phase_requirements>

---

## Summary

Phase 2 builds the pure TypeScript sizing engine that calculates OpenShift cluster hardware requirements for all 8 supported topologies. The domain knowledge is fully captured in `.planning/research/hardware-sizing.md` — the sizing formulas, CP scaling table, allocatable RAM formula, ODF/infra sizing, and HCP load-based scaling are all documented with HIGH confidence from official Red Hat sources.

The architecture pattern is inherited directly from vcf-sizer: each engine file is a pure TypeScript module with no Vue imports, arithmetic uses `decimal.js` to avoid IEEE 754 errors, validation returns `ValidationWarning[]` with i18n keys only, and all engine files live in `src/engine/`. The calculationStore already exists as a stub — Phase 2 replaces the stub logic with real engine calls.

Phase 1 left two engine files in place (`types.ts`, `defaults.ts`) with deliberate stubs for Phase 2 to complete. The `ClusterConfig` interface needs workload profile fields (pods, CPU/pod, RAM/pod, etc.) added. The `SizingResult` interface needs `addOns` fields for ODF and RHACM. These additions should not break existing Phase 1 store tests because stores use `Partial<ClusterConfig>` in `updateCluster`.

**Primary recommendation:** Follow the vcf-sizer file-per-concern pattern for the engine layer. Use 6 engine files (types, constants, formulas, calculators, addons, recommendation) plus one test file per engine module. Keep topology calculators in a single `calculators.ts` file (not one-per-topology) because they share the same formula primitives.

---

## Project Constraints (from CLAUDE.md)

No project-level `CLAUDE.md` found in `/Users/fjacquet/Projects/os-sizer/`. Constraints are carried via `STATE.md` decisions and the architecture research documents. The authoritative constraints are:

| Constraint | Source | Enforcement |
|-----------|--------|-------------|
| CALC-01: Zero Vue imports in `src/engine/` | app-architecture.md | vitest runs in `node` env — Vue imports cause test failures |
| CALC-02: `calculationStore` has zero `ref()` — only `computed()` | app-architecture.md | Code review / linting |
| Use `decimal.js` for all arithmetic | app-architecture.md | IEEE 754 float errors corrupt utilization percentages |
| Validation returns `ValidationWarning[]` — never throw, i18n keys only | app-architecture.md | Engine tests verify no English strings in warnings |
| Factory functions in defaults.ts, not exported constants | app-architecture.md | Prevents shared-reference mutation bugs |
| Store uses `ref<[]>` not `reactive([])` | app-architecture.md | storeToRefs() double-wrap bug |
| No `$patch()` on arrays — use `Object.assign()` | app-architecture.md | Silent loss of array elements |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | ^10.6.0 | All engine arithmetic | IEEE 754 correction; already in package.json |
| vitest | ^4.1.2 | Unit testing | Already configured; node environment; 11 tests passing |
| TypeScript | (project) | Engine type safety | Topology discriminated unions; already configured |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Input validation schemas | QA-03: Zod schemas for ClusterConfig fields |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| decimal.js | Plain JS arithmetic | Plain JS has IEEE 754 errors at rounding boundaries; not acceptable in sizing tool |
| Pure lookup tables | Interpolation | Lookup tables are safer for official Red Hat CP sizing — no interpolation risk |

**Installation:** All packages already installed in Phase 1.

**Verified versions from package.json:**

- decimal.js: 10.6.0 (confirmed installed)
- vitest: 4.1.2 (confirmed installed, tests passing)
- zod: 4.3.6 (confirmed installed)

---

## Architecture Patterns

### Engine File Structure

```
src/engine/
├── types.ts          # Extends Phase 1 stub — adds WorkloadProfile, AddOnConfig, full SizingResult
├── constants.ts      # NEW — all Red Hat minimum hardware constants per topology
├── formulas.ts       # NEW — pure math: allocatableRam, cpSizing, workerCount, infraSizing
├── calculators.ts    # NEW — 8 topology calculator functions, all return SizingResult
├── addons.ts         # NEW — ODF, infra node, RHACM hub add-on calculators
├── recommendation.ts # NEW — constraint-to-topology ranking, returns TopologyRecommendation[]
├── validation.ts     # NEW — returns ValidationWarning[] for ClusterConfig inputs
├── defaults.ts       # Extend Phase 1 — add workload profile defaults to createDefaultClusterConfig()
└── index.ts          # NEW — re-exports public API (prevents deep import paths)
```

Plus test files co-located:

```
src/engine/
├── formulas.test.ts
├── calculators.test.ts
├── addons.test.ts
├── recommendation.test.ts
└── validation.test.ts
```

### Why not one file per topology?

The 8 topology calculators share `allocatableRam()`, `cpSizing()`, and `workerCount()` primitives. Putting them in separate files creates circular dependency risk and forces duplication of imports. A single `calculators.ts` with one exported function per topology is cleaner and matches the vcf-sizer pattern (single `compute.ts` handles all deployment modes).

### Pattern 1: Pure Formula Functions (formulas.ts)

**What:** Stateless math functions that encode the official Red Hat sizing rules.
**When to use:** Every topology calculator imports from `formulas.ts` — never duplicates formulas inline.

```typescript
// Source: hardware-sizing.md section 6 — Allocatable RAM Calculation
import Decimal from 'decimal.js'

export function allocatableRamGB(totalGiB: number): number {
  const reserved = new Decimal(0)
    .plus(new Decimal(0.25).times(Math.min(totalGiB, 4)))
    .plus(new Decimal(0.20).times(Math.min(Math.max(totalGiB - 4, 0), 4)))
    .plus(new Decimal(0.10).times(Math.min(Math.max(totalGiB - 8, 0), 8)))
    .plus(new Decimal(0.06).times(Math.max(totalGiB - 16, 0)))
  return new Decimal(totalGiB).minus(reserved).toNumber()
}
```

```typescript
// Source: hardware-sizing.md section 6 — Control Plane Sizing
export function cpSizing(workerCount: number, useOvnK = false): { vcpu: number; ramGB: number } {
  if (workerCount <= 24)  return { vcpu: 4,  ramGB: 16 }
  if (workerCount <= 120) return { vcpu: 8,  ramGB: 32 }
  if (workerCount <= 252) return { vcpu: useOvnK ? 24 : 16, ramGB: useOvnK ? 128 : 64 }
  return { vcpu: 16, ramGB: 96 }
}
```

```typescript
// Source: hardware-sizing.md section 3.2 — Worker Count Formula
export function workerCount(
  totalPodCpuMillicores: number,
  totalPodMemMiB: number,
  totalPods: number,
  nodeVcpu: number,
  nodeRamGB: number,
  maxPodsPerNode = 200,
  targetUtilization = 0.70,
): number {
  const allocCpu = allocatableRamGB(nodeVcpu)   // CPU: no tiering, only node-level reservation
  const allocRam = allocatableRamGB(nodeRamGB)
  const byCpu  = Math.ceil((totalPodCpuMillicores / 1000) / (nodeVcpu * targetUtilization))
  const byRam  = Math.ceil((totalPodMemMiB / 1024) / (allocRam * targetUtilization))
  const byPods = Math.ceil(totalPods / maxPodsPerNode)
  return Math.max(byCpu, byRam, byPods, 2)   // minimum 2 for HA
}
```

**NOTE on CPU allocatable:** CPU reservation in OCP uses the `60m + (cores × 12m)` formula (OCP 4.17+), not the tiered GB model. For sizing purposes, the difference is small — use `nodeVcpu * 0.94` as a conservative CPU allocatable approximation (approximately subtracts the 500m minimum + ~6% for typical 8–16 vCPU nodes). The tiered model only applies to RAM.

### Pattern 2: Constants File (constants.ts)

**What:** Readonly objects encoding all Red Hat hardware minimums. Never inline magic numbers.
**When to use:** Import from constants.ts in both calculators.ts and validation.ts.

```typescript
// Source: hardware-sizing.md sections 1–2
export const CP_MIN: NodeSpec = { count: 3, vcpu: 4, ramGB: 16, storageGB: 100 }
export const WORKER_MIN: NodeSpec = { count: 2, vcpu: 2, ramGB: 8, storageGB: 100 }
export const SNO_STD_MIN: NodeSpec = { count: 1, vcpu: 8, ramGB: 16, storageGB: 120 }
export const SNO_EDGE_MIN: NodeSpec = { count: 1, vcpu: 8, ramGB: 32, storageGB: 120 }
export const SNO_TELECOM_MIN: NodeSpec = { count: 1, vcpu: 24, ramGB: 48, storageGB: 600 }
export const TNA_CP_MIN: NodeSpec = { count: 2, vcpu: 4, ramGB: 16, storageGB: 100 }
export const TNA_ARBITER_MIN: NodeSpec = { count: 1, vcpu: 2, ramGB: 8, storageGB: 50 }
export const TNF_CP_MIN: NodeSpec = { count: 2, vcpu: 4, ramGB: 16, storageGB: 100 }
export const HCP_PODS_PER_CP = 78
export const HCP_CPU_PER_CP_IDLE = 5    // vCPU
export const HCP_RAM_PER_CP_IDLE = 18   // GiB
export const HCP_CPU_PER_1000_QPS = 9   // additional vCPU per 1000 QPS
export const HCP_RAM_PER_1000_QPS = 2.5 // additional GB per 1000 QPS
export const MICROSHIFT_SYS_MIN: NodeSpec = { count: 1, vcpu: 2, ramGB: 2, storageGB: 10 }
export const ODF_MIN_CPU_PER_NODE = 16
export const ODF_MIN_RAM_PER_NODE_GB = 64
export const ODF_MIN_NODES = 3
export const ODF_CPU_PER_OSD = 2
export const ODF_RAM_PER_OSD_GB = 5
export const INFRA_SIZING_TABLE = [
  { maxWorkers: 27,  vcpu: 4,  ramGB: 24  },
  { maxWorkers: 120, vcpu: 8,  ramGB: 48  },
  { maxWorkers: 252, vcpu: 16, ramGB: 128 },
] as const
export const TARGET_UTILIZATION = 0.70
export const MAX_PODS_PER_NODE = 200
```

### Pattern 3: Topology Calculator Functions (calculators.ts)

**What:** One exported function per topology. Each takes a `ClusterConfig` and returns a `SizingResult`.
**When to use:** `calculationStore.ts` calls the function matching `cluster.topology`.

```typescript
// Dispatcher pattern — calculationStore calls this
export function calcCluster(config: ClusterConfig): ClusterSizing {
  switch (config.topology) {
    case 'standard-ha':   return calcStandardHA(config)
    case 'compact-3node': return calcCompact3Node(config)
    case 'sno':           return calcSNO(config)
    case 'two-node-arbiter': return calcTNA(config)
    case 'two-node-fencing': return calcTNF(config)
    case 'hcp':           return calcHCP(config)
    case 'microshift':    return calcMicroShift(config)
    case 'managed-cloud': return calcManagedCloud(config)
    default: {
      const _exhaustive: never = config.topology
      throw new Error(`Unhandled topology: ${_exhaustive}`)
    }
  }
}
```

The exhaustive switch with `never` type is the correct TypeScript pattern — ensures all 8 topology variants are handled. Missing a topology is a compile error.

### Pattern 4: Recommendation Engine (recommendation.ts)

**What:** Takes `RecommendationConstraints` (environment type, HA requirement, node budget, workload size, connectivity) and returns `TopologyRecommendation[]` sorted by fit score.
**When to use:** Phase 3 wizard Step 3 reads this to pre-select the topology card.

```typescript
export interface RecommendationConstraints {
  environment: 'datacenter' | 'edge' | 'far-edge' | 'cloud'
  haRequired: boolean
  maxNodes: number | null          // null = no budget constraint
  airGapped: boolean
  estimatedWorkers: number         // from workload profile pre-calculation
  addOns: { odf: boolean; rhacm: boolean }
}

export interface TopologyRecommendation {
  topology: TopologyType
  fitScore: number                 // 0–100
  justificationKey: string         // i18n key
  warningKeys: string[]            // i18n keys for caveats (e.g., "Tech Preview")
}
```

Recommendation ranking logic (derived from Red Hat docs):

- `standard-ha`: default for datacenter + HA required + workers >= 2
- `compact-3node`: when node budget <= 3, datacenter, workers <= ~20
- `sno`: when environment is edge/far-edge OR single site OR no HA required
- `two-node-arbiter` / `two-node-fencing`: Tech Preview — always include warning key
- `hcp`: when estimatedWorkers >= 3 AND hosted cluster count provided
- `microshift`: when environment is far-edge OR very constrained resources
- `managed-cloud`: when environment is cloud (informational only — no hardware sizing)

### Pattern 5: Extended ClusterConfig (types.ts additions)

The Phase 1 `ClusterConfig` stub needs workload profile fields. These additions are backward-compatible — `createDefaultClusterConfig()` in `defaults.ts` provides zero/defaults for all new fields.

```typescript
export type SnoProfile = 'standard' | 'edge' | 'telecom-vdu'

export interface WorkloadProfile {
  totalPods: number             // default 10
  podCpuMillicores: number      // avg CPU request per pod
  podMemMiB: number             // avg RAM request per pod
  nodeVcpu: number              // worker node size
  nodeRamGB: number             // worker node size
}

export interface AddOnConfig {
  odfEnabled: boolean
  odfOsdCount: number           // OSDs per storage node
  infraNodesEnabled: boolean
  rhacmEnabled: boolean
  rhacmManagedClusters: number
}

// Extend existing ClusterConfig:
export interface ClusterConfig {
  id: string
  name: string
  topology: TopologyType
  snoProfile?: SnoProfile                  // only used when topology === 'sno'
  hcpHostedClusters?: number              // only used when topology === 'hcp'
  hcpQpsPerCluster?: number               // default 1000 (medium load)
  workload: WorkloadProfile
  addOns: AddOnConfig
}

// SizingResult — full shape including add-ons
export interface ClusterSizing {
  masterNodes: NodeSpec
  workerNodes: NodeSpec
  infraNodes: NodeSpec | null
  odfNodes: NodeSpec | null
  rhacmWorkers: NodeSpec | null
  totals: { vcpu: number; ramGB: number; storageGB: number }
}

export interface SizingResult {
  id: string
  sizing: ClusterSizing
  recommendations: TopologyRecommendation[]
  validationErrors: ValidationWarning[]
}
```

### Anti-Patterns to Avoid

- **Inline magic numbers in calculators:** All constants in `constants.ts`. Calculator files never contain bare numbers like `16` or `64`.
- **English strings in validation:** `messageKey` is always an i18n key (e.g., `'validation.snoNoWorkers'`), never `'SNO does not support worker nodes'`.
- **Plain JS arithmetic for thresholds:** `Math.ceil(pods / 200)` is fine for integer ceiling, but `workerCpu / (nodeCpu * 0.70)` must use Decimal. The rule: any multiplication, division, or percentage calculation uses Decimal.
- **Throwing errors in validation:** `validateInputs` always returns `ValidationWarning[]`. Only the dispatcher switch throws for exhaustiveness.
- **Topology-specific logic in formulas.ts:** `formulas.ts` is pure math. Topology-specific minimums and constraints belong in `calculators.ts` and `validation.ts`.
- **`managed-cloud` in the calculator dispatcher:** ManagedCloud/ROSA has no hardware sizing — return a fixed informational result with a warning, not a hardware calculation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Floating-point arithmetic | Custom rounding helpers | decimal.js | IEEE 754 errors compound across 3-factor formula; already in package.json |
| Ceiling division | `(a + b - 1) / b` integer trick | `Math.ceil(new Decimal(a).dividedBy(b).toNumber())` | Decimal handles intermediate precision |
| Input validation schema | Custom validator functions | Zod schemas for Phase 3 form inputs (QA-03) | Zod already in package.json; matches URL state pattern |
| i18n warning messages | English string concatenation | i18n `messageKey` + locale JSON | Engine has no Vue dependency — it cannot call `t()` |

**Key insight:** The engine is purely computational. Its only output strings are i18n keys that the UI layer resolves. This keeps the engine testable in Node without any Vue environment.

---

## Common Pitfalls

### Pitfall 1: CPU Allocatable vs RAM Allocatable Are Different Formulas

**What goes wrong:** Applying the tiered RAM reservation model (`25%/20%/10%/6%`) to CPU as well.
**Why it happens:** The research document mentions them together; readers assume the same formula applies.
**How to avoid:** CPU reservation in OCP 4.17+ is `60m + (additional_cores × 12m)`, min 500m. For a typical 8-vCPU node, reserved CPU is approximately `60 + 7×12 = 144m = 0.144 vCPU`. Use ~94% of vCPU as allocatable for sizing (conservative approximation). RAM uses the tiered formula.
**Warning signs:** Worker count formula producing too few workers for CPU-heavy workloads.

### Pitfall 2: OVN-Kubernetes Control Plane Overhead

**What goes wrong:** Using standard CP sizing table without OVN-K flag for large clusters (>120 workers).
**Why it happens:** The OVN-K multiplier only matters above 120 workers; easy to miss.
**How to avoid:** Add a `useOvnK: boolean` parameter to `cpSizing()`. Default false. Document in constants that at >120 workers OVN-K increases CP requirements to 24 vCPU / 128 GB.
**Warning signs:** Users report control plane instability at large scale.

### Pitfall 3: ODF Adds to Worker Node Sizing in Converged Mode

**What goes wrong:** Calculating worker nodes based purely on application workload; forgetting ODF pods consume worker node resources when ODF is collocated.
**Why it happens:** ODF nodes and worker nodes are treated as independent line items.
**How to avoid:** In the Standard HA calculator with ODF enabled: ODF nodes are separate dedicated nodes, NOT the same as worker nodes. Output ODF nodes as a separate `odfNodes: NodeSpec` in SizingResult with count=3, cpu=16+, ram=64+. Never add ODF requirements to worker node specs.
**Warning signs:** Total cluster vCPU/RAM doesn't include ODF overhead.

### Pitfall 4: HCP Default QPS

**What goes wrong:** Sizing management cluster for idle HCP (5 vCPU / 18 GiB per cluster) and undersizing for real load.
**Why it happens:** The idle baseline is easy to implement; the QPS scaling factor is overlooked.
**How to avoid:** Default `hcpQpsPerCluster` to 1000 (medium load) when not specified. At 1000 QPS: `5 + (1000/1000)×9 = 14 vCPU` and `18 + (1000/1000)×2.5 = 20.5 GiB` per hosted cluster. This is the safe sizing default.
**Warning signs:** Management cluster is undersized for real API traffic.

### Pitfall 5: Compact 3-Node Workers = 0, but Subscriptions Count

**What goes wrong:** Setting workerNodes.count = 0 for compact clusters and having the UI display "0 worker nodes" confusingly.
**Why it happens:** Compact clusters have no dedicated worker nodes, but the 3 control-plane nodes are schedulable and require compute subscriptions.
**How to avoid:** For compact-3node, `SizingResult.sizing.workerNodes` should be `null` (or a count-0 sentinel). The `masterNodes` result describes all 3 nodes, and a `ValidationWarning` with `severity: 'warning'` and key `'validation.compactSubscriptionNote'` should be included in the result to indicate subscription impact.
**Warning signs:** Users confused about subscription licensing for compact clusters.

### Pitfall 6: TNA/TNF Are Tech Preview

**What goes wrong:** Recommending TNA/TNF without flagging them as unsupported for production.
**Why it happens:** The calculator produces valid hardware specs; the TP status is domain knowledge.
**How to avoid:** Both `calcTNA()` and `calcTNF()` must append a `ValidationWarning` with `severity: 'warning'` and key `'validation.techPreviewNotForProduction'` to every result, unconditionally.
**Warning signs:** Users deploy TNA/TNF in production expecting full support.

### Pitfall 7: SNO Profile Matters for Storage

**What goes wrong:** SNO standard has 120 GB storage minimum; SNO vDU telecom has 600 GB minimum. Using wrong minimum.
**Why it happens:** SNO has 3 sub-profiles with different minimums.
**How to avoid:** `SNO_PROFILE_MINS` constant maps all 3 profiles. `calcSNO()` reads `config.snoProfile ?? 'standard'` to select the right minimum.

### Pitfall 8: ManagedCloud Returns No Hardware

**What goes wrong:** Implementing a hardware calculator for ROSA/ARO when the spec says "informational only".
**Why it happens:** The dispatcher switch tempts developers to provide a sizing result.
**How to avoid:** `calcManagedCloud()` returns a fixed result with all NodeSpecs at count=0 and a `ValidationWarning` key `'validation.managedCloudNoHardware'`.

---

## Code Examples

Verified patterns from vcf-sizer source:

### Decimal.js arithmetic pattern

```typescript
// Source: vcf-sizer src/engine/compute.ts
import Decimal from 'decimal.js'

// Correct: all intermediate results via Decimal
const workers = Math.ceil(
  new Decimal(totalPodCpuMillicores)
    .dividedBy(1000)
    .dividedBy(new Decimal(nodeVcpu).times(TARGET_UTILIZATION))
    .toNumber()
)
```

### Exhaustive switch with never

```typescript
// Source: vcf-sizer src/engine/storage.ts — default case pattern
default: {
  const _exhaustive: never = config.topology
  throw new Error(`Unhandled topology: ${_exhaustive}`)
}
```

### Validation warning without English strings

```typescript
// Source: vcf-sizer src/engine/validation.ts
errors.push({
  code: 'OCP_TECH_PREVIEW',
  severity: 'warning',
  messageKey: 'validation.techPreviewNotForProduction',  // key in all 4 locale JSON files
})
```

### Engine test pattern

```typescript
// Source: vcf-sizer app-architecture.md section 8
/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest'
import { allocatableRamGB } from './formulas'
import { cpSizing } from './formulas'

describe('allocatableRamGB', () => {
  it('8 GB node → ~6.2 GB allocatable (25%+20%+10% tiers)', () => {
    // 25% of 4 = 1.0 + 20% of 4 = 0.8 → reserved = 1.8, allocatable = 6.2
    expect(allocatableRamGB(8)).toBeCloseTo(6.2, 1)
  })
  it('16 GB node → ~12.4 GB allocatable', () => {
    expect(allocatableRamGB(16)).toBeCloseTo(12.4, 1)
  })
  it('32 GB node → ~28.4 GB allocatable', () => {
    expect(allocatableRamGB(32)).toBeCloseTo(28.4, 1)
  })
})

describe('cpSizing', () => {
  it('24 workers → 4 vCPU / 16 GB', () => {
    expect(cpSizing(24)).toEqual({ vcpu: 4, ramGB: 16 })
  })
  it('120 workers → 8 vCPU / 32 GB', () => {
    expect(cpSizing(120)).toEqual({ vcpu: 8, ramGB: 32 })
  })
  it('252 workers with OVN-K → 24 vCPU / 128 GB', () => {
    expect(cpSizing(252, true)).toEqual({ vcpu: 24, ramGB: 128 })
  })
})
```

### CalcStore wiring pattern (calculationStore.ts update)

```typescript
// calculationStore.ts — replace stub with real engine call
import { calcCluster } from '@/engine/calculators'
import { validateInputs } from '@/engine/validation'
import { recommend } from '@/engine/recommendation'

const clusterResults = computed<SizingResult[]>(() =>
  input.clusters.map((cluster) => ({
    id: cluster.id,
    sizing: calcCluster(cluster),
    recommendations: recommend(cluster),
    validationErrors: validateInputs(cluster),
  }))
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CPU reservation: 60m + 10m/core + HT/NUMA factors | CPU reservation: 60m + 12m/core, min 500m for ≤64 CPUs | OCP 4.17 | Slightly more CPU reserved on newer OCP; small delta for sizing |
| OVN-K CP overhead not documented | OVN-K adds significant CP overhead at >120 workers | OCP 4.x doc update | Must expose as flag in CP sizing |

**Deprecated/outdated:**

- OCP 4.16 and earlier CPU reservation formula (10m/core): superseded by 12m/core in 4.17+. Use 4.17+ formula as it is the current standard.

---

## Open Questions

1. **SNO Edge profile exact minimums**
   - What we know: SNO standard = 8 vCPU / 16 GB / 120 GB; SNO telecom-vDU = 24–32 vCPU / 48–64 GB / 600 GB
   - What's unclear: The "edge" profile between standard and telecom is not a formally defined Red Hat sizing tier. It is referenced in REQUIREMENTS.md but not in hardware-sizing.md.
   - Recommendation: Define "edge" SNO as 8 vCPU / 32 GB / 120 GB (double the RAM, same CPU as standard) as a conservative practical choice. Document as a project decision in STATE.md, not an official Red Hat spec.

2. **RHACM hub sizing for fewer than 100 clusters**
   - What we know: 3 workers × 16 vCPU / 64 GB for 100–500 clusters; 3 workers × 8 vCPU / 32 GB for up to 100 clusters
   - What's unclear: Whether to automatically scale RHACM hub based on `rhacmManagedClusters` input
   - Recommendation: Implement a two-tier lookup (< 100 → 8 vCPU/32 GB; ≥ 100 → 16 vCPU/64 GB) with 3 workers always.

3. **HCP management cluster worker node spec**
   - What we know: Minimum 3 workers × 8 vCPU / 32 GB each; standard 3+ workers × 16 vCPU / 64 GB
   - What's unclear: Whether the HCP calculator should expose node spec as a user input or derive it from the hosted cluster count
   - Recommendation: Derive from hosted cluster count. When hcpHostedClusters × hcpCpuAtLoad > (workers × allocatable_cpu × 0.7), increase node spec from minimum to standard automatically. Show a warning if standard is insufficient.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest engine tests | Yes | v25.8.2 | — |
| npm | Package management | Yes | 11.11.1 | — |
| vitest | Unit testing (QA-01–03) | Yes | 4.1.2 | — |
| decimal.js | Engine arithmetic | Yes | 10.6.0 | — |
| zod | Input validation schemas | Yes | 4.3.6 | — |

All 11 existing Phase 1 tests pass (`vitest run`). No missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` (same — `vitest run`) |
| Environment | `node` (no DOM — enforces CALC-01) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENG-01 | All 8 TopologyType values compile; ClusterConfig includes WorkloadProfile | unit (types) | `npm run test` | ❌ Wave 0 |
| ENG-02 | `cpSizing(24)` → 4/16; `cpSizing(120)` → 8/32; `cpSizing(252)` → 16/64; `cpSizing(501)` → 16/96 | unit | `npm run test` | ❌ Wave 0 |
| ENG-03 | `workerCount()` returns max of cpu, ram, pod-density checks; min 2 | unit | `npm run test` | ❌ Wave 0 |
| ENG-04 | `allocatableRamGB(8)` ≈ 6.2; `allocatableRamGB(16)` ≈ 12.4; `allocatableRamGB(32)` ≈ 28.4 | unit | `npm run test` | ❌ Wave 0 |
| ENG-05 | Infra lookup: 27 workers → 4 CPU/24 GB; 120 → 8/48; 252 → 16/128 | unit | `npm run test` | ❌ Wave 0 |
| ENG-06 | `calcStandardHA({...minInputs})` returns CP nodes with vcpu≥4, ramGB≥16 | unit | `npm run test` | ❌ Wave 0 |
| ENG-07 | `calcOdf(1)` returns 3 nodes × 16 vCPU/64 GB; `calcOdf(2)` → 3 nodes × 18 vCPU/69 GB | unit | `npm run test` | ❌ Wave 0 |
| ENG-08 | `calcRhacm(100)` → 3 × 16/64; `calcRhacm(50)` → 3 × 8/32 | unit | `npm run test` | ❌ Wave 0 |
| ENG-09 | Engine files have zero Vue imports | unit (import scan in test or eslint rule) | `npm run test` | ❌ Wave 0 |
| REC-01 | `recommend({environment:'datacenter', haRequired:true, ...})` returns standard-ha first | unit | `npm run test` | ❌ Wave 0 |
| REC-02 | `recommend({environment:'far-edge', ...})` includes microshift or sno; `recommend({...airGapped:true})` excludes managed-cloud | unit | `npm run test` | ❌ Wave 0 |
| REC-03 | Every recommendation.justificationKey is a non-empty string that does not contain spaces | unit | `npm run test` | ❌ Wave 0 |
| QA-01 | All formula functions covered by tests above | unit | `npm run test` | ❌ Wave 0 |
| QA-02 | Recommendation engine covered | unit | `npm run test` | ❌ Wave 0 |
| QA-03 | Zod schema for ClusterConfig validates correctly (future — schema created in Phase 3) | unit | `npm run test` | ❌ Phase 3 |
| QA-05 | `calcStandardHA({workers:0})` → workers enforced to 2; SNO topology returns workerNodes null | unit | `npm run test` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test` (all 11 existing + new engine tests)
- **Per wave merge:** `npm run test` (same command)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps (test files to create)

- [ ] `src/engine/formulas.test.ts` — covers ENG-02, ENG-03, ENG-04, ENG-05
- [ ] `src/engine/calculators.test.ts` — covers ENG-06, QA-05 (minimums enforcement)
- [ ] `src/engine/addons.test.ts` — covers ENG-07, ENG-08
- [ ] `src/engine/recommendation.test.ts` — covers REC-01, REC-02, REC-03, QA-02
- [ ] `src/engine/validation.test.ts` — covers ENG-09 (no Vue imports), topology constraint rules

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/hardware-sizing.md` — CP scaling table, allocatable RAM formula, all topology minimums, ODF sizing, HCP scaling, infra sizing (directly from openshift-docs sources)
- `.planning/research/app-architecture.md` — vcf-sizer engine patterns, decimal.js requirement, validation pattern, test patterns
- `src/engine/types.ts` — Phase 1 definitions (direct source read)
- `src/engine/defaults.ts` — Phase 1 factory function (direct source read)
- `/Users/fjacquet/Projects/vcf-sizer/src/engine/compute.ts` — arithmetic pattern, Decimal.js usage
- `/Users/fjacquet/Projects/vcf-sizer/src/engine/validation.ts` — validation pattern, constants, i18n keys
- `/Users/fjacquet/Projects/vcf-sizer/src/engine/management.ts` — constants-as-readonly-objects pattern
- `vitest.config.ts` — confirmed test runner, `node` environment, include patterns

### Secondary (MEDIUM confidence)

- hardware-sizing.md section 5.2 RHACM hub sizing — sourced from `github.com/stolostron/capacity-planning` (MEDIUM — community tool, not official RH doc)
- SNO edge profile (8 vCPU / 32 GB) — project decision, no official Red Hat "edge" sub-profile specification

### Tertiary (LOW confidence)

- OVN-Kubernetes overhead claim — documented in hardware-sizing.md but exact thresholds are from OCP docs that may have updated; LOW until verified against current openshift-docs `master-node-sizing.adoc`

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — packages confirmed installed and working
- Architecture: HIGH — directly cloned from production vcf-sizer patterns with source code verification
- Sizing formulas: HIGH — hardware-sizing.md sourced from official openshift-docs adoc files
- Pitfalls: HIGH — derived from hardware-sizing.md section 7 and vcf-sizer architecture doc section 12
- Recommendation engine: MEDIUM — ranking logic is inferred from topology constraints, no official Red Hat "sizing advisor" algorithm to verify against

**Research date:** 2026-03-31
**Valid until:** 2026-06-30 (Red Hat sizing constants change with major OCP releases; verify against openshift-docs when OCP 4.21+ releases)
