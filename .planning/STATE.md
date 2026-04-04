---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Export
current_phase: — (defining requirements)
current_plan: —
status: Defining requirements
last_updated: "2026-04-04T00:00:00.000Z"
last_activity: 2026-04-04
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

**Project:** os-sizer
**Current Phase:** — (defining requirements)
**Current Plan:** —
**Last Updated:** 2026-04-04
**Last Activity:** 2026-04-04 — Milestone v2.1 started

## Progress

```
v2.1 Milestone: Not started (defining requirements)
░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%
```

## Status

- [x] v1.0 complete (8 phases, 186 tests, shipped 2026-04-01)
- [x] v2.0 complete (12 phases, 256 tests, shipped 2026-04-04)
- [ ] v2.1 requirements defined
- [ ] v2.1 roadmap created

## Accumulated Context

- Tech stack: Vue 3 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n + pptxgenjs + jsPDF
- Pattern source: /Users/fjacquet/Projects/vcf-sizer (mirror architecture exactly)
- Critical pitfall: vue-i18n VueI18nPlugin must NOT use `include` option (Vite 8 rolldown bug)
- Architecture doc: docs/Architectures de déploiement OpenShift supportées.md
- Known tech debt: SNO_VIRT_NO_HA warning dropped by calculationStore; `gpuPerNode` orphan field in AddOnConfig (deferred to v2.2)
- WARN-02 currently says "virt requires ODF" — should be "virt requires any RWX storage"
- Export libs: pptxgenjs (PPTX), jsPDF + jspdf-autotable (PDF), native CSV
