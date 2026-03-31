---
phase: 03-wizard-ui
plan: 04
status: complete
---

# 03-04 Summary — Step 3 Architecture Form

## Files Created

- `src/components/wizard/RecommendationCard.vue` — single topology recommendation card; displays topology name (via `t(topologyLabelKey)`), fitScore badge with colour coding (green ≥70, amber ≥40, red <40), justification text (via `t(rec.justificationKey)`), and warning pills (via `t(key)` for each warningKey); emits `select: [topology: TopologyType]` on click.

- `src/components/wizard/Step3ArchitectureForm.vue` — architecture selection step; reads `calc.recommendations` (sorted by fitScore descending from engine), renders `RecommendationCard` grid, manual override dropdown (all 8 topologies), and topology-specific sub-inputs (SNO profile selector, HCP cluster count + QPS sliders, TNA/TNF tech preview notices, managed-cloud no-hardware notice). Clicking a card calls `ui.confirmTopology()` AND updates `inputStore` topology via `updateCluster()`. Function parameter renamed from `t` to `topo` in `selectTopology` to avoid shadowing `useI18n`'s `t`.

## Files Modified

- `src/App.vue` — imports `Step3ArchitectureForm` and renders it for `currentWizardStep === 3` (replacing placeholder text).

- `src/i18n/locales/en.json` — added keys (see below)
- `src/i18n/locales/fr.json` — added same keys in French
- `src/i18n/locales/de.json` — added same keys in German
- `src/i18n/locales/it.json` — added same keys in Italian

## i18n Keys Added (all 4 locales)

### wizard.step3

- `wizard.step3.showOverride`
- `wizard.step3.hideOverride`

### warnings

- `warnings.tna.techPreview`
- `warnings.tnf.techPreview`
- `warnings.tnf.redfishRequired`
- `warnings.managedCloud.noHardware`

### validation (warningKeys used by engine)

- `validation.techPreviewNotForProduction`
- `validation.redfishBmcRequired`
- `validation.managedCloudNoHardware`

### recommendation (justificationKey values from recommendation.ts)

- `recommendation.standardHa.production`
- `recommendation.compact3Node.budgetFriendly`
- `recommendation.sno.edgeSingleSite`
- `recommendation.tna.minimalHa`
- `recommendation.tnf.twoNodeFencing`
- `recommendation.hcp.multiClusterEfficiency`
- `recommendation.microshift.constrainedEdge`
- `recommendation.managedCloud.noHardwareManagement`

## Actual justificationKey Values from recommendation.ts

These are the exact strings emitted by the engine (for 03-05 reference):

| Topology | justificationKey |
|---|---|
| standard-ha | `recommendation.standardHa.production` |
| compact-3node | `recommendation.compact3Node.budgetFriendly` |
| sno | `recommendation.sno.edgeSingleSite` |
| two-node-arbiter | `recommendation.tna.minimalHa` |
| two-node-fencing | `recommendation.tnf.twoNodeFencing` |
| hcp | `recommendation.hcp.multiClusterEfficiency` |
| microshift | `recommendation.microshift.constrainedEdge` |
| managed-cloud | `recommendation.managedCloud.noHardwareManagement` |

## warningKeys Used by Engine

- `validation.techPreviewNotForProduction` — used by TNA and TNF
- `validation.redfishBmcRequired` — used by TNF
- `validation.managedCloudNoHardware` — used by managed-cloud

## Engine Types

No engine types needed adjustment. All types (`TopologyType`, `SnoProfile`, `ClusterConfig`, `TopologyRecommendation`) were used as-is from `src/engine/types.ts`.

## Verification

- `npm run type-check` — exits 0 (clean)
- `npm run test` — 85/85 tests pass
- `grep "confirmTopology"` in Step3ArchitectureForm.vue — found (line 59)
- `grep "useCalculationStore"` in Step3ArchitectureForm.vue — found (lines 6, 15)
- No hardcoded English strings ("Two-Node", "Tech Preview", "provider") in template — all via `t()`
