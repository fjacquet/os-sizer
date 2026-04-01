# Architecture Research

**Domain:** OpenShift Virtualization + AI/GPU sizing extension to an existing OpenShift sizer
**Researched:** 2026-04-01
**Confidence:** HIGH (based on direct source code analysis + MEDIUM for sizing constants from official docs)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Vue 3 UI Layer                           │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │  Wizard      │  │  Results     │  │  Shared Components    │   │
│  │  Step1-3     │  │  BomTable    │  │  NumberSliderInput    │   │
│  │  Step3:NEW   │  │  BomTable:   │  │  WarningBanner        │   │
│  │  VirtInputs  │  │  GPU rows    │  │  WizardStepper        │   │
│  │  GpuInputs   │  │  Virt rows   │  │                       │   │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────┘   │
│         │                 │                                       │
├─────────┴─────────────────┴───────────────────────────────────────┤
│                       Pinia Store Layer                          │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌───────────────────────────────────┐  │
│  │  inputStore          │  │  calculationStore                 │  │
│  │  clusters[]          │  │  clusterResults[] (computed)      │  │
│  │  ClusterConfig:NEW   │  │  recommendations[] (computed)     │  │
│  │  + VirtConfig        │  │  → calcCluster() per cluster      │  │
│  │  + GpuConfig         │  │  → recommend() per cluster        │  │
│  └──────────────────────┘  └───────────────────────────────────┘  │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                       Engine Layer (zero Vue)                    │
├───────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌─────────────────┐  ┌──────────┐  ┌───────────┐  │
│  │ types.ts │  │  calculators.ts │  │ addons.ts│  │ constants │  │
│  │ NEW:     │  │  calcCluster()  │  │ calcODF()│  │ NEW:      │  │
│  │ VirtConf │  │  NEW: calcVirt()│  │ NEW:     │  │ VIRT_*    │  │
│  │ GpuConf  │  │  mod: calcSNO() │  │ calcGpu  │  │ GPU_*     │  │
│  │ TopType  │  │  NEW: case virt │  │ Nodes()  │  │ SNO_VIRT_ │  │
│  │ +virt    │  │  calcGpuNodes() │  │ calcRHOAI│  │ RHOAI_*   │  │
│  │ ClustCfg │  │                 │  │ Workers()│  │           │  │
│  │ +virtCfg │  │                 │  │          │  │           │  │
│  │ +gpuCfg  │  │                 │  │          │  │           │  │
│  └──────────┘  └─────────────────┘  └──────────┘  └───────────┘  │
│  ┌──────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ defaults │  │  recommendation │  │  validation.ts           │  │
│  │ +virt/   │  │  +scoreVirt()   │  │  +GPU passthrough blocks  │  │
│  │  gpu defs│  │  +virt in list  │  │   live migration          │  │
│  └──────────┘  └─────────────────┘  │  +RWX required for virt  │  │
│                                     │  +RHOAI req >= 2 workers  │  │
│                                     └──────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New vs Modified |
|-----------|----------------|-----------------|
| `types.ts` | All data shapes; TopologyType union; ClusterConfig; ClusterSizing | **MODIFIED** — add VirtConfig, GpuConfig, extend AddOnConfig, extend ClusterConfig, extend ClusterSizing |
| `constants.ts` | Hardware minimums as readonly constants | **MODIFIED** — add VIRT_WORKER_MIN, SNO_VIRT_MIN, GPU_NODE_*, RHOAI_* constants |
| `calculators.ts` | Dispatch + topology calculators | **MODIFIED** — add calcVirt(), calcGpuNodes() helper, modify calcSNO() for virt profile, extend calcCluster() switch |
| `addons.ts` | Post-dispatch add-on sizing (ODF, RHACM) | **MODIFIED** — add calcRHOAIWorkers(), calcGpuNodePool() |
| `defaults.ts` | Default ClusterConfig factory | **MODIFIED** — add virtConfig, gpuConfig defaults |
| `recommendation.ts` | Score + rank topologies | **MODIFIED** — add 'virt' to topologies[], add scoreVirt() |
| `validation.ts` | Cross-field warnings | **MODIFIED** — add GPU passthrough + live migration warning, RWX required warning, RHOAI node count check |
| `index.ts` (barrel) | Public engine API exports | **MODIFIED** — export calcVirt, calcGpuNodes, calcRHOAIWorkers, calcGpuNodePool |
| `Step3ArchitectureForm.vue` | Topology picker + topology-specific inputs | **MODIFIED** — add 'virt' to topologyLabelMap and allTopologies, add VirtInputsSection, GpuConfigSection |
| `BomTable.vue` | Node rows per ClusterSizing | **MODIFIED** — add gpuNodes row, virtStorage row |
| `inputStore.ts` | Reactive clusters[] array | **MODIFIED** — VirtConfig and GpuConfig are part of ClusterConfig, no store change needed |
| `calculationStore.ts` | Computed clusterResults | **MODIFIED** — pass virt/gpu flags to recommend() constraints |

---

## Recommended Project Structure

```
src/
├── engine/
│   ├── types.ts          # MODIFIED: VirtConfig, GpuConfig, GpuMode, extended ClusterConfig/ClusterSizing
│   ├── constants.ts      # MODIFIED: VIRT_WORKER_MIN, SNO_VIRT_MIN, GPU_NODE_*, RHOAI_* constants
│   ├── calculators.ts    # MODIFIED: calcVirt(), modified calcSNO(), extended calcCluster() switch
│   ├── addons.ts         # MODIFIED: calcGpuNodePool(), calcRHOAIWorkers()
│   ├── defaults.ts       # MODIFIED: virtConfig + gpuConfig in createDefaultClusterConfig()
│   ├── recommendation.ts # MODIFIED: 'virt' in topologies[], scoreVirt()
│   ├── validation.ts     # MODIFIED: GPU passthrough warning, RWX storage warning, RHOAI minimum
│   ├── formulas.ts       # NO CHANGE — existing worker/CP formulas reused by calcVirt()
│   └── index.ts          # MODIFIED: new exports
├── stores/
│   ├── inputStore.ts     # NO CHANGE — ClusterConfig shape change flows automatically
│   └── calculationStore.ts # MODIFIED: pass virtEnabled/gpuEnabled to recommend()
├── components/
│   ├── wizard/
│   │   ├── Step3ArchitectureForm.vue   # MODIFIED: add virt to topology list + sub-inputs
│   │   └── VirtConfigSection.vue       # NEW: virt worker config, VM count, ODF RWX checkbox
│   │   └── GpuConfigSection.vue        # NEW: GPU count, type, mode (container/passthrough/vGPU/MIG)
│   └── results/
│       └── BomTable.vue                # MODIFIED: gpuNodes row, virtStorage annotation row
```

### Structure Rationale

- **Engine stays zero-Vue:** All new types, constants, calculators follow the CALC-01 constraint — no Vue imports in `engine/`. This preserves testability with plain Vitest.
- **New sub-components for virt/GPU inputs:** Step3 is already 188 lines. Adding virt + GPU inline would make it unmaintainable. Extract `VirtConfigSection.vue` and `GpuConfigSection.vue` as scoped sub-components rendered conditionally inside Step3.
- **addons.ts gets GPU/RHOAI:** The post-dispatch add-on pattern (established for ODF/RHACM) is the right home for GPU node pool sizing and RHOAI worker sizing. They are add-ons applied after topology dispatch, not separate topologies.
- **ClusterSizing gets new node pool fields:** `gpuNodes` and (optionally) `virtStorageNodes` follow the same optional `NodeSpec | null` pattern as `odfNodes` and `rhacmWorkers`. BomTable already handles this pattern with null checks.

---

## Architectural Patterns

### Pattern 1: Topology Calculator — Pure Function returning `{ sizing, warnings }`

**What:** Each topology is a pure function `(config: ClusterConfig) => { sizing: ClusterSizing; warnings: ValidationWarning[] }`. No side effects, no Vue reactivity.

**When to use:** For `calcVirt()` — exactly the same signature as `calcStandardHA()`. The 'virt' topology is Standard HA with KubeVirt overhead added to worker nodes and ODF RWX required.

**Trade-offs:** Simple to test, simple to reason about. Coupling to `ClusterConfig` means new fields (virtConfig, gpuConfig) must be added to the shared config type rather than having separate per-topology config objects.

**Example:**
```typescript
// calcVirt() follows the same signature as calcStandardHA()
export function calcVirt(config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  // Step 1: standard HA sizing
  const base = calcStandardHA(config)
  // Step 2: boost worker nodes for KubeVirt overhead
  //   KubeVirt overhead = 2 vCPU baseline + (1.002 * vmRamGB) + 146 MiB + 8 MiB * vCPUs
  //   Minimum virt worker: 16 vCPU, 64 GB RAM (bare metal class)
  // Step 3: force odfEnabled=true (RWX required for live migration)
  // Step 4: return warnings if GPU passthrough + live migration enabled
  return { sizing, warnings }
}
```

### Pattern 2: Post-Dispatch Add-On Augmentation

**What:** After topology dispatch in `calcCluster()`, the sizing is augmented with add-on node pools. Existing pattern handles ODF and RHACM. GPU nodes and RHOAI workers extend this same post-dispatch block.

**When to use:** For GPU node pools and RHOAI workers. These are add-ons that overlay on top of any topology, not a topology variant themselves.

**Trade-offs:** Clean separation. A 'standard-ha' cluster with GPU + RHOAI enabled follows the same code path as one without — the topology calculator focuses on topology, the add-on block handles optional overlays. The totals recalculation at the end must include all new node pools.

**Example:**
```typescript
// In calcCluster() post-dispatch block (extension of existing pattern):
if (config.addOns.rhOaiEnabled) {
  sizing.rhoaiWorkers = calcRHOAIWorkers(config.addOns.rhOaiGpuCount)
}
if (config.gpuConfig?.enabled) {
  sizing.gpuNodes = calcGpuNodePool(config.gpuConfig)
}
// Recalculate totals to include all new pools
sizing.totals = sumTotals([
  sizing.masterNodes, sizing.workerNodes, sizing.infraNodes,
  sizing.odfNodes, sizing.rhacmWorkers, sizing.rhoaiWorkers, sizing.gpuNodes,
])
```

### Pattern 3: SNO Profile Extension (Additive, Not Fork)

**What:** `calcSNO()` uses a `profileMap` keyed by `config.snoProfile`. Adding a `'virt'` SNO profile means adding one entry to the profileMap and one constant to `constants.ts`. The switch case in `calcCluster()` does not change — `calcSNO()` handles all SNO variants.

**When to use:** For the SNO-with-Virt profile (boosted minimums: 8 vCPU, 120 GB root + 50 GB virt storage, 32 GB RAM minimum). This is not a separate topology — it is SNO with a virt-capable hardware minimum.

**Trade-offs:** Low-change-surface. Only `constants.ts` (new constant), `types.ts` (extend `SnoProfile` union), `defaults.ts` (update default if needed), and the `profileMap` in `calcSNO()`. No change to the dispatcher.

**Example:**
```typescript
// In types.ts:
export type SnoProfile = 'standard' | 'edge' | 'telecom-vdu' | 'virt'

// In constants.ts:
export const SNO_VIRT_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 8, ramGB: 32, storageGB: 170 }
// 170 GB = 120 GB root + 50 GB virt storage — aligns with Red Hat guidance

// In calcSNO() profileMap:
const profileMap = {
  'standard': SNO_STD_MIN,
  'edge': SNO_EDGE_MIN,
  'telecom-vdu': SNO_TELECOM_MIN,
  'virt': SNO_VIRT_MIN,   // NEW
}
```

### Pattern 4: GpuMode Type + Per-Mode NodeSpec

**What:** GPU nodes are not a topology — they are a typed configuration producing a `NodeSpec`. Four modes exist with distinct constraints:

| Mode | Live Migration | Bare Metal Required | vGPU Manager | Notes |
|------|---------------|--------------------|-----------|-|
| `container` | Yes (no GPU) | No | No | Standard container GPU — NVIDIA GPU Operator only |
| `passthrough` | **NO** | Yes | No | VFIO-PCI; each VM owns the physical GPU |
| `vgpu` | Yes (NVIDIA mediated) | Yes | Yes (NVIDIA vGPU Manager) | MxGPU or NVIDIA vGPU license required |
| `mig` | Partition-dependent | Yes (A100/H100 only) | No | MIG for A30/A100/A100X/H100/H200/H800 |

**When to use:** GpuMode drives both the NodeSpec sizing (passthrough needs more RAM per GPU) and validation warnings (passthrough blocks live migration).

**Example:**
```typescript
// In types.ts:
export type GpuMode = 'container' | 'passthrough' | 'vgpu' | 'mig'

export interface GpuConfig {
  enabled: boolean
  gpuCount: number           // number of GPU nodes
  gpusPerNode: number        // GPUs per node (typically 1-8)
  gpuType: string            // 'A100-80GB', 'H100-80GB', 'L40S', etc. (informational)
  mode: GpuMode
  migProfile?: string        // '1g.10gb', '2g.20gb', etc. — only when mode='mig'
}
```

---

## Data Flow

### Request Flow: User changes topology to 'virt'

```
Step3ArchitectureForm.vue
  → selectTopology('virt')
  → inputStore.updateCluster(id, { topology: 'virt' })
  → calculationStore.clusterResults (computed, auto-recalcs)
  → calcCluster({ topology: 'virt', ... })
  → case 'virt': calcVirt(config)  [NEW]
  → post-dispatch: calcGpuNodePool() if gpuConfig.enabled  [NEW]
  → post-dispatch: calcRHOAIWorkers() if addOns.rhOaiEnabled  [NEW]
  → sumTotals([...all node pools including gpuNodes, rhoaiWorkers])
  → SizingResult.sizing → BomTable renders GPU row, virt storage annotation
```

### Request Flow: GPU passthrough + live migration warning

```
validateInputs(config)
  → if gpuConfig.mode === 'passthrough' && topology === 'virt'
  → push ValidationWarning { code: 'VIRT_GPU_PASSTHROUGH_BLOCKS_MIGRATION', severity: 'warning' }
  → SizingResult.validationErrors
  → WarningBanner in ResultsPage renders the warning
```

### State Management

```
inputStore.clusters[] (ref<ClusterConfig[]>)
  ↓ reactive, auto-triggers computed
calculationStore.clusterResults (computed<SizingResult[]>)
  ← calcCluster(cluster)   ← engine/calculators.ts
  ← recommend(constraints) ← engine/recommendation.ts
  ← validateInputs(cluster) ← engine/validation.ts
  ↓ passed as props
ResultsPage.vue
  → BomTable (result.sizing — reads gpuNodes, rhoaiWorkers as optional rows)
  → WarningBanner (result.validationErrors)
```

### Key Data Flows

1. **New type fields flow automatically:** `ClusterConfig` gains `virtConfig: VirtConfig` and `gpuConfig: GpuConfig`. `inputStore.updateCluster()` uses `Object.assign()`, so partial patches work for any field. No store surgery required.

2. **ClusterSizing gains optional pools:** `gpuNodes: NodeSpec | null` and `rhoaiWorkers: NodeSpec | null` follow the existing null-field pattern. `BomTable.vue` already conditionally renders rows with `v-if`, so adding two more is a minimal change.

3. **Totals recalculation:** The `sumTotals()` helper in `calculators.ts` accepts `Array<NodeSpec | null>` and skips nulls. Adding `gpuNodes` and `rhoaiWorkers` to the array at the bottom of `calcCluster()` is the only totals change needed.

---

## Integration Points

### New vs Modified: Explicit Mapping

#### Types (`src/engine/types.ts`) — MODIFIED

**Add:**
```typescript
export type TopologyType = ... | 'virt'          // 9th topology
export type SnoProfile = ... | 'virt'            // 4th profile
export type GpuMode = 'container' | 'passthrough' | 'vgpu' | 'mig'

export interface VirtConfig {
  vmCount: number            // estimated concurrent VMs (drives worker sizing)
  avgVmVcpu: number          // avg vCPUs per VM (default 2)
  avgVmRamGB: number         // avg RAM per VM (default 4)
  rwxStorageEnabled: boolean // true = flag that RWX storage class is available
}

export interface GpuConfig {
  enabled: boolean
  gpuCount: number
  gpusPerNode: number
  gpuType: string
  mode: GpuMode
  migProfile?: string
}
```

**Extend `AddOnConfig`:**
```typescript
export interface AddOnConfig {
  // ... existing fields ...
  rhOaiEnabled: boolean       // NEW
  rhOaiGpuCount: number       // NEW — GPU nodes dedicated to RHOAI (default 0)
}
```

**Extend `ClusterConfig`:**
```typescript
export interface ClusterConfig {
  // ... existing fields ...
  virtConfig: VirtConfig      // NEW — only used when topology === 'virt' or snoProfile === 'virt'
  gpuConfig: GpuConfig        // NEW — add-on, independent of topology
}
```

**Extend `ClusterSizing`:**
```typescript
export interface ClusterSizing {
  // ... existing fields ...
  gpuNodes: NodeSpec | null    // NEW — GPU node pool (container/passthrough/vGPU/MIG)
  rhoaiWorkers: NodeSpec | null // NEW — RHOAI dedicated worker nodes
}
```

#### Constants (`src/engine/constants.ts`) — MODIFIED

**Add:**
```typescript
// OpenShift Virtualization worker minimums (bare metal class)
// Source: Red Hat OpenShift Virtualization Installation docs
// Workers hosting VMs require minimum 2 extra vCPU overhead + per-VM overhead
export const VIRT_WORKER_MIN: Readonly<NodeSpec> = { count: 3, vcpu: 16, ramGB: 64, storageGB: 200 }
// 16 vCPU / 64 GB RAM = minimum for VM-density workloads per Red Hat sizing guide

// SNO-with-Virt minimum (boosted for KubeVirt + VM storage)
// Source: PROJECT.md requirement — 8 vCPU, 120 GB root + 50 GB virt storage
export const SNO_VIRT_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 8, ramGB: 32, storageGB: 170 }

// KubeVirt memory overhead formula parameters
// Source: Red Hat OCP docs — overhead = (1.002 * guestRAM) + 146 MiB + 8 MiB * vCPUs
export const KUBEVIRT_OVERHEAD_BASE_MIB = 146
export const KUBEVIRT_OVERHEAD_PER_VCPU_MIB = 8
export const KUBEVIRT_OVERHEAD_FACTOR = 1.002

// GPU node minimums by mode (passthrough/vGPU bare metal)
// Source: NVIDIA GPU Operator + OpenShift Virtualization docs
export const GPU_NODE_MIN_VCPU = 16
export const GPU_NODE_MIN_RAM_GB = 128   // 128 GB minimum for GPU passthrough/vGPU nodes
export const GPU_NODE_STORAGE_GB = 200
export const GPU_RAM_OVERHEAD_PER_DEVICE_GB = 1 // 1 GB per GPU per Red Hat docs (SR-IOV/GPU)

// RHOAI operator minimum worker requirements
// Source: Red Hat OpenShift AI Self-Managed 3.3 docs — 2 workers, 8 CPU / 32 GB each
export const RHOAI_WORKER_MIN_COUNT = 2
export const RHOAI_WORKER_VCPU = 16     // recommend 16 (docs say 8 minimum; 16 for real workloads)
export const RHOAI_WORKER_RAM_GB = 64   // recommend 64 (docs say 32 minimum; 64 for real workloads)
export const RHOAI_WORKER_STORAGE_GB = 200
```

#### Calculators (`src/engine/calculators.ts`) — MODIFIED

**Add `calcVirt()`:**

Strategy: Base on Standard HA, but:
1. Boost worker node RAM to account for KubeVirt overhead per VM: `overhead = (1.002 * avgVmRamGB) + 0.146 + 0.008 * avgVmVcpu` (GB) per VM
2. Worker count driven by both container pods AND VM overhead (use max)
3. Minimum worker spec: `VIRT_WORKER_MIN` (16 vCPU / 64 GB / 200 GB)
4. Force `odfNodes` to be populated (RWX required for live migration — warn if `virtConfig.rwxStorageEnabled === false`)
5. Return `VIRT_LIVE_MIGRATION_RWX_REQUIRED` warning if no RWX storage class flagged

**Modify `calcSNO()`:**

Add `'virt': SNO_VIRT_MIN` to the `profileMap`. No other change.

**Extend `calcCluster()` switch:**

Add `case 'virt': result = calcVirt(config); break` before the default. Add `rhoaiWorkers` and `gpuNodes` to the post-dispatch augmentation block.

#### Add-ons (`src/engine/addons.ts`) — MODIFIED

**Add `calcGpuNodePool(gpuConfig: GpuConfig): NodeSpec`:**

- `count` = `gpuConfig.gpuCount`
- `vcpu` = `max(GPU_NODE_MIN_VCPU, gpuConfig.gpusPerNode * 8)` — 8 vCPU per GPU is typical host ratio
- `ramGB` = `max(GPU_NODE_MIN_RAM_GB, gpuConfig.gpusPerNode * GPU_RAM_OVERHEAD_PER_DEVICE_GB * 16 + base)` — GPU passthrough and vGPU modes need more RAM
- `storageGB` = `GPU_NODE_STORAGE_GB`

**Add `calcRHOAIWorkers(gpuCount: number): NodeSpec`:**

- `count` = `max(RHOAI_WORKER_MIN_COUNT, gpuCount)` — at least 2, at least one per GPU node if GPU-enabled
- `vcpu` = `RHOAI_WORKER_VCPU`
- `ramGB` = `RHOAI_WORKER_RAM_GB`
- `storageGB` = `RHOAI_WORKER_STORAGE_GB`

#### Validation (`src/engine/validation.ts`) — MODIFIED

**Add three new checks:**

1. **GPU passthrough blocks live migration:**
   ```
   if gpuConfig.mode === 'passthrough' && topology === 'virt'
   → WARN: VIRT_GPU_PASSTHROUGH_BLOCKS_MIGRATION (severity: 'warning')
   ```

2. **Virt topology requires RWX storage:**
   ```
   if topology === 'virt' && !virtConfig.rwxStorageEnabled
   → WARN: VIRT_RWX_STORAGE_REQUIRED (severity: 'warning')
   ```

3. **RHOAI on SNO/MicroShift insufficient:**
   ```
   if rhOaiEnabled && ['sno', 'microshift'].includes(topology)
   → WARN: RHOAI_TOPOLOGY_INSUFFICIENT (severity: 'warning')
     unless snoProfile === 'virt' (SNO-virt has sufficient resources)
   ```

#### Recommendation Engine (`src/engine/recommendation.ts`) — MODIFIED

**Add `'virt'` to topologies array and add `scoreVirt()`:**

Scoring rationale:
- Base score: 65 (similar to standard-ha, designed for datacenter VM workloads)
- `+20` if environment is 'datacenter' (virt is a datacenter pattern)
- `+15` if `addOns.virt === true` (explicit virt workload signal)
- `-40` if `haRequired === false` (live migration requires HA — warn, not exclude)
- Hard exclusion (score=0): if environment is 'far-edge' or 'microshift' context

**Extend `RecommendationConstraints`:**

Add `addOns.virt: boolean` to the constraints interface so the calculationStore can pass the signal.

#### Step3ArchitectureForm.vue — MODIFIED

**Changes:**
1. Add `'virt'` to `topologyLabelMap` and `allTopologies` array
2. Add `<VirtConfigSection>` rendered `v-if="topology === 'virt' || snoProfile === 'virt'"`
3. Add `<GpuConfigSection>` rendered always (GPU is topology-agnostic add-on) when `addOns.rhOaiEnabled` or `gpuConfig.enabled`

**New sub-components:**

`VirtConfigSection.vue` — scoped to wizard:
- VM count slider (1–500)
- Avg VM vCPU (1–16)
- Avg VM RAM GB (1–128)
- RWX storage class available toggle
- Live-migration info note

`GpuConfigSection.vue` — scoped to wizard:
- GPU node count slider (1–32)
- GPUs per node slider (1–8)
- GPU type text input (informational: "A100-80GB")
- GPU mode selector: container / passthrough / vGPU / MIG
- MIG profile input (shown if mode=mig)
- Warning banner if mode=passthrough (live migration blocked)

#### BomTable.vue — MODIFIED

**Add two conditional rows:**
```typescript
if (s.gpuNodes) entries.push({ labelKey: 'node.gpu', spec: s.gpuNodes })
if (s.rhoaiWorkers) entries.push({ labelKey: 'node.rhoaiWorkers', spec: s.rhoaiWorkers })
```

The existing `v-for` over `rows` renders them automatically — the template does not change, only the `rows` computed property does.

---

## Build Order

The dependency graph dictates this order. Each layer depends only on layers above it in this list.

### Phase 1: Types and Constants (no dependencies within project)

1. `src/engine/types.ts` — add `GpuMode`, `VirtConfig`, `GpuConfig`; extend `TopologyType`, `SnoProfile`, `AddOnConfig`, `ClusterConfig`, `ClusterSizing`
2. `src/engine/constants.ts` — add `VIRT_WORKER_MIN`, `SNO_VIRT_MIN`, `KUBEVIRT_OVERHEAD_*`, `GPU_NODE_*`, `RHOAI_WORKER_*` constants

**Why first:** Everything else imports from types and constants. Zero risk of circular imports.

### Phase 2: Engine Calculators and Add-ons (depends on Phase 1)

3. `src/engine/addons.ts` — add `calcGpuNodePool()`, `calcRHOAIWorkers()`
4. `src/engine/calculators.ts` — add `calcVirt()`, modify `calcSNO()` (virt profile), extend `calcCluster()` switch + post-dispatch block
5. `src/engine/defaults.ts` — extend `createDefaultClusterConfig()` with `virtConfig`, `gpuConfig` defaults, extend `addOns` with `rhOaiEnabled`, `rhOaiGpuCount`

**Why second:** Calculator functions must compile against updated types. Defaults must match updated ClusterConfig shape.

### Phase 3: Validation and Recommendation (depends on Phase 1 + 2)

6. `src/engine/validation.ts` — add GPU passthrough/live migration warning, RWX required warning, RHOAI on SNO warning
7. `src/engine/recommendation.ts` — add `'virt'` to topology list, add `scoreVirt()`, extend `RecommendationConstraints` with `addOns.virt`

**Why third:** Validation and recommendation reference types and constants but not the calculators themselves.

### Phase 4: Store Updates (depends on Phase 1–3)

8. `src/stores/calculationStore.ts` — pass `virt: cluster.addOns.virtEnabled` in the `addOns` object passed to `recommend()` (mirrors existing `odf`, `rhacm` pattern)
9. `src/engine/index.ts` — add barrel exports for `calcVirt`, `calcGpuNodePool`, `calcRHOAIWorkers`, `GpuMode`, `VirtConfig`, `GpuConfig`

**Why fourth:** Stores depend on the entire engine being stable.

### Phase 5: UI Components (depends on Phase 1–4)

10. `src/components/wizard/VirtConfigSection.vue` — NEW: VM sizing inputs
11. `src/components/wizard/GpuConfigSection.vue` — NEW: GPU node configuration inputs
12. `src/components/wizard/Step3ArchitectureForm.vue` — MODIFIED: add 'virt' to topology list, add VirtConfigSection and GpuConfigSection
13. `src/components/results/BomTable.vue` — MODIFIED: add `gpuNodes` and `rhoaiWorkers` rows
14. i18n key additions — all new `messageKey` values need strings in all 4 locales (EN/FR/IT/DE)

**Why last:** UI depends on store shape which depends on engine types being finalized.

### Phase 6: Tests (parallel to Phase 5 or after)

15. `src/engine/calculators.test.ts` — add calcVirt() tests, modified calcSNO() virt profile tests
16. `src/engine/addons.test.ts` — add calcGpuNodePool() and calcRHOAIWorkers() tests
17. `src/engine/validation.test.ts` — add GPU passthrough warning tests, RWX warning tests
18. `src/engine/recommendation.test.ts` — add scoreVirt() tests

**Test first for engine (TDD):** Per project decision (TDD for engine from v1.0), write engine tests before or alongside implementation.

---

## Anti-Patterns

### Anti-Pattern 1: Separate VirtClusterConfig Type

**What people do:** Create a `VirtClusterConfig extends ClusterConfig` or a separate store for virt clusters because the fields feel different.

**Why it's wrong:** The existing `inputStore.clusters[]` is `ClusterConfig[]`. The `calcCluster()` dispatcher takes `ClusterConfig`. Introducing a subtype breaks the uniform dispatch pattern, requires type guards everywhere, and duplicates the store logic. The existing pattern — all clusters have all fields, topology-specific fields are ignored by non-relevant calculators — is correct.

**Do this instead:** Add `virtConfig` and `gpuConfig` directly to `ClusterConfig` with sensible defaults in `createDefaultClusterConfig()`. Non-virt topologies ignore `virtConfig`. Non-GPU clusters have `gpuConfig.enabled = false`. Follow the existing pattern of `hcpHostedClusters` being present in all configs but only used by the HCP calculator.

### Anti-Pattern 2: GPU as a Topology Instead of an Add-on

**What people do:** Add `'gpu-standard-ha'`, `'gpu-hcp'` as separate topology values because GPU nodes feel like a different kind of cluster.

**Why it's wrong:** GPU nodes are orthogonal to topology. A standard-ha cluster, a compact-3node cluster, or an HCP cluster can all have GPU workers. Adding a topology per GPU type explodes the combination space (8 topologies × 4 GPU modes = 32 topology values) and duplicates all topology sizing logic.

**Do this instead:** GPU nodes are a post-dispatch add-on in `calcCluster()` — the same pattern as ODF and RHACM. `gpuConfig.enabled` triggers `calcGpuNodePool()` which returns a `NodeSpec` stored in `ClusterSizing.gpuNodes`.

### Anti-Pattern 3: Hardcoding Live Migration Warning in the UI

**What people do:** Add the passthrough/live migration warning directly in `Step3ArchitectureForm.vue` or `GpuConfigSection.vue` because it feels like a UI concern.

**Why it's wrong:** The warning belongs in `validation.ts` so it surfaces in `SizingResult.validationErrors` and flows through the export pipeline (PPTX/PDF exports include validation warnings). Hard-coded UI warnings are invisible to exports and tests.

**Do this instead:** Add to `validateInputs()`. Render via the existing `WarningBanner` component in `ResultsPage.vue` which already consumes `result.validationErrors`. Keep one validation code path.

### Anti-Pattern 4: Modifying `sumTotals()` for GPU Nodes

**What people do:** Add special GPU-aware totals logic because GPU nodes have unusual specs.

**Why it's wrong:** `sumTotals()` already accepts `Array<NodeSpec | null>` and sums them correctly regardless of what the numbers represent. It does not need to know about GPU semantics.

**Do this instead:** Add `sizing.gpuNodes` and `sizing.rhoaiWorkers` to the array passed to `sumTotals()` in the recalculation block at the end of `calcCluster()`. No other change needed.

---

## Scaling Considerations

This is a client-side web application. Scaling concerns are about calculation complexity, not server load.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (8 topologies, 2 add-ons) | Single `calcCluster()` dispatcher — fine |
| v2.0 (9 topologies, 4 add-ons + GPU) | Same dispatcher pattern — no issues expected |
| v2.1+ (multi-cluster comparison, air-gap) | Consider memoizing `calcCluster()` if users add 10+ clusters; still a computed() — likely fine |

The `clusterResults` computed in `calculationStore` recalculates all clusters on any input change. With <10 clusters and pure TypeScript arithmetic, this is negligible (<1 ms per cluster). No optimization needed.

---

## Sources

- Direct source code analysis: `src/engine/types.ts`, `calculators.ts`, `addons.ts`, `constants.ts`, `recommendation.ts`, `validation.ts`, `defaults.ts` — HIGH confidence
- [NVIDIA GPU Operator with OpenShift Virtualization](https://docs.nvidia.com/datacenter/cloud-native/openshift/latest/openshift-virtualization.html) — GPU modes, live migration constraints, node labeling — MEDIUM confidence
- [Red Hat OpenShift AI Self-Managed 3.3 Installation](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.3/html/installing_and_uninstalling_openshift_ai_self-managed/installing-and-deploying-openshift-ai_install) — RHOAI worker minimums (2 workers × 8 CPU / 32 GB) — MEDIUM confidence
- [MIG Support in OpenShift Container Platform](https://docs.nvidia.com/datacenter/cloud-native/openshift/latest/mig-ocp.html) — MIG-compatible GPU types (A30/A100/H100/H200) — MEDIUM confidence
- [Memory management in OpenShift Virtualization (Red Hat Developer, Jan 2025)](https://developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization) — KubeVirt memory overhead formula — MEDIUM confidence
- KubeVirt overhead formula: `overhead = (1.002 * guestRAM) + 146 MiB + 8 MiB * vCPUs` — from multiple Red Hat OCP docs versions — MEDIUM confidence
- GPU passthrough blocks live migration: KVM/libvirt upstream constraint, confirmed by NVIDIA OCP docs note on node exclusivity — MEDIUM confidence
- SNO minimum specs (8 vCPU, 16 GB RAM, 120 GB storage) — confirmed by multiple sources — HIGH confidence
- SNO-with-Virt boosted minimums (8 vCPU, 32 GB RAM, 170 GB storage) — derived from PROJECT.md requirements + SNO standard minimum + 50 GB virt storage overhead — MEDIUM confidence (verify against Red Hat published SNO+Virt specs before finalizing constants)

---

*Architecture research for: OpenShift Virtualization + GPU/RHOAI integration into os-sizer v2.0*
*Researched: 2026-04-01*
