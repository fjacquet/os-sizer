# os-sizer

## What This Is

A web-based OpenShift sizing and architecture recommendation tool for pre-sales architects and engineers. Users describe their constraints (workload, HA requirements, environment, virtualization needs, GPU/AI requirements) and the tool guides them to the right OpenShift deployment topology, calculates precise hardware requirements, and produces exportable BoM reports — including OpenShift Virtualization, GPU node pools, and RHOAI AI/ML platform sizing.

## Core Value

From constraints to proposal-ready hardware BoM in minutes — covering every supported OpenShift topology.

## Current Milestone: v2.1 Export

**Goal:** Improve export quality, add multi-cluster sizing and session portability, and fix the ODF-only live migration validation warning.

**Target features:**
- Live migration bug fix (WARN-02: any RWX storage valid, not ODF-only)
- PPTX redesign (1 slide, charts, branding)
- PDF redesign (graphs, better layout, branding)
- Multi-cluster sizing (Hub+Spoke + side-by-side topology comparison, aggregate BoM)
- Session portability (export/import JSON)

## Previous State (v2.0 shipped 2026-04-04)

- 12 phases, 41 plans, ~6,400 LOC TypeScript/Vue
- 256 tests passing (engine formulas, add-ons, stores, wizard components, export composables)
- v2.0 adds: OpenShift Virtualization (`calcVirt()`), GPU node pools (`calcGpuNodes()`), RHOAI add-on (`calcRHOAI()`), SNO-with-Virt profile, full i18n across 4 locales
- Deployed: GitHub Pages via GitHub Actions CI/CD

## Requirements

### Validated

- ✓ Vue 3 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n scaffolding — v1.0
- ✓ 8 topology calculators (StandardHA, Compact3Node, SNO, TNA, TNF, HCP, MicroShift, ManagedCloud) — v1.0
- ✓ Recommendation engine with constraint-driven topology ranking — v1.0
- ✓ Multi-step wizard: Environment → Workload → Architecture → Results — v1.0
- ✓ ODF and RHACM add-on sizing wired into calcCluster dispatcher — v1.0
- ✓ Results page: BoM table, charts, totals, warnings — v1.0
- ✓ PPTX/PDF/CSV exports — v1.0
- ✓ URL sharing (lz-string + Zod encoding) — v1.0
- ✓ EN/FR/IT/DE i18n (all strings, all locales) — v1.0
- ✓ GitHub Pages deployment + CI/CD — v1.0
- ✓ 186 tests: engine formulas, recommendation engine, stores, wizard components — v1.0
- ✓ allocatableRamGB formula, Math.max minimums, HCP infraNodes support — v1.0
- ✓ OpenShift Virtualization topology (VIRT-01..04): calcVirt() KubeVirt overhead + wizard UI + recommendation boost — v2.0
- ✓ GPU node sizing (GPU-01..05): calcGpuNodes(), MIG profiles, passthrough/vGPU modes, wizard UI, BoM/exports — v2.0
- ✓ RHOAI add-on (RHOAI-01..04): worker floor enforcement, infra overhead, BoM component breakdown — v2.0
- ✓ SNO-with-Virt profile (SNO-01): 14 vCPU/32 GB/170 GB boosted minimums — v2.0
- ✓ Validation warnings (WARN-01..03): passthrough blocks migration, virt requires ODF, MIG+KubeVirt unsupported — v2.0
- ✓ 256 tests passing (70 new tests for v2.0 add-ons and UI components) — v2.0

### Active (v2.1)

- [ ] WARN-02 fix: live migration requires any RWX storage (ODF/NFS/other), not ODF exclusively
- [ ] PPTX redesign: consolidated 1-slide layout, charts/graphs, branding improvements
- [ ] PDF redesign: graphs, improved layout, branding
- [ ] Multi-cluster sizing: Hub+Spoke multi-site sizing + side-by-side topology comparison, aggregate BoM export
- [ ] Session portability: export/import session as JSON file (portable across browsers)

### Backlog (v2.2+)

- [ ] Air-gapped mirror registry sizing (bastion host, storage for 100–650 GB images)
- [ ] ROSA/ARO/OSD managed cloud comparison view
- [ ] RWX/ODF storage row as separate BoM line
- [ ] Fix SNO_VIRT_NO_HA warning surfacing (store drops .warnings from calcCluster return) — tech debt from v2.0
- [ ] Remove orphan `gpuPerNode` field from AddOnConfig — tech debt from v2.0

### Out of Scope

- Subscription/licensing cost calculations — pricing changes too frequently, maintain separately
- Network topology design — out of scope for hardware sizer
- Day-2 operations planning — focus is on initial sizing
- SNO + worker nodes — SNO is by definition single-node (not supported by Red Hat)
- vGPU license type modeling — depends on NVIDIA licensing tier, cannot be modeled statically

## Context

- Deployed at GitHub Pages: `/os-sizer/` base path
- Source of truth for hardware specs: `docs/Architectures de déploiement OpenShift supportées.md`
- Target audience: pre-sales architects creating customer proposals and BoM documents
- Modeled on `vcf-sizer` (VMware Cloud Foundation sizer) — same maintainer, same tech stack
- Known tech debt: SNO_VIRT_NO_HA warning dropped by calculationStore (hardware minimum correct, warning display missing); `gpuPerNode` orphan field in AddOnConfig

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mirror vcf-sizer tech stack | Same maintainer, consistency, proven patterns | ✓ Worked well — fast bootstrap |
| All 8 architectures in v1 | Full coverage matches architecture doc scope | ✓ Validated — users need topology choice |
| Infra nodes sized separately | Key for licensing optimization | ✓ Confirmed — separate BomTable row |
| 4 languages from day one | Primary markets: FR, EN, IT, DE | ✓ Completed with Swiss locale review |
| TDD for engine | Sizing errors are high-stakes; tests catch regressions | ✓ Caught 3 real gaps in gap-closure phases |
| Post-dispatch add-on pattern | Cleaner than per-topology add-on handling | ✓ Reused for v2.0 calcVirt/calcGpuNodes/calcRHOAI |
| Gap-closure phases 6-8 | Audit-identified gaps addressed separately | ✓ Clean separation, all gaps resolved |
| Three-constraint calcVirt formula | max(density, RAM, CPU, 3) + live migration reserve | ✓ Matches KubeVirt docs; prevents under-sizing |
| calcRHOAI void mutation pattern | Matches existing post-dispatch pattern; simpler than return | ✓ Consistent with codebase style |
| rhoaiOverhead required (not optional) | null sentinel forces all topology paths to acknowledge field | ✓ Prevented silent omission in BoM/exports |
| German locale umlauts only (no eszett) | Phase 05 decision — Web font compatibility | ✓ Reapplied in v2.0 i18n |

## Constraints

- **Tech stack**: Vue 3 + TypeScript + Vite + Tailwind v4 + Pinia + vue-i18n — match vcf-sizer for maintainability
- **Accuracy**: Sizing must align with Red Hat official hardware specifications (not estimates)
- **Languages**: FR, EN, IT, DE — all UI strings via vue-i18n
- **Exports**: PPTX via pptxgenjs, PDF via jsPDF, CSV

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-04 — v2.1 Export milestone started*
