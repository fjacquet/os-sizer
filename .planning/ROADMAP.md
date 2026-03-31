# Roadmap: os-sizer

**Milestone:** v1.0 — Full OpenShift Sizer
**Granularity:** Coarse (3-5 phases)
**Created:** 2026-03-31

---

## Phase 1: Project Foundation

**Goal:** Runnable Vue 3 app with full toolchain, i18n for 4 languages, and Pinia store skeleton — ready for engine development.

**Requirements covered:** SETUP-01 – SETUP-05, I18N-01 – I18N-07

**Plans:** 2/3 plans executed

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

### Plans

1. **Core types & constants** — Define `TopologyType` union, `NodeSpec`, `ClusterConfig`, `SizingResult` types; encode all Red Hat minimum hardware constants per topology
2. **Control plane & worker formulas** — Implement CP scaling table (24/120/252/501 workers), allocatable RAM formula (tiered reservation), worker count formula (CPU/RAM/pod-density limited, 70% target utilization)
3. **Topology calculators** — One calculator function per topology (StandardHA, Compact3Node, SNO with 3 profiles, TNA, TNF, HCP, MicroShift); each returns `SizingResult`
4. **Add-on calculators** — ODF storage nodes (16vCPU/64GB × 3 + per-OSD scaling), infra node sizing formula, RHACM hub sizing
5. **Recommendation engine** — Constraint-to-topology mapping; ranks topologies by fit; returns top suggestions with i18n justification keys
6. **Engine unit tests** — Vitest tests for all formulas, constants, topology calculators, and recommendation engine; cover edge cases and minimums enforcement

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

### Plans

1. **Results page — BoM table & summary** — On-screen BoM table (node type, count, vCPU, RAM, storage), total resource summary, architecture overview card, warnings for below-minimum inputs
2. **Charts** — Bar/donut charts via vue-chartjs showing resource distribution; responsive layout
3. **URL sharing** — lz-string + Zod schema URL encoding of all inputs; copy-to-clipboard button; decode on page load
4. **PPTX export** — pptxgenjs: architecture summary slide + BoM table slide; dynamically imported; branded template
5. **PDF & CSV exports** — jsPDF + jspdf-autotable for PDF (dynamic import); plain TypeScript blob download for CSV; both triggered from results page export menu

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

### Plans

1. **Responsive design & accessibility** — Mobile-friendly layout, keyboard navigation, ARIA labels, color contrast check
2. **i18n QA pass** — Review all 4 locales for completeness, grammar, and technical accuracy; fix any gaps
3. **CI setup** — GitHub Actions: lint + type-check + test on PR; build check on main
4. **Deployment** — GitHub Pages (`.nojekyll`, static build) matching vcf-sizer deployment pattern

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
