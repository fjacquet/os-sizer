---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: — Export
current_phase: 15
current_plan: 2 complete
status: Phase 15 Complete
last_updated: "2026-04-05T17:35:00Z"
last_activity: 2026-04-05
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 5
  completed_plans: 4
  percent: 80
---

# Project State

**Project:** os-sizer
**Current Phase:** 15
**Current Plan:** 2 complete
**Last Updated:** 2026-04-05
**Last Activity:** 2026-04-05

## Progress

```
v2.1 Milestone: Phase 15 of 19 (7 v2.1 phases total)
[████████░░] 80%  (Phase 15 complete — all 2 plans done, 276 tests passing)
```

## Status

- [x] v1.0 complete (8 phases, 186 tests, shipped 2026-04-01)
- [x] v2.0 complete (12 phases, 256 tests, shipped 2026-04-04)
- [x] v2.1 requirements defined (15 requirements)
- [x] v2.1 roadmap created (Phases 13-19)
- [x] Phase 13 Plan 01 complete — downloadBlob shared utils + useChartData pure TS module (265 tests passing)
- [x] Phase 13 Plan 02 complete — ClusterConfig role field + aggregateTotals computed (269 tests passing)
- [x] Phase 13 VERIFIED — 8/8 must-haves confirmed, CALC-02 invariant preserved
- [x] Phase 14 Plan 01 complete — VIRT_RWX_STORAGE_REQUIRED warning fix + rwxStorageAvailable field wired end-to-end (270 tests passing)
- [x] Phase 15 Plan 01 complete — useSessionExport composable (exportSession + importSession, 6 tests, pure TS)
- [x] Phase 15 Plan 02 complete — ExportToolbar session buttons + i18n keys in 4 locales (276 tests passing)

## Accumulated Context

- Tech stack: Vue 3 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n + pptxgenjs + jsPDF
- Pattern source: /Users/fjacquet/Projects/vcf-sizer (mirror architecture exactly)
- Critical pitfall: vue-i18n VueI18nPlugin must NOT use `include` option (Vite 8 rolldown bug)
- CALC-02 invariant: calculationStore must contain zero ref() — only computed()
- Export libs: pptxgenjs (PPTX), jsPDF + jspdf-autotable (PDF), native CSV
- pptxgenjs pitfall: options objects mutated in-place — use factory function per addChart() call
- jsPDF pitfall: animation must be { duration: 0 } or canvas captures blank on first paint
- Session import pitfall: use clusters.value = newArray (not index assignment) for reactivity
- Phase 13 is enabler (no requirements) — completed; unblocks Phases 14/15/16/17/18
- Phases 14, 15, 16, 17, 18 can run in parallel now that Phase 13 is complete
- Phase 19 requires all of 16, 17, 18 complete
- 13-01 decision: useChartData.ts has zero Vue imports — pure TS; ChartNodeRow labels are English (not i18n keys) for export-context safety
- 13-01 decision: jsdom not installed; download.test.ts uses manual globalThis polyfills (Blob, URL, document) in node environment
- src/composables/utils/ established as home for pure TS utilities with no Vue/Pinia dependencies
- 13-02 decision: role field is optional in ClusterConfig (undefined = no role assigned); URL schema defaults to 'standalone' for backward compatibility
- 15-01 decision: vi.stubGlobal() required for crypto polyfill in tests — globalThis.crypto is read-only in Node/Vitest environment
- 15-02 decision: ExportToolbar wrapped in outer div to allow sibling error/success p elements after flex button row

## Decisions

- Phase 15: useSessionExport reuses InputStateSchema from useUrlState.ts — no new Zod schema
- Phase 15: importSession rejects with typed Error('parse'|'schema'|'read') for clean caller error mapping
- Phase 15: fileInputKey incremented in finally block ensures same-file re-import (D-08)
- Phase 15: Error messages always use i18n keys — Zod internals never exposed to UI (T-15-06)

## Blockers/Concerns

- PDF Unicode: font subsetting approach (full NotoSans ~300KB vs pyftsubset subset ~30KB) — decide in Phase 17 planning
- Safari iOS: `<a download>` not honoured — known limitation for Session JSON export (documented)
- WARN-04/05 resolved: rwxStorageAvailable field added with .optional().default(false) for backward compat; VIRT_RWX_REQUIRES_ODF renamed to VIRT_RWX_STORAGE_REQUIRED
- 14-01 decision: VIRT_RWX_REQUIRES_ODF renamed to VIRT_RWX_STORAGE_REQUIRED — new code accurately reflects that the guard checks for absence of any RWX storage, not just ODF
