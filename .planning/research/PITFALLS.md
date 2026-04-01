# Pitfalls Research

**Domain:** OpenShift Virtualization + RHOAI/GPU sizing — adding virt/AI features to an existing container workload sizer
**Researched:** 2026-04-01
**Confidence:** HIGH for KubeVirt overhead numbers, GPU mode constraints, SNO minimums (official Red Hat docs). MEDIUM for RHOAI operator overhead (no single authoritative number). LOW for MIG-backed vGPU + OCP Virt combination (limited GA support).

---

## Critical Pitfalls

### Pitfall 1: Omitting the KubeVirt Node Overhead Addend in calcVirt()

**What goes wrong:**
`calcVirt()` sizes worker nodes based on VM workload demand (summed guest RAM + vCPUs) without adding the mandatory KubeVirt infrastructure overhead. The resulting BoM is systematically undersized. On a 32-worker virt cluster this can undercount by 64 cores and significant RAM.

**Why it happens:**
The existing `calcStandardHA()` pattern does not need per-node overhead addends — Kubernetes container reservations are handled by the `allocatableRamGB()` formula. Developers mirror that pattern for VMs, forgetting that virtualisation adds a second layer of platform overhead on top of OS reservations.

**How to avoid:**
Apply both addends explicitly in `calcVirt()`:

- **Per virt-worker overhead (management plane):** +2 CPU cores (2000 millicores) for virt-handler, virt-controller and KubeVirt management DaemonSet pods. Nodes that also host infrastructure components need +4 cores.
- **Per-VM overhead (virt-launcher pod):** `(0.002 × guestRAM_MiB) + 218 MiB + (8 MiB × vCPUs) + (16 MiB × graphicsDevices)`. Add 1 GiB extra per GPU or SR-IOV NIC attached to the VM.
- Apply `allocatableRamGB()` on the combined (guest + per-VM overhead) total, not on the raw guest total.

Define `VIRT_NODE_OVERHEAD_VCPU = 2` and `VIRT_VM_BASE_OVERHEAD_MIB = 218` as named constants in `constants.ts`.

**Warning signs:**
- `calcVirt()` total vCPU closely matches sum-of-VM vCPUs with no extra margin.
- No constant or variable named `virtOverhead` or `VIRT_NODE_OVERHEAD` anywhere in the codebase.
- Vitest tests for `calcVirt()` pass with VM count = 0 (overhead not being checked).

**Phase to address:**
Phase 1 (calcVirt() engine function) — encode overhead constants before any sizing formula is written.

---

### Pitfall 2: Treating GPU Passthrough, vGPU, and Container GPU as Co-Schedulable on the Same Node

**What goes wrong:**
The sizer UI offers GPU mode (passthrough / vGPU / container) as a global cluster-level setting and calculates one GPU node count for the cluster. In reality, NVIDIA GPU Operator enforces mutually exclusive node labels: a node is labeled `nvidia.com/gpu.workload.config=container`, `vm-passthrough`, or `vm-vgpu`. A single node cannot serve GPU containers AND GPU VMs simultaneously. Sizing as if you can mix them on shared nodes produces an invalid BoM.

**Why it happens:**
Sizer UIs naturally flatten workload inputs into a single node pool. The hardware-level GPU driver constraint (vfio-pci vs nvidia vs vGPU manager cannot coexist on the same device) is not obvious from API or Kubernetes abstractions.

**How to avoid:**
Model GPU nodes as a dedicated pool, separate from general workers. In `ClusterConfig` add a `gpuMode` discriminated union (`container | passthrough | vGpu | mig`). In `calcGPUNodes()`:
- Always output a separate `gpuNodes` `NodeSpec` rather than inflating `workerNodes`.
- Emit a `GPU_DEDICATED_NODE_REQUIRED` validation warning explaining that GPU nodes must be isolated.
- For `passthrough` mode: emit `GPU_PASSTHROUGH_NO_LIVE_MIGRATION` warning — live migration is permanently blocked for these VMs.

**Warning signs:**
- GPU count is added as extra resource requests on the generic workerNodes spec.
- No dedicated `gpuNodes` field in `ClusterSizing`.
- No warning emitted for passthrough mode.

**Phase to address:**
Phase 2 (GPU node type engine) — define `gpuNodes` as a first-class `NodeSpec | null` field in `ClusterSizing` before building any UI.

---

### Pitfall 3: SNO-with-Virt Minimum Not Boosted Beyond the Base SNO Floor

**What goes wrong:**
`calcSNO()` returns `SNO_STD_MIN` = 8 vCPU / 16 GB / 120 GB. When OpenShift Virtualization is enabled on SNO, the official requirements are:
- +6 vCPU for the CNV operator stack (total ≥ 14 vCPU if using the base minimum)
- Second local storage device ≥ 50 GB for VM disks (the 120 GB root disk is OS only)
- RAM typically needs boosting for any real VM workload

Returning the base SNO spec for a virt-enabled SNO seriously undersizes the BoM. The user gets a hardware list that will fail to install or crash under minimal VM load.

**Why it happens:**
`calcSNO()` reads from a `profileMap` keyed on `snoProfile` string. A virt-enabled flag is an add-on, not a profile. Developers add the virt flag to the wizard without patching the SNO calculator to apply the SNO-virt boost.

**How to avoid:**
In `calcSNO()`, after selecting the base profile, check `config.addOns.virtEnabled`:
```
if (addOns.virtEnabled) {
  masterNodes.vcpu = Math.max(masterNodes.vcpu, SNO_VIRT_MIN_VCPU)   // 14
  masterNodes.ramGB = Math.max(masterNodes.ramGB, SNO_VIRT_MIN_RAM)  // 32 recommended
  sizing.virtStorageGB = SNO_VIRT_STORAGE_MIN                        // 50 GB second disk
  warnings.push({ code: 'SNO_VIRT_SECOND_DISK_REQUIRED', ... })
}
```
Add `SNO_VIRT_MIN_VCPU = 14`, `SNO_VIRT_MIN_RAM = 32`, `SNO_VIRT_STORAGE_MIN = 50` to `constants.ts`.

**Warning signs:**
- `SNO_STD_MIN.vcpu` is 8; a virt-enabled SNO BoM also shows 8 vCPU.
- No second-disk line in the BoM for SNO-virt.
- No `SNO_VIRT` constant defined anywhere.

**Phase to address:**
Phase 3 (SNO-with-Virt profile) — patch `calcSNO()` and add BoM second-disk row in the same phase that adds the virt-enabled wizard option.

---

### Pitfall 4: RWX Storage Requirement for Live Migration Buried as a Comment, Not a Warning

**What goes wrong:**
Live VM migration in OpenShift Virtualization requires PVCs with `ReadWriteMany` (RWX) access mode and `Block` volume mode. If VM disks are provisioned on `ReadWriteOnce` (RWO) storage classes (the default for most Ceph RBD and NFS classes), live migration silently fails at runtime — Kubernetes cannot bind the PVC to a second node. This is a customer-facing disaster discovered weeks after BoM approval.

A sizer that does not surface this as a BoM-level warning leaves the architect unaware.

**Why it happens:**
Storage class selection is a Day-2 configuration task. Sizing tools traditionally skip it. RWX is not flagged in the hardware BoM because it appears to be a software config issue, not a hardware sizing issue. However, ODF nodes must be in the BoM for RWX to be available — no ODF means no RWX on bare metal.

**How to avoid:**
In `calcVirt()`:
- If `addOns.odfEnabled = false` and `vmLiveMigration = true`: emit `VIRT_RWX_REQUIRES_ODF` error. A customer cannot have live migration without shared storage.
- If `odfEnabled = true`: emit `VIRT_USE_CEPH_RBD_BLOCK` info warning recommending Ceph RBD Block over CephFS for better VM disk performance.
- If `gpuMode = passthrough`: emit `GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION` warning, regardless of storage.

**Warning signs:**
- No warning emitted when `odfEnabled=false` and `vmLiveMigration=true` are both set.
- BoM table contains a VM live migration column but no storage class or ODF dependency note.

**Phase to address:**
Phase 1 (calcVirt engine) and Phase 4 (BoM warnings update) — the engine warning is Phase 1; the BoM row and i18n string is Phase 4.

---

### Pitfall 5: MIG-Backed vGPU in OpenShift Virtualization Silently Not Supported

**What goes wrong:**
A user selects GPU mode = `vGPU` and GPU type = `A100` or `H100` (both MIG-capable GPUs). The sizer calculates GPU nodes normally. However, the NVIDIA GPU Operator does not currently support configuring MIG-backed vGPUs for KubeVirt VMs. This combination appears valid in the UI but is unsupported at the infrastructure level.

**Why it happens:**
MIG is a feature of the GPU hardware. vGPU is a software partitioning mode. Both individually work on OpenShift Virtualization. The intersection (MIG-backed vGPU for VMs) is a documented limitation that requires a workaround (custom DaemonSet) and is not in the standard GPU Operator path.

**How to avoid:**
In `calcGPUNodes()` or the virt-aware GPU validation:
- If `gpuMode = vGpu` AND `gpuType` is a MIG-capable GPU (A30, A100, H100, etc.): emit `MIG_VGPU_VM_NOT_SUPPORTED` warning with severity `error`, pointing to the Red Hat KCS article.
- Add a `gpuProfile` input that lets users select `mig` as an explicit separate mode (not conflated with `vGPU`). MIG is purely for container workloads, not VM passthrough.

**Warning signs:**
- UI has a single "vGPU" option without distinguishing MIG-backed vs time-sliced vGPU.
- GPU type list includes A100/H100 with vGPU mode, no warning attached.

**Phase to address:**
Phase 2 (GPU node type engine) — encode the MIG/vGPU/VM exclusion as a validation rule in the same PR that introduces GPU node profiles.

---

### Pitfall 6: RHOAI Operator Overhead Missing from Worker Node Sizing

**What goes wrong:**
RHOAI (Red Hat OpenShift AI) installs a suite of operator-managed components into the cluster: dashboard, KServe, ModelMesh, Data Science Pipelines, CodeFlare/Ray, Kueue, and workbench controllers. Each component runs pods with CPU requests and memory limits. If the worker sizing only accounts for end-user AI workloads (model training pods, inference servers), the RHOAI control plane pods starve existing workloads or fail to schedule.

A commonly cited minimum is 16 vCPU / 64 GB RAM for a cluster where RHOAI itself runs, before any data science workloads.

**Why it happens:**
Operator overhead is invisible during pre-sales sizing — the customer sees training jobs and inference endpoints, not KServe controllers and pipeline backends. RHOAI uses the same post-dispatch add-on pattern as ODF/RHACM in this codebase, so developers add a `rhoaiEnabled` flag but forget to model the operator pods as a separate NodeSpec or minimum cluster size constraint.

**How to avoid:**
In `calcRHOAI()` (analogous to `calcODF()`):
- Output a `rhoaiOperatorOverhead: NodeSpec` with minimum `{ count: 0, vcpu: 4, ramGB: 16 }` representing the aggregate operator pod requests.
- Apply this overhead as an addend to an existing worker pool (do not create separate nodes — RHOAI pods schedule on workers).
- Enforce a cluster-level minimum: if `rhoaiEnabled = true`, total worker capacity must be ≥ 16 vCPU / 64 GB before workload demand is added.
- Emit `RHOAI_MINIMUM_CLUSTER_REQUIRED` warning if calculated workers fall below this floor.

**Warning signs:**
- `calcRHOAI()` returns a node spec but no cluster minimum check exists.
- Test for `rhoaiEnabled=true` with zero workload demand produces 0 workers.

**Phase to address:**
Phase 5 (RHOAI add-on calculator) — model operator overhead before any GPU sizing that references RHOAI.

---

### Pitfall 7: ClusterSizing Type Not Extended for New Node Roles — Type Errors Surface in BoM, Not Engine

**What goes wrong:**
`ClusterSizing` in `types.ts` has fixed fields: `masterNodes`, `workerNodes`, `infraNodes`, `odfNodes`, `rhacmWorkers`. Adding `gpuNodes`, `virtStorageGB`, and `rhoaiOverhead` fields requires editing `types.ts`, `calculators.ts`, `addons.ts`, `BomTable.vue`, and every test fixture that constructs a `ClusterSizing` object. If the type is extended without updating test fixtures, TypeScript catches it at compile time — but only if fixtures are typed. If fixtures are typed as `Partial<ClusterSizing>` or `any`, tests pass and a runtime error appears in the BoM table.

**Why it happens:**
Adding new calculator features is tempting to scope as "just a new field". The impact radius across the codebase is underestimated, especially for the export layer (CSV/PPTX/PDF) which reads `ClusterSizing` fields by name.

**How to avoid:**
- Extend `ClusterSizing` as the very first commit of v2.0 — before any calculator code is written.
- Make all new fields explicitly typed (never `any`), use `null` as the absent sentinel (consistent with existing pattern).
- Run `tsc --noEmit` in CI and add it to the Vitest pre-run hook.
- Add a `ClusterSizing` fixture helper in `test/fixtures.ts` that always includes all fields with typed defaults — failing fast when a new field is added but fixtures are not updated.
- Audit `BomTable.vue`, `CsvExport.ts`, `PptxExport.ts`, and `PdfExport.ts` for hardcoded field reads before merging the type change.

**Warning signs:**
- `ClusterSizing` type change compiles but BomTable renders `undefined` for new rows.
- Export files produce empty columns for GPU or virt storage rows.
- Test fixtures use object spread `{...existingSizing, gpuNodes: null}` without strict type checking.

**Phase to address:**
Phase 1 (before any other v2.0 code) — type-first, then calculator, then UI.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode KubeVirt overhead as a flat 10% RAM uplift | Simpler formula | Misses per-VM and per-node dual overhead; wrong at extremes (few large VMs vs many small VMs) | Never |
| Put GPU nodes in `workerNodes` instead of a dedicated `gpuNodes` field | No type change needed | BoM shows wrong totals; export row missing; future GPU-specific warnings impossible | Never |
| Model RHOAI overhead as a comment in the wizard, not a sizing addend | Saves one calculator function | Customers get undersized cluster; RHOAI pods starve or evict application pods | Never |
| Defer RWX/ODF warning to a tooltip instead of a `ValidationWarning` | Faster Phase 1 | Warning bypassed silently in future; missed in exports; not visible in shared URL | Only for dev preview, must be upgraded before v2.0 GA |
| Reuse `infraNodes` field for virt storage nodes | No schema change | Semantically wrong; breaks infra-node sizing logic; licensing calculations incorrect | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| KubeVirt + existing `calcCluster` dispatcher | Add `virt` as a new `topology` case | Virt is not a topology — it is an add-on to Standard HA. Add post-dispatch handling in `calcCluster()` similar to `calcODF()`, not a new switch case |
| RHOAI + ODF | Enable RHOAI without ODF | RHOAI persistent storage (model registry, pipeline artifacts, S3-backed object store) requires either ODF or external object storage. Warn when `rhoaiEnabled=true` and `odfEnabled=false` |
| GPU passthrough + live migration UI toggle | Show live migration checkbox for all GPU modes | Passthrough physically prevents live migration. Disable or hide the live-migration toggle when `gpuMode=passthrough` |
| vGPU + MIG-capable GPU type | Allow vGPU + A100/H100 combination without warning | Emit error: MIG-backed vGPU for VMs is not supported by the standard GPU Operator path |
| SNO + virt + LVMS | Enable virt on SNO without recommending LVMS for second disk | LVMS is the official local storage solution for SNO; without a second disk + LVMS or local-path storage, VM PVCs have nowhere to land |
| i18n strings for new warnings | Add English warning keys and forget FR/IT/DE | All four locales must be updated atomically. A missing key falls back to the key string itself, surfacing in production |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| CPU overcommit ratio (default 10:1) applied to GPU VM nodes | VM appears to fit on 8-core node when GPU VMs need dedicated physical CPUs | For GPU passthrough and latency-sensitive VMs, set `cpuAllocationRatio = 1` (dedicated CPUs). Document this in the BoM warning | As soon as more than one large GPU VM is scheduled on the same node |
| virt-handler memory growth with VM count | Cluster memory pressure despite correct per-VM sizing | Known upstream issue (kubevirt/kubevirt#13295): virt-handler RSS grows with VM count. Add 10–15% buffer on top of per-VM overhead for large VM counts (>50 VMs per node) | At approximately 50+ VMs per node |
| ModelMesh ScaleToZero disabled | 10+ additional pods permanently running, consuming several GB RAM even with no inference requests | Default `ScaleToZero=enabled` for ModelMesh; document this in RHOAI add-on notes | The moment `ScaleToZero` is toggled off without updating worker sizing |
| CephFS volume mode for VM disks | VM disk I/O 30–50% slower than block mode; live migration takes significantly longer | Use Ceph RBD Block PVCs for VM root disks, not CephFS Filesystem mode. Emit a `VIRT_PREFER_RBD_BLOCK` info warning | Immediately visible under any disk-intensive VM workload |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Single "GPU Mode" dropdown without explaining live migration impact | Architect selects passthrough without realising VMs cannot be migrated; discovers issue during cluster maintenance window | Add inline explanation next to GPU mode: passthrough = no live migration, vGPU = live migration supported |
| SNO + Virt presented as equivalent to full HA Virt | Customer expects HA for VMs, gets a single node | Add a prominent `SNO_NO_VM_HA` warning: SNO provides no VM high availability — a node failure means all VMs stop |
| RWX storage requirement hidden in advanced settings | Customer builds BoM without ODF, VM migration silently fails | Surface `VIRT_RWX_REQUIRES_SHARED_STORAGE` as a prominent BoM-level error when live migration is enabled without a shared storage add-on |
| GPU node BoM row merged with worker node row | BoM shows one line "24 workers (incl. 4 GPU)" — customer cannot procure separately | Render GPU nodes as a dedicated BoM row with GPU count, type, and mode columns |
| RHOAI overhead invisible in results | Cluster appears right-sized for model training but RHOAI control plane cannot start | Add an "RHOAI Operator Overhead" line in the BoM table showing the operator's aggregate resource reservation |

---

## "Looks Done But Isn't" Checklist

- [ ] **calcVirt() KubeVirt overhead:** Verify constants `VIRT_NODE_OVERHEAD_VCPU` and `VIRT_VM_BASE_OVERHEAD_MIB` exist and are applied — not just the raw guest memory sum.
- [ ] **SNO-Virt minimum:** Verify `calcSNO()` returns ≥ 14 vCPU and surfaces a second-disk row when `virtEnabled=true`.
- [ ] **GPU node isolation:** Verify `ClusterSizing.gpuNodes` is a separate `NodeSpec | null` field, not folded into `workerNodes`.
- [ ] **Live migration + ODF gate:** Verify `VIRT_RWX_REQUIRES_ODF` error fires when `odfEnabled=false && vmLiveMigration=true`.
- [ ] **GPU passthrough blocks live migration:** Verify `GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION` warning fires for `gpuMode=passthrough`.
- [ ] **MIG+vGPU+VM exclusion:** Verify `MIG_VGPU_VM_NOT_SUPPORTED` error fires when `gpuMode=vGpu` + MIG-capable GPU type selected.
- [ ] **RHOAI floor check:** Verify that `rhoaiEnabled=true` with zero workload still produces minimum 16 vCPU / 64 GB worker capacity.
- [ ] **BoM exports:** Verify CSV, PPTX, and PDF exports include GPU node row and virt storage row.
- [ ] **i18n completeness:** Verify all new `messageKey` strings exist in `en.json`, `fr.json`, `it.json`, and `de.json`.
- [ ] **Type safety:** Verify `tsc --noEmit` passes after `ClusterSizing` type extension.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| KubeVirt overhead missing from calcVirt() | MEDIUM | Add `VIRT_NODE_OVERHEAD_VCPU` constant, update formula, update all Vitest snapshots for `calcVirt`, update BoM totals test |
| GPU nodes merged into workerNodes | HIGH | Requires type change to `ClusterSizing`, new field propagation through dispatcher, BoM, and all three export formats; plan for a full PR cycle |
| SNO-Virt minimum not boosted | LOW | Single constant addition + one `if` block in `calcSNO()` + one new BoM row; 1-day fix |
| RWX/ODF warning missing | LOW | Add one `ValidationWarning` emission in `calcVirt()` + one i18n string in 4 locales |
| RHOAI floor check missing | LOW | Add minimum cluster guard in `calcRHOAI()` or as a post-dispatch check, similar to existing `Math.max(workers, 3)` pattern |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| KubeVirt node overhead addend missing | Phase 1: calcVirt() engine | Vitest: `calcVirt()` with 10 VMs shows workerNodes.vcpu > sum-of-vm-vcpus |
| GPU passthrough nodes not isolated | Phase 2: GPU node engine | Vitest: `gpuMode=passthrough` produces `gpuNodes != null` and `workerNodes` unchanged |
| SNO-Virt minimum not boosted | Phase 3: SNO-virt profile | Vitest: `calcSNO()` with `virtEnabled=true` returns ≥ 14 vCPU + second-disk warning |
| RWX/ODF gate missing | Phase 1: calcVirt() engine | Vitest: `odfEnabled=false` + `vmLiveMigration=true` produces `VIRT_RWX_REQUIRES_ODF` error |
| MIG+vGPU+VM exclusion missing | Phase 2: GPU node engine | Vitest: `gpuMode=vGpu` + A100 produces `MIG_VGPU_VM_NOT_SUPPORTED` error |
| RHOAI overhead missing | Phase 5: RHOAI add-on | Vitest: `rhoaiEnabled=true` with 0 workload produces cluster with ≥ 16 vCPU workers |
| ClusterSizing type not extended first | Phase 1 (pre-code) | `tsc --noEmit` passes; all export files compile |
| BoM exports missing new rows | Phase 4: BoM update | Manual test: CSV export contains GPU row; PPTX includes virt storage row |
| i18n strings incomplete | Phase 1–5 (per warning) | CI lint rule: every `messageKey` in `ValidationWarning[]` has a corresponding key in all 4 locale files |

---

## Sources

- [OpenShift Virtualization memory overhead formula — OCP 4.15–4.20 docs](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html-single/virtualization/index)
- [KubeVirt node overhead: +2 cores per virt worker — OCP 4.6–4.20 consistent](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html-single/virtualization/index)
- [NVIDIA GPU Operator with OpenShift Virtualization — dedicated node requirement](https://docs.nvidia.com/datacenter/cloud-native/openshift/latest/openshift-virtualization.html)
- [GPU passthrough does not support live migration — NVIDIA docs](https://docs.nvidia.com/datacenter/cloud-native/openshift/latest/openshift-virtualization.html)
- [MIG-backed vGPU not supported for KubeVirt VMs — NVIDIA GPU Operator 23.9–24.9](https://docs.nvidia.com/datacenter/cloud-native/openshift/24.9.1/openshift-virtualization.html)
- [RWX required for live migration — OKD 4.19 virt live migration docs](https://docs.okd.io/4.19/virt/live_migration/virt-about-live-migration.html)
- [Ceph RBD Block preferred over CephFS for VM disks — NetApp/Red Hat best practices](https://docs.netapp.com/us-en/netapp-solutions/containers/rh-os-n_use_case_openshift_virtualization_bpg.html)
- [SNO + Virtualization: +6 vCPU overhead, second 50 GB disk — community confirmed, hardware-sizing.md](../research/hardware-sizing.md)
- [RHOAI 16 vCPU / 64 GB minimum — ai-on-openshift.io; Red Hat Customer Portal](https://access.redhat.com/articles/rhoai-supported-configs)
- [Memory management in OpenShift Virtualization — Red Hat Developer 2025-01-31](https://developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization)
- [virt-handler memory consumption issue — kubevirt/kubevirt#13295](https://github.com/kubevirt/kubevirt/issues/13295)
- [Right-sizing for OpenShift Virtualization — Red Hat Developer 2025-12-05](https://developers.redhat.com/articles/2025/12/05/right-sizing-recommendations-openshift-virtualization)
- [OpenShift Virtualization Cluster Sizing Guide — Red Hat Customer Portal KCS 7107457](https://access.redhat.com/articles/7107457)

---
*Pitfalls research for: OpenShift Virtualization + RHOAI/GPU sizing add-on to os-sizer*
*Researched: 2026-04-01*
