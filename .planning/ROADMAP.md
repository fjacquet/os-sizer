# Roadmap: os-sizer

**Milestone:** v1.0 — Full OpenShift Sizer
**Granularity:** Coarse (3-5 phases)
**Created:** 2026-03-31

---

## Phase 1: Project Foundation

**Goal:** Runnable Vue 3 app with full toolchain, i18n for 4 languages, and Pinia store skeleton — ready for engine development.

**Requirements covered:** SETUP-01 – SETUP-05, I18N-01 – I18N-07

**Plans:** 3/3 plans complete

Plans:
- [x] 01-PLAN-scaffold.md — Project scaffold: Vue 3 + Vite + Tailwind v4 + ESLint + Prettier + Vitest + Wave-0 test stubs (COMPLETE: 2026-03-31)
- [ ] 01-PLAN-stores.md — Pinia store skeletons: inputStore (refs), calculationStore (computed-only), uiStore (4-step wizard)
- [ ] 01-PLAN-i18n.md — vue-i18n setup: 4 locale files, lazy-loading, LanguageSwitcher, Vite 8 rolldown compatibility

### Success Criteria

- `npm run dev` starts without errors
- `npm run test` passes (stub tests green, runner works)
- Language switcher cycles through EN/FR/IT/DE correctly
- Store types compile without errors

---

## Phase 2: Sizing Engine

**Goal:** Complete TypeScript sizing engine with all 8 topology calculators, recommendation logic, and full unit test coverage — zero Vue dependencies.

**Requirements covered:** ENG-01 – ENG-09, REC-01 – REC-03, QA-01 – QA-03

**Plans:** 1/6 plans executed

Plans:
- [x] 02-01-PLAN.md — Core types, constants, defaults, barrel index, Wave-0 test stubs
- [x] 02-02-PLAN.md — CP sizing, allocatable RAM, worker count, infra node formulas (TDD)
- [ ] 02-03-PLAN.md — 8 topology calculator functions + dispatcher (TDD)
- [ ] 02-04-PLAN.md — ODF, infra node, RHACM add-on calculators (TDD)
- [x] 02-05-PLAN.md — Recommendation engine: constraint-to-topology ranking (TDD)
- [ ] 02-06-PLAN.md — Validation module, complete test coverage, zero-Vue enforcement

### Success Criteria

- All engine functions return correct values for known inputs (match official Red Hat docs)
- 100% of engine code covered by unit tests
- `npm run test` passes with no failures
- Zero Vue imports in `src/engine/`

---

## Phase 3: Wizard UI

**Goal:** Complete multi-step input wizard — environment → workload → architecture selection — with validation and i18n.

**Requirements covered:** FORM-01 – FORM-09, I18N-01 – I18N-07 (strings), QA-04

### Plans

1. **Wizard shell** — Multi-step wizard component with back/next navigation, step indicator, progress persistence in `uiStore`
2. **Step 1 — Environment constraints** — Inputs: deployment type (datacenter/edge/far-edge/cloud), connectivity (connected/air-gapped), HA level; Zod validation; wired to `inputStore`
3. **Step 2 — Workload profile** — Inputs: number of apps, total pods, avg CPU per pod (millicores), avg RAM per pod (MiB), optional add-ons toggles; NumberSliderInput components; Zod validation
4. **Step 3 — Architecture selection** — Recommendation cards from engine; manual override dropdown; topology-specific sub-inputs (SNO profile, HCP cluster count/QPS, TNA/TNF notices)
5. **i18n string completion** — All wizard strings translated for EN/FR/IT/DE; topology names, justification messages, validation errors

### Success Criteria

- User can complete full wizard flow from Step 1 to Step 3
- Validation prevents advancing with invalid inputs
- All strings render correctly in all 4 languages
- `inputStore` reflects wizard state at every step

---

## Phase 4: Results, Exports & Sharing

**Goal:** Results page with BoM table, charts, URL sharing, and all three export formats (PPTX, PDF, CSV).

**Requirements covered:** RES-01 – RES-07, SHARE-01 – SHARE-03, EXP-01 – EXP-03, QA-05

**Plans:** 5 plans in 4 waves

Plans:
- [ ] 04-01-PLAN.md — Results page shell: BoM table, totals summary, architecture overview, warnings, App.vue step 4 wiring (Wave 1)
- [ ] 04-02-PLAN.md — Charts: vue-chartjs vCPU bar, RAM bar, Storage donut in ChartsSection grid (Wave 2, parallel)
- [ ] 04-03-PLAN.md — URL sharing: lz-string + Zod encoding, hydrateFromUrl in main.ts, ExportToolbar with Share button (Wave 2, parallel)
- [ ] 04-04-PLAN.md — PPTX export: pptxgenjs dynamic import, 2-slide report, ExportToolbar wired (Wave 3)
- [ ] 04-05-PLAN.md — PDF (jsPDF+autotable dynamic import) + CSV (blob download) exports; jspdf install (Wave 4)

### Success Criteria

- BoM table matches engine output for all 8 topologies
- Shared URL round-trips correctly (encode → navigate → same state)
- PPTX file opens in PowerPoint with correct data
- PDF file contains BoM table with correct values
- CSV file imports correctly into Excel
- `npm run build` produces clean production bundle

---

## Phase 5: Polish & Release

**Goal:** Production-ready: responsive design, full i18n QA, accessibility, CI, and deployment.

**Requirements covered:** QA-05 (final pass), all i18n locales verified

**Plans:** 1/4 plans executed

Plans:
- [ ] 05-01-PLAN.md — Responsive design and accessibility: mobile layout, ARIA labels, keyboard navigation (Wave 1)
- [x] 05-02-PLAN.md — i18n QA pass: key completeness, grammar, technical accuracy, Swiss locale review (Wave 1)
- [ ] 05-03-PLAN.md — CI setup: GitHub Actions lint + type-check + test + build on PR/push (Wave 2)
- [ ] 05-04-PLAN.md — Deployment: GitHub Pages with .nojekyll, static build, deploy workflow (Wave 3)

### Success Criteria

- App is usable on mobile (375px viewport)
- Zero missing i18n keys in all 4 locales
- CI pipeline passes on clean branch
- App deployed and accessible via GitHub Pages URL

---

## Dependency Graph

```
Phase 1 (Foundation)
    └── Phase 2 (Engine)
            └── Phase 3 (Wizard UI)
                    └── Phase 4 (Results & Exports)
                            └── Phase 5 (Polish & Release)
```

All phases are sequential (each depends on the prior).

---

## Milestones

| Milestone | Phases | Deliverable |
|-----------|--------|-------------|
| v0.1 — Engine complete | 1–2 | Runnable app with tested sizing engine |
| v0.5 — Wizard complete | 1–3 | Full input flow, all 4 languages |
| v1.0 — Full release | 1–5 | All exports, URL sharing, deployed |

---
*Created: 2026-03-31*
*Based on research: hardware-sizing.md, app-architecture.md*
