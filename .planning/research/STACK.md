# Stack Research

**Domain:** OpenShift Virtualization + RHOAI/GPU sizing additions to existing Vue 3 + TypeScript sizer
**Researched:** 2026-04-01
**Confidence:** MEDIUM — engine patterns are HIGH (derive directly from existing code); GPU/KubeVirt overhead numbers are MEDIUM (Red Hat docs behind paywall, community sources used)

---

## Existing Stack (DO NOT CHANGE)

The v1.0 stack is already installed and working. No core dependency changes are needed for v2.0.

| Technology | Installed Version | Role |
|------------|-------------------|------|
| Vue 3 | ^3.5.31 | UI framework |
| TypeScript | via vue-tsc ^3.2.6 | Type safety |
| Vite | ^8.0.3 | Build tool |
| Tailwind CSS v4 | ^4.2.2 | Styling |
| Pinia | ^3.0.4 | State management |
| vue-i18n | ^11.3.0 | Internationalization |
| Zod | ^4.3.6 | Schema validation + URL state |
| chart.js + vue-chartjs | ^4.5.1 + ^5.3.3 | Charts |
| pptxgenjs | ^4.0.1 | PPTX export |
| jsPDF + jspdf-autotable | ^4.2.1 + ^5.0.7 | PDF export |
| lz-string | ^1.5.0 | URL state compression |
| @vueuse/core | ^14.2.1 | Composable utilities |
| Vitest | ^4.1.2 | Testing |

---

## New Dependencies Required for v2.0

**Verdict: Zero new npm packages needed.** All v2.0 features extend the existing engine, schema, and UI patterns without requiring new libraries. The rationale for each potential addition is below.

---

## Engine Layer — New Constants and Calculators

### New Constants (src/engine/constants.ts additions)

All new constants follow the existing pattern: named exports, typed `NodeSpec` or plain numbers, sourced from Red Hat documentation.

**KubeVirt worker node overhead (MEDIUM confidence — Red Hat docs + community sources):**

```typescript
// OpenShift Virtualization worker node overhead
// Source: Red Hat docs — "2 additional cores + 10 GiB disk per node for OCP Virt management"
export const VIRT_OVERHEAD_CPU_PER_NODE = 2       // vCPU reserved per virt-enabled worker
export const VIRT_OVERHEAD_STORAGE_GB = 10         // disk for CNV components per node
export const VIRT_OVERHEAD_RAM_MB = 2179           // MiB total across all infra (spread, ~218 MiB per component)

// Per-VM overhead formula constants (KubeVirt virt-launcher pod overhead)
// Source: Red Hat memory management doc — overhead ≈ 218 MiB + 8 MiB×vCPUs + 16 MiB×GPUs
export const VIRT_VM_OVERHEAD_BASE_MIB = 218
export const VIRT_VM_OVERHEAD_PER_VCPU_MIB = 8
export const VIRT_VM_OVERHEAD_PER_GPU_MIB = 16

// SNO-with-Virt boosted minimum
// Source: Red Hat SNO docs — base SNO std (8 vCPU, 16 GB, 120 GB) + 50 GB additional virt disk
export const SNO_VIRT_STORAGE_EXTRA_GB = 50        // additional disk for VM hostpath-provisioner

// ODF RWX for live migration: existing ODF_MIN_* constants already apply
// No new ODF constants needed — ODF nodes are sized the same way
```

**RHOAI operator overhead (MEDIUM confidence — community sources, not official sizing doc):**

```typescript
// RHOAI operator minimum worker node requirements
// Source: Red Hat RHOAI 3.x docs — minimum 2 worker nodes × 8 CPU / 32 GB RAM each
export const RHOAI_MIN_WORKER_NODES = 2
export const RHOAI_MIN_WORKER_VCPU = 8
export const RHOAI_MIN_WORKER_RAM_GB = 32
// Overhead above base workers (reserved for RHOAI pods — odh-dashboard, model-registry, etc.)
export const RHOAI_OVERHEAD_VCPU = 4               // ~4 vCPU reserved across RHOAI components
export const RHOAI_OVERHEAD_RAM_GB = 16            // ~16 GB RAM for RHOAI operator pods
```

**GPU node profiles (HIGH confidence — NVIDIA official MIG documentation):**

```typescript
// GPU worker node modes — one mode per node (cannot mix)
// Source: NVIDIA GPU Operator docs — "container | vm-passthrough | vm-vgpu" per node label
export type GpuMode = 'container' | 'passthrough' | 'vgpu' | 'mig'

// GPU node minimum specs (per node, beyond standard worker minimum)
// Source: Red Hat hardware accelerators docs — GPU node needs standard worker spec
export const GPU_MIN_WORKER_VCPU = 16              // minimum for GPU workloads
export const GPU_MIN_WORKER_RAM_GB = 64            // minimum for GPU workloads (VRAM headroom)

// MIG profile definitions — max instances per GPU card
// Source: NVIDIA MIG User Guide (docs.nvidia.com/datacenter/tesla/mig-user-guide)
// Profile name → max instances per physical GPU
export const MIG_PROFILES = {
  // A100-40GB
  'a100-40gb-1g.5gb':  { gpuModel: 'A100-40GB', slicesPerGpu: 7,  memGb: 5  },
  'a100-40gb-2g.10gb': { gpuModel: 'A100-40GB', slicesPerGpu: 3,  memGb: 10 },
  'a100-40gb-3g.20gb': { gpuModel: 'A100-40GB', slicesPerGpu: 2,  memGb: 20 },
  'a100-40gb-7g.40gb': { gpuModel: 'A100-40GB', slicesPerGpu: 1,  memGb: 40 },
  // A100-80GB
  'a100-80gb-1g.10gb': { gpuModel: 'A100-80GB', slicesPerGpu: 7,  memGb: 10 },
  'a100-80gb-2g.20gb': { gpuModel: 'A100-80GB', slicesPerGpu: 3,  memGb: 20 },
  'a100-80gb-3g.40gb': { gpuModel: 'A100-80GB', slicesPerGpu: 2,  memGb: 40 },
  'a100-80gb-7g.80gb': { gpuModel: 'A100-80GB', slicesPerGpu: 1,  memGb: 80 },
  // H100-80GB
  'h100-80gb-1g.10gb': { gpuModel: 'H100-80GB', slicesPerGpu: 7,  memGb: 10 },
  'h100-80gb-2g.20gb': { gpuModel: 'H100-80GB', slicesPerGpu: 3,  memGb: 20 },
  'h100-80gb-3g.40gb': { gpuModel: 'H100-80GB', slicesPerGpu: 2,  memGb: 40 },
  'h100-80gb-7g.80gb': { gpuModel: 'H100-80GB', slicesPerGpu: 1,  memGb: 80 },
  // H200-141GB
  'h200-141gb-1g.18gb': { gpuModel: 'H200-141GB', slicesPerGpu: 7, memGb: 18 },
  'h200-141gb-2g.35gb': { gpuModel: 'H200-141GB', slicesPerGpu: 3, memGb: 35 },
  'h200-141gb-7g.141gb': { gpuModel: 'H200-141GB', slicesPerGpu: 1, memGb: 141 },
} as const
```

---

## Type System — New Types (src/engine/types.ts additions)

Follow the existing zero-Vue-imports pattern. All additions are pure TypeScript.

### New union types

```typescript
// GPU operating mode — one per dedicated node pool
// Source: NVIDIA GPU Operator — node label nvidia.com/gpu.workload.config
export type GpuMode = 'container' | 'passthrough' | 'vgpu' | 'mig'

// MIG profile key — corresponds to keys in MIG_PROFILES constant
export type MigProfile = keyof typeof MIG_PROFILES
```

### AddOnConfig extensions

The existing `AddOnConfig` interface gains new optional fields:

```typescript
export interface AddOnConfig {
  // ... existing fields unchanged ...
  odfEnabled: boolean
  odfExtraOsdCount: number
  infraNodesEnabled: boolean
  rhacmEnabled: boolean
  rhacmManagedClusters: number

  // NEW for v2.0
  virtEnabled: boolean             // OpenShift Virtualization / CNV
  virtVmCount: number              // total VMs to host across cluster
  virtAvgVmVcpu: number            // average vCPU per VM (for density sizing)
  virtAvgVmRamGB: number           // average RAM per VM (for density sizing)
  rhoaiEnabled: boolean            // RHOAI operator add-on
  gpuEnabled: boolean              // GPU node pool
  gpuNodeCount: number             // number of dedicated GPU nodes
  gpuMode: GpuMode                 // container | passthrough | vgpu | mig
  gpuPerNode: number               // physical GPUs per node
  migProfile: string | null        // MIG profile key, null unless gpuMode === 'mig'
}
```

### ClusterSizing extensions

```typescript
export interface ClusterSizing {
  // ... existing fields unchanged ...
  masterNodes: NodeSpec
  workerNodes: NodeSpec | null
  infraNodes: NodeSpec | null
  odfNodes: NodeSpec | null
  rhacmWorkers: NodeSpec | null

  // NEW for v2.0
  virtWorkerNodes: NodeSpec | null   // dedicated VM-hosting worker pool
  gpuNodes: NodeSpec | null          // GPU worker pool
  totals: { vcpu: number; ramGB: number; storageGB: number }
}
```

---

## Schema Layer — Zod Schema Extensions

The existing `AddOnConfigSchema` in `useUrlState.ts` and `workloadSchema.ts` need new fields. The pattern is `.strip()` objects with `.default()` values — maintain backward compatibility with v1.0 URLs.

### AddOnConfigSchema additions (useUrlState.ts)

```typescript
// Append to existing AddOnConfigSchema.shape:
virtEnabled: z.boolean().default(false),
virtVmCount: z.number().int().min(0).default(0),
virtAvgVmVcpu: z.number().int().min(1).max(256).default(4),
virtAvgVmRamGB: z.number().int().min(1).max(1024).default(8),
rhoaiEnabled: z.boolean().default(false),
gpuEnabled: z.boolean().default(false),
gpuNodeCount: z.number().int().min(0).max(100).default(0),
gpuMode: z.enum(['container', 'passthrough', 'vgpu', 'mig']).default('container'),
gpuPerNode: z.number().int().min(1).max(16).default(1),
migProfile: z.string().nullable().default(null),
```

**URL compatibility:** Zod `.default()` values mean v1.0 shared URLs still parse correctly — missing new fields fall back to their defaults. This is the existing pattern and it works.

**No discriminated union needed** for GpuMode: the fields are independent config, not a sum type. A discriminated union would be over-engineering that adds validation complexity without benefit — the calc function handles the mode via a simple `switch`.

---

## Calculator Pattern — New calcVirt() and calcRHOAI()

The `calcCluster()` dispatcher in `calculators.ts` currently has two patterns:

1. **Topology calculators** (switch-dispatched): `calcStandardHA`, `calcSNO`, etc.
2. **Post-dispatch add-ons** (applied after topology): `calcODF`, `calcRHACM`

For v2.0, both new calculators are **post-dispatch add-ons**, matching the `calcODF`/`calcRHACM` pattern in `addons.ts`.

### calcVirt() — Post-dispatch add-on

```typescript
// Returns NodeSpec for dedicated virtualization worker pool
// Formula:
//   workersByVcpu = ceil((vmCount * avgVmVcpu) / (nodeVcpu * 0.70)) + 1  // +1 for migration headroom
//   workersByRam  = ceil((vmCount * (avgVmRamGB + VM_OVERHEAD)) / (nodeRam * 0.70))
//   count = max(workersByVcpu, workersByRam, 3)  // HA minimum
//   vcpu = max(nodeVcpu, GPU_MIN_WORKER_VCPU or worker min)
//   storageGB = vmCount * avgVmRamGB  // rough hostpath-provisioner estimate
export function calcVirt(vmCount: number, avgVmVcpu: number, avgVmRamGB: number, nodeVcpu: number, nodeRamGB: number): NodeSpec
```

### calcRHOAI() — Post-dispatch add-on

```typescript
// Returns NodeSpec for RHOAI operator overhead (added to existing workers, not new nodes)
// RHOAI does not require dedicated nodes — it adds overhead to existing worker pool
// Returns a synthetic NodeSpec representing the additional resource reservation:
//   count = 0 (no new physical nodes — RHOAI pods run on existing workers)
//   vcpu  = RHOAI_OVERHEAD_VCPU
//   ramGB = RHOAI_OVERHEAD_RAM_GB
// The BoM table shows this as "RHOAI operator overhead" row, not a node count row
export function calcRHOAI(): NodeSpec
```

### calcGpuNodes() — Post-dispatch add-on

```typescript
// Returns NodeSpec for dedicated GPU worker node pool
// GPU nodes are always dedicated (cannot mix container/passthrough/vgpu modes per node)
//   count = gpuNodeCount  (user-specified — GPU nodes are hardware-constrained)
//   vcpu  = max(GPU_MIN_WORKER_VCPU, user nodeVcpu)
//   ramGB = max(GPU_MIN_WORKER_RAM_GB, user nodeRamGB)
//   storageGB = WORKER_MIN.storageGB
// If gpuMode === 'mig': gpuSlices = gpuNodeCount * gpuPerNode * MIG_PROFILES[migProfile].slicesPerGpu
//   → surface as a warning/info field, not a NodeSpec field
export function calcGpuNodes(gpuNodeCount: number, gpuMode: GpuMode, gpuPerNode: number, migProfile: string | null, nodeVcpu: number, nodeRamGB: number): NodeSpec
```

### SNO-with-Virt boosted minimums

Not a new calculator — a conditional in the existing `calcSNO()`:

```typescript
// When addOns.virtEnabled is true on an SNO topology:
// storageGB = SNO_STD_MIN.storageGB + SNO_VIRT_STORAGE_EXTRA_GB  (120 + 50 = 170 GB)
// No vCPU/RAM boost required — SNO standard minimum (8/16) is sufficient for minimal VM workloads
// Heavy VM workloads on SNO should raise a warning, not change the base spec
```

---

## UI Layer — No New Libraries Required

The existing Tailwind v4 + Vue 3 component patterns are sufficient for all new UI elements.

### GPU profile selector

Use the existing `<select>` element pattern already in the wizard forms. The GPU model + MIG profile selection is a two-level cascade:

1. Select GPU model (A100-40GB, A100-80GB, H100-80GB, H200-141GB, passthrough-custom)
2. If MIG mode: select MIG profile from filtered list based on selected GPU model

This is a standard `v-model` + computed filtered list — no headless UI library or combobox component needed. The existing wizard form pattern (Step2WorkloadForm, Step3ArchitectureForm) handles this exactly.

**Why not add radix-vue, headless-ui, or vue3-select-component?**
- The GPU profile list is short (~15 options per model, ~4 GPU models)
- Existing native `<select>` is already styled with Tailwind v4 in the project
- Adding a new component library for a single use case would inflate the bundle and create a style inconsistency
- The existing wizard forms have no searchable comboboxes — this would be an orphaned pattern

### Live-migration warning display

The existing `WarningBanner` component pattern handles this. New warning codes in `ValidationWarning` are surfaced through the same `messageKey` i18n pattern.

---

## Chart Layer — No New Libraries Required

chart.js 4.5.1 + vue-chartjs 5.3.3 are already installed and sufficient.

### GPU visualization

A GPU node row in the BoM table is sufficient for sizing output — no dedicated GPU chart needed. If a GPU utilization/density visualization is desired, it can be added as an additional `Bar` chart using the already-imported `vue-chartjs` components.

The existing `ClusterSizing.totals` aggregation handles the total vCPU/RAM display. GPU-specific data (GPU count, MIG slices available) can be surfaced as annotation text in the existing results layout rather than a new chart type.

---

## Validation Layer — New Warning Codes

New `ValidationWarning` codes following the existing naming convention:

| Code | Severity | Trigger Condition |
|------|----------|-------------------|
| `VIRT_PASSTHROUGH_BLOCKS_MIGRATION` | error | gpuMode === 'passthrough' && virtEnabled |
| `VIRT_RWX_REQUIRED` | warning | virtEnabled (live migration requires ODF RWX) |
| `SNO_VIRT_LIMITED` | warning | SNO topology && virtEnabled && vmCount > 5 |
| `GPU_MODE_EXCLUSIVE` | warning | GPU passthrough/vGPU — node cannot mix workloads |
| `MIG_NOT_SUPPORTED_WITH_VIRT` | error | gpuMode === 'mig' && virtEnabled (MIG-backed vGPUs not supported with KubeVirt) |
| `RHOAI_INSUFFICIENT_WORKERS` | error | rhoaiEnabled && workerCount < RHOAI_MIN_WORKER_NODES |

**Key constraint surfaced via warning:** NVIDIA GPU passthrough with KubeVirt blocks live migration. This is the most important cross-feature interaction and must be flagged at the validation layer.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| GPU profile UI | Native `<select>` + Vue 3 cascade | radix-vue Combobox, vue3-select-component | Overkill for a 15-item dropdown; adds bundle weight and style inconsistency |
| GPU chart | Existing BoM table row | New chart type (d3, echarts) | The output is a node count and spec, not a time series — a table row communicates more clearly |
| MIG profile typing | String key + lookup table | Zod discriminated union per GPU model | Discriminated unions on a 15-key lookup table add schema complexity without runtime benefit |
| RHOAI sizing | Overhead reservation (no new nodes) | Dedicated RHOAI nodes | RHOAI pods run on existing workers in practice; dedicated nodes are only needed for very large deployments |
| SNO+Virt | Storage boost + warning | Separate SNO-virt topology | Complexity not justified — SNO+virt is a single-node constraint, not a topology choice |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new npm dependency for v2.0 | Zero new packages needed; all patterns in existing stack | Extend existing engine/schema/UI patterns |
| Zod discriminated union for GPU config | Adds schema fragility without benefit; GPU mode is config not a sum type | `z.enum` + nullable `migProfile` field |
| GPU-specific chart library | Bundle weight, new API to learn, chart.js already present | `vue-chartjs` Bar chart with GPU annotation |
| vGPU licensing checks in the sizer | Licensing changes frequently; out of scope per PROJECT.md | Show static warning: "vGPU requires per-node NVIDIA license" |
| MIG time-slicing or MPS mode | Time-slicing is not hardware partitioning; MPS is advanced/uncommon | MIG only for hardware-isolated GPU slices |

---

## Stack Patterns by Variant

**If gpuMode === 'mig':**
- Show MIG profile selector (cascade from GPU model selection)
- Calculate GPU slice count = gpuNodeCount × gpuPerNode × MIG_PROFILES[profile].slicesPerGpu
- Surface slice count in BoM table as "Available GPU slices" annotation
- Emit MIG_NOT_SUPPORTED_WITH_VIRT if virtEnabled

**If gpuMode === 'passthrough':**
- Each GPU node gets 1 VM per physical GPU
- Block live migration (emit VIRT_PASSTHROUGH_BLOCKS_MIGRATION warning)
- Surface GPU_MODE_EXCLUSIVE warning

**If gpuMode === 'vgpu':**
- vGPU density is license-constrained; sizer does not calculate density
- Surface static warning about NVIDIA license requirement
- Worker node specs use GPU_MIN_WORKER_VCPU / GPU_MIN_WORKER_RAM_GB

**If virtEnabled on SNO topology:**
- Boost storageGB by SNO_VIRT_STORAGE_EXTRA_GB (50 GB additional disk)
- Emit SNO_VIRT_LIMITED warning if vmCount > 5 (SNO is not a production virt platform)
- SNO does not support live migration — emit VIRT_RWX_REQUIRED as informational only

---

## Version Compatibility

All existing packages are already installed and compatible. The v2.0 additions are pure TypeScript engine extensions — no compatibility risk.

| Concern | Status |
|---------|--------|
| Zod v4 + new fields | Safe — `.default()` maintains backward compat with existing URL state |
| chart.js 4.x + new BoM rows | Safe — existing `vue-chartjs` Bar components unchanged |
| Pinia 3.x + new AddOnConfig fields | Safe — store `updateCluster()` uses `Object.assign(cluster, patch)` |
| Vitest 4.x + new calculator tests | Safe — same pattern as existing `calculators.test.ts` |

---

## Sources

- NVIDIA MIG User Guide — `docs.nvidia.com/datacenter/tesla/mig-user-guide/supported-mig-profiles.html` — MIG profile names, slice counts, max instances per GPU (HIGH confidence)
- NVIDIA GPU Operator on OpenShift — `docs.nvidia.com/datacenter/cloud-native/openshift/latest/openshift-virtualization.html` — GPU modes (container/passthrough/vGPU), node label system, mode exclusivity constraint (HIGH confidence)
- Red Hat OpenShift Virtualization memory management — `developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization` — virt-launcher overhead formula (MEDIUM confidence — formula extracted from article example)
- Red Hat OpenShift Virtualization worker node overhead — community + docs.openshift.com — "2 additional cores + 10 GiB disk per node" (MEDIUM confidence)
- Red Hat RHOAI 3.x minimum requirements — community sources + access.redhat.com — "2 worker nodes × 8 CPU / 32 GB RAM" (MEDIUM confidence)
- SNO virtualization storage — `access.redhat.com/solutions/7014308` — "additional 50 GiB disk for hostpath-provisioner" (MEDIUM confidence)
- MIG + KubeVirt incompatibility — NVIDIA GPU Operator docs — "MIG-backed vGPUs not supported with KubeVirt in certain GPU Operator versions" (MEDIUM confidence — version-dependent)
- GPU passthrough + live migration incompatibility — NVIDIA docs + Red Hat docs — passthrough uses vfio-pci, blocks live migration (HIGH confidence — architectural constraint)

---

*Stack research for: OpenShift Virtualization + RHOAI/GPU sizing (v2.0 milestone)*
*Researched: 2026-04-01*
