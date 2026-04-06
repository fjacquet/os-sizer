# Phase 15: Session Portability - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-05
**Phase:** 15-session-portability
**Mode:** assumptions
**Areas analyzed:** Composable Architecture, Session Serialization Schema, Error Handling Surface, File Input Reset Strategy, i18n Keys

## Assumptions Presented

### Composable Architecture
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| `useSessionExport` composable, pure TS, parallel to `useUrlState.ts` | Confident | `src/composables/useUrlState.ts`, `src/composables/utils/download.ts` |

### Session Serialization Schema
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Reuse `InputStateSchema` from `useUrlState.ts`, no new schema | Confident | `src/composables/useUrlState.ts` — schema covers all v2.1 fields |

### Error Handling Surface
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Inline `ref<string | null>` in ExportToolbar, not toast/modal | Likely | ExportToolbar inline-state pattern (`copied`, `pdfLoading`, `pptxLoading`) |

### File Input Reset Strategy
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| `:key="fileInputKey"` integer ref increment to force remount | Likely | ROADMAP success criterion 4 + Vue key trick standard |

### i18n Keys
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| 4 new keys under `results.toolbar.*` in all 4 locale files | Confident | `src/i18n/locales/en.json` existing `results.toolbar` namespace |

## Corrections Made

No corrections — all assumptions confirmed.
