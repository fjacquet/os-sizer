# os-sizer

## What This Is

A web-based OpenShift sizing and architecture recommendation tool for pre-sales architects and engineers. Users describe their constraints (workload, HA requirements, environment) and the tool guides them to the right OpenShift deployment topology, then calculates precise hardware requirements and produces exportable BoM reports.

## Core Value

From constraints to proposal-ready hardware BoM in minutes — covering every supported OpenShift topology.

## Current Milestone: v2.0 OpenShift Virtualization + AI Sizing

**Goal:** Extend the sizer to handle VM-based workloads (OpenShift Virtualization / CNV) and AI/RHOAI clusters with GPU nodes, covering the full hybrid topology spectrum.

**Target features:**

- OpenShift Virtualization topology (`calcVirt()`) — worker + KubeVirt overhead + ODF RWX storage nodes
- AI / RHOAI add-on — GPU node sizing (count, type, mode: container / passthrough / vGPU), RHOAI operator overhead
- GPU node profiles — NVIDIA passthrough vs vGPU density vs MIG partition sizing
- SNO-with-Virt profile — boosted minimums (8 vCPU, 120 GB root + 50 GB virt storage)
- Updated BoM table — GPU node rows, virt storage row, live-migration warnings

## Previous State

**v1.0 shipped 2026-04-01** — Full OpenShift Sizer complete.

- 8 phases, 26 plans, ~5,100 LOC TypeScript/Vue
- 186 tests passing (engine, stores, composables, wizard components)
- Deployed: GitHub Pages via GitHub Actions CI/CD
- Tech stack: Vue 3 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n + pptxgenjs/jsPDF

## Requirements

### Validated (v1.0)

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

### Active (v2.0)

- [ ] OpenShift Virtualization topology (CNV) — `calcVirt()` calculator
- [ ] GPU node sizing — count, type, mode (container / passthrough / vGPU / MIG)
- [ ] RHOAI add-on — operator overhead + GPU nodes
- [ ] SNO-with-Virt profile — boosted hardware minimums
- [ ] Live-migration storage warning — RWX required, GPU passthrough blocks migration
- [ ] Updated BoM — GPU row, virt storage row

### Deferred (v2.1+)

- [ ] Multi-cluster sizing (multiple sites/environments in one session)
- [ ] Air-gapped mirror registry sizing (bastion host, storage for 100–650 GB images)
- [ ] ROSA/ARO/OSD managed cloud comparison view
- [ ] Side-by-side topology comparison
- [ ] Save/load sessions (localStorage)

### Out of Scope

- Subscription/licensing cost calculations — pricing changes too frequently, maintain separately
- Network topology design — out of scope for hardware sizer
- Day-2 operations planning — focus is on initial sizing
- SNO + worker nodes — SNO is by definition single-node (not supported by Red Hat)

## Context

- Deployed at GitHub Pages: `/os-sizer/` base path
- Source of truth for hardware specs: `docs/Architectures de déploiement OpenShift supportées.md`
- Target audience: pre-sales architects creating customer proposals and BoM documents
- Modeled on `vcf-sizer` (VMware Cloud Foundation sizer) — same maintainer, same tech stack

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mirror vcf-sizer tech stack | Same maintainer, consistency, proven patterns | ✓ Worked well — fast bootstrap |
| All 8 architectures in v1 | Full coverage matches architecture doc scope | ✓ Validated — users need topology choice |
| Infra nodes sized separately | Key for licensing optimization | ✓ Confirmed — separate BomTable row |
| 4 languages from day one | Primary markets: FR, EN, IT, DE | ✓ Completed with Swiss locale review |
| TDD for engine | Sizing errors are high-stakes; tests catch regressions | ✓ Caught 3 real gaps in gap-closure phases |
| Post-dispatch add-on pattern | Cleaner than per-topology add-on handling | ✓ Used for ODF/RHACM wiring in Phase 6 |
| Gap-closure phases 6-8 | Audit-identified gaps addressed separately | ✓ Clean separation, all gaps resolved |

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
*Last updated: 2026-04-01 — v2.0 milestone started*
