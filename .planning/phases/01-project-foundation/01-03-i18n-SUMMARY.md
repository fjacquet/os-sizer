---
phase: 01-project-foundation
plan: 03
subsystem: ui
tags: [vue-i18n, i18n, localization, typescript, vite, rolldown]

# Dependency graph
requires:
  - phase: 01-01-scaffold
    provides: Vite config with VueI18nPlugin (no include option), project structure
  - phase: 01-02-stores
    provides: uiStore with setLocale() and locale ref that drives i18n switching

provides:
  - createI18n instance with legacy:false, fallbackLocale, Swiss numberFormats
  - loadLocale() lazy-loader with explicit if/else branches
  - 4 locale JSON files (en, fr, de, it) with identical 12-key os-sizer domain structure
  - LanguageSwitcher.vue component with EN/FR/DE/IT buttons
  - App.vue header wired with LanguageSwitcher

affects:
  - phase-03-wizard (all wizard strings must use t() keys defined here)
  - phase-04-results (results/toolbar/export keys defined here)
  - phase-05-polish (print keys defined here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vue-i18n Composition API mode: legacy:false required for useI18n() in <script setup>"
    - "Lazy locale loading: explicit if/else dynamic imports, not template literals"
    - "Swiss locale codes: fr-CH, de-CH, it-CH in localeMap and numberFormats"
    - "Locale JSON files: flat JSON with top-level section objects, identical key structure across all locales"

key-files:
  created:
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
    - src/components/shared/LanguageSwitcher.vue
  modified:
    - src/i18n/index.ts
    - src/i18n/locales/en.json
    - src/App.vue

key-decisions:
  - "loadLocale() uses explicit if/else branches (not template literals) — avoids INEFFECTIVE_DYNAMIC_IMPORT warning with rolldown/Vite 8"
  - "Locale codes for non-EN are fr-CH, de-CH, it-CH — explicit Swiss number formatting, not inherited from parent locale"
  - "EN locale eagerly bundled in index.ts import, FR/DE/IT lazy-loaded as separate chunks"
  - "LanguageSwitcher.vue copied verbatim from vcf-sizer — identical component API"

patterns-established:
  - "i18n locale keys: top-level domain sections (topology, node, wizard, environment, workload, sno, hcp, results, validation, print)"
  - "All 4 locale files maintain identical key structure — key parity enforced by top-level count check"

requirements-completed: [SETUP-04, I18N-01, I18N-02, I18N-03, I18N-04, I18N-05, I18N-06, I18N-07]

# Metrics
duration: 15min
completed: 2026-03-31
---

# Phase 1 Plan 3: i18n Setup Summary

**vue-i18n configured with 4 Swiss locales (EN/FR/DE/IT), lazy-loading via explicit if/else branches, LanguageSwitcher in App.vue header, and Vite 8 rolldown build clean**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-31T11:30:00Z
- **Completed:** 2026-03-31T11:45:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Full i18n/index.ts replacing stub: createI18n with legacy:false, fallbackLocale, explicit Swiss numberFormats (fr-CH, de-CH, it-CH)
- 4 locale JSON files with 12 identical top-level os-sizer domain keys (topology, node, wizard, environment, workload, sno, hcp, results, validation, print)
- LanguageSwitcher.vue component rendering EN/FR/DE/IT buttons, wired to uiStore.setLocale()
- App.vue header updated to include LanguageSwitcher component
- npm run build exits 0 — FR/DE/IT lazy chunks emitted correctly by Vite 8 rolldown

## Task Commits

Each task was committed atomically:

1. **Task 1: Write src/i18n/index.ts (full implementation)** - `a9276eb` (feat)
2. **Task 2: Write 4 locale JSON files with os-sizer domain keys** - `b321945` (feat)
3. **Task 3: Write LanguageSwitcher.vue, update App.vue, verify build** - `c19f302` (feat)

## Files Created/Modified

- `src/i18n/index.ts` - createI18n instance with Swiss numberFormats + loadLocale() lazy-loader
- `src/i18n/locales/en.json` - English locale with 12 os-sizer domain sections
- `src/i18n/locales/fr.json` - French locale (lazy-loaded, emits fr chunk in build)
- `src/i18n/locales/de.json` - German locale (lazy-loaded, emits de chunk in build)
- `src/i18n/locales/it.json` - Italian locale (lazy-loaded, emits it chunk in build)
- `src/components/shared/LanguageSwitcher.vue` - EN/FR/DE/IT language switcher buttons
- `src/App.vue` - Header updated to import and render LanguageSwitcher

## Decisions Made

- loadLocale() uses explicit if/else branches (not template literals): required for Vite 8 rolldown compatibility — template literal dynamic imports trigger INEFFECTIVE_DYNAMIC_IMPORT warning
- Swiss locale codes (fr-CH, de-CH, it-CH) used throughout — explicit numberFormats, no parent locale inheritance
- EN locale eagerly bundled at startup, FR/DE/IT lazy-loaded on demand from uiStore.setLocale()
- LanguageSwitcher.vue copied verbatim from vcf-sizer — identical component pattern maintained

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all 4 commands (type-check, test, lint, build) passed cleanly on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- i18n foundation complete for Phase 3 (Wizard UI) and Phase 4 (Results/Exports)
- All domain key sections pre-defined: topology, node, wizard steps 1-4, environment, workload, sno, hcp, results toolbar, validation, print
- Phase 3 wizard components can add keys under existing sections without touching logic
- Phase 2 (Sizing Engine) can proceed immediately — no i18n dependencies for engine logic

## Self-Check

- `src/i18n/index.ts` — exists and contains `legacy: false` and explicit if/else branches
- `src/i18n/locales/en.json` — exists with 12 top-level keys
- `src/i18n/locales/fr.json` — exists with 12 top-level keys
- `src/i18n/locales/de.json` — exists with 12 top-level keys
- `src/i18n/locales/it.json` — exists with 12 top-level keys
- `src/components/shared/LanguageSwitcher.vue` — exists with uiStore.setLocale
- `src/App.vue` — imports and renders LanguageSwitcher
- Commits a9276eb, b321945, c19f302 — all present in git log
- npm run build — exits 0, dist/index.html created

## Self-Check: PASSED

---
*Phase: 01-project-foundation*
*Completed: 2026-03-31*
