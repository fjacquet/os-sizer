# Requirements: os-sizer

**Defined:** 2026-04-01
**Core Value:** From constraints to proposal-ready hardware BoM in minutes — covering every supported OpenShift topology.

## v2.0 Requirements

### Virtualization (VIRT)

- [x] **VIRT-01**: User can select 'OpenShift Virtualization' as a distinct topology type in the architecture wizard step
- [x] **VIRT-02**: `calcVirt()` calculator applies KubeVirt per-worker overhead: +2 vCPU/node plus per-VM formula (0.002 × guestRAM + 218 MiB + 8 MiB × vCPUs)
- [x] **VIRT-03**: User can input the expected number of VMs per worker node to drive worker count calculation
- [x] **VIRT-04**: Virt topology is surfaced as a recommendation option in the topology recommendation engine

### GPU Nodes (GPU)

- [x] **GPU-01**: User can enable a dedicated GPU node pool with a configurable node count
- [x] **GPU-02**: User can select GPU mode: container (whole-GPU per pod), passthrough (whole-GPU per VM), vGPU (shared across VMs)
- [x] **GPU-03**: GPU nodes rendered as a separate NodeSpec row in the BoM table and all exports (CSV, PPTX, PDF)
- [x] **GPU-04**: User can select MIG profile for A100/H100 GPU nodes from a static lookup table (1g.5gb, 2g.10gb, 3g.20gb, 7g.40gb)
- [x] **GPU-05**: vGPU density table displayed per GPU model (NVIDIA profile lookup, clearly marked as estimated and driver-version dependent)

### RHOAI (RHOAI)

- [x] **RHOAI-01**: User can enable the RHOAI add-on to size an AI/ML platform layer
- [x] **RHOAI-02**: When RHOAI is enabled, each worker node is enforced to meet minimum 8 vCPU / 32 GB RAM
- [x] **RHOAI-03**: RHOAI operator overhead is reserved on infra nodes when RHOAI is enabled
- [x] **RHOAI-04**: BoM shows RHOAI component breakdown (KServe, Data Science Pipelines, Model Registry) as a separate overhead row

### SNO with Virtualization (SNO)

- [x] **SNO-01**: SNO wizard profile includes a 'SNO-with-Virt' option with boosted hardware minimums: 14 vCPU, 32 GB RAM, 170 GB total storage (120 GB root + 50 GB second disk for VM PVCs)

### Validation Warnings (WARN)

- [x] **WARN-01**: System emits a `ValidationWarning` when GPU passthrough mode is active, informing that live migration is permanently blocked
- [x] **WARN-02**: System emits a `ValidationWarning` when virt topology is selected without ODF enabled, informing that RWX storage is required for live migration
- [x] **WARN-03**: System emits a `ValidationWarning` when MIG profile is combined with KubeVirt VMs, noting this combination is unsupported by the standard GPU Operator

## Future Requirements (v2.1+)

- Multi-cluster sizing (multiple sites/environments in one session)
- Air-gapped mirror registry sizing (bastion host, storage for 100–650 GB images)
- ROSA/ARO/OSD managed cloud comparison view
- Side-by-side topology comparison
- Save/load sessions (localStorage)
- RWX/ODF storage row as separate BoM line (deferred from v2.0)
- RHOAI vGPU v2.0 BoM output strategy (pending decision)

## Out of Scope

- Subscription/licensing cost calculations — pricing changes too frequently, maintain separately
- Network topology design — out of scope for hardware sizer
- Day-2 operations planning — focus is on initial sizing
- SNO + worker nodes — SNO is by definition single-node (not supported by Red Hat)
- vGPU license type modeling — depends on NVIDIA licensing tier, cannot be modeled statically

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| VIRT-01 | Phase 12 | Complete |
| VIRT-02 | Phase 9 | Complete |
| VIRT-03 | Phase 12 | Complete |
| VIRT-04 | Phase 9 | Complete |
| GPU-01 | Phase 12 | Complete |
| GPU-02 | Phase 12 | Complete |
| GPU-03 | Phase 12 | Complete |
| GPU-04 | Phase 12 | Complete |
| GPU-05 | Phase 12 | Complete |
| RHOAI-01 | Phase 12 | Complete |
| RHOAI-02 | Phase 11 | Complete |
| RHOAI-03 | Phase 11 | Complete |
| RHOAI-04 | Phase 12 | Complete |
| SNO-01 | Phase 9 | Complete |
| WARN-01 | Phase 10 | Complete |
| WARN-02 | Phase 9 | Complete |
| WARN-03 | Phase 10 | Complete |
