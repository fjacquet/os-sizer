# Phase 10: GPU Node Engine — Research

**Researched:** 2026-04-01
**Domain:** NVIDIA GPU Operator + OpenShift, MIG profiles, GPU passthrough live migration constraints, KubeVirt GPU incompatibilities
**Confidence:** HIGH for core patterns (from live codebase + official docs); MEDIUM for MIG profile lookup table (official NVIDIA docs, but Phase 10 only exposes A100-40GB profiles per roadmap scope); LOW for vGPU density (deliberately out of scope for v2.0)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WARN-01 | Emit `ValidationWarning` when GPU passthrough mode active: live migration permanently blocked | PCI passthrough blocks VM live migration at the hypervisor level — VMs with PCIDevice passthrough cannot be live-migrated (Harvester docs, KubeVirt user guide); GPU passthrough uses vfio-pci which binds PCI device exclusively |
| WARN-03 | Emit `ValidationWarning` when MIG profile combined with KubeVirt VMs: unsupported by standard GPU Operator | Explicitly documented: "MIG-backed vGPUs are not supported" in NVIDIA GPU Operator + OpenShift Virtualization docs (24.9.2); Red Hat Customer Portal article 7115541 presents a workaround, confirming this is a known official limitation |
</phase_requirements>

---

## Summary

Phase 10 is a pure engine extension — zero UI work, zero new npm packages. Every pattern required has a direct equivalent in the codebase established by Phases 6–9. The `calcVirt()` post-dispatch add-on pattern in `addons.ts` is the exact template for `calcGpuNodes()`. The `VIRT_RWX_REQUIRES_ODF` / `SNO_VIRT_NO_LIVE_MIGRATION` validation warning pattern in `validation.ts` is the template for WARN-01 and WARN-03. The `AddOnConfig` field group added in Phase 9 is the template for the GPU field group.

The `gpuNodes: NodeSpec | null` field is **already present** on `ClusterSizing` (planted in Phase 9, Plan 09-01). This is the critical structural prerequisite and it is already satisfied — Phase 10 only needs to populate it via `calcGpuNodes()`.

Two facts about GPU modes drive the entire warning logic. First, GPU passthrough uses vfio-pci to bind the physical PCI device exclusively to a VM; this is architecturally incompatible with live migration (KubeVirt cannot migrate a VM with a bound PCI device — Harvester docs state this explicitly, and it is a fundamental QEMU/KVM constraint). Second, MIG-backed vGPU with KubeVirt VMs is explicitly unsupported by the standard NVIDIA GPU Operator path — NVIDIA's own OpenShift Virtualization guide (24.9.2) states: "MIG-backed vGPUs are not supported." A Red Hat Customer Portal article (7115541) describes a workaround using a custom DaemonSet, confirming this is a known official limitation, not a configuration oversight.

The MIG profile lookup table for A100-40GB (the primary in-scope model per roadmap requirements WARN-01/WARN-03) has four standard profiles: `1g.5gb` (7 instances), `2g.10gb` (3 instances), `3g.20gb` (2 instances), `7g.40gb` (1 instance). These match the profile names referenced in requirements GPU-04. H100-80GB uses analogous profiles with doubled memory per instance but identical structure.

**Primary recommendation:** Add GPU fields to `AddOnConfig` + defaults first (commit 1), then GPU constants (commit 2), then `calcGpuNodes()` + dispatcher wiring (commit 3), then WARN-01/WARN-03 in `validation.ts` (commit 4), then tests (commit 5).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (existing) | 5.x | Type system for GPU mode union types and MIG profile lookup | Already installed; zero new packages |
| Vitest (existing) | 2.x | Unit tests for calcGpuNodes(), WARN-01, WARN-03 | Already installed; existing test patterns apply exactly |

### Supporting
No new npm packages required. The existing stack handles all GPU engine requirements identically to how it handled the Phase 9 virt engine work.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static MIG profile lookup table | Dynamic NVIDIA catalog fetch | Dynamic breaks offline-capable use case; static is correct for pre-sales tool |
| `gpuCount` field on `NodeSpec` | Separate `GpuNodeSpec` type extending `NodeSpec` | Adding a separate type is unnecessary complexity — `storageGB` of NodeSpec is unused for GPU nodes; a `gpuCount` annotation in the calculator comment suffices for Phase 10; Phase 12 BoM can surface it via `AddOnConfig.gpuPerNode` |

---

## Architecture Patterns

### Current State After Phase 9

The GPU field placeholder is already live in `src/engine/types.ts`:
```typescript
export interface ClusterSizing {
  ...
  virtWorkerNodes: NodeSpec | null  // Phase 9: dedicated VM-hosting worker pool
  gpuNodes: NodeSpec | null         // Phase 9: placeholder for Phase 10 GPU calculator
  virtStorageGB: number
  totals: { vcpu: number; ramGB: number; storageGB: number }
}
```

The `emptySizing()` helper in `calculators.ts` already initializes `gpuNodes: null`.

### Pattern 1: AddOnConfig GPU Field Group (mirrors Phase 9 virt fields)

Phase 9 added virt fields to `AddOnConfig` in `types.ts`:
```typescript
// Phase 9: OpenShift Virtualization
virtEnabled: boolean
vmCount: number
vmsPerWorker: number
virtAvgVmVcpu: number
virtAvgVmRamGB: number
snoVirtMode: boolean
```

Phase 10 adds GPU fields in the same style, in the same file, annotated with the phase comment:
```typescript
// Phase 10: GPU Node Engine
gpuEnabled: boolean              // dedicated GPU node pool enabled
gpuNodeCount: number             // number of GPU nodes in pool (user-specified)
gpuMode: 'container' | 'passthrough' | 'vgpu'  // GPU workload mode
gpuModel: 'A100-40GB' | 'A100-80GB' | 'H100-80GB'  // GPU model selector
migProfile: string               // MIG profile name (e.g. '1g.5gb') — empty string = no MIG
gpuPerNode: number               // GPUs per node (default 1)
```

**Key design decision:** `migProfile` is a `string` not a union type because the valid values differ per GPU model. The MIG_PROFILES lookup table validates the combination. An empty string (`''`) means MIG is not configured.

### Pattern 2: calcGpuNodes() in addons.ts (mirrors calcVirt())

The function signature follows the post-dispatch add-on pattern. Compare:

```typescript
// Phase 9 pattern (in addons.ts)
export function calcVirt(
  vmCount: number,
  vmsPerWorker: number,
  avgVmVcpu: number,
  avgVmRamGB: number,
  nodeVcpu: number,
  nodeRamGB: number,
): NodeSpec { ... }

// Phase 10 pattern (same file)
export function calcGpuNodes(
  gpuNodeCount: number,
  nodeVcpu: number,
  nodeRamGB: number,
  nodeStorageGB: number,
): NodeSpec { ... }
```

`calcGpuNodes()` is simpler than `calcVirt()` because the user directly specifies node count. The function normalizes the inputs against GPU node minimums and returns a `NodeSpec`. The GPU count is not modeled in `NodeSpec` itself — it is tracked via `AddOnConfig.gpuPerNode` for downstream use by the Phase 12 BoM layer.

```typescript
// Source: post-dispatch pattern from calculators.ts (Phase 6 decision: ENG-07, ENG-08)
export function calcGpuNodes(
  gpuNodeCount: number,
  nodeVcpu: number,
  nodeRamGB: number,
  nodeStorageGB: number,
): NodeSpec {
  return {
    count: Math.max(gpuNodeCount, 1),
    vcpu: Math.max(nodeVcpu, GPU_NODE_MIN_VCPU),
    ramGB: Math.max(nodeRamGB, GPU_NODE_MIN_RAM_GB),
    storageGB: Math.max(nodeStorageGB, GPU_NODE_MIN_STORAGE_GB),
  }
}
```

### Pattern 3: calcCluster() Post-Dispatch Wiring (mirrors Phase 9 virt block)

The existing Phase 9 virt block in `calculators.ts` (lines 449-461):
```typescript
// Phase 9: virt worker pool (VIRT-02)
if (config.addOns.virtEnabled) {
  sizing.virtWorkerNodes = calcVirt(...)
  sizing.virtStorageGB = ...
}
```

Phase 10 adds an analogous block immediately after:
```typescript
// Phase 10: GPU node pool (GPU engine)
if (config.addOns.gpuEnabled) {
  sizing.gpuNodes = calcGpuNodes(
    config.addOns.gpuNodeCount,
    config.workload.nodeVcpu,
    config.workload.nodeRamGB,
    GPU_NODE_MIN_STORAGE_GB,
  )
}
```

The `sumTotals()` recalculation at lines 463-473 must be updated to include `sizing.gpuNodes` in the array alongside `sizing.virtWorkerNodes`.

### Pattern 4: Validation Warnings (mirrors WARN-02 pattern)

Existing WARN-02 pattern in `validation.ts`:
```typescript
if (config.addOns.virtEnabled && !config.addOns.odfEnabled && config.topology !== 'sno') {
  warnings.push({
    code: 'VIRT_RWX_REQUIRES_ODF',
    severity: 'warning',
    messageKey: 'warnings.virt.rwxRequiresOdf',
  })
}
```

WARN-01 pattern (GPU passthrough blocks live migration):
```typescript
// WARN-01: GPU passthrough permanently blocks live migration on affected nodes.
// vfio-pci binds the PCI device exclusively — VMs with passthrough cannot be live-migrated.
// Source: KubeVirt host devices guide + Harvester live migration docs
if (config.addOns.gpuEnabled && config.addOns.gpuMode === 'passthrough') {
  warnings.push({
    code: 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION',
    severity: 'warning',
    messageKey: 'warnings.gpu.passthroughBlocksLiveMigration',
  })
}
```

WARN-03 pattern (MIG profile + KubeVirt VMs unsupported):
```typescript
// WARN-03: MIG-backed vGPU + KubeVirt VMs is unsupported by the standard GPU Operator.
// Source: NVIDIA GPU Operator + OpenShift Virtualization docs (24.9.2): "MIG-backed vGPUs are not supported"
// Red Hat Customer Portal article 7115541 provides a workaround using a custom DaemonSet.
if (config.addOns.gpuEnabled && config.addOns.migProfile !== '' && config.addOns.virtEnabled) {
  warnings.push({
    code: 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED',
    severity: 'warning',
    messageKey: 'warnings.gpu.migProfileWithKubevirtUnsupported',
  })
}
```

### Pattern 5: MIG Profile Lookup Table in constants.ts

The lookup table is a typed constant object. The key is the GPU model; the value is a record mapping profile name to instances-per-GPU count:

```typescript
// MIG profiles for GPU nodes — static lookup table (GPU-04)
// Source: NVIDIA MIG User Guide — docs.nvidia.com/datacenter/tesla/mig-user-guide/supported-mig-profiles.html
// Scope: A100-40GB profiles only for v2.0 (1g.5gb, 2g.10gb, 3g.20gb, 7g.40gb per REQUIREMENTS.md GPU-04)
export const MIG_PROFILES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'A100-40GB': {
    '1g.5gb':  7,  // 7 instances × 5 GB = 35 GB (out of 40 GB; 1 slice reserved for system)
    '2g.10gb': 3,  // 3 instances × 10 GB
    '3g.20gb': 2,  // 2 instances × 20 GB
    '7g.40gb': 1,  // 1 instance (whole GPU in MIG mode)
  },
  'A100-80GB': {
    '1g.10gb': 7,
    '2g.20gb': 3,
    '3g.40gb': 2,
    '7g.80gb': 1,
  },
  'H100-80GB': {
    '1g.10gb': 7,
    '2g.20gb': 3,
    '3g.40gb': 2,
    '7g.80gb': 1,
  },
} as const

// GPU node minimums — no authoritative Red Hat sizing table exists for GPU nodes;
// these reflect general bare-metal GPU server minimums from hardware context
export const GPU_NODE_MIN_VCPU = 16        // typical bare-metal GPU node baseline
export const GPU_NODE_MIN_RAM_GB = 64      // GPU nodes require sufficient CPU-side RAM for driver + workloads
export const GPU_NODE_MIN_STORAGE_GB = 200 // OS + GPU drivers + container images

// GPU workload mode node label values (nvidia.com/gpu.workload.config)
// Source: NVIDIA GPU Operator + OpenShift Virtualization docs
export const GPU_MODE_LABELS = {
  container:    'container',     // default; datacenter drivers + device plugin
  passthrough:  'vm-passthrough', // vfio-pci; blocks live migration
  vgpu:         'vm-vgpu',       // vGPU manager; MIG-backed vGPUs unsupported with KubeVirt
} as const
```

### Pattern 6: defaults.ts Extension (mirrors Phase 9 virt defaults)

Phase 9 added virt defaults to `createDefaultClusterConfig()`:
```typescript
// Phase 9: OpenShift Virtualization
virtEnabled: false,
vmCount: 50,
vmsPerWorker: 10,
virtAvgVmVcpu: 4,
virtAvgVmRamGB: 8,
snoVirtMode: false,
```

Phase 10 adds GPU defaults in the same style:
```typescript
// Phase 10: GPU Node Engine
gpuEnabled: false,
gpuNodeCount: 1,
gpuMode: 'container',
gpuModel: 'A100-40GB',
migProfile: '',
gpuPerNode: 1,
```

### Pattern 7: useUrlState.ts AddOnConfigSchema Extension

Phase 9 extended `AddOnConfigSchema` with Zod fields using `.default()` for backward URL compat:
```typescript
// Phase 9: OpenShift Virtualization
virtEnabled: z.boolean().default(false),
vmCount: z.number().int().min(0).default(50),
...
```

Phase 10 adds GPU fields the same way. The `.strip()` call on the schema ensures unknown fields from old URLs are silently dropped, maintaining backward compatibility.

```typescript
// Phase 10: GPU Node Engine
gpuEnabled: z.boolean().default(false),
gpuNodeCount: z.number().int().min(1).default(1),
gpuMode: z.enum(['container', 'passthrough', 'vgpu']).default('container'),
gpuModel: z.enum(['A100-40GB', 'A100-80GB', 'H100-80GB']).default('A100-40GB'),
migProfile: z.string().default(''),
gpuPerNode: z.number().int().min(1).default(1),
```

### Recommended Project Structure (no new files needed)

All Phase 10 work fits within existing files:

```
src/engine/
├── types.ts          — AddOnConfig: add 6 GPU fields (gpuEnabled, gpuNodeCount, gpuMode, gpuModel, migProfile, gpuPerNode)
├── constants.ts      — Add MIG_PROFILES lookup table, GPU_NODE_MIN_* constants, GPU_MODE_LABELS
├── addons.ts         — Add calcGpuNodes() function
├── calculators.ts    — Add gpuEnabled post-dispatch block + gpuNodes in sumTotals call
├── validation.ts     — Add WARN-01 + WARN-03 warning blocks
├── defaults.ts       — Add 6 GPU fields to createDefaultClusterConfig()
├── addons.test.ts    — Add calcGpuNodes() describe block
└── validation.test.ts — Add WARN-01 + WARN-03 describe blocks
src/composables/
└── useUrlState.ts    — Extend AddOnConfigSchema with 6 GPU Zod fields
```

### Anti-Patterns to Avoid

- **Merging GPU nodes into workerNodes:** GPU Operator requires dedicated node pools with exclusive `nvidia.com/gpu.workload.config` labels. Mixed sizing produces an invalid BoM. The `gpuNodes: NodeSpec | null` field is already in `ClusterSizing` for this reason.
- **Using `storageGB` in `NodeSpec` as a proxy for GPU count:** NodeSpec has no GPU field. The GPU count is tracked in `AddOnConfig.gpuPerNode`; the Phase 12 BoM reads it directly from config, not from sizing. Do not attempt to encode GPU count in `storageGB`.
- **Emitting WARN-01 only when virtEnabled:** The passthrough live migration block applies to all VMs on the node, regardless of whether OpenShift Virtualization is enabled. The warning fires whenever `gpuMode === 'passthrough'`, regardless of `virtEnabled`.
- **Checking `gpuMode === 'vgpu'` for WARN-03:** WARN-03 is about MIG profile combined with KubeVirt VMs (`virtEnabled`), not specifically about vGPU mode. A MIG profile can also be used for container workloads. The condition is `migProfile !== '' && virtEnabled`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIG profile validation | Custom profile validator | `MIG_PROFILES[gpuModel]?.[migProfile]` lookup | Profiles are model-specific; a lookup table handles all validation implicitly |
| GPU mode exclusivity check | Custom multi-field validator | Simple `gpuMode` type guard + warning | Mode exclusivity is enforced by NVIDIA labels at deploy time; sizer warns but does not block |
| GPU node count sizing formula | Multi-constraint GPU calculator | Direct user input (`gpuNodeCount`) passed through | GPU node count is explicitly user-specified (GPU-01); unlike VM workers, there is no derivable formula |

**Key insight:** GPU node sizing is user-specified, not formula-derived. The user knows how many GPU nodes they need based on their model loading requirements. `calcGpuNodes()` normalizes against minimums but does not derive count — this is a fundamental difference from `calcVirt()` which derives count from VM density constraints.

---

## Common Pitfalls

### Pitfall 1: WARN-01 Condition Scope Too Narrow
**What goes wrong:** `if (gpuMode === 'passthrough' && virtEnabled)` — warning only fires when both passthrough AND virt are enabled.
**Why it happens:** Developer assumes the warning is about the passthrough+VM interaction specifically.
**How to avoid:** WARN-01 fires whenever `gpuEnabled && gpuMode === 'passthrough'`. Live migration is blocked for any VMs on that node, not only KubeVirt VMs. A node running passthrough GPUs cannot participate in OpenShift live migration operations at all.
**Warning signs:** Test case "passthrough without virtEnabled should warn" fails — this case MUST warn.

### Pitfall 2: WARN-03 Condition Checks Wrong Field
**What goes wrong:** `if (gpuMode === 'vgpu' && virtEnabled)` — fires on vGPU+virt instead of MIG+virt.
**Why it happens:** Developer conflates "MIG-backed vGPU" (NVIDIA terminology) with "vGPU mode" (GPU Operator node label).
**How to avoid:** WARN-03 condition is `migProfile !== '' && virtEnabled`. A non-empty `migProfile` means MIG is configured. The NVIDIA limitation is: MIG-backed vGPU slices cannot be assigned to KubeVirt VMs via the standard GPU Operator. This is independent of whether `gpuMode` is `'vgpu'` — a user could select MIG profiles with `gpuMode='container'` for container workloads and that is valid.
**Warning signs:** The NVIDIA docs (24.9.2) say "MIG-backed vGPUs are not supported" in the OpenShift Virtualization context — the key word is "MIG-backed", not "vGPU mode".

### Pitfall 3: sumTotals() Not Updated to Include gpuNodes
**What goes wrong:** `sizing.gpuNodes` is populated by `calcGpuNodes()` but not included in the `sumTotals()` call, so cluster totals are incorrect.
**Why it happens:** The existing sumTotals call at lines 463-473 only conditionally recalculates totals when `odfEnabled || rhacmEnabled || virtEnabled`. Adding `gpuEnabled` to that condition and including `sizing.gpuNodes` in the array is required.
**How to avoid:** Update both the condition guard and the array in the `sumTotals()` call site. The easiest approach: include `gpuEnabled` in the condition OR clause and add `sizing.gpuNodes` to the sumTotals array unconditionally (null-safe because `sumTotals` already skips null entries).
**Warning signs:** A test showing expected total vcpu includes GPU node contribution will catch this.

### Pitfall 4: MIG_PROFILES Constants Use Wrong Profile Names for A100-40GB
**What goes wrong:** Using H100-80GB profile names (1g.10gb, 2g.20gb, 3g.40gb, 7g.80gb) for A100-40GB.
**Why it happens:** NVIDIA MIG profile names encode actual memory per instance; A100-40GB and A100-80GB have different profile names even though the instance count structure is the same.
**How to avoid:** REQUIREMENTS.md GPU-04 explicitly calls out `1g.5gb, 2g.10gb, 3g.20gb, 7g.40gb` — these are A100-40GB profile names. Verify against NVIDIA MIG User Guide supported profiles table for each GPU model before writing the constant.
**Warning signs:** If a test checks `MIG_PROFILES['A100-40GB']['1g.5gb']` returns `7`, it will catch a wrong key.

### Pitfall 5: GpuMode Type Not Exported from types.ts
**What goes wrong:** `gpuMode` field in `AddOnConfig` uses an inline union type `'container' | 'passthrough' | 'vgpu'` rather than an exported named type.
**Why it happens:** Inline union types are convenient but the validation.ts and addons.ts both need to reference the type.
**How to avoid:** Export `export type GpuMode = 'container' | 'passthrough' | 'vgpu'` from `types.ts` and use it for the `AddOnConfig.gpuMode` field. This is the same pattern as `TopologyType` and `SnoProfile`.
**Warning signs:** TypeScript will not catch this — it's a maintainability risk, not a compile error.

---

## Code Examples

Verified patterns from the live codebase and official sources:

### calcGpuNodes() Full Implementation
```typescript
// Source: post-dispatch add-on pattern from addons.ts (calcVirt/calcODF/calcRHACM)
// GPU_NODE_MIN_* constants defined in constants.ts
export function calcGpuNodes(
  gpuNodeCount: number,
  nodeVcpu: number,
  nodeRamGB: number,
  nodeStorageGB: number,
): NodeSpec {
  return {
    count: Math.max(gpuNodeCount, 1),
    vcpu: Math.max(nodeVcpu, GPU_NODE_MIN_VCPU),
    ramGB: Math.max(nodeRamGB, GPU_NODE_MIN_RAM_GB),
    storageGB: Math.max(nodeStorageGB, GPU_NODE_MIN_STORAGE_GB),
  }
}
```

### calcCluster() Post-Dispatch GPU Block
```typescript
// Source: calculators.ts lines 449-461 Phase 9 pattern
// Phase 10: GPU node pool
if (config.addOns.gpuEnabled) {
  sizing.gpuNodes = calcGpuNodes(
    config.addOns.gpuNodeCount,
    config.workload.nodeVcpu,
    config.workload.nodeRamGB,
    GPU_NODE_MIN_STORAGE_GB,
  )
}

// Updated totals recalculation condition (add gpuEnabled)
if (config.addOns.odfEnabled || config.addOns.rhacmEnabled || config.addOns.virtEnabled || config.addOns.gpuEnabled) {
  sizing.totals = sumTotals([
    sizing.masterNodes,
    sizing.workerNodes,
    sizing.infraNodes,
    sizing.odfNodes,
    sizing.rhacmWorkers,
    sizing.virtWorkerNodes,
    sizing.gpuNodes,            // Phase 10 addition
  ])
}
```

### WARN-01 Validation (GPU Passthrough Blocks Live Migration)
```typescript
// Source: NVIDIA GPU Operator + OpenShift Virtualization docs; Harvester live migration docs
// PCI passthrough (vfio-pci) permanently binds the device — VMs cannot be live-migrated
if (config.addOns.gpuEnabled && config.addOns.gpuMode === 'passthrough') {
  warnings.push({
    code: 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION',
    severity: 'warning',
    messageKey: 'warnings.gpu.passthroughBlocksLiveMigration',
  })
}
```

### WARN-03 Validation (MIG Profile + KubeVirt VMs Unsupported)
```typescript
// Source: NVIDIA GPU Operator + OpenShift Virtualization docs 24.9.2
// "MIG-backed vGPUs are not supported" — standard GPU Operator cannot automate this
if (config.addOns.gpuEnabled && config.addOns.migProfile !== '' && config.addOns.virtEnabled) {
  warnings.push({
    code: 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED',
    severity: 'warning',
    messageKey: 'warnings.gpu.migProfileWithKubevirtUnsupported',
  })
}
```

### MIG Profile Instances-Per-GPU Lookup
```typescript
// Source: NVIDIA MIG User Guide — supported-mig-profiles.html
// Usage: const instancesPerGpu = MIG_PROFILES[gpuModel]?.[migProfile] ?? 0
const instances = MIG_PROFILES['A100-40GB']['1g.5gb']  // → 7
const instances2 = MIG_PROFILES['A100-40GB']['3g.20gb'] // → 2
```

### Vitest Test Pattern (mirrors addons.test.ts / validation.test.ts)
```typescript
// Source: src/engine/addons.test.ts and validation.test.ts patterns
describe('calcGpuNodes', () => {
  it('user-specified count is honored when above minimum', () => {
    const result = calcGpuNodes(4, 32, 128, 500)
    expect(result.count).toBe(4)
  })

  it('minimum 1 node enforced for count=0', () => {
    const result = calcGpuNodes(0, 32, 128, 500)
    expect(result.count).toBe(1)
  })

  it('vcpu floored at GPU_NODE_MIN_VCPU when nodeVcpu too small', () => {
    const result = calcGpuNodes(2, 4, 128, 500)
    expect(result.vcpu).toBe(GPU_NODE_MIN_VCPU)
  })

  it('MIG_PROFILES lookup: A100-40GB 1g.5gb = 7 instances', () => {
    expect(MIG_PROFILES['A100-40GB']['1g.5gb']).toBe(7)
  })

  it('MIG_PROFILES lookup: A100-40GB 7g.40gb = 1 instance', () => {
    expect(MIG_PROFILES['A100-40GB']['7g.40gb']).toBe(1)
  })
})

describe('WARN-01: GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION', () => {
  it('emits warning when gpuEnabled=true, gpuMode=passthrough', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.gpuMode = 'passthrough'
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION' && w.severity === 'warning')).toBe(true)
  })

  it('no warning when gpuMode=container', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.gpuMode = 'container'
    expect(validateInputs(config).some(w => w.code === 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION')).toBe(false)
  })

  it('no warning when gpuEnabled=false even if gpuMode=passthrough', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = false
    config.addOns.gpuMode = 'passthrough'
    expect(validateInputs(config).some(w => w.code === 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION')).toBe(false)
  })

  it('fires regardless of virtEnabled (passthrough blocks migration for any VM)', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.gpuMode = 'passthrough'
    config.addOns.virtEnabled = false
    expect(validateInputs(config).some(w => w.code === 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION')).toBe(true)
  })
})

describe('WARN-03: MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED', () => {
  it('emits warning when migProfile set and virtEnabled=true', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.migProfile = '1g.5gb'
    config.addOns.virtEnabled = true
    expect(validateInputs(config).some(w => w.code === 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED' && w.severity === 'warning')).toBe(true)
  })

  it('no warning when migProfile is empty string', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.migProfile = ''
    config.addOns.virtEnabled = true
    expect(validateInputs(config).some(w => w.code === 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED')).toBe(false)
  })

  it('no warning when virtEnabled=false even if migProfile set', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.migProfile = '3g.20gb'
    config.addOns.virtEnabled = false
    expect(validateInputs(config).some(w => w.code === 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED')).toBe(false)
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GPU nodes co-located with container workers | Dedicated GPU node pools with exclusive `nvidia.com/gpu.workload.config` labels | GPU Operator 1.x+ | GPU nodes must be `gpuNodes: NodeSpec | null`, not merged into `workerNodes` |
| MIG not available on A100 | MIG supported: A100-40GB, A100-80GB, H100-80GB, H200-141GB | NVIDIA Ampere release | Static lookup table approach is correct for these models |
| MIG-backed vGPU with KubeVirt: workaround only | Still unsupported in standard GPU Operator path as of 24.9.2 | GPU Operator 22.9–24.9 | WARN-03 remains valid; Red Hat article 7115541 describes custom DaemonSet workaround |
| GPU passthrough: driver-level concern | vfio-pci binding is a kernel-level PCI device exclusive attach | QEMU/KVM fundamental | Live migration architecturally impossible with bound PCI devices |

**Deprecated/outdated:**
- GPU Operator 22.9.x docs: confirm "MIG-backed vGPUs are not supported" language unchanged through 24.9.2 — still current as of research date.

---

## Open Questions

1. **GPU node minimum sizing constants (GPU_NODE_MIN_VCPU, GPU_NODE_MIN_RAM_GB)**
   - What we know: No authoritative Red Hat GPU node sizing table exists; the NVIDIA GPU Operator docs focus on configuration, not capacity planning.
   - What's unclear: Are 16 vCPU / 64 GB defaults appropriate for a pre-sales sizer, or should these be lower to avoid over-specifying?
   - Recommendation: Use 16 vCPU / 64 GB / 200 GB as soft minimums (user can specify higher via nodeVcpu/nodeRamGB). These are defensible for A100/H100 nodes which typically ship as dual-socket servers. The user specifies node count; the minimums only guard against obviously wrong input.

2. **vGPU mode BoM output for v2.0**
   - What we know: vGPU density sizing is deliberately deferred to v2.1 (REQUIREMENTS.md Out of Scope: "vGPU license type modeling"). The `gpuMode='vgpu'` case still produces a valid `NodeSpec` with a static warning.
   - What's unclear: Should v2.0 show a static "density requires NVIDIA license" warning for vGPU mode, or should vGPU mode be a no-op that simply sets `gpuNodes` normally?
   - Recommendation: `calcGpuNodes()` treats all three modes identically (user-specified count, normalized against minimums). No extra vGPU density calculation. A separate Phase 12 UI concern may show a static note; Phase 10 only needs to ensure no crash for `gpuMode='vgpu'`.

3. **Whether WARN-01 should be 'warning' or 'error' severity**
   - What we know: WARN-02 (virt without ODF) uses `severity: 'warning'` per Phase 9 decision — "supported but suboptimal, not forbidden". Passthrough is a supported and valid configuration.
   - What's unclear: Is passthrough + live migration a hard error (user cannot deploy this way) or a warning (user is informed)?
   - Recommendation: Use `severity: 'warning'` consistent with all other WARN-* codes. Passthrough is a valid supported configuration; the sizer informs, not blocks. This matches the Phase 9 pattern decision for SNO_VIRT_NO_LIVE_MIGRATION.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — Phase 10 is pure TypeScript engine additions with no new CLI tools, services, databases, or external APIs required)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npx vitest run src/engine/addons.test.ts src/engine/validation.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WARN-01 | `GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION` warning fires when `gpuEnabled && gpuMode=passthrough` | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0: add describe block |
| WARN-01 | Warning does NOT fire when `gpuMode=container` | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0 |
| WARN-01 | Warning does NOT fire when `gpuEnabled=false` | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0 |
| WARN-01 | Warning fires regardless of `virtEnabled` | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0 |
| WARN-03 | `MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED` warning fires when `migProfile !== '' && virtEnabled` | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0 |
| WARN-03 | Warning does NOT fire when `migProfile=''` | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0 |
| WARN-03 | Warning does NOT fire when `virtEnabled=false` | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0 |
| SC-3 | `gpuNodes: NodeSpec \| null` on `ClusterSizing` populated by `calcGpuNodes()` | unit | `npx vitest run src/engine/addons.test.ts` | ❌ Wave 0 |
| SC-4 | `MIG_PROFILES['A100-40GB']['1g.5gb']` returns 7 | unit | `npx vitest run src/engine/addons.test.ts` | ❌ Wave 0 |
| SC-4 | All four A100-40GB profiles resolve correctly | unit | `npx vitest run src/engine/addons.test.ts` | ❌ Wave 0 |
| SC-5 | `tsc --noEmit` exits 0 after all GPU changes | compile | `npx tsc --noEmit` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/engine/addons.test.ts src/engine/validation.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (currently 204 passing) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/engine/validation.test.ts` — add `describe('WARN-01: GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION', ...)` block (4 test cases)
- [ ] `src/engine/validation.test.ts` — add `describe('WARN-03: MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED', ...)` block (3 test cases)
- [ ] `src/engine/addons.test.ts` — add `describe('calcGpuNodes', ...)` block (3+ test cases) and MIG_PROFILES lookup assertions
- [ ] No new test config needed — existing vitest.config.ts covers all new engine files

---

## Sources

### Primary (HIGH confidence)
- NVIDIA GPU Operator + OpenShift Virtualization docs (24.9.2) — `docs.nvidia.com/datacenter/cloud-native/openshift/24.9.2/openshift-virtualization.html` — GPU modes (container/vm-passthrough/vm-vgpu), mode exclusivity, node label values, "MIG-backed vGPUs are not supported" statement
- NVIDIA MIG User Guide — `docs.nvidia.com/datacenter/tesla/mig-user-guide/supported-mig-profiles.html` — A100-40GB profiles: 1g.5gb×7, 2g.10gb×3, 3g.20gb×2, 7g.40gb×1; A100-80GB and H100-80GB analogous structures with doubled memory
- Harvester Live Migration docs — `docs.harvesterhci.io/v1.5/vm/live-migration/` — "Live migration is not allowed when the virtual machine has any PCIDevice passthrough enabled" (exact quote)
- os-sizer live codebase — `src/engine/types.ts`, `addons.ts`, `calculators.ts`, `validation.ts`, `defaults.ts` — post-dispatch pattern, existing warning pattern, gpuNodes field already in ClusterSizing, 204 passing tests

### Secondary (MEDIUM confidence)
- Red Hat Customer Portal article 7115541 — `access.redhat.com/articles/7115541` — Confirms MIG-backed vGPU + OpenShift Virtualization is unsupported in standard GPU Operator; workaround via custom DaemonSet presented, confirming this is a known official limitation not a configuration error
- NVIDIA GPU Operator with KubeVirt docs — `docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-operator-kubevirt.html` — Worker nodes running passthrough/vGPU assumed to be bare metal; driver installation inside KubeVirt VMs not automated
- GPU Operator 25.3.2 Release Notes — `docs.nvidia.com/datacenter/cloud-native/gpu-operator/25.3.2/release-notes.html` — Added KubeVirt + OpenShift Virtualization support with vGPU v17.4 for A30/A100/H100; MIG-backed vGPU limitation appears unchanged
- Red Hat Developer article (2025-02-06) — "How MIG maximizes GPU efficiency on OpenShift AI" — A100-80GB profile `all-1g.10gb` = 7 instances; confirms H100-80GB shares same profile structure

### Tertiary (LOW confidence — validate during implementation)
- GPU_NODE_MIN_VCPU=16, GPU_NODE_MIN_RAM_GB=64 — Community convention for bare-metal GPU nodes; no official Red Hat GPU node sizing table found. These are defensible starting values only.
- vGPU mode (gpuMode='vgpu') behavior in v2.0 — No authoritative guidance on what a pre-sales sizer should show for vGPU nodes without density calculation. Recommendation (see Open Questions) defers to Phase 12 UI layer.

---

## Metadata

**Confidence breakdown:**
- Warning logic (WARN-01, WARN-03): HIGH — both limitations explicitly documented in official NVIDIA GPU Operator + OpenShift Virtualization docs; passthrough+live-migration constraint confirmed by Harvester docs citing PCI device exclusive binding
- MIG profile lookup table (A100-40GB): HIGH — verified directly against NVIDIA MIG User Guide supported profiles page
- Architecture patterns (addons.ts, validation.ts): HIGH — derived directly from live codebase post-Phase 9
- GPU node minimum constants: LOW — no authoritative Red Hat sizing table; community-derived defaults
- vGPU density (out of scope): N/A — deliberately excluded per v2.0 requirements

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable NVIDIA GPU Operator docs; MIG profile list is hardware-generation-stable)
