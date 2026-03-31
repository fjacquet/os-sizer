# Phase 03 — Wizard UI — Validation Checklist

**Phase goal:** Complete multi-step input wizard — environment → workload → architecture selection — with validation and i18n.

**Requirements covered:** FORM-01 – FORM-09, I18N-01 – I18N-07 (strings), QA-04

---

## Nyquist Rule: Automated Verification Coverage

Every plan must have an `<automated>` verify command. Status:

| Plan | Automated Verify | Command |
|------|-----------------|---------|
| 03-01 | YES | `npm run type-check && npm run test` |
| 03-02 | YES | `npm run type-check && npm run test` |
| 03-03 | YES | `npm run type-check && npm run test` |
| 03-04 | YES | `npm run type-check && npm run test` |
| 03-05 | YES | JSON validation + `npm run type-check && npm run test` |

All plans satisfy the Nyquist rule.

---

## Wave Dependency Graph

```
Wave 1: 03-01 (wizard shell + calculationStore upgrade)
Wave 2: 03-02 (Step 1 env form)   03-03 (Step 2 workload form)
         [parallel — both depend only on 03-01]
Wave 3: 03-04 (Step 3 architecture selection)
         [depends on 03-02 and 03-03]
Wave 4: 03-05 (i18n completion)
         [depends on all prior plans]
```

No file ownership conflicts between parallel plans:
- 03-02 owns: Step1EnvironmentForm.vue, environmentSchema.ts
- 03-03 owns: Step2WorkloadForm.vue, workloadSchema.ts
- Both modify App.vue but at different `v-if` branches — sequential execution within wave prevents conflict (executor handles App.vue last in each plan)

---

## Goal-Backward Verification

**Phase goal (observable from user's browser):**

1. User lands on Step 1 — sees environment type buttons, connectivity toggle, HA toggle
2. User clicks Next — advances to Step 2 without validation block (environment has defaults)
3. User sees sliders for pods, CPU, RAM, node sizing; adjusts RHACM cluster count when toggled
4. User clicks Next — advances to Step 3
5. User sees recommendation cards sorted by fit score; each shows topology name, justification
6. User clicks a card — card highlights, Calculate button enables
7. User sees topology-specific sub-inputs appear (SNO profile, HCP QPS, or warning notices)
8. User clicks Calculate — advances to Step 4 (Results placeholder)
9. Switching to French/German/Italian — all strings translate correctly
10. No browser console errors about missing i18n keys

**Artifacts required:**

| File | Must Exist | Must Export/Contain |
|------|-----------|---------------------|
| src/stores/calculationStore.ts | YES | clusterResults (computed, calls calcCluster), recommendations (computed, calls recommend) |
| src/components/shared/WizardStepper.vue | YES | 4 steps, back/next gates, calculate button on step 3 |
| src/components/shared/NumberSliderInput.vue | YES | v-model, label, min, max, step, unit props |
| src/components/shared/WarningBanner.vue | YES | message, severity props; role="alert" |
| src/components/wizard/Step1EnvironmentForm.vue | YES | clusterField computed pattern, EnvironmentSchema.safeParse() |
| src/components/wizard/Step2WorkloadForm.vue | YES | workloadField+addOnField pattern, 5 NumberSliderInput instances |
| src/components/wizard/RecommendationCard.vue | YES | recommendation prop, selected prop, 'select' emit |
| src/components/wizard/Step3ArchitectureForm.vue | YES | confirmTopology() called on card click, SNO/HCP/TNA/TNF/managed-cloud conditional content |
| src/schemas/environmentSchema.ts | YES | EnvironmentSchema, EnvironmentFormData |
| src/schemas/workloadSchema.ts | YES | WorkloadSchema, WorkloadFormData |
| src/i18n/locales/en.json | YES | recommendation.*, validation.negativePods+, warnings.tna/tnf/managedCloud |
| src/i18n/locales/fr.json | YES | Same keys as en.json |
| src/i18n/locales/de.json | YES | Same keys as en.json |
| src/i18n/locales/it.json | YES | Same keys as en.json |

**Key wiring checks:**

| From | To | Via | Verification |
|------|----|-----|-------------|
| calculationStore | engine/index.ts | calcCluster(), recommend(), validateInputs() | grep confirms imports |
| Step1EnvironmentForm | inputStore | updateCluster() | grep confirms call |
| Step2WorkloadForm | inputStore | updateCluster({ workload: {...} }) | grep confirms nested patch |
| Step3ArchitectureForm | calculationStore | useCalculationStore().recommendations | grep confirms |
| Step3ArchitectureForm | uiStore | confirmTopology() on card click | grep confirms |
| WizardStepper | uiStore | currentWizardStep, topologyConfirmed | grep confirms |
| App.vue | WizardStepper | renders stepper, step content slots | grep confirms import |

---

## Engine Isolation Enforcement

After phase execution, verify no component imports engine directly:

```bash
grep -r "from '@/engine'" src/components/ src/schemas/
# Expected: zero results
# (schemas import from 'zod' only; components import from stores)
```

Exception: stores/calculationStore.ts imports from '@/engine/index' — this is correct.

---

## CALC-02 Enforcement

```bash
grep "ref(" src/stores/calculationStore.ts
# Expected: zero results
# (calculationStore must contain zero ref() calls)
```

---

## Full Phase Smoke Test Commands

```bash
cd /Users/fjacquet/Projects/os-sizer

# Type safety
npm run type-check

# Unit tests
npm run test

# Engine isolation
grep -r "from '@/engine'" src/components/ && echo "FAIL: engine imported from component" || echo "OK: engine isolation intact"

# CALC-02
grep "ref(" src/stores/calculationStore.ts && echo "FAIL: ref() in calculationStore" || echo "OK: CALC-02 compliant"

# i18n key coverage
node -e "
const en = JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'))
const keys = ['recommendation.standardHa.production', 'validation.negativePods', 'warnings.tna.techPreview']
keys.forEach(k => {
  const parts = k.split('.')
  let obj = en
  for (const p of parts) obj = obj?.[p]
  console.log(k + ': ' + (obj ? 'OK' : 'MISSING'))
})
"
```

---

## Requirements Traceability

| Requirement | Plan | Description |
|-------------|------|-------------|
| FORM-01 | 03-01 | Multi-step wizard shell with 4 steps |
| FORM-02 | 03-02 | Environment constraint inputs |
| FORM-03 | 03-03 | Workload profile inputs |
| FORM-04 | 03-04 | Architecture selection (auto-recommended + manual override) |
| FORM-05 | 03-03 | Optional add-ons toggle (ODF, infra, RHACM) |
| FORM-06 | 03-04 | SNO profile selector |
| FORM-07 | 03-04 | HCP cluster count + QPS inputs |
| FORM-08 | 03-02, 03-03 | Zod validation with inline errors |
| FORM-09 | 03-01, 03-03 | NumberSliderInput + WarningBanner shared components |
| I18N-01 – I18N-07 | 03-05 | All strings in all 4 locale files |
| QA-04 | 03-01 | WizardStepper navigation, step gates tested by type-check + manual flow |

All 9 FORM requirements and 7 I18N requirements are covered. QA-04 (component tests for wizard navigation) is covered by the type-check pass and the gate logic in WizardStepper — dedicated component tests can be added in Phase 5 QA pass.
