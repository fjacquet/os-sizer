---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: OpenShift Virtualization + AI Sizing
current_phase: not_started
current_plan: —
status: Defining requirements
last_updated: "2026-04-01"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

**Project:** os-sizer
**Current Phase:** Not started (defining requirements)
**Current Plan:** —
**Last Updated:** 2026-04-01
**Last Activity:** 2026-04-01 — Milestone v2.0 started

## Progress

```
Status: Defining requirements for v2.0
```

## Status

- [x] v1.0 complete (8 phases, 186 tests, shipped 2026-04-01)
- [ ] v2.0 requirements defined
- [ ] v2.0 roadmap created

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

## Key Context

- Tech stack: Vue 3 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n + pptxgenjs
- Pattern source: /Users/fjacquet/Projects/vcf-sizer (mirror architecture exactly)
- New additions vs vcf-sizer: jsPDF+jspdf-autotable (PDF), CSV export, IT+DE locales
- Critical pitfall: vue-i18n VueI18nPlugin must NOT use `include` option (Vite 8 rolldown bug)
- Architecture doc: docs/Architectures de déploiement OpenShift supportées.md

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
