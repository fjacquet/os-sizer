# Roadmap: os-sizer

## Milestones

- ✅ **v1.0 — Full OpenShift Sizer** — Phases 1-8 (shipped 2026-04-01) → [archive](.planning/milestones/v1.0-ROADMAP.md)
- **v2.0 — OpenShift Virtualization + AI Sizing** — Phases 9-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 — Full OpenShift Sizer (Phases 1-8) — SHIPPED 2026-04-01</summary>

- [x] Phase 1: Project Foundation (3/3 plans) — completed 2026-03-31
- [x] Phase 2: Sizing Engine (6/6 plans) — completed 2026-03-31
- [x] Phase 3: Wizard UI (5/5 plans) — completed 2026-03-31
- [x] Phase 4: Results, Exports & Sharing (5/5 plans) — completed 2026-03-31
- [x] Phase 5: Polish & Release (4/4 plans) — completed 2026-03-31
- [x] Phase 6: Add-on Engine Integration (1/1 plans) — completed 2026-03-31
- [x] Phase 7: Wizard Component Tests (1/1 plans) — completed 2026-03-31
- [x] Phase 8: Engine Tech Debt (1/1 plans) — completed 2026-03-31

</details>

### v2.0 — OpenShift Virtualization + AI Sizing

- [x] **Phase 9: Virt Engine Foundation** - Extend types, implement calcVirt(), SNO-virt profile, and RWX storage warning (completed 2026-04-01)
- [ ] **Phase 10: GPU Node Engine** - Dedicated GPU node pool sizing with MIG profiles and passthrough/MIG-vGPU warnings
- [ ] **Phase 11: RHOAI Add-On Engine** - RHOAI operator overhead calculation and worker node floor enforcement
- [ ] **Phase 12: BoM, Exports, Wizard UI + i18n** - GPU and RHOAI rows in BoM/exports; wizard inputs for all new fields; all four locales

## Phase Details

### Phase 9: Virt Engine Foundation
**Goal**: The engine can size VM-based workloads with correct KubeVirt overhead and surface virt topology as a recommendation option
**Depends on**: Phase 8 (v1.0 engine complete)
**Requirements**: VIRT-02, VIRT-04, SNO-01, WARN-02
**Success Criteria** (what must be TRUE):
  1. `calcVirt()` returns a worker count that exceeds the raw VM-count-derived minimum by the KubeVirt per-node CPU overhead (2 vCPU/node) and per-VM memory overhead (218 MiB base + 8 MiB × vCPUs + 0.2% guest RAM)
  2. The recommendation engine ranks OpenShift Virtualization topology as a candidate when VM workload constraints are present
  3. SNO topology with virt enabled enforces minimum 14 vCPU, 32 GB RAM, and 170 GB total storage (120 GB root + 50 GB second disk)
  4. A `ValidationWarning` is emitted when virt topology is active and ODF is not enabled, informing that RWX storage is required for live migration
  5. All new engine code compiles with `tsc --noEmit` and passes Vitest unit tests covering the overhead formula and the RWX warning trigger
**Plans**: 4 plans
Plans:
- [x] 09-01-PLAN.md — Type Extension + Constants (ClusterSizing, AddOnConfig, RecommendationConstraints, KubeVirt constants)
- [x] 09-02-PLAN.md — calcVirt() + Integration (addons.ts implementation, calcCluster() wiring, WARN-02)
- [x] 09-03-PLAN.md — SNO-with-Virt Profile + Recommendation Engine (calcSNO snoVirtMode branch, scoreStandardHa +25 boost)
- [x] 09-04-PLAN.md — Unit Tests (Vitest tests for calcVirt formula, WARN-02 trigger, SNO-virt minimums, recommendation boost)

### Phase 10: GPU Node Engine
**Goal**: The engine sizes a dedicated GPU node pool, enforces GPU-mode constraints, and emits warnings for incompatible combinations
**Depends on**: Phase 9
**Requirements**: WARN-01, WARN-03
**Success Criteria** (what must be TRUE):
  1. A `ValidationWarning` is emitted when GPU passthrough mode is active, stating that live VM migration is permanently blocked for affected nodes
  2. A `ValidationWarning` is emitted when MIG profile is combined with KubeVirt VMs, noting the combination is unsupported by the standard GPU Operator
  3. GPU node pool sizing data is available as a typed `gpuNodes: NodeSpec | null` field on `ClusterSizing`, fully distinct from `workerNodes`
  4. MIG profile lookup (1g.5gb, 2g.10gb, 3g.20gb, 7g.40gb for A100/H100) resolves correctly and is accessible from downstream BoM and export layers
  5. All GPU engine code compiles cleanly and is covered by Vitest tests for each GPU mode and each warning trigger condition
**Plans**: 3 plans
Plans:
- [x] 10-01-PLAN.md — Type Extension + GPU Constants (AddOnConfig GPU fields, MIG_PROFILES lookup, GPU_NODE_MIN_*, defaults, useUrlState schema)
- [x] 10-02-PLAN.md — calcGpuNodes() + Integration (addons.ts implementation, calcCluster() post-dispatch wiring, WARN-01 + WARN-03 in validation.ts)
- [ ] 10-03-PLAN.md — Unit Tests (calcGpuNodes(), MIG profile lookup, WARN-01 trigger, WARN-03 trigger, GPU mode coverage)

### Phase 11: RHOAI Add-On Engine
**Goal**: The engine enforces RHOAI worker minimums and reserves operator overhead so the resulting cluster is sized to run RHOAI
**Depends on**: Phase 10
**Requirements**: RHOAI-02, RHOAI-03
**Success Criteria** (what must be TRUE):
  1. When RHOAI is enabled, every worker node in the sizing result meets a minimum of 8 vCPU and 32 GB RAM (smaller nodes are scaled up, not supplemented)
  2. Infra nodes in the sizing result carry RHOAI operator overhead as a reserved addend when RHOAI is enabled
  3. RHOAI overhead constants are defined as named typed constants (not inline literals) and are tested against the expected RHOAI 3.x cluster minimum
  4. The engine compiles and Vitest tests cover the worker floor enforcement (below-minimum and at-minimum input cases)
**Plans**: TBD

### Phase 12: BoM, Exports, Wizard UI + i18n
**Goal**: All new v2.0 capabilities are accessible through the wizard, visible in the BoM, and included in all exports across all four locales
**Depends on**: Phase 11
**Requirements**: VIRT-01, VIRT-03, GPU-01, GPU-02, GPU-03, GPU-04, GPU-05, RHOAI-01, RHOAI-04
**Success Criteria** (what must be TRUE):
  1. User can select OpenShift Virtualization as a topology in the wizard architecture step and enter VM count per worker node to drive sizing
  2. User can enable a GPU node pool, set node count, choose GPU mode (container / passthrough / vGPU), and select a MIG profile for A100/H100 GPUs; the vGPU density table is shown as a static estimated reference per GPU model
  3. User can enable the RHOAI add-on via the wizard; the resulting BoM shows a separate RHOAI overhead row with KServe, Data Science Pipelines, and Model Registry components
  4. GPU nodes appear as a dedicated row in the BoM table and in all three export formats (CSV, PPTX, PDF) — no export format silently omits the GPU row
  5. All new UI strings are present and translated in EN, FR, IT, and DE locale files with no missing keys at runtime
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Foundation | v1.0 | 3/3 | Complete | 2026-03-31 |
| 2. Sizing Engine | v1.0 | 6/6 | Complete | 2026-03-31 |
| 3. Wizard UI | v1.0 | 5/5 | Complete | 2026-03-31 |
| 4. Results, Exports & Sharing | v1.0 | 5/5 | Complete | 2026-03-31 |
| 5. Polish & Release | v1.0 | 4/4 | Complete | 2026-03-31 |
| 6. Add-on Engine Integration | v1.0 | 1/1 | Complete | 2026-03-31 |
| 7. Wizard Component Tests | v1.0 | 1/1 | Complete | 2026-03-31 |
| 8. Engine Tech Debt | v1.0 | 1/1 | Complete | 2026-03-31 |
| 9. Virt Engine Foundation | v2.0 | 4/4 | Complete   | 2026-04-01 |
| 10. GPU Node Engine | v2.0 | 2/3 | In Progress|  |
| 11. RHOAI Add-On Engine | v2.0 | 0/? | Not started | — |
| 12. BoM, Exports, Wizard UI + i18n | v2.0 | 0/? | Not started | — |

---
*v1.0 archived: 2026-04-01*
*v2.0 roadmap created: 2026-04-01*
