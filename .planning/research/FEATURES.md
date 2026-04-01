# Feature Research

**Domain:** OpenShift Virtualization + AI/GPU sizing extension for existing OpenShift sizer
**Researched:** 2026-04-01
**Confidence:** HIGH (Red Hat official docs + NVIDIA official docs + Red Hat Developer blog 2025)

---

## Context: Existing Engine (v1.0 — Already Built)

The following features are already implemented and must NOT be rebuilt. New features
extend these foundations.

- `calcStandardHA`, `calcCompact3Node`, `calcSNO`, `calcTNA`, `calcTNF`, `calcHCP`, `calcMicroShift`, `calcManagedCloud`
- `calcODF` (ODF storage nodes), `calcInfraNodes`, `calcRHACM`
- `ClusterConfig.addOns.odfEnabled`, `addOns.rhacmEnabled` flags already in types
- `ClusterSizing` shape: `masterNodes`, `workerNodes`, `infraNodes`, `odfNodes`, `rhacmWorkers`, `totals`
- BoM table, PPTX/PDF/CSV exports, URL sharing, wizard, recommendation engine
- `ValidationWarning` system with i18n keys already wired into results page

New features add new calculator functions, new fields on `ClusterConfig` / `AddOnConfig`,
new `NodeSpec` rows in `ClusterSizing`, and new validation warning codes.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a pre-sales architect expects when the tool claims to size for OpenShift
Virtualization and RHOAI. Missing these makes the tool feel incomplete or wrong.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `calcVirt()` — VM-density-based worker node sizing | Core of any virtualization sizer; without it the tool cannot produce a BoM for virt workloads | MEDIUM | Inputs: VM count, avg vCPU per VM, avg RAM per VM, target node size. Formula: workers = ceil(vmCount * vCPUperVM / (nodeVcpu * cpuAllocationRatio)) compared against ceil((vmCount * vmRamGB + overhead) / allocatableRamGB). Take max of both. KubeVirt default CPU allocation ratio is 10:1; memory overhead is ~350 MB per VM (qemu overhead). |
| KubeVirt memory overhead per VM | Every VM consumes slightly more RAM than its guest allocation; ignoring this causes undersizing | LOW | ~350 MB qemu overhead per VM + 1% of guest RAM (emulator overhead). Apply as: podRequestRam = guestRam + 0.35 GB. Constant sourced from Red Hat Developer blog 2025-01. |
| Live migration node reserve (N+1 capacity) | Live migration requires at least one node worth of headroom at all times | MEDIUM | Standard: size for N VMs on N-1 nodes, so one node can always drain. This means workerCount += 1 whenever virtEnabled AND liveMigrationEnabled. |
| RWX storage row in BoM | Every virt deployment needs shared RWX volumes for live migration; pre-sales need to size ODF accordingly | LOW | Virt storage is a separate BoM row distinct from ODF node sizing. Formula: virtStorageGB = vmCount * avgVmDiskGB. Surface as `virtNodes: NodeSpec | null` with count=0 (storage-only row) OR add a `virtStorageGB` annotation to existing ODF nodes. |
| GPU node profile selection | Pre-sales must specify GPU count and mode for AI workloads | MEDIUM | Inputs: gpuNodeCount, gpuType (e.g. A100/H100/L40S), gpuMode (container / passthrough / vGPU / mig). Output: additional `gpuNodes: NodeSpec` row in `ClusterSizing`. GPU nodes must be same GPU type per node per NVIDIA docs. |
| MIG partition profile sizing | Pre-sales must know how many AI workloads a GPU node can serve with MIG enabled | MEDIUM | A100 40 GB: up to 7 × 1g.5gb, 3 × 2g.10gb, 2 × 3g.20gb, 1 × 7g.40gb. H100 80 GB: up to 7 × 1g.10gb. Expose as migProfile enum (1g.5gb, 2g.10gb, 3g.20gb, 7g.40gb, all-balanced). Show instances-per-GPU in results. Only supported on A30, A100, A100X, H100, H200, H800. |
| SNO-with-Virt boosted minimums | SNO + Virtualization has different minimums than base SNO; ignoring this causes invalid configs | LOW | Minimums: 8 vCPU base + 6 vCPU for virt operator = 14 vCPU effective, 32 GB RAM, 120 GB OS disk + 50 GB dedicated virt storage disk. Already documented in Red Hat SNO install guide. |
| GPU passthrough blocks live migration warning | This is a hard architectural constraint; a sizing tool must surface it prominently | LOW | `ValidationWarning` with severity `warning`, code `GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION`. Triggered when gpuMode === 'passthrough' AND liveMigrationEnabled === true. Already have `ValidationWarning` infrastructure. |
| RWX storage required for live migration warning | ODF must be enabled (or equivalent RWX storage) for live migration to work | LOW | `ValidationWarning` code `LIVE_MIGRATION_REQUIRES_RWX`. Triggered when virtEnabled AND liveMigrationEnabled AND NOT odfEnabled. |
| RHOAI operator overhead on infra/worker nodes | RHOAI requires minimum 8 CPU / 32 GB RAM per worker node; failing to account for this gives incorrect sizing | LOW | Minimum per node for RHOAI: 8 vCPU, 32 GB RAM. If rhoaiEnabled: bump workerNodes minimum to max(current, 8 vCPU / 32 GB RAM). For SNO: minimum is 32 vCPU / 128 GB RAM. |
| Updated BoM table rows (GPU row, virt storage row) | BoM is the deliverable for the pre-sales architect — it must show all hardware | LOW | New rows: `gpuNodes` (GPU worker nodes), `virtStorageGB` annotation on ODF or as separate row. Follows existing `BomTable` row pattern (already has odfNodes, rhacmWorkers rows). |

### Differentiators (Competitive Advantage)

Features that go beyond what a basic sizer would produce, relevant to the os-sizer
pre-sales audience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| GPU mode comparison sub-table | Show passthrough vs vGPU vs MIG side-by-side for the same VM/pod count — lets the architect pick the right mode | MEDIUM | Display: pods-per-GPU, memory isolation (yes/no), live-migration compatible (yes/no), fault isolation (yes/no). Static lookup table keyed on gpuMode enum. |
| vGPU density sizing | vGPU allows multiple VMs to share one GPU using NVIDIA vGPU Manager. Show GPU-to-VM ratio per profile | HIGH | Requires NVIDIA vGPU profile catalog lookup (e.g., A100 NVLINK vGPU: up to 4 × 20 GB instances). Data changes per driver version — may need a maintained static table. Flag as MEDIUM confidence. |
| Mixed workload topology recommendation update | Recommendation engine should penalise or flag topologies that cannot support virt (e.g., SNO with virt has live-migration constraint) | LOW | Extend `recommendation.ts` scoring: deduct fitScore points when virtEnabled && topology === 'sno' (no live migration possible). Add `warningKeys: ['warnings.sno.noLiveMigration']`. |
| Time-slicing GPU option | Beyond MIG, NVIDIA time-slicing allows N replicas of a GPU exposed as N schedulable devices with shared memory | MEDIUM | Not memory-isolated. Useful for burst dev workloads. Node label: `nvidia.com/gpu.replicas`. Show as an option alongside MIG in GPU mode selector. Lower confidence — not yet covered by Red Hat official sizing tables. |
| Right-sizing recommendations for VMs | Surface a note that over-provisioned VMs waste node capacity; recommend instance types from RHOAI/virt instance type catalog | LOW | April 2025: Red Hat announced right-sizing for OpenShift Virtualization in RHOAI dashboard. Reference as a post-sizing operational recommendation, not a calculator input. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Dynamic GPU catalog fetch from NVIDIA API | Keeps GPU profiles current without code changes | Network dependency at sizing time, cache invalidation complexity, API stability risk. The target use-case is pre-sales on laptops, possibly offline. | Maintain a versioned static GPU profile table in `constants.ts`, document update cadence. |
| GPU cost/licensing calculator | Pre-sales want a total cost of ownership view | NVIDIA vGPU and MIG licensing change frequently; maintaining accurate pricing is a full-time effort and out of scope per PROJECT.md | Note in results page that GPU licensing must be quoted separately via NVIDIA/Red Hat price books. |
| Live VM rightsizing via cluster metrics | Tempting to connect to a live cluster API to pull current VM utilisation | This is a sizing *estimator*, not a monitoring tool. Requires auth, CORS, network access, and changes the tool from offline-capable to online-only. | Allow user to input observed CPU/RAM utilisation percentages as workload profile inputs. |
| Multi-GPU type per node | Some users want to mix GPU models | NVIDIA GPU Operator explicitly does not support mixing GPU types on the same node. | Enforce single GPU type per node row; allow multiple GPU node rows with different types for mixed-node clusters (v2.1+). |
| Automatic IOMMU/SR-IOV validation | GPU passthrough requires IOMMU enabled at BIOS/hypervisor level | Hardware-level validation cannot be done in a browser sizing tool. | Surface as a checklist warning in the results page: "GPU passthrough requires IOMMU enabled in BIOS and supported hardware." |

---

## Feature Dependencies

```
[calcVirt() — VM density sizing]
    ├──requires──> [KubeVirt memory overhead constant (per VM)]
    ├──requires──> [liveMigrationEnabled flag in AddOnConfig]
    └──requires──> [virtEnabled flag in AddOnConfig]

[Live migration node reserve]
    └──requires──> [calcVirt() — worker node count baseline]
                       └──conflicts──> [GPU passthrough mode]
                           (passthrough VMs cannot live-migrate)

[RWX storage requirement warning]
    └──requires──> [virtEnabled + liveMigrationEnabled flags]
    └──requires──> [odfEnabled flag (already exists)]

[GPU node profile sizing]
    ├──requires──> [gpuMode enum: container / passthrough / vGPU / mig]
    ├──requires──> [gpuType field (A100 / H100 / L40S / etc.)]
    └──requires──> [gpuNodeCount field in AddOnConfig]

[MIG partition profile sizing]
    └──requires──> [GPU node profile sizing]
    └──requires──> [migProfile enum on GPU node config]

[GPU passthrough blocks live migration warning]
    └──requires──> [GPU node profile sizing (gpuMode field)]
    └──requires──> [liveMigrationEnabled flag]
    └──uses──> [existing ValidationWarning infrastructure]

[RHOAI operator overhead sizing]
    └──requires──> [rhoaiEnabled flag in AddOnConfig]
    └──enhances──> [existing workerNodes NodeSpec minimum enforcement]

[SNO-with-Virt boosted minimums]
    └──requires──> [virtEnabled flag in AddOnConfig]
    └──enhances──> [calcSNO() — existing calculator]

[Updated BoM table rows]
    └──requires──> [gpuNodes NodeSpec in ClusterSizing]
    └──requires──> [virtStorageGB in ClusterSizing or ODF annotation]
    └──uses──> [existing BomTable row rendering pattern]
```

### Dependency Notes

- **calcVirt() requires virtEnabled + liveMigrationEnabled flags:** These do not yet exist in `AddOnConfig`. Must be added before any virt calculator work.
- **GPU node sizing requires gpuMode:** The `gpuMode` enum determines which NVIDIA driver stack (vfio-pci for passthrough, vGPU manager for vGPU, standard for MIG/container). The sizing logic branches on this enum.
- **GPU passthrough conflicts with live migration:** Hard constraint from NVIDIA GPU Operator docs. The `node.kubernetes.io/gpu.workload.config: vm-passthrough` label is incompatible with VMI live migration. This is not a soft warning — the feature must block or warn loudly.
- **RHOAI overhead enhances workerNodes minimum:** RHOAI does not add a new node type; it raises the floor for existing worker nodes. The engine must apply `Math.max(currentWorkerRam, RHOAI_MIN_RAM)` and similar for vCPU.
- **SNO-with-Virt is a special case of calcSNO:** Virt adds +6 vCPU overhead and requires a second disk of 50 GB. This should be handled inside `calcSNO()` via a conditional branch on `addOns.virtEnabled`, not a new calculator.

---

## MVP Definition (v2.0 scope)

### Launch With (v2.0)

The following are the minimum features for this milestone to be useful to pre-sales:

- [ ] `virtEnabled` + `liveMigrationEnabled` flags added to `AddOnConfig` type
- [ ] `gpuNodeCount`, `gpuType`, `gpuMode`, `migProfile` fields added to `AddOnConfig` type
- [ ] `rhoaiEnabled` flag added to `AddOnConfig` type (may already exist as placeholder)
- [ ] `calcVirt()` — worker node sizing from VM count × vCPU + RAM, with KubeVirt overhead
- [ ] Live migration +1 node reserve applied inside `calcVirt()` when liveMigrationEnabled
- [ ] `calcGPUNodes()` — GPU node sizing (count × node spec), appended to ClusterSizing as `gpuNodes`
- [ ] MIG profile instances-per-GPU lookup table in `constants.ts`
- [ ] `calcSNO()` updated — virt profile: +6 vCPU, 32 GB RAM min, +50 GB virt disk
- [ ] RHOAI worker node minimum enforcement (8 vCPU / 32 GB RAM floor when rhoaiEnabled)
- [ ] `GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION` validation warning
- [ ] `LIVE_MIGRATION_REQUIRES_RWX` validation warning
- [ ] `gpuNodes` and `virtStorageGB` rows in BomTable
- [ ] GPU mode selector and VM density inputs in wizard Step 2 (Workload) or Step 3 (Architecture)
- [ ] All new i18n keys in EN/FR/IT/DE

### Add After Validation (v2.1)

- [ ] GPU mode comparison sub-table in results — trigger: user requests side-by-side GPU mode comparison
- [ ] Time-slicing GPU option — trigger: user request, after NVIDIA time-slicing confirmed in Red Hat sizing tables
- [ ] vGPU density sizing — trigger: when NVIDIA vGPU profile catalog is stable enough to maintain statically
- [ ] Mixed GPU node rows (multiple GPU types in one cluster) — trigger: customer demand

### Future Consideration (v2.2+)

- [ ] Dynamic GPU catalog updates — defer: offline use case must be preserved
- [ ] Multi-cluster virt sizing — defer: scope is v2.1+ per PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| calcVirt() VM density sizing | HIGH | MEDIUM | P1 |
| KubeVirt memory overhead constant | HIGH | LOW | P1 |
| Live migration +1 node reserve | HIGH | LOW | P1 |
| GPU passthrough blocks migration warning | HIGH | LOW | P1 |
| RWX storage required warning | HIGH | LOW | P1 |
| GPU node profile sizing (calcGPUNodes) | HIGH | MEDIUM | P1 |
| MIG partition profile lookup table | MEDIUM | LOW | P1 |
| SNO-with-Virt boosted minimums | MEDIUM | LOW | P1 |
| RHOAI worker node floor enforcement | MEDIUM | LOW | P1 |
| Updated BoM rows (GPU + virt storage) | HIGH | LOW | P1 |
| Wizard inputs for new fields | HIGH | MEDIUM | P1 |
| i18n keys (EN/FR/IT/DE) | HIGH | LOW | P1 |
| GPU mode comparison sub-table | MEDIUM | MEDIUM | P2 |
| Time-slicing GPU option | LOW | MEDIUM | P3 |
| vGPU density sizing (profile catalog) | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.0 launch
- P2: Should have, add when core is stable
- P3: Nice to have, future milestone

---

## Competitor Feature Analysis

No direct public competitor for a standalone OpenShift Virtualization + RHOAI sizer exists.
The vcf-sizer (sister tool, same maintainer) covers VMware vSphere VM density using a similar
approach: worker nodes driven by VM count × vCPU + RAM + overhead. The os-sizer should follow
the same pattern for consistency.

| Feature | vcf-sizer | Red Hat PS internal tools | Our Approach |
|---------|-----------|--------------------------|--------------|
| VM density formula | vmCount × vCPU / nodeVcpu | Manual spreadsheet | calcVirt() — formula matching vcf-sizer pattern |
| GPU node sizing | Not applicable | Not public | calcGPUNodes() driven by gpuMode enum |
| Live migration reserve | Not applicable | Manual | Auto-applied +1 node when liveMigrationEnabled |
| MIG profile breakdown | Not applicable | Not public | Static lookup table from NVIDIA docs |
| Warning system | Separate validation pass | Not automated | Extends existing ValidationWarning infrastructure |

---

## Sizing Constants to Implement

Sourced from official docs. These need to land in `constants.ts`:

```
// KubeVirt overhead (Red Hat Developer blog 2025-01)
KUBEVIRT_MEM_OVERHEAD_PER_VM_GB = 0.35    // ~350 MB qemu overhead per VM
KUBEVIRT_CPU_ALLOCATION_RATIO = 10        // default vmiCPUAllocationRatio (10:1 overcommit)

// SNO with Virtualization additional requirements
SNO_VIRT_EXTRA_VCPU = 6                   // virt operator overhead on SNO
SNO_VIRT_MIN_RAM_GB = 32                  // minimum RAM for SNO + virt
SNO_VIRT_EXTRA_DISK_GB = 50              // second disk minimum for VM storage

// RHOAI minimum worker node floor
RHOAI_MIN_VCPU_PER_WORKER = 8
RHOAI_MIN_RAM_PER_WORKER_GB = 32
RHOAI_SNO_MIN_VCPU = 32
RHOAI_SNO_MIN_RAM_GB = 128

// MIG profile instances per GPU (A100 40 GB)
MIG_A100_PROFILES = {
  '1g.5gb':  { instances: 7, memGB: 5 },
  '2g.10gb': { instances: 3, memGB: 10 },
  '3g.20gb': { instances: 2, memGB: 20 },
  '7g.40gb': { instances: 1, memGB: 40 },
}

// MIG profile instances per GPU (H100 80 GB)
MIG_H100_PROFILES = {
  '1g.10gb': { instances: 7, memGB: 10 },
  '2g.20gb': { instances: 3, memGB: 20 },
  '3g.40gb': { instances: 2, memGB: 40 },
  '7g.80gb': { instances: 1, memGB: 80 },
}

// GPU workload config values (node label values from NVIDIA GPU Operator)
GPU_MODES = ['container', 'vm-passthrough', 'vm-vgpu', 'mig'] as const
```

---

## Sources

- [Memory management in OpenShift Virtualization — Red Hat Developer 2025-01](https://developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization)
- [Right-sizing for OpenShift Virtualization — Red Hat Developer 2025-04](https://developers.redhat.com/articles/2025/04/28/announcing-right-sizing-openshift-virtualization)
- [Evaluating memory overcommitment in OpenShift Virtualization — Red Hat Developer 2025-04](https://developers.redhat.com/articles/2025/04/24/evaluating-memory-overcommitment-openshift-virtualization)
- [KubeVirt node overcommit user guide](https://kubevirt.io/user-guide/compute/node_overcommit/)
- [Storage considerations for OpenShift Virtualization — Red Hat Developer 2025-07](https://developers.redhat.com/articles/2025/07/10/storage-considerations-openshift-virtualization)
- [NVIDIA GPU Operator with OpenShift Virtualization — NVIDIA official docs](https://docs.nvidia.com/datacenter/cloud-native/openshift/latest/openshift-virtualization.html)
- [MIG Support in OpenShift Container Platform — NVIDIA official docs](https://docs.nvidia.com/datacenter/cloud-native/openshift/latest/mig-ocp.html)
- [NVIDIA GPUs — AI on OpenShift](https://ai-on-openshift.io/odh-rhoai/nvidia-gpus/)
- [How MIG maximizes GPU efficiency on OpenShift AI — Red Hat Developer 2025-02](https://developers.redhat.com/articles/2025/02/06/how-mig-maximizes-gpu-efficiency-openshift-ai)
- [NVIDIA GPU architecture overview — OpenShift Container Platform 4.17](https://docs.redhat.com/en/documentation/openshift_container_platform/4.17/html/architecture/nvidia-gpu-architecture-overview)
- [RHOAI Supported Configurations — Red Hat Customer Portal](https://access.redhat.com/articles/rhoai-supported-configs)
- [Best practices for VM deployments on OpenShift Virtualization — Microsoft Learn](https://learn.microsoft.com/en-us/azure/openshift/best-practices-openshift-virtualization)
- [Virtualization — OpenShift Container Platform 4.20 official docs](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html-single/virtualization/index)

---

*Feature research for: OpenShift Virtualization + RHOAI/GPU sizing (os-sizer v2.0)*
*Researched: 2026-04-01*
