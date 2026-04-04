# Phase 13: Foundation Infrastructure — Research

**Researched:** 2026-04-04
**Domain:** Vue 3 / TypeScript refactoring — shared utility extraction, Pinia store extension, engine type extension
**Confidence:** HIGH — all findings based on direct source code inspection of the actual codebase

---

## Summary

Phase 13 is a pure infrastructure phase: zero user-visible changes, 100% internal refactoring. It extracts three shared modules and extends two existing ones so that all v2.1 feature phases (14-18) can build without duplicating logic or violating the CALC-02 invariant.

The source code inspection confirms that every artifact this phase needs to produce either (a) already exists in draft form inside an existing file (the `downloadBlob` function in `useCsvExport.ts`, the node-rows pattern in all three chart components) or (b) is a straightforward additive change with no conflicts (the optional `role` field on `ClusterConfig`, the `aggregateTotals` computed in `calculationStore`). Nothing requires a new npm package. Nothing touches the wizard, the engine formula logic, or any UI component that would risk regressions.

The single most critical discipline this phase must enforce is **CALC-02**: `calculationStore.ts` must contain zero `ref()` calls. The current file passes this check (only `computed()` used). The new `aggregateTotals` must also be `computed()`. This is a compile-time constraint, not a runtime one — vitest will not catch it automatically, so a grep check must be included in the verification step.

**Primary recommendation:** Execute as two sequential plans — Plan 13-01 extracts `downloadBlob` and creates `useChartData.ts`; Plan 13-02 adds the `role` field and `aggregateTotals`. Keep each plan atomic so test regression is checked independently.

---

## Project Constraints (from CLAUDE.md)

- Always prefix shell commands with `rtk` (RTK token-killer proxy).
- Never use `git add .` — add specific files by name.
- Context7 MCP required before writing any library function calls.
- Serena symbolic tools preferred for code navigation over `grep`.
- CALC-02 invariant: `calculationStore.ts` must contain zero `ref()` — only `computed()`.
- CALC-01 invariant: `src/engine/` must never import Vue, Pinia, or Vue ecosystem.
- pptxgenjs pitfall: options objects mutated in-place — use factory function per `addChart()` call.
- jsPDF pitfall: `animation: { duration: 0 }` required or canvas is blank on export.
- Session import pitfall: use `clusters.value = newArray` (ref replacement), not index assignment.
- vue-i18n VueI18nPlugin must NOT use `include` option (Vite 8 rolldown bug).

---

## What Currently Exists (Source Code Findings)

### `src/composables/useCsvExport.ts` — downloadBlob is already there

The exact function to extract (lines 33-41):

```typescript
function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

Currently `private` (no `export`). Plan 13-01 moves this to `src/composables/utils/download.ts`, exports it, and replaces the private copy in `useCsvExport.ts` with an import. No logic change — pure extraction.

**Callers after extraction:**
- `useCsvExport.ts` (existing, now imports instead of defining)
- `useSessionExport.ts` (Phase 15, will import from utils/download)

### `src/engine/types.ts` — ClusterConfig has NO role field (confirmed)

Current `ClusterConfig` interface (lines 56-70) has: `id`, `name`, `topology`, `snoProfile`, `hcpHostedClusters`, `hcpQpsPerCluster`, `workload`, `addOns`, `environment`, `haRequired`, `airGapped`, `maxNodes`. No `role` field exists. This is the correct baseline — we add it as optional.

**Target shape:**
```typescript
export interface ClusterConfig {
  // ... all existing fields ...
  role?: 'hub' | 'spoke' | 'standalone'  // Phase 13: multi-cluster role tagging
}
```

The `createDefaultClusterConfig()` factory in `src/engine/defaults.ts` does NOT need updating — the field is optional and will be `undefined` (equivalent to `'standalone'`) until the user sets it in Phase 18.

**Note from SUMMARY.md:** `InputStateSchema` in `useUrlState.ts` should also be updated with `.optional().default('standalone')` for the `role` field so that existing session URLs continue to parse without error.

### `src/stores/calculationStore.ts` — CALC-02 status confirmed CLEAN

Current file (53 lines) exports: `clusterResults` (computed), `recommendations` (computed), `activeCluster` (computed). Zero `ref()` calls. Return statement: `return { clusterResults, recommendations, activeCluster }`.

**Target addition:**
```typescript
const aggregateTotals = computed(() => {
  return clusterResults.value.reduce(
    (acc, result) => ({
      vcpu: acc.vcpu + result.sizing.totals.vcpu,
      ramGB: acc.ramGB + result.sizing.totals.ramGB,
      storageGB: acc.storageGB + result.sizing.totals.storageGB,
    }),
    { vcpu: 0, ramGB: 0, storageGB: 0 },
  )
})
```

Return statement becomes: `return { clusterResults, recommendations, activeCluster, aggregateTotals }`.

The `ClusterSizing.totals` field already exists as `{ vcpu: number; ramGB: number; storageGB: number }` — confirmed in `engine/types.ts` line 82. No new typing needed.

### Chart Components — Node Row Pattern to Extract into useChartData.ts

All three chart components (`VcpuChart.vue`, `RamChart.vue`, `StorageChart.vue`) contain an identical `rows` computed that filters `ClusterSizing` into `NodeRow[]`:

```typescript
// Identical in all three components:
const rows = computed((): NodeRow[] => {
  const s = activeResult.value?.sizing
  if (!s) return []
  return [
    { labelKey: 'node.masters', spec: s.masterNodes },
    ...(s.workerNodes ? [{ labelKey: 'node.workers', spec: s.workerNodes }] : []),
    ...(s.infraNodes ? [{ labelKey: 'node.infra', spec: s.infraNodes }] : []),
    ...(s.odfNodes ? [{ labelKey: 'node.storage', spec: s.odfNodes }] : []),
    ...(s.rhacmWorkers ? [{ labelKey: 'results.bom.rhacmWorkers', spec: s.rhacmWorkers }] : []),
  ]
})
```

**Key observation:** Chart components currently omit `virtWorkerNodes` and `gpuNodes` from the rows list (they are in `useCsvExport.ts` and `usePptxExport.ts` but not in the chart components). The `useChartData.ts` module should include all non-null node specs for completeness and forward compatibility with Phase 16/17 export charts.

**What differs per chart:**
- VcpuChart: `data = count * vcpu`, color `rgba(220,38,38,0.7)`
- RamChart: `data = count * ramGB`, color `rgba(37,99,235,0.7)`
- StorageChart: `data = count * storageGB`, doughnut type with multi-color palette

---

## Standard Stack

### Core (no new packages required)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Vue 3 | 3.x | Component framework | Installed |
| TypeScript | 5.x | Type safety | Installed |
| Pinia | 3.0.4 | State management | Installed |
| Vitest | Current | Unit testing | Installed |

**Verification:** All versions confirmed via project `package.json`. Zero new packages needed for Phase 13.

---

## Architecture Patterns

### 4-Layer Separation — MUST be preserved

```
src/engine/        Pure TypeScript — ZERO Vue imports (CALC-01)
src/stores/        Pinia — inputStore (ref) + calculationStore (computed only, CALC-02)
src/components/    Vue SFCs — read stores, never call engine directly
src/composables/   Plain TypeScript modules — no Vue lifecycle hooks
```

Phase 13 adds:
```
src/composables/utils/download.ts    Pure TS utility — no Vue, no Pinia
src/composables/useChartData.ts      Pure TS — no Vue imports (exportable to non-Vue contexts)
```

### Pattern 1: Pure TS Utility Module

`src/composables/utils/download.ts` is a pure TypeScript utility that can be called from any composable without Vue dependencies:

```typescript
// src/composables/utils/download.ts
// Source: extracted from useCsvExport.ts (Phase 13)
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### Pattern 2: Pure TS Chart Data Builder

`src/composables/useChartData.ts` must have NO Vue imports. It accepts `ClusterSizing` and returns typed data structures. The chart components then call it inside their existing `computed()` blocks:

```typescript
// src/composables/useChartData.ts
// Pure TypeScript — no Vue, no Pinia — CALC-01 equivalent for composables
import type { ClusterSizing, NodeSpec } from '@/engine/types'

export interface ChartNodeRow {
  label: string   // English label — NOT i18n key (export consumers don't have vue-i18n)
  spec: NodeSpec
}

export function buildChartRows(sizing: ClusterSizing): ChartNodeRow[] {
  return [
    { label: 'Control Plane', spec: sizing.masterNodes },
    ...(sizing.workerNodes ? [{ label: 'Workers', spec: sizing.workerNodes }] : []),
    ...(sizing.infraNodes ? [{ label: 'Infra Nodes', spec: sizing.infraNodes }] : []),
    ...(sizing.odfNodes ? [{ label: 'ODF Storage', spec: sizing.odfNodes }] : []),
    ...(sizing.rhacmWorkers ? [{ label: 'RHACM Hub', spec: sizing.rhacmWorkers }] : []),
    ...(sizing.virtWorkerNodes ? [{ label: 'Virt Workers', spec: sizing.virtWorkerNodes }] : []),
    ...(sizing.gpuNodes ? [{ label: 'GPU Nodes', spec: sizing.gpuNodes }] : []),
  ]
}

export function buildVcpuData(rows: ChartNodeRow[]): number[] {
  return rows.map(r => r.spec.count * r.spec.vcpu)
}

export function buildRamData(rows: ChartNodeRow[]): number[] {
  return rows.map(r => r.spec.count * r.spec.ramGB)
}

export function buildStorageData(rows: ChartNodeRow[]): number[] {
  return rows.map(r => r.spec.count * r.spec.storageGB)
}

export function buildNodeCountData(rows: ChartNodeRow[]): number[] {
  return rows.map(r => r.spec.count)
}
```

**Why English labels (not i18n keys):** Export composables (`usePptxExport`, `usePdfExport`) run as plain TypeScript without a Vue component context — `t()` from `vue-i18n` is not available. Chart components that need translated labels can apply `t(labelKey)` as a mapping step on top of the English labels. The Phase 16 PPTX chart will use English labels directly.

### Pattern 3: CALC-02 Compliant Store Extension

The `aggregateTotals` computed reduces over `clusterResults.value` — which is itself a computed. This creates a computed-of-computed chain that Pinia handles correctly:

```typescript
// Inside calculationStore defineStore callback — after clusterResults definition
const aggregateTotals = computed(() =>
  clusterResults.value.reduce(
    (acc, result) => ({
      vcpu: acc.vcpu + result.sizing.totals.vcpu,
      ramGB: acc.ramGB + result.sizing.totals.ramGB,
      storageGB: acc.storageGB + result.sizing.totals.storageGB,
    }),
    { vcpu: 0, ramGB: 0, storageGB: 0 },
  ),
)
```

**Return type:** `{ vcpu: number; ramGB: number; storageGB: number }` — same shape as `ClusterSizing['totals']`.

### Anti-Patterns to Avoid

- **Don't add `role` to `AddOnConfig`** — it belongs on `ClusterConfig` (cluster-level metadata, not add-on config)
- **Don't use `ref()` in calculationStore for aggregateTotals** — CALC-02 violation, causes incorrect reactivity
- **Don't add Vue imports to `useChartData.ts`** — it must remain importable in non-Vue export contexts
- **Don't translate labels inside `useChartData.ts`** — no `t()` access outside Vue component context
- **Don't update `createDefaultClusterConfig()`** for `role` — the field is optional, `undefined` is valid and means standalone

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blob download | Custom fetch/XHR download | `URL.createObjectURL()` + `<a download>` | Browser native, already in `useCsvExport.ts` — extract don't rewrite |
| Aggregate sum | Manual loop with `let` totals | `Array.reduce()` in `computed()` | Reactive, immutable, testable |
| Optional field backward compat | Manual version checking | TypeScript `?` optional + Zod `.optional()` | Type system enforces it at compile time |

---

## Common Pitfalls

### Pitfall 1: Adding ref() to calculationStore

**What goes wrong:** `aggregateTotals` is implemented as `ref()` instead of `computed()`, breaking the CALC-02 invariant.
**Why it happens:** Developer habit — `ref()` is the default Pinia store primitive.
**How to avoid:** The store file has a comment `// ZERO ref() — only computed() — enforces CALC-02` on line 11. Follow it. Use `computed(() => ...)`.
**Warning signs:** `grep -n 'ref(' src/stores/calculationStore.ts` returns any lines pointing to a `ref(` call that is not inside a comment.

### Pitfall 2: Adding Vue imports to useChartData.ts

**What goes wrong:** Developer adds `import { computed } from 'vue'` to `useChartData.ts`, making it non-importable in the plain-TS export composables without a Vue app context.
**Why it happens:** Vue 3 `computed()` is imported from 'vue' and the developer uses it for reactive derivation.
**How to avoid:** `useChartData.ts` is a pure data-mapping module — all functions accept `ClusterSizing` directly and return plain data. No reactivity needed here; reactivity lives in the Vue components that call these functions.
**Warning signs:** `grep "from 'vue'" src/composables/useChartData.ts` returns any result.

### Pitfall 3: Breaking useCsvExport.ts during downloadBlob extraction

**What goes wrong:** The extraction removes `downloadBlob` from `useCsvExport.ts` but forgets to add the import, causing a runtime `ReferenceError`.
**Why it happens:** Two-step refactor (add to utils, remove from composable) done in wrong order.
**How to avoid:** In the same commit — (1) create `utils/download.ts` with the exported function, (2) add `import { downloadBlob } from './utils/download'` to `useCsvExport.ts`, (3) delete the private function definition. Keep the call site unchanged.
**Warning signs:** `rtk tsc` reports `Cannot find name 'downloadBlob'` in `useCsvExport.ts`.

### Pitfall 4: ChartNodeRow label mismatch between components and useChartData

**What goes wrong:** The Vue chart components currently use i18n keys (`'node.masters'`, `'node.workers'` etc.) but `useChartData.ts` will use English labels. After refactoring, chart components either lose translated labels or the data doesn't match what they display.
**Why it happens:** The two label conventions are incompatible.
**How to avoid:** Chart components keep their own `rows` computed using i18n keys for display. They call `buildChartRows()` from `useChartData.ts` only for the data values (not the labels). Alternatively, chart components can map English labels back through a lookup table. The simplest approach: chart components continue to build their own label arrays from i18n keys; `useChartData.ts` provides the numeric data builders (`buildVcpuData`, `buildRamData`, etc.) that accept a `ChartNodeRow[]`. Components call both.
**Warning signs:** Chart labels display as English strings instead of locale-translated strings after refactoring.

### Pitfall 5: role field placement confusion

**What goes wrong:** `role` is added to `AddOnConfig` instead of `ClusterConfig`.
**Why it happens:** `AddOnConfig` is the "options bag" developers reach for first.
**How to avoid:** Role is cluster-level metadata (which cluster is the hub?), not an add-on. It belongs directly on `ClusterConfig` as an optional field alongside `name`, `topology`, `environment`.

---

## Code Examples

### Example 1: Extracting downloadBlob (complete migration)

```typescript
// BEFORE — useCsvExport.ts (lines 33-41)
function downloadBlob(content: string, filename: string, mimeType: string): void { ... }

// AFTER — src/composables/utils/download.ts (new file)
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// AFTER — useCsvExport.ts (updated import, no other changes)
import { downloadBlob } from './utils/download'
// private function definition removed
```

### Example 2: ClusterConfig role field addition

```typescript
// engine/types.ts — add after maxNodes field
export interface ClusterConfig {
  id: string
  name: string
  topology: TopologyType
  snoProfile: SnoProfile
  hcpHostedClusters: number
  hcpQpsPerCluster: number
  workload: WorkloadProfile
  addOns: AddOnConfig
  environment: EnvironmentType
  haRequired: boolean
  airGapped: boolean
  maxNodes: number | null
  role?: 'hub' | 'spoke' | 'standalone'  // Phase 13: multi-cluster topology role
}
```

### Example 3: aggregateTotals in calculationStore

```typescript
// calculationStore.ts — add after clusterResults computed definition
const aggregateTotals = computed(() =>
  clusterResults.value.reduce(
    (acc, result) => ({
      vcpu: acc.vcpu + result.sizing.totals.vcpu,
      ramGB: acc.ramGB + result.sizing.totals.ramGB,
      storageGB: acc.storageGB + result.sizing.totals.storageGB,
    }),
    { vcpu: 0, ramGB: 0, storageGB: 0 },
  ),
)

// Update return statement
return { clusterResults, recommendations, activeCluster, aggregateTotals }
```

### Example 4: useChartData.ts integration in VcpuChart.vue (refactored)

```typescript
// VcpuChart.vue script — after refactoring
import { buildChartRows, buildVcpuData } from '@/composables/useChartData'

// Replace the existing `rows` computed:
const chartData = computed((): ChartData<'bar'> => {
  const sizing = activeResult.value?.sizing
  if (!sizing) return { labels: [], datasets: [] }
  const rows = buildChartRows(sizing)
  return {
    labels: rows.map(r => t(labelKeyFor(r.label))),  // component maps to i18n
    datasets: [{
      label: t('results.charts.vcpu'),
      data: buildVcpuData(rows),
      backgroundColor: 'rgba(220,38,38,0.7)',
      borderColor: 'rgba(220,38,38,1)',
      borderWidth: 1,
    }],
  }
})
```

---

## Open Questions

1. **i18n label mapping in chart components after refactoring**
   - What we know: Components use i18n keys; `useChartData.ts` uses English labels
   - What's unclear: Whether we refactor components to use `buildChartRows` in Phase 13, or defer Vue component refactoring to Phase 16/17
   - Recommendation: Phase 13 creates `useChartData.ts` with builders but does NOT refactor the Vue chart components. Components are refactored in Phase 16 (PPTX) and Phase 17 (PDF) when export composables need the chart data. This keeps Phase 13 minimal and regression-safe.

2. **`InputStateSchema` in `useUrlState.ts` — role field update scope**
   - What we know: SUMMARY.md recommends updating the schema with `.optional().default('standalone')` for `role`
   - What's unclear: Whether this belongs in Plan 13-02 (alongside the type extension) or Plan 15 (Session Portability)
   - Recommendation: Include it in Plan 13-02 alongside the `ClusterConfig` type change — keeps type and schema in sync, avoids drift.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 13 is purely code/TypeScript refactoring with no external tool, service, or CLI dependencies beyond the project's existing Vite/Vitest/TypeScript stack.

---

## Validation Architecture

Nyquist validation is ENABLED (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (current version — confirmed via `package.json`) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `rtk vitest run` |
| Full suite command | `rtk vitest run --reporter=verbose` |

**Baseline:** 256 tests pass, 0 fail (confirmed by `rtk vitest run` on 2026-04-04).

### Phase 13 Behavior — Test Map

Phase 13 has no formal requirement IDs (it is an enabler phase). The success criteria translate to the following testable behaviors:

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| SC-1: downloadBlob extracted | `downloadBlob` exported from `utils/download.ts` and callable | unit | `rtk vitest run src/composables/__tests__/download.test.ts` | No — Wave 0 |
| SC-1b: useCsvExport unchanged | Existing CSV export tests still pass after extraction | regression | `rtk vitest run src/composables/__tests__/useCsvExport.test.ts` | Yes |
| SC-2: useChartData exists | `buildChartRows` returns correct rows from a `ClusterSizing` fixture | unit | `rtk vitest run src/composables/__tests__/useChartData.test.ts` | No — Wave 0 |
| SC-2b: Pure TS — no Vue | `useChartData.ts` importable without Vue app context | unit | Verified by test passing outside `@vue/test-utils` wrapper | Covered by SC-2 |
| SC-3: role field typed | `ClusterConfig` accepts `role: 'hub'` without TS error | type check | `rtk tsc --noEmit` | Covered by compile |
| SC-4: aggregateTotals computed | `aggregateTotals` sums totals across multiple clusters correctly | unit | `rtk vitest run src/stores/__tests__/calculationStore.test.ts` | No — Wave 0 |
| SC-4b: CALC-02 clean | Zero `ref()` in `calculationStore.ts` | static analysis | `grep -n "ref(" src/stores/calculationStore.ts \| grep -v computed \| grep -v "//\|'ref'"` | Inline check |
| SC-5: 256 tests still pass | All existing tests pass after refactoring | regression | `rtk vitest run` | Yes |

### Sampling Rate

- **Per task commit:** `rtk vitest run` — full suite, fast (< 1 second baseline)
- **Per wave merge:** `rtk vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps (test files to create before implementation)

- [ ] `src/composables/__tests__/download.test.ts` — covers SC-1: `downloadBlob` exports, call signature, mocks `URL.createObjectURL`
- [ ] `src/composables/__tests__/useChartData.test.ts` — covers SC-2: `buildChartRows`, `buildVcpuData`, `buildRamData`, `buildStorageData`, `buildNodeCountData` with a standard `ClusterSizing` fixture
- [ ] `src/stores/__tests__/calculationStore.test.ts` — covers SC-4: `aggregateTotals` sums correctly for 1-cluster, 2-cluster, and 3-cluster cases

**Existing test infrastructure covers all other criteria.** The Vitest + `@vue/test-utils` setup is already in place, store testing pattern established in Phase 9-12 tests.

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `src/composables/useCsvExport.ts` — exact `downloadBlob` function body confirmed
- Direct source read: `src/engine/types.ts` — `ClusterConfig`, `ClusterSizing`, `AddOnConfig` interfaces confirmed, no `role` field present
- Direct source read: `src/stores/calculationStore.ts` — CALC-02 compliance confirmed, existing computed structure documented
- Direct source read: `src/stores/inputStore.ts` — `clusters` ref structure, existing actions confirmed
- Direct source read: `src/components/results/charts/VcpuChart.vue`, `RamChart.vue`, `StorageChart.vue` — node row pattern documented
- Direct source read: `src/engine/defaults.ts` — `createDefaultClusterConfig` confirmed, no `role` field
- Direct command: `rtk vitest run` — 256 tests passing, 0 failing confirmed on 2026-04-04
- Direct read: `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` — v2.1 milestone research, architecture decisions, pitfall catalogue
- `.planning/ROADMAP.md` — Phase 13 success criteria and plan breakdown

### Tertiary (LOW confidence)

- None — all findings from direct source inspection.

---

## Metadata

**Confidence breakdown:**

- Current source state: HIGH — all files read directly, no assumptions
- Extraction plan for `downloadBlob`: HIGH — exact function body confirmed, extraction is mechanical
- `useChartData.ts` shape: HIGH — three chart components read, node row pattern is identical across all three
- `aggregateTotals` shape: HIGH — `ClusterSizing.totals` type confirmed, arithmetic pattern is standard `reduce`
- `role` field placement: HIGH — `ClusterConfig` interface read in full, no `role` present, correct location confirmed
- CALC-02 safety: HIGH — calculationStore.ts has 53 lines, all computed(), no ref() anywhere

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable codebase — no external API dependencies)
