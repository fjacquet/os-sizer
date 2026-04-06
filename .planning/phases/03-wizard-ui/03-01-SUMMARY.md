---
phase: 03-wizard-ui
plan: 01
status: COMPLETE
completed: "2026-03-31"
---

# 03-01 Summary: Wizard Shell & calculationStore Upgrade

## What Was Built

### Files Modified

- **src/engine/types.ts** — Extended `ClusterConfig` interface with 4 new fields needed by the recommendation engine: `environment: EnvironmentType`, `haRequired: boolean`, `airGapped: boolean`, `maxNodes: number | null`
- **src/engine/defaults.ts** — Added corresponding defaults in `createDefaultClusterConfig()`: `environment: 'datacenter'`, `haRequired: true`, `airGapped: false`, `maxNodes: null`
- **src/stores/calculationStore.ts** — Replaced Phase 1 stub with real engine calls: `calcCluster()`, `recommend()`, `validateInputs()` imported from `@/engine/index` barrel. Exports `clusterResults`, `recommendations`, `activeCluster` — all `computed()`, zero `ref()`.
- **src/App.vue** — Updated wizard shell rendering `WizardStepper` with 4 step content slots (placeholder text for steps implemented in later plans)
- **src/i18n/locales/en.json** — Added `wizard.step3.selectionRequired` key
- **src/i18n/locales/fr.json** — Added `wizard.step3.selectionRequired` (French translation)
- **src/i18n/locales/de.json** — Added `wizard.step3.selectionRequired` (German translation)
- **src/i18n/locales/it.json** — Added `wizard.step3.selectionRequired` (Italian translation)

### Files Created

- **src/components/shared/NumberSliderInput.vue** — Dual number+range input with v-model, bidirectional sync
- **src/components/shared/WarningBanner.vue** — Alert banner with error (red) vs warning (yellow) severity styling
- **src/components/shared/WizardStepper.vue** — 4-step navigator (Environment, Workload, Architecture, Results) with back/forward gating; step 3 forward gate requires `ui.topologyConfirmed`

## Key Decisions

1. **ClusterConfig extended rather than parallel store**: The plan offered two options (extend ClusterConfig or add environmentConstraints to inputStore). Chose extending ClusterConfig as it keeps all cluster data co-located and the recommendation engine can receive it without store coupling.

2. **CALC-02 compliant**: `calculationStore.ts` has zero `ref()` calls — the comment `// ZERO ref()` contains the literal but no actual `ref(` call. All reactive state is `computed()`.

3. **Barrel import enforced**: Engine imported as `import { calcCluster, recommend, validateInputs } from '@/engine/index'` — not from individual engine files.

4. **uiStore already complete**: `topologyConfirmed` and `confirmTopology()` were already present in `uiStore.ts` from Phase 1. No changes needed.

5. **All 4 locales updated**: `wizard.step3.selectionRequired` added to en/fr/de/it to avoid missing key warnings.

## Engine Function Signatures Used

```typescript
// From @/engine/index barrel:
calcCluster(cluster: ClusterConfig): ClusterSizing
recommend(constraints: RecommendationConstraints): TopologyRecommendation[]
validateInputs(config: ClusterConfig): ValidationWarning[]
```

## Verification Results

- `npm run type-check` — clean (zero errors)
- `npm run test` — 85/85 tests passing (8 test files)
- Engine isolation verified: no store imports in `src/engine/`
- CALC-02 verified: no `ref()` calls in `calculationStore.ts`
- All three engine functions confirmed present in store

## Deviations from Plan

None. The plan was executed exactly as specified. The `clusterResults` computed in the store maps per-cluster recommendations inline (using `recommend()` per cluster) while the separate `recommendations` computed uses the active cluster for the step 3 architecture selection UI.
