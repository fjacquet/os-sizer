# Phase 15: Session Portability - Context

**Gathered:** 2026-04-05 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can save their complete sizing session to a `.json` file and restore it later — enabling cross-browser portability and sharing without URL size limits. This phase delivers save/load buttons in the export toolbar only. Multi-cluster export, PPTX/PDF redesign, and URL sharing are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Composable Architecture
- **D-01:** Implement `useSessionExport` composable in `src/composables/` — pure TypeScript, no Vue lifecycle hooks, parallel to `useUrlState.ts`
- **D-02:** Export two named functions: `exportSession()` and `importSession(file: File): Promise<void>` — mirrors the `generateShareUrl` / `hydrateFromUrl` naming pattern

### Session Serialization Schema
- **D-03:** Reuse `InputStateSchema` from `useUrlState.ts` as the JSON file schema — no new Zod schema required
- **D-04:** JSON export is uncompressed (human-readable, unlike LZ-string URL encoding) — filename: `os-sizer-session-YYYY-MM-DD.json`
- **D-05:** On import, parse with `InputStateSchema.safeParse()`, re-generate UUIDs for cluster `id` fields (same pattern as `hydrateFromUrl`)

### Error Handling Surface
- **D-06:** `sessionImportError` stored as `ref<string | null>` in ExportToolbar — shown inline below the Load Session button, cleared on next import attempt
- **D-07:** Error messages use i18n keys (not raw Zod errors) — user-readable strings for validation failure vs. JSON parse failure

### File Input Reset Strategy
- **D-08:** Use `:key="fileInputKey"` (integer ref, incremented after each import attempt) to force `<input type="file">` remount — ensures same file can be imported twice

### i18n Keys
- **D-09:** Add 4 keys to all 4 locale files (`en`, `fr`, `de`, `it`): `results.toolbar.saveSession`, `results.toolbar.loadSession`, `results.toolbar.sessionImportError`, `results.toolbar.sessionImportSuccess`

### Claude's Discretion
- Exact inline error styling (color, icon) — consistent with existing toolbar visual style
- Whether to show a success flash (like `copied` ref) or silent success
- Order of new buttons in toolbar (relative to existing Share/CSV/PDF/PPTX)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Session schema and URL state pattern
- `src/composables/useUrlState.ts` — `InputStateSchema`, `ClusterConfigSchema`, `hydrateFromUrl()` pattern to reuse verbatim for JSON import
- `src/composables/utils/download.ts` — `downloadBlob()` utility to call for JSON export

### Export toolbar integration point
- `src/components/results/ExportToolbar.vue` — where Save/Load buttons are added; existing button styling and loading state pattern to match
- `src/i18n/locales/en.json` — `results.toolbar.*` key namespace for new i18n keys

### Requirements
- `.planning/REQUIREMENTS.md` §SESSION-01, SESSION-02 — exact acceptance criteria for save and load flows

### Test patterns
- `src/composables/__tests__/useUrlState.test.ts` — mock pattern for inputStore, window, and Zod schema testing
- `src/composables/__tests__/download.test.ts` — downloadBlob test pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `downloadBlob(content, filename, mimeType)` in `src/composables/utils/download.ts` — call directly from `exportSession()` with `application/json` MIME type
- `InputStateSchema` / `ClusterConfigSchema` in `src/composables/useUrlState.ts` — import and reuse for `safeParse()` on import
- `useInputStore().clusters` — the single source of truth to serialize on export and mutate on import

### Established Patterns
- Pure TypeScript composables with no Vue lifecycle — `usePptxExport.ts`, `usePdfExport.ts`, `useCsvExport.ts` all follow this pattern
- `ref(false)` / `ref(true)` for loading state in ExportToolbar — same pattern for `sessionImportError`
- `store.clusters = result.data.clusters.map(c => ({ ...c, id: crypto.randomUUID() }))` — verbatim copy of `hydrateFromUrl()` hydration

### Integration Points
- `ExportToolbar.vue` — add two new buttons (`saveSession`, `loadSession`) and a hidden `<input type="file" accept=".json">` with the key-reset pattern
- All 4 locale JSON files — add `saveSession`, `loadSession`, `sessionImportError`, `sessionImportSuccess` keys under `results.toolbar`

</code_context>

<specifics>
## Specific Ideas

- No specific requirements beyond ROADMAP success criteria — open to standard approaches for button order and success flash

</specifics>

<deferred>
## Deferred Ideas

- Session JSON version field for forward compatibility — REQUIREMENTS.md already lists this as deferred to v2.2+
- Import preview before session replace ("3 clusters: Hub, Spoke-A, Spoke-B") — v2.2+ per REQUIREMENTS.md

</deferred>

---

*Phase: 15-session-portability*
*Context gathered: 2026-04-05*
