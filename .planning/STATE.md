---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Export
current_phase: 13
current_plan: —
status: Ready to plan
last_updated: "2026-04-04T00:00:00.000Z"
last_activity: 2026-04-04
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 13
  completed_plans: 0
---

# Project State

**Project:** os-sizer
**Current Phase:** 13 — Foundation Infrastructure
**Current Plan:** —
**Last Updated:** 2026-04-04
**Last Activity:** 2026-04-04 — v2.1 roadmap created (7 phases, 15 requirements)

## Progress

```
v2.1 Milestone: Phase 13 of 19 (7 v2.1 phases total)
░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%
```

## Status

- [x] v1.0 complete (8 phases, 186 tests, shipped 2026-04-01)
- [x] v2.0 complete (12 phases, 256 tests, shipped 2026-04-04)
- [x] v2.1 requirements defined (15 requirements)
- [x] v2.1 roadmap created (Phases 13-19)
- [ ] Phase 13 planned

## Accumulated Context

- Tech stack: Vue 3 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n + pptxgenjs + jsPDF
- Pattern source: /Users/fjacquet/Projects/vcf-sizer (mirror architecture exactly)
- Critical pitfall: vue-i18n VueI18nPlugin must NOT use `include` option (Vite 8 rolldown bug)
- CALC-02 invariant: calculationStore must contain zero ref() — only computed()
- Export libs: pptxgenjs (PPTX), jsPDF + jspdf-autotable (PDF), native CSV
- pptxgenjs pitfall: options objects mutated in-place — use factory function per addChart() call
- jsPDF pitfall: animation must be { duration: 0 } or canvas captures blank on first paint
- Session import pitfall: use clusters.value = newArray (not index assignment) for reactivity
- Phase 13 is enabler (no requirements) — must complete before 14/15/16/17/18 can begin
- Phases 14, 15, 16, 17, 18 can run in parallel after Phase 13
- Phase 19 requires all of 16, 17, 18 complete

## Blockers/Concerns

- PDF Unicode: font subsetting approach (full NotoSans ~300KB vs pyftsubset subset ~30KB) — decide in Phase 17 planning
- Safari iOS: `<a download>` not honoured — flag as known limitation for Session JSON export
- WARN-02 backward compat: v2.0 sessions lack rwxStorageAvailable — Zod schema must use .optional().default(false)
