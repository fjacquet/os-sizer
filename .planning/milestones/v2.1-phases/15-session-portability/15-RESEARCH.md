# Phase 15: Session Portability - Research

**Researched:** 2026-04-05
**Domain:** Vue 3 composable + File API + Zod schema validation + i18n
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Implement `useSessionExport` composable in `src/composables/` — pure TypeScript, no Vue lifecycle hooks, parallel to `useUrlState.ts`
- **D-02:** Export two named functions: `exportSession()` and `importSession(file: File): Promise<void>` — mirrors the `generateShareUrl` / `hydrateFromUrl` naming pattern
- **D-03:** Reuse `InputStateSchema` from `useUrlState.ts` as the JSON file schema — no new Zod schema required
- **D-04:** JSON export is uncompressed (human-readable, unlike LZ-string URL encoding) — filename: `os-sizer-session-YYYY-MM-DD.json`
- **D-05:** On import, parse with `InputStateSchema.safeParse()`, re-generate UUIDs for cluster `id` fields (same pattern as `hydrateFromUrl`)
- **D-06:** `sessionImportError` stored as `ref<string | null>` in ExportToolbar — shown inline below the Load Session button, cleared on next import attempt
- **D-07:** Error messages use i18n keys (not raw Zod errors) — user-readable strings for validation failure vs. JSON parse failure
- **D-08:** Use `:key="fileInputKey"` (integer ref, incremented after each import attempt) to force `<input type="file">` remount — ensures same file can be imported twice
- **D-09:** Add 4 keys to all 4 locale files (`en`, `fr`, `de`, `it`): `results.toolbar.saveSession`, `results.toolbar.loadSession`, `results.toolbar.sessionImportError`, `results.toolbar.sessionImportSuccess`

### Claude's Discretion

- Exact inline error styling (color, icon) — consistent with existing toolbar visual style
- Whether to show a success flash (like `copied` ref) or silent success
- Order of new buttons in toolbar (relative to existing Share/CSV/PDF/PPTX)

### Deferred Ideas (OUT OF SCOPE)

- Session JSON version field for forward compatibility — deferred to v2.2+
- Import preview before session replace ("3 clusters: Hub, Spoke-A, Spoke-B") — v2.2+ per REQUIREMENTS.md
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESSION-01 | User can download the current sizing session as a `.json` file from the export toolbar | `exportSession()` calls `downloadBlob()` with `JSON.stringify` of `InputStateSchema`-shaped clusters; filename pattern documented below |
| SESSION-02 | User can load a previously saved `.json` session file from the export toolbar; validated via Zod with user-friendly error messages on failure | `importSession(file)` reads via `FileReader.readAsText`, parses JSON, calls `InputStateSchema.safeParse()`, maps two error buckets to i18n keys |
</phase_requirements>

---

## Summary

Phase 15 delivers a save/load session feature using the existing Zod schema, download utility, and store already in the codebase. The implementation is intentionally a thin layer on top of proven patterns: `exportSession()` mirrors `generateShareUrl()` (serialize clusters, call `downloadBlob`), and `importSession(file)` mirrors `hydrateFromUrl()` (parse, Zod-validate, re-UUID, assign to store). No new packages are required; everything is achievable with the currently installed stack.

The only new surface beyond the composable is the `ExportToolbar.vue` UI integration: two buttons, a hidden `<input type="file">`, an error message slot, and an optional success flash. All decisions are locked in CONTEXT.md. The planner's primary task is translating those decisions into correctly ordered, testable tasks.

**Primary recommendation:** Implement `useSessionExport.ts` first (pure TS, testable in isolation), then wire it into `ExportToolbar.vue` with the key-reset pattern and i18n error messages.

---

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| zod | installed (project) | Session JSON validation via `InputStateSchema.safeParse()` | Already used for URL state; same schema applies |
| pinia | installed (project) | `useInputStore().clusters` — single source of truth for export and import target | Established store pattern |
| vue-i18n | installed (project) | i18n keys for button labels and error/success messages | All user-facing strings go through `t()` |
| Browser File API | built-in | `FileReader.readAsText(file)` to read the uploaded `.json` | No library needed; async callback wraps in Promise |
| `downloadBlob` | `src/composables/utils/download.ts` | Trigger JSON file download | Already extracted in Phase 13 for reuse |
| `InputStateSchema` | `src/composables/useUrlState.ts` (exported) | Validate imported JSON | Already exported; zero new schema work |

[VERIFIED: codebase grep — all packages confirmed installed and in use]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomUUID()` | built-in (browser + Node 14.17+) | Re-generate cluster `id` on import | Same as `hydrateFromUrl()` pattern — always use, never trust imported ids |

[VERIFIED: codebase — `src/composables/useUrlState.ts` line 112]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `FileReader.readAsText` | `file.text()` (Promise-based File API) | Both work in modern browsers; `FileReader` has broader legacy support but `file.text()` is simpler. Either is acceptable — `FileReader` matches older patterns in the codebase. |
| `InputStateSchema` reuse | New dedicated `SessionFileSchema` | Adds schema duplication; CONTEXT.md explicitly forbids this (D-03) |
| `:key` remount for file input | `inputRef.value.value = ''` reset | The `value = ''` approach is simpler but known to fail for same-file re-selection in some browsers. Key-based remount (D-08) is the correct cross-browser strategy. |

**Installation:** No new packages required.

---

## Architecture Patterns

### Composable File: `src/composables/useSessionExport.ts`

```
src/composables/
├── useUrlState.ts          # source of InputStateSchema, ClusterConfigSchema (IMPORT FROM HERE)
├── useSessionExport.ts     # NEW — exportSession() + importSession(file)
├── utils/
│   └── download.ts         # downloadBlob() — call from exportSession()
└── __tests__/
    └── useSessionExport.test.ts  # NEW test file
```

### Pattern 1: Export Function (mirrors `generateShareUrl`)

**What:** Serialize `useInputStore().clusters` (excluding `id`), `JSON.stringify`, call `downloadBlob`.
**When to use:** User clicks "Save Session" button.

```typescript
// Source: derived from src/composables/useUrlState.ts (generateShareUrl pattern)
import { useInputStore } from '@/stores/inputStore'
import { downloadBlob } from './utils/download'
import type { z } from 'zod'
import { InputStateSchema, ClusterConfigSchema } from './useUrlState'

export function exportSession(): void {
  const store = useInputStore()
  const state = {
    clusters: store.clusters.map(({ id: _id, ...rest }) => rest as z.infer<typeof ClusterConfigSchema>),
  }
  const json = JSON.stringify(state, null, 2) // human-readable (D-04)
  const date = new Date().toISOString().split('T')[0]
  downloadBlob(json, `os-sizer-session-${date}.json`, 'application/json')
}
```

[VERIFIED: pattern from src/composables/useUrlState.ts generateShareUrl() lines 118-131]

### Pattern 2: Import Function (mirrors `hydrateFromUrl`)

**What:** Read `File` via `FileReader`, parse JSON, `safeParse` via `InputStateSchema`, re-UUID, assign to store.
**When to use:** User selects a `.json` file via the hidden file input.
**Error buckets:** JSON parse failure → `sessionImportError` i18n key; Zod validation failure → `sessionImportError` i18n key (both user-readable, neither exposes raw Zod output per D-07).

```typescript
// Source: derived from src/composables/useUrlState.ts (hydrateFromUrl pattern)
import { InputStateSchema } from './useUrlState'

export function importSession(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(event.target!.result as string)
      } catch {
        reject(new Error('parse')) // caller maps to sessionImportError i18n key
        return
      }
      const result = InputStateSchema.safeParse(parsed)
      if (!result.success) {
        reject(new Error('schema')) // caller maps to sessionImportError i18n key
        return
      }
      const store = useInputStore()
      store.clusters = result.data.clusters.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
      }))
      resolve()
    }
    reader.onerror = () => reject(new Error('read'))
    reader.readAsText(file)
  })
}
```

[VERIFIED: hydrateFromUrl pattern from src/composables/useUrlState.ts lines 88-115]
[ASSUMED: Two error message buckets (parse vs schema) is the right granularity — user confirmed in D-07 that messages use i18n keys but exact key content is discretionary]

### Pattern 3: Store Replacement Pitfall — `clusters.value = newArray`

Per STATE.md accumulated context:

> Session import pitfall: use `clusters.value = newArray` (not index assignment) for reactivity

The `inputStore.ts` defines `clusters` as `ref<ClusterConfig[]>`. Assigning directly to `store.clusters` in a Pinia setup store works only when the store exposes `clusters` as the unwrapped ref (which it does — Pinia auto-unwraps). The correct pattern from `hydrateFromUrl` is:

```typescript
store.clusters = result.data.clusters.map((c) => ({ ...c, id: crypto.randomUUID() }))
```

[VERIFIED: src/stores/inputStore.ts — `clusters = ref<ClusterConfig[]>([...])` returned from setup store]
[VERIFIED: src/composables/useUrlState.ts line 110 — verbatim assignment pattern]

### Pattern 4: ExportToolbar Integration

**File input reset via key increment (D-08):**

```vue
<!-- Source: CONTEXT.md D-08 decision -->
<script setup lang="ts">
const fileInputKey = ref(0)
const sessionImportError = ref<string | null>(null)

async function handleLoadSession(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  sessionImportError.value = null // clear previous error (D-06)
  try {
    await importSession(file)
    // discretionary: show success flash (copied pattern) or silent
  } catch (err) {
    const key = (err as Error).message === 'schema' ? 'sessionImportError' : 'sessionImportError'
    sessionImportError.value = t(`results.toolbar.${key}`)
  } finally {
    fileInputKey.value++ // force <input> remount so same file can re-trigger (D-08)
  }
}
</script>

<template>
  <!-- hidden file input — key forces remount -->
  <input
    :key="fileInputKey"
    type="file"
    accept=".json"
    class="hidden"
    @change="handleLoadSession"
  />
</template>
```

[VERIFIED: ExportToolbar.vue read in full — existing `ref(false)` loading pattern confirmed; `copied` flash pattern confirmed]

### Anti-Patterns to Avoid

- **Exposing raw Zod error messages:** Never pass `result.error.issues` to the UI. Always map to i18n keys (D-07).
- **Using `inputRef.value.value = ''` to reset file input:** Works inconsistently for same-file re-selection in Safari/Firefox. Use `:key` remount (D-08).
- **Assigning to `store.clusters[i]`:** Index assignment does not trigger Pinia reactivity for array replacement. Always assign the whole array.
- **Storing `id` in the JSON export:** The id is ephemeral (re-generated on hydration). Strip it on export exactly as `generateShareUrl` does.
- **Compressing the JSON:** The decision (D-04) is human-readable uncompressed JSON, unlike the URL state which uses LZ-string. Do not add LZ compression.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom type-checking logic | `InputStateSchema.safeParse()` | Zod handles coercion, defaults, and `.strip()` automatically; already covers all fields |
| File download | `window.open(dataURL)` or `fetch` blob | `downloadBlob()` from `utils/download.ts` | Already handles Blob creation + URL revocation; tested |
| File reading | Custom XMLHttpRequest | `FileReader.readAsText(file)` (browser built-in) | Standard API; no library needed |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Cryptographically random, built into browser and Node 14.17+ |
| Error display | Global toast/notification | Inline `ref<string | null>` in ExportToolbar | Matches existing `copied` flash pattern; no new UI components |

**Key insight:** Every building block already exists in the codebase. This phase is wiring, not invention.

---

## Common Pitfalls

### Pitfall 1: Same-File Re-import Fails Silently
**What goes wrong:** User imports a file, modifies session, tries to import the same file again — no `change` event fires.
**Why it happens:** Browser caches the file input value; if the selected file path is identical, no `change` event is emitted.
**How to avoid:** Use `:key="fileInputKey"` and increment `fileInputKey` after every import attempt (success or failure). This forces the `<input>` element to unmount and remount, resetting its internal state.
**Warning signs:** Import handler not called on second selection of same file.

[VERIFIED: CONTEXT.md D-08; standard browser behavior — confirmed by web knowledge]

### Pitfall 2: Raw Zod Error Leaking to UI
**What goes wrong:** User sees `"Expected array, received string"` or a JSON issue object in the browser.
**Why it happens:** Passing `result.error.issues` or `result.error.message` directly to the error display.
**How to avoid:** Use only `t('results.toolbar.sessionImportError')` — a single user-readable message that covers both parse and schema failures. If differentiation is desired (future), use two separate i18n keys.
**Warning signs:** Error message contains brackets, "received", "expected", or Zod field paths.

[VERIFIED: CONTEXT.md D-07]

### Pitfall 3: Store Reactivity Lost on Array Replacement
**What goes wrong:** UI does not update after import despite store assignment succeeding.
**Why it happens:** `store.clusters[0] = newCluster` mutates the ref internal array without triggering Vue's reactive tracking for the array ref itself.
**How to avoid:** Always replace the whole array: `store.clusters = newArray`. This is the same pattern used by `hydrateFromUrl()`.
**Warning signs:** Console shows no error but ResultsPage still shows old data after import.

[VERIFIED: STATE.md accumulated context; src/stores/inputStore.ts — `clusters` is `ref<ClusterConfig[]>`]

### Pitfall 4: Safari iOS `<a download>` Not Honoured
**What goes wrong:** On Safari iOS, clicking a dynamically created `<a download>` anchor does not trigger a file download — it opens the file in the browser tab instead.
**Why it happens:** Safari iOS has historically blocked programmatic download attribute on dynamically created anchors.
**How to avoid:** This is a known platform limitation documented in STATE.md. Flag it in the plan as a known limitation for the JSON export. No workaround is required for v2.1 scope.
**Warning signs:** File opens as JSON text in a new tab on iOS Safari instead of downloading.

[VERIFIED: STATE.md — "Safari iOS: `<a download>` not honoured — flag as known limitation for Session JSON export"]

### Pitfall 5: Importing IDs from JSON
**What goes wrong:** Imported cluster IDs collide with existing Pinia store internal state or become stale references.
**Why it happens:** If `id` is included in the exported JSON and restored as-is on import, it could conflict if future multi-cluster logic reuses IDs.
**How to avoid:** Always exclude `id` on export (same as `generateShareUrl`). Always call `crypto.randomUUID()` on import for each cluster (same as `hydrateFromUrl`).

[VERIFIED: CONTEXT.md D-05; src/composables/useUrlState.ts lines 110-113]

---

## Code Examples

### Full Export Flow

```typescript
// Source: synthesized from src/composables/useUrlState.ts (generateShareUrl)
// and src/composables/utils/download.ts (downloadBlob)

export function exportSession(): void {
  const store = useInputStore()
  const state = {
    clusters: store.clusters.map(({ id: _id, ...rest }) => rest),
  }
  const date = new Date().toISOString().split('T')[0]
  downloadBlob(
    JSON.stringify(state, null, 2),
    `os-sizer-session-${date}.json`,
    'application/json',
  )
}
```

### Full Import Flow

```typescript
// Source: derived from src/composables/useUrlState.ts (hydrateFromUrl) lines 88-115

export function importSession(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      let raw: unknown
      try {
        raw = JSON.parse(e.target!.result as string)
      } catch {
        reject(new Error('parse'))
        return
      }
      const result = InputStateSchema.safeParse(raw)
      if (!result.success) {
        reject(new Error('schema'))
        return
      }
      const store = useInputStore()
      store.clusters = result.data.clusters.map((c) => ({ ...c, id: crypto.randomUUID() }))
      resolve()
    }
    reader.onerror = () => reject(new Error('read'))
    reader.readAsText(file)
  })
}
```

### i18n Keys to Add (all 4 locale files)

```jsonc
// Path: results.toolbar (after existing exportPptxLoading key)
// en.json — add these 4 keys
"saveSession": "Save Session",
"loadSession": "Load Session",
"sessionImportError": "Invalid session file. Please select a valid os-sizer session.",
"sessionImportSuccess": "Session loaded successfully"
```

The fr/de/it locale files follow the same `results.toolbar` key namespace structure.
[VERIFIED: src/i18n/locales/en.json lines 139-146 — toolbar section confirmed; fr.json toolbar section confirmed]

### Test Pattern for `useSessionExport.ts`

```typescript
// Source: derived from src/composables/__tests__/useUrlState.test.ts + download.test.ts

// Mock inputStore (same as useUrlState tests)
vi.mock('@/stores/inputStore', () => ({
  useInputStore: () => ({
    get clusters() { return mockClusters() },
    set clusters(val) { mockSetClusters(val) },
    activeClusterIndex: 0,
  }),
}))

// Mock FileReader in node environment
class MockFileReader {
  result: string | null = null
  onload: ((e: Event) => void) | null = null
  onerror: (() => void) | null = null
  readAsText(file: File) {
    // synchronously trigger onload for test control
    setTimeout(() => this.onload?.({ target: { result: this.result } } as unknown as Event), 0)
  }
}
globalThis.FileReader = MockFileReader as unknown as typeof FileReader

// Polyfill crypto.randomUUID in node (same as useUrlState tests)
globalThis.crypto = { randomUUID: () => 'test-uuid-' + Math.random() } as unknown as Crypto
```

[VERIFIED: src/composables/__tests__/useUrlState.test.ts — mock pattern for inputStore, window; download.test.ts — Blob/URL/document polyfill pattern]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage session persistence | JSON file export/import | v2.1 decision | File-based is explicit, portable, sharable; localStorage is hidden state with bad UX |
| URL sharing (LZ-string compressed) | JSON file for large sessions | v2.1 decision | URL approach has size limits; JSON file has no practical limit |

**Deprecated/outdated:**
- `localStorage` for session persistence: explicitly ruled Out of Scope in REQUIREMENTS.md — "hidden state, bad UX; JSON file export is the chosen approach"
- `html2canvas` for export: ruled Out of Scope in REQUIREMENTS.md — "breaks headless export composable pattern"

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Two error message buckets (parse vs schema) map to the same `sessionImportError` i18n key; differentiation not required | Architecture Patterns | If user wants distinct messages per failure type, a second i18n key is needed — low risk, easy to add |
| A2 | `FileReader.readAsText` is the correct API choice over `file.text()` | Standard Stack | `file.text()` would also work in modern browsers; test polyfill for `FileReader` is already proven in codebase mock patterns |

---

## Open Questions

1. **Success flash vs. silent success**
   - What we know: The `copied` ref pattern in ExportToolbar flashes a message for 1500ms then resets
   - What's unclear: Whether to show a `sessionImportSuccess` flash message or perform silent success (UI updates immediately as the store assignment drives reactivity)
   - Recommendation: Use the same 1500ms flash pattern as `copied` — provides confirmation without requiring a separate notification system. This is within Claude's Discretion per CONTEXT.md.

2. **Error key granularity — one key or two**
   - What we know: D-07 says "user-readable strings for validation failure vs. JSON parse failure"
   - What's unclear: Whether two separate i18n keys are expected or one generic key is sufficient
   - Recommendation: Add one generic `sessionImportError` key for v2.1 (simpler, matches D-09 which lists a single `sessionImportError` key). The import handler can map both error types to the same key since the message is user-readable either way. If differentiation becomes needed, a second key can be added without breaking changes.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 15 is purely code and configuration changes. All required APIs (`FileReader`, `crypto.randomUUID`, `Blob`, `URL.createObjectURL`) are browser built-ins already exercised in existing test polyfills. No external CLI tools, databases, or services are required.

---

## Validation Architecture

`nyquist_validation` is set to `false` in `.planning/config.json` — this section is skipped per configuration.

---

## Project Constraints (from CLAUDE.md)

- **RTK prefix:** All bash commands must be prefixed with `rtk` (e.g., `rtk git status`, `rtk vitest run`)
- **No new npm packages:** REQUIREMENTS.md explicitly states all v2.1 features are achievable with already-installed packages
- **CALC-02 invariant:** `calculationStore` must contain zero `ref()` — only `computed()`. This phase does not touch `calculationStore`, so no risk.
- **Pure TypeScript composables:** No Vue lifecycle hooks in `useSessionExport.ts` (D-01)
- **vue-i18n VueI18nPlugin:** Must NOT use `include` option (Vite 8 rolldown bug) — not relevant to this phase but must not be introduced
- **Test environment:** Vitest in node environment — DOM APIs (`FileReader`, `Blob`, `URL`, `document`) must be polyfilled manually in test setup, NOT via jsdom
- **Store assignment:** `store.clusters = newArray` (not index assignment) for reactivity — critical pitfall documented

---

## Sources

### Primary (HIGH confidence)

- `src/composables/useUrlState.ts` — `InputStateSchema`, `generateShareUrl`, `hydrateFromUrl` patterns read in full
- `src/composables/utils/download.ts` — `downloadBlob` implementation read in full
- `src/components/results/ExportToolbar.vue` — integration point read in full; button styling and ref patterns confirmed
- `src/composables/__tests__/useUrlState.test.ts` — test mock patterns read in full
- `src/composables/__tests__/download.test.ts` — DOM polyfill patterns read in full
- `src/stores/inputStore.ts` — `clusters` ref structure and setter behavior read in full
- `src/i18n/locales/en.json` lines 139-146 — `results.toolbar` key namespace confirmed
- `src/i18n/locales/fr.json` — toolbar section confirmed (parallel structure)
- `.planning/config.json` — `nyquist_validation: false` confirmed; `commit_docs: true` confirmed
- `.planning/STATE.md` — accumulated pitfalls (Safari iOS, reactivity pattern) confirmed

### Secondary (MEDIUM confidence)

- CONTEXT.md D-01 through D-09 — all decisions verified against codebase reality; no contradictions found

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in codebase; no new dependencies
- Architecture: HIGH — both functions derived directly from verified patterns in codebase (`generateShareUrl`, `hydrateFromUrl`)
- Pitfalls: HIGH — all pitfalls sourced from STATE.md accumulated context + verified codebase patterns
- i18n integration: HIGH — toolbar key namespace verified in all locale files

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable, pattern-based — not dependent on rapidly-changing ecosystem)
