# Phase 17: PDF Redesign - Discussion Log (Discuss Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-05
**Phase:** 17-pdf-redesign
**Mode:** discuss
**Areas analyzed:** Chart Implementation, Font Strategy, Warning i18n Resolution

## Gray Areas Presented

| Area | Selected for Discussion |
|------|------------------------|
| Chart implementation | Yes |
| Font strategy | Yes |
| Warning text source | Yes |
| Warning display style | No (Claude's discretion) |

## Decisions Made

### Chart Implementation
- **Decision:** Chart.js canvas → doc.addImage()
- **Rationale:** Standard approach per ROADMAP plan 17-01; handles complex bar chart rendering cleanly

### Font Strategy
- **Decision:** Helvetica (jsPDF default) — no embedded custom font
- **User note:** "Use normal font available by default, I don't know NotoSans, use classical like Helvetica"
- **Consequence noted:** PDF-03 acceptance criterion (accented FR/DE/IT characters) deferred — Helvetica drops accented chars

### Warning i18n Resolution
- **Decision:** ExportToolbar resolves i18n keys via useI18n().t(), passes resolved strings to generatePdfReport()
- **Rationale:** PDF composable stays pure TS with no Vue dependency

## Corrections Made

No corrections — all selected areas resolved in first round.
