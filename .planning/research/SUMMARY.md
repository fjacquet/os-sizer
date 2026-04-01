# Project Research Summary

**Project:** os-sizer v2.0 — OpenShift Virtualization + RHOAI/GPU Sizing
**Domain:** OpenShift infrastructure pre-sales sizing tool (browser-based, offline-capable)
**Researched:** 2026-04-01
**Confidence:** MEDIUM-HIGH — engine patterns HIGH (from live codebase); GPU/KubeVirt overhead numbers MEDIUM (community + docs); MIG+vGPU intersection LOW (limited GA support)

## Executive Summary

The os-sizer v1.0 already provides a complete, working Vue 3 + TypeScript sizing engine for OpenShift container workloads. The v2.0 milestone extends it with two new domains: OpenShift Virtualization (KubeVirt-based VM hosting) and AI/GPU workloads via RHOAI and the NVIDIA GPU Operator. Both extensions follow an identical architectural pattern already established in the codebase: post-dispatch add-on calculators that augment topology sizing without replacing it. No new npm packages are required — the existing stack (Vue 3, TypeScript, Pinia, Zod, chart.js, Tailwind v4) handles all new requirements.

The recommended approach is type-first, engine-first, UI-last. The single most important prerequisite is extending `ClusterSizing` in `types.ts` with `gpuNodes: NodeSpec | null` and `virtStorageGB` fields before any calculator code is written, because this type flows through the dispatcher, BoM table, and all three export formats (CSV, PPTX, PDF). Failure to do this first is the highest-risk mistake identified in research: the compiler will miss the impact if export files use untyped object access. After the type extension, the engine work divides cleanly into four parallel tracks: `calcVirt()`, `calcGpuNodes()`, SNO-virt profile, and `calcRHOAI()`.

The primary technical risks are (1) undersizing due to missing KubeVirt per-node and per-VM overhead addends in `calcVirt()`, (2) treating GPU nodes as shared with general workers rather than a dedicated isolated pool, and (3) silently producing an invalid BoM for the GPU-passthrough + live-migration combination. All three risks are preventable by encoding the correct constants and validation warnings before UI work begins. The offline-capable, pre-sales positioning of the tool rules out dynamic GPU catalog fetching, real-time cluster metrics, or licensing calculations — these must remain static lookup tables and deferred concerns.

## Key Findings

### Recommended Stack

The v1.0 stack is installed and frozen — zero new npm packages are needed for v2.0. All new features are pure TypeScript engine additions (new constants, types, pure calculator functions) plus Vue 3 component extensions using existing Tailwind v4 patterns. The existing Zod `.default()` URL-state pattern automatically preserves backward compatibility with v1.0 shared URLs when new `AddOnConfig` fields are added.

**Core technologies (unchanged):**
- Vue 3 + TypeScript: UI framework and type safety — no change
- Pinia: reactive state for `inputStore` (ClusterConfig) and `calculationStore` — ClusterConfig shape change flows automatically
- Zod v4: schema validation and URL state compression — extend `AddOnConfigSchema` with `.default()` to maintain URL compat
- chart.js + vue-chartjs: charts and BoM visualization — GPU nodes appear as a new table row, no new chart type needed
- Vitest: test framework — same calculator test pattern as existing `calculators.test.ts`

**New engine constants (typed, in `constants.ts`):**
- KubeVirt per-VM overhead: base 218 MiB + 8 MiB × vCPUs + 0.2% of guest RAM
- KubeVirt per-node overhead: 2 vCPU per virt-enabled worker
- SNO-virt minimum: 8 vCPU, 32 GB RAM, 170 GB storage (120 GB root + 50 GB virt disk)
- RHOAI minimum: 2 workers × 8 vCPU / 32 GB RAM; operator overhead ~4 vCPU / 16 GB
- MIG profiles: A100-40/80 GB, H100-80 GB, H200-141 GB (static lookup table from NVIDIA docs)

### Expected Features

See `.planning/research/FEATURES.md` for full feature table.

**Must have (table stakes for v2.0):**
- `calcVirt()` — VM density-based worker sizing with KubeVirt memory and CPU overhead applied
- Live migration +1 node reserve — added inside `calcVirt()` when `liveMigrationEnabled=true`
- `calcGpuNodes()` — dedicated GPU worker pool sizing, separate `NodeSpec | null` in `ClusterSizing`
- MIG partition profile lookup table — instances-per-GPU exposed in BoM annotation
- SNO-with-Virt boosted minimums — patch `calcSNO()` via `virtEnabled` conditional, not a new topology
- RHOAI operator overhead enforcement — minimum worker floor when `rhoaiEnabled=true`
- `GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION` validation warning — highest-priority cross-feature interaction
- `LIVE_MIGRATION_REQUIRES_RWX` / `VIRT_RWX_REQUIRES_ODF` warnings — storage dependency surfaced prominently
- Updated BoM table with GPU node row and virt storage annotation
- Wizard inputs for all new fields (Step 2/3); all new i18n keys in EN/FR/IT/DE

**Should have (v2.1 differentiators):**
- GPU mode comparison sub-table — side-by-side passthrough/vGPU/MIG trade-off matrix
- Mixed GPU node rows (multiple GPU types in one cluster)
- Time-slicing GPU option (after NVIDIA time-slicing confirmed in Red Hat sizing tables)

**Defer to v2.2+:**
- vGPU density sizing — NVIDIA profile catalog too volatile to maintain statically
- Dynamic GPU catalog fetch — breaks offline-capable use case
- Multi-cluster virt sizing — out of v2.0 scope per PROJECT.md

### Architecture Approach

The architecture is a strict 4-layer Vue app: zero-Vue engine layer (pure TypeScript), Pinia store layer, Vue component layer, and export layer. All v2.0 work follows established patterns: `calcVirt()` and `calcGpuNodes()` are post-dispatch add-ons (like `calcODF`/`calcRHACM`), not new topologies. The SNO-virt variant is an additive profile entry in `calcSNO()`'s `profileMap`, not a fork. Two new sub-components (`VirtConfigSection.vue`, `GpuConfigSection.vue`) are extracted from Step3 to keep the wizard maintainable. The `ClusterSizing` type extension is the critical prerequisite that must land in the first commit.

**Major components and their v2.0 responsibilities:**
1. `engine/types.ts` — add `GpuConfig`, `GpuMode`, extend `AddOnConfig` and `ClusterSizing`; this is the foundation commit
2. `engine/constants.ts` — add all VIRT_*, GPU_*, SNO_VIRT_*, RHOAI_* constants before any calculator work
3. `engine/calculators.ts` + `addons.ts` — add `calcVirt()`, `calcGpuNodes()`, `calcRHOAIWorkers()`; modify `calcSNO()` for virt profile
4. `engine/validation.ts` — add GPU passthrough, RWX, RHOAI minimum warnings
5. `components/wizard/` + `components/results/BomTable.vue` — new inputs and new BoM rows

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full detail including recovery cost and phase mapping.

1. **KubeVirt overhead addend missing from `calcVirt()`** — On a 32-worker cluster this causes ~64 cores undersizing. Prevention: define `VIRT_NODE_OVERHEAD_VCPU=2` and `VIRT_VM_BASE_OVERHEAD_MIB=218` as named constants before writing the formula. Test: `calcVirt()` with 10 VMs must show `workerNodes.vcpu > sum-of-vm-vcpus`.

2. **GPU nodes merged into `workerNodes` instead of dedicated pool** — NVIDIA GPU Operator enforces mutually exclusive node labels; mixed sizing produces an invalid BoM and breaks all export rows. Prevention: `ClusterSizing.gpuNodes: NodeSpec | null` must exist as a first-class field from the first type extension commit. Recovery cost is HIGH if deferred.

3. **SNO-with-Virt minimum not boosted** — `calcSNO()` returns 8 vCPU / 16 GB / 120 GB for virt-enabled SNO, which will fail to install. Prevention: single `if (addOns.virtEnabled)` branch in `calcSNO()` applying `SNO_VIRT_MIN` (14 vCPU, 32 GB RAM, 170 GB disk). Recovery cost is LOW.

4. **RWX/ODF dependency buried as a comment** — Live migration silently fails at runtime without RWX storage. Prevention: emit `VIRT_RWX_REQUIRES_ODF` as a `ValidationWarning` error (not a tooltip) when `liveMigrationEnabled=true` and `odfEnabled=false`. The warning must appear in the BoM and in exports.

5. **MIG-backed vGPU + KubeVirt combination silently unsupported** — NVIDIA GPU Operator does not support this combination in the standard path. Prevention: emit `MIG_VGPU_VM_NOT_SUPPORTED` error when `gpuMode=vgpu` and a MIG-capable GPU type (A100/H100) is selected alongside `virtEnabled=true`.

6. **`ClusterSizing` type not extended before calculator work** — TypeScript catches this at compile time only if test fixtures are strictly typed. Prevention: extend `ClusterSizing` as the absolute first v2.0 commit; add `tsc --noEmit` to CI.

## Implications for Roadmap

Based on combined research, the suggested phase structure below is dependency-driven: the type system must precede the engine, the engine must precede the UI, and validation warnings must accompany each calculator (not deferred to a final cleanup phase).

### Phase 1: Type Foundation and Engine Core (virtEnabled)
**Rationale:** The `ClusterSizing` type extension is a breaking change that touches every downstream layer. Doing it first means all subsequent PRs compile cleanly. KubeVirt overhead constants belong here because `calcVirt()` cannot be correct without them. The RWX/ODF warning is also Phase 1 because it lives in the calculator, not the UI.
**Delivers:** Extended `ClusterSizing` type, new `AddOnConfig` fields, all VIRT_* constants, `calcVirt()` with overhead, live migration +1 reserve, `VIRT_RWX_REQUIRES_ODF` validation warning, Zod schema extensions with `.default()` backward compat.
**Addresses:** calcVirt() VM density sizing, KubeVirt memory overhead, live migration reserve, RWX storage warning (table stakes P1 features).
**Avoids:** Pitfall 1 (overhead missing), Pitfall 4 (RWX buried as comment), Pitfall 7 (type not extended first).
**Research flag:** Standard patterns — follow existing `calcODF()` post-dispatch pattern exactly.

### Phase 2: GPU Node Engine
**Rationale:** GPU nodes require a dedicated `ClusterSizing.gpuNodes` field (already in Phase 1 type extension) and the full `GpuMode` type with per-mode constraints. The MIG+vGPU+VM exclusion warning must be encoded in the same PR as the GPU calculator to prevent the dangerous silent-failure case.
**Delivers:** `GpuConfig` type, `GpuMode` enum, all GPU_* and MIG_PROFILES constants, `calcGpuNodes()` in `addons.ts`, `GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION` warning, `MIG_VGPU_VM_NOT_SUPPORTED` warning, `GPU_DEDICATED_NODE_REQUIRED` warning.
**Addresses:** GPU node profile sizing, MIG partition profile lookup table (table stakes P1 features).
**Avoids:** Pitfall 2 (GPU nodes merged into workerNodes), Pitfall 5 (MIG+vGPU+VM silently unsupported).
**Research flag:** NVIDIA MIG profiles are HIGH confidence (official docs). vGPU density is deliberately out of scope for v2.0.

### Phase 3: SNO-with-Virt Profile
**Rationale:** Low-risk, self-contained change to `calcSNO()`. Grouped separately from Phase 1 to keep PRs focused and reviewable. The SNO_VIRT_MIN constant and `SnoProfile` union extension are the only dependencies.
**Delivers:** `SNO_VIRT_MIN` constant, `'virt'` entry in `calcSNO()` `profileMap`, `SNO_VIRT_SECOND_DISK_REQUIRED` warning, `SNO_NO_VM_HA` warning (SNO provides no VM HA).
**Addresses:** SNO-with-Virt boosted minimums (table stakes P1 feature).
**Avoids:** Pitfall 3 (SNO-virt minimum not boosted).
**Research flag:** Standard pattern — additive profile entry, no architecture uncertainty.

### Phase 4: RHOAI Add-On Calculator
**Rationale:** RHOAI follows the identical post-dispatch add-on pattern as ODF/RHACM. The operator overhead must be modeled as an addend to existing workers (not new nodes) with a cluster minimum check. RHOAI + ODF dependency warning belongs here.
**Delivers:** All RHOAI_* constants, `calcRHOAIWorkers()` in `addons.ts`, worker node floor enforcement (max of current vs RHOAI minimum), `RHOAI_MINIMUM_CLUSTER_REQUIRED` warning, `RHOAI_REQUIRES_STORAGE` warning when `odfEnabled=false`.
**Addresses:** RHOAI operator overhead sizing (table stakes P1 feature).
**Avoids:** Pitfall 6 (RHOAI overhead invisible in results).
**Research flag:** RHOAI overhead numbers are MEDIUM confidence — validate 16 vCPU / 64 GB cluster minimum against official RHOAI 3.x sizing docs during phase planning.

### Phase 5: BoM Table and Exports
**Rationale:** UI work is last because it depends on all ClusterSizing fields being finalized. The BoM table, CSV, PPTX, and PDF exports must all be updated atomically — partial export support is worse than none because it produces silent empty columns.
**Delivers:** GPU node row in `BomTable.vue`, virt storage annotation row, RHOAI overhead row, updated CSV/PPTX/PDF export field reads for all new `ClusterSizing` fields.
**Addresses:** Updated BoM table rows (table stakes P1 feature).
**Avoids:** Pitfall 7 (export files missing new rows, type errors surface in BoM not engine).
**Research flag:** Standard pattern — follow existing BomTable row pattern (null check + row render).

### Phase 6: Wizard Inputs and i18n
**Rationale:** Wizard inputs and i18n strings are UI-only and carry no architectural risk. Grouping all four locales (EN/FR/IT/DE) in one phase ensures they are updated atomically. The GPU mode selector (native `<select>` cascade) and MIG profile selector reuse the existing wizard form pattern — no new component library needed.
**Delivers:** Wizard Step 2/3 inputs for virt VM count/vCPU/RAM, GPU mode selector, MIG profile cascade, `VirtConfigSection.vue`, `GpuConfigSection.vue`, all new `messageKey` strings in all four locale files, live-migration toggle disabled/hidden when `gpuMode=passthrough`.
**Addresses:** Wizard inputs for new fields, i18n keys (table stakes P1 features).
**Research flag:** Standard pattern — existing wizard form pattern, no research needed.

### Phase Ordering Rationale

- **Type-first ordering** is mandatory because `ClusterSizing` and `AddOnConfig` changes touch every layer; doing this last would require re-reviewing all earlier PRs.
- **Engine before UI** is the existing codebase discipline — zero Vue imports in `engine/`. Breaking this would make the engine untestable with plain Vitest.
- **Validation warnings co-located with calculators** (Phases 1-4) prevents the "looks done but isn't" failure mode where a working calculator silently produces an invalid BoM.
- **Exports atomic in Phase 5** prevents partial export support shipping to users.
- **GPU and RHOAI as separate phases** keeps PR scope manageable and aligns with the natural `addons.ts` extension point.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (RHOAI):** RHOAI operator overhead numbers are MEDIUM confidence. The "16 vCPU / 64 GB cluster minimum" comes from ai-on-openshift.io and Red Hat Customer Portal, not a single authoritative sizing table. Validate against current RHOAI 3.x supported configurations article before finalizing constants.
- **Phase 2 (GPU vGPU mode):** vGPU density sizing is deliberately deferred to v2.1, but the `vgpu` mode must still produce a valid BoM for v2.0. The sizer cannot calculate density without a stable NVIDIA vGPU profile catalog — the Phase 2 plan must specify exactly what the BoM shows for vGPU mode (node count + static "density requires NVIDIA license" warning).

Phases with well-documented patterns (research-phase not needed):
- **Phase 1 (calcVirt engine):** KubeVirt overhead formula is documented in the Red Hat Developer blog (Jan 2025) and OCP 4.20 docs. The post-dispatch add-on pattern is identical to `calcODF()`.
- **Phase 3 (SNO-virt):** Additive profileMap entry. Constants sourced from official Red Hat SNO docs.
- **Phase 5 (BoM exports):** Null-check + row render is the existing BomTable pattern. No architectural uncertainty.
- **Phase 6 (Wizard/i18n):** Existing wizard form patterns are sufficient. Two new sub-components, native `<select>` cascade.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing installed stack; zero new packages; patterns derived directly from live codebase |
| Features | HIGH | Official Red Hat + NVIDIA docs; feature set aligns with vcf-sizer sister tool pattern |
| Architecture | HIGH | Direct source code analysis; all patterns have existing examples in the codebase |
| Pitfalls | MEDIUM-HIGH | KubeVirt/GPU constraints HIGH (official docs); RHOAI overhead MEDIUM (community + Customer Portal); MIG+vGPU+VM intersection LOW (limited GA surface) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **RHOAI exact overhead numbers:** The 16 vCPU / 64 GB cluster minimum cited in research is from community sources. During Phase 4 planning, validate against the current RHOAI 3.x supported configurations article on the Red Hat Customer Portal. The formula for RHOAI pod requests per component (dashboard, KServe, ModelMesh, etc.) may differ from the aggregate estimate.
- **vGPU mode BoM output for v2.0:** Research confirms vGPU density sizing is deferred, but the sizer must still handle `gpuMode=vgpu` without crashing. Phase 2 planning must decide: does v2.0 show a node spec with a static warning, or does it disable vGPU mode selection entirely until v2.1?
- **MIG+vGPU+VM intersection stability:** The documented limitation (MIG-backed vGPU not supported for KubeVirt VMs) applies to NVIDIA GPU Operator 23.9-24.9. By implementation time (2026), newer GPU Operator versions may have lifted this restriction. Verify against the current GPU Operator release notes during Phase 2 planning.
- **CephFS vs RBD Block for VM disks:** Research recommends emitting a `VIRT_PREFER_RBD_BLOCK` info warning, but the correct ODF storage class names are cluster-specific. The warning should reference the storage class type (RBD Block) rather than a specific StorageClass name.

## Sources

### Primary (HIGH confidence)
- NVIDIA MIG User Guide — `docs.nvidia.com/datacenter/tesla/mig-user-guide/supported-mig-profiles.html` — MIG profile names, slice counts, max instances per GPU
- NVIDIA GPU Operator with OpenShift Virtualization — `docs.nvidia.com/datacenter/cloud-native/openshift/latest/openshift-virtualization.html` — GPU modes, node label system, mode exclusivity, passthrough blocks live migration
- Red Hat OCP 4.20 Virtualization docs — `docs.redhat.com/en/documentation/openshift_container_platform/4.20/html-single/virtualization/index` — KubeVirt node overhead, RWX requirement, memory overhead formula
- Memory management in OpenShift Virtualization — `developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization` — per-VM overhead formula (218 MiB base + 8 MiB × vCPUs)

### Secondary (MEDIUM confidence)
- Red Hat RHOAI supported configurations — `access.redhat.com/articles/rhoai-supported-configs` — minimum 2 workers × 8 vCPU / 32 GB RAM
- KubeVirt node overcommit user guide — `kubevirt.io/user-guide/compute/node_overcommit/` — CPU allocation ratio 10:1 default
- SNO + Virtualization second disk requirement — `access.redhat.com/solutions/7014308` — additional 50 GiB for hostpath-provisioner
- NVIDIA How MIG maximizes GPU efficiency — `developers.redhat.com/articles/2025/02/06/how-mig-maximizes-gpu-efficiency-openshift-ai`
- Storage considerations for OCP Virt — `developers.redhat.com/articles/2025/07/10/storage-considerations-openshift-virtualization`

### Tertiary (LOW confidence — validate during implementation)
- MIG+vGPU+VM incompatibility — NVIDIA GPU Operator 23.9-24.9 docs — version-dependent, may change in newer GPU Operator releases
- RHOAI aggregate operator overhead (4 vCPU / 16 GB) — community estimate from ai-on-openshift.io, not an official sizing table
- virt-handler RSS growth with VM count — kubevirt/kubevirt#13295 — upstream issue, not yet in official sizing guidance

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
