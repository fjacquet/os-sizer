---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — OpenShift Virtualization + AI Sizing
current_phase: Phase 11 — RHOAI Add-On Engine (not started)
current_plan: —
status: Phase 11 planned — ready for execution
last_updated: "2026-04-01T09:00:47.738Z"
last_activity: 2026-04-01 — Phase 10 GPU Node Engine verified complete (221 tests passing)
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 10
  completed_plans: 8
---

# Project State

**Project:** os-sizer
**Current Phase:** Phase 11 — RHOAI Add-On Engine (not started)
**Current Plan:** —
**Last Updated:** 2026-04-01
**Last Activity:** 2026-04-01 — Phase 10 GPU Node Engine verified complete (221 tests passing)

## Progress

```
v2.0 Milestone: 2/4 phases complete
████████████████░░░░  50%

Phase 9:  Virt Engine Foundation      [ Complete  2026-04-01 ]
Phase 10: GPU Node Engine             [ Complete  2026-04-01 ]
Phase 11: RHOAI Add-On Engine         [ Not started ]
Phase 12: BoM, Exports, Wizard UI     [ Not started ]
```

## Status

- [x] v1.0 complete (8 phases, 186 tests, shipped 2026-04-01)
- [x] v2.0 requirements defined (17 requirements: VIRT-01..04, GPU-01..05, RHOAI-01..04, SNO-01, WARN-01..03)
- [x] v2.0 roadmap created (4 phases, 100% coverage)
- [x] Phase 9: Virt Engine Foundation — complete 2026-04-01 (204 tests passing)
- [x] Phase 10: GPU Node Engine — complete 2026-04-01 (221 tests passing)
- [ ] Phase 11: RHOAI Add-On Engine
- [ ] Phase 12: BoM, Exports, Wizard UI + i18n

## Decisions Made

- VueI18nPlugin configured without `include` option (Vite 8 rolldown/JSON conflict workaround)
- TypeScript 6.0 requires `"ignoreDeprecations": "6.0"` for `baseUrl` in paths
- vite-env.d.ts required for CSS side-effect imports with `noUncheckedSideEffectImports: true`
- [Phase 01]: uiStore wizard step typed as ref<1|2|3|4> — os-sizer has 4 steps, not 3 like vcf-sizer
- [Phase 01]: calculationStore has zero ref() calls — only computed() (CALC-02 compliant)
- [Phase 01]: loadLocale() uses explicit if/else branches (not template literals) for Vite 8 rolldown compatibility
- [Phase 01]: Locale codes for non-EN are fr-CH, de-CH, it-CH with explicit Swiss numberFormats (not inherited from parent locale)
- [Phase 01]: EN locale eagerly bundled, FR/DE/IT lazy-loaded via explicit dynamic imports as separate chunks
- [Phase 02]: ClusterSizing.workerNodes typed as NodeSpec | null to model SNO/compact/MicroShift topologies where workers don't exist separately
- [Phase 02]: CP_SAFETY_FACTOR (0.60) added as explicit constant alongside TARGET_UTILIZATION (0.70) — captures two different utilization targets from hardware-sizing.md
- [Phase 02]: fitScore=0 used as hard-exclusion sentinel for incompatible topology combinations
- [Phase 02-sizing-engine]: allocatableRamGB(16) is 13.4 GB not 12.4 GB — plan arithmetic comment had typo; formula (2.6 GB reserved) is correct per hardware-sizing.md specification
- [Phase 02-sizing-engine]: All 4 sizing formulas use decimal.js for intermediate arithmetic and return plain numbers, maintaining zero Vue imports (CALC-01)
- [Phase 05]: Swiss German uses proper umlauts (ä, ö, ü) throughout — only eszett (ß) is forbidden; corrected prior ASCII transliterations
- [Phase 05]: French nœud ligature used consistently for 'nœuds' throughout FR locale
- [Phase 05-01]: v-if/v-else split for active wizard step renders literal aria-current=step satisfying static analysis
- [Phase 05-03]: CI pipeline uses Node 22 with npm cache; Build step added beyond vcf-sizer pattern to catch production build regressions; targets main branch
- [Phase 05]: deploy.yml uses actions/upload-pages-artifact@v3 and actions/deploy-pages@v4 (current stable); environment block added for GitHub UI deployment URL tracking
- [Phase 06-01]: Post-dispatch augmentation pattern in calcCluster isolates add-on logic from topology functions — odfNodes/rhacmWorkers populated after dispatch
- [Phase 07]: vi.stubGlobal(navigator) required before setActivePinia to prevent uiStore navigator.language access in test environment
- [Phase 07]: workload/addOns fields require spread-merge pattern in updateCluster patch to avoid wiping sibling fields
- [Phase 08]: allocatableRamGB(32)=28.44 — inline constant in calcHCP replaced by formula call for engine consistency
- [Phase 08]: calcHCP infraNodes branch added matching calcStandardHA pattern — HCP now supports infra nodes (RES-04)
- [Phase 08]: calcTNA untouched — its infraNodes slot holds arbiter node with different semantics from infrastructure nodes
- [v2.0 Roadmap]: coarse granularity applied — research 6-phase structure compressed to 4 phases by merging SNO-virt into Phase 9 and wizard/BoM/exports into Phase 12
- [v2.0 Roadmap]: WARN-01 and WARN-03 co-located with GPU engine (Phase 10) to prevent silent-failure mode where calculator ships without its warnings
- [v2.0 Roadmap]: WARN-02 co-located with virt engine (Phase 9) — RWX dependency belongs in the calculator, not UI
- [v2.0 Roadmap]: Phase 12 marked UI hint=yes — contains all wizard inputs and BoM display work
- [Phase 09]: AddOnConfig.vmCount is explicit user input — NOT derived from vmsPerWorker * workerNodes.count (circular dependency)
- [Phase 09]: RecommendationConstraints.addOns.virt added for recommendation engine scoring in P09-03 scoreStandardHa boost
- [Phase 09]: useUrlState.ts AddOnConfigSchema extended with Phase 9 virt fields — URL state hydration now round-trips all virt fields
- [Phase 09]: calcVirt() vmCount sourced directly from config.addOns.vmCount — not derived from vmsPerWorker*workerNodes.count (circular dependency)
- [Phase 09]: SNO_VIRT_NO_LIVE_MIGRATION condition uses virtEnabled (not snoVirtMode) — live migration is a topology constraint, not a hardware profile constraint
- [Phase 09-03]: SNO_VIRT_NO_HA warning severity is 'warning' (not 'error') — SNO+Virt is supported, not forbidden; signals live migration and HA unavailable
- [Phase 09-03]: snoVirtMode branch uses SNO_VIRT_MIN regardless of snoProfile — full spec override (SNO-01)
- [Phase 09-03]: justificationKey 'recommendation.standardHa.virtWorkloads' is i18n token only — translation added in Phase 12
- [Phase 09]: Existing P09-03 tests covered recommendation VIRT-04 and calcSNO snoVirtMode — P09-04 added only calcVirt (addons.test.ts) and WARN-02 (validation.test.ts) describe blocks
- [Phase 10]: migProfile typed as string (not union) — valid values differ per GPU model; MIG_PROFILES table validates at runtime
- [Phase 10]: gpuMode/gpuModel use as const in defaults.ts to satisfy TypeScript union narrowing without losing type safety
- [Phase 10]: gpuNodeCount and gpuPerNode use Zod .min(1) — zero-node GPU pools are nonsensical; gpuEnabled:false disables the pool
- [Phase 10]: calcGpuNodes count safety guard Math.max(gpuNodeCount,1) — zero-node GPU pools are nonsensical; gpuEnabled=false disables the pool
- [Phase 10]: WARN-01 fires on passthrough regardless of virtEnabled — vfio-pci is a node-level hardware constraint affecting all VMs
- [Phase 10]: WARN-03 checks migProfile!=='' + virtEnabled (NOT gpuMode=vgpu) — MIG+KubeVirt incompatibility is orthogonal to vGPU mode
- [Phase 10]: calcGpuNodes tests use direct function call pattern — pure unit test, no config fixture needed
- [Phase 10]: MIG_PROFILES tests import directly from constants.ts — verifying lookup table structure, not engine integration
- [Phase 11]: rhoaiEnabled typed as boolean (not union) — only on/off semantics needed for Phase 11
- [Phase 11]: RHOAI_INFRA_OVERHEAD constants annotated MEDIUM confidence — no official Red Hat aggregate table; community estimate from ai-on-openshift.io

## Key Context

- Tech stack: Vue 3 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n + pptxgenjs
- Pattern source: /Users/fjacquet/Projects/vcf-sizer (mirror architecture exactly)
- New additions vs vcf-sizer: jsPDF+jspdf-autotable (PDF), CSV export, IT+DE locales
- Critical pitfall: vue-i18n VueI18nPlugin must NOT use `include` option (Vite 8 rolldown bug)
- Architecture doc: docs/Architectures de déploiement OpenShift supportées.md
- v2.0 critical pitfall: ClusterSizing type extension (gpuNodes: NodeSpec | null, virtStorageGB) MUST land in Phase 9 first commit before any calculator work
- v2.0 pattern: calcVirt() and calcGpuNodes() follow post-dispatch add-on pattern identical to calcODF()/calcRHACM()
- v2.0 research flag: RHOAI overhead constants (Phase 11) are MEDIUM confidence — validate 16 vCPU / 64 GB cluster minimum against RHOAI 3.x supported configs during Phase 11 planning

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | ~15 min | 3 | 20 |
| 01 | 02 | 10 min | 2 | 8 |
| 01 | 03 | 15 min | 3 | 7 |
| Phase 02 P01 | 5 min | 2 tasks | 9 files |
| Phase 02 P05 | 2 | 2 tasks | 2 files |
| Phase 02-sizing-engine P02 | 3 | 2 tasks | 2 files |
| Phase 05 P02 | 15 | 2 tasks | 3 files |
| Phase 05 P01 | 7 min | 2 tasks | 7 files |
| Phase 05 P03 | 3 min | 1 tasks | 1 files |
| Phase 05 P04 | 5 | 2 tasks | 2 files |
| Phase 06 P01 | 5 min | 3 tasks | 7 files |
| Phase 07 P07-01 | 4 min | 2 tasks | 5 files |
| Phase 08 P01 | 4 | 2 tasks | 2 files |
| Phase 09 P01 | 8 min | 3 tasks | 6 files |
| Phase 09 P02 | 8 | 3 tasks | 3 files |
| Phase 09 P03 | 8 min | 2 tasks | 4 files |
| Phase 09 P04 | 8 min | 3 tasks | 3 files |
| Phase 10 P01 | 5 min | 2 tasks | 4 files |
| Phase 10 P02 | 5 min | 2 tasks | 3 files |
| Phase 10 P03 | 5 min | 3 tasks | 2 files |
| Phase 11 P01 | 5 | 2 tasks | 4 files |
