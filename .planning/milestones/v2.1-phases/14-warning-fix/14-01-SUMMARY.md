---
phase: 14-warning-fix
plan: 01
subsystem: engine
tags: [validation, i18n, vue, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 09-virt-engine-foundation
    provides: AddOnConfig with virtEnabled, odfEnabled fields
  - phase: 03-wizard-ui
    provides: Step2WorkloadForm.vue wizard form pattern
provides:
  - rwxStorageAvailable field on AddOnConfig interface
  - Updated validation guard checking both odfEnabled and rwxStorageAvailable
  - VIRT_RWX_STORAGE_REQUIRED warning code replacing VIRT_RWX_REQUIRES_ODF
  - i18n keys in all 4 locales for renamed warning and new checkbox label
  - rwxStorageAvailable checkbox in Step2WorkloadForm (visible when virtEnabled)
affects: [validation, wizard-ui, i18n, exports]

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "Backward-compat Zod fields use .optional().default(false) to avoid breaking existing URL state"
  - "Checkbox sub-controls use v-if on parent field to appear only when relevant"

key-files:
  created: []
  modified:
    - src/engine/types.ts
    - src/engine/defaults.ts
    - src/engine/validation.ts
    - src/composables/useUrlState.ts
    - src/components/wizard/Step2WorkloadForm.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
    - src/engine/validation.test.ts
    - src/composables/__tests__/usePptxExport.test.ts

key-decisions:
  - "VIRT_RWX_REQUIRES_ODF renamed to VIRT_RWX_STORAGE_REQUIRED — new code reflects the actual guard condition (no RWX at all, not just no ODF)"
  - "rwxStorageAvailable uses .optional().default(false) in Zod schema for URL backward compatibility with v2.0 sessions"
  - "Checkbox placed inside v-if=virtEnabled wrapper so it is only shown when relevant"

patterns-established:
  - "New boolean add-on fields: add to types.ts, defaults.ts, Zod schema with .optional().default(), validation guard, locale files, and Step2WorkloadForm"

requirements-completed:
  - WARN-04
  - WARN-05

# Metrics
duration: 41min
completed: 2026-04-05
---

# Phase 14 Plan 01: Warning Fix Summary

**VIRT_RWX_STORAGE_REQUIRED warning gate extended to suppress false positives when non-ODF RWX storage is available; rwxStorageAvailable field wired through type, defaults, Zod schema, validation, 4 locales, and wizard UI**

## Performance

- **Duration:** 41 min
- **Started:** 2026-04-05T05:48:03Z
- **Completed:** 2026-04-05T06:29:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added `rwxStorageAvailable: boolean` to `AddOnConfig` interface with defaults, Zod schema backward-compat field, and full validation integration
- Renamed warning code `VIRT_RWX_REQUIRES_ODF` to `VIRT_RWX_STORAGE_REQUIRED` across all source, locale, and test files — old key completely absent from codebase
- Updated validation guard to check both `odfEnabled` and `rwxStorageAvailable` so users with NFS/Longhorn/other RWX classes no longer see false-positive warning
- Added checkbox in Step2WorkloadForm visible only when virtEnabled, following existing conditional display patterns
- All 4 locale files updated with renamed warning message and new checkbox label using proper diacritics
- 270 tests pass, TypeScript strict compilation clean

## Task Commits

Each task was committed atomically:

1. **TDD RED — Failing tests for VIRT_RWX_STORAGE_REQUIRED** - `(initial test commit)` (test)
2. **Task 1: Engine types, validation, Zod schema, locales, test fixture** - `7d5fb41` (feat)
3. **Task 2: Add rwxStorageAvailable checkbox to Step2WorkloadForm** - `b436e1a` (feat)

_Note: TDD task has separate RED commit (failing tests) before GREEN implementation commit._

## Files Created/Modified

- `src/engine/types.ts` - Added `rwxStorageAvailable: boolean` to `AddOnConfig` interface
- `src/engine/defaults.ts` - Added `rwxStorageAvailable: false` default in `createDefaultClusterConfig`
- `src/engine/validation.ts` - Updated guard to check both `odfEnabled` and `rwxStorageAvailable`; renamed code to `VIRT_RWX_STORAGE_REQUIRED`
- `src/composables/useUrlState.ts` - Added `rwxStorageAvailable: z.boolean().optional().default(false)` to `AddOnConfigSchema`
- `src/components/wizard/Step2WorkloadForm.vue` - Added `rwxStorageAvailable` computed and checkbox (v-if=virtEnabled)
- `src/i18n/locales/en.json` - Renamed `rwxRequiresOdf` to `rwxStorageRequired`; added `workload.rwxStorageAvailable`
- `src/i18n/locales/fr.json` - Same locale updates in French with proper accents
- `src/i18n/locales/de.json` - Same locale updates in German with proper umlauts
- `src/i18n/locales/it.json` - Same locale updates in Italian
- `src/engine/validation.test.ts` - Updated describe block name, all assertion codes, added new rwxStorageAvailable=true test
- `src/composables/__tests__/usePptxExport.test.ts` - Added `rwxStorageAvailable: false` to `makeClusterConfig` fixture

## Decisions Made

- `VIRT_RWX_REQUIRES_ODF` renamed to `VIRT_RWX_STORAGE_REQUIRED` — the new name accurately reflects the condition (no RWX storage at all, not just no ODF)
- Zod schema field uses `.optional().default(false)` for backward compatibility with v2.0 URL-compressed state that lacks this field
- Checkbox placed in `v-if="virtEnabled"` wrapper so it only appears when the live migration context is relevant

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all steps worked as expected. Tests transitioned cleanly from RED (1 failure) to GREEN (19 passing) after implementing the engine changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WARN-04 and WARN-05 requirements fully satisfied
- False-positive live migration warning eliminated for non-ODF RWX storage users
- No regressions — 270 tests pass, TypeScript strict clean
- Ready for any follow-on phases

---
*Phase: 14-warning-fix*
*Completed: 2026-04-05*
