# Phase 12: BoM, Exports, Wizard UI + i18n — Research

**Researched:** 2026-04-01
**Domain:** Vue 3 wizard UI, BoM table, CSV/PPTX/PDF exports, vue-i18n locale files
**Confidence:** HIGH — all findings derived from direct codebase inspection; zero external research required

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIRT-01 | User can select 'OpenShift Virtualization' as a distinct topology type in the architecture wizard step | Step3ArchitectureForm.vue topology select + virtEnabled addOnField pattern documented below |
| VIRT-03 | User can input the expected number of VMs per worker node to drive worker count calculation | `vmCount`, `vmsPerWorker`, `virtAvgVmVcpu`, `virtAvgVmRamGB` already exist in `AddOnConfig` and defaults — UI inputs only |
| GPU-01 | User can enable a dedicated GPU node pool with a configurable node count | `gpuEnabled` + `gpuNodeCount` already in `AddOnConfig` — same checkbox+slider pattern as RHACM |
| GPU-02 | User can select GPU mode: container / passthrough / vGPU | `gpuMode` already typed as union in `AddOnConfig` — native `<select>` element in Step2 add-ons section |
| GPU-03 | GPU nodes rendered as a separate NodeSpec row in BoM table and all exports | `sizing.gpuNodes: NodeSpec | null` populated by Phase 10 — BomTable + 3 export composables need one new entry each |
| GPU-04 | User can select MIG profile for A100/H100 GPU nodes from static lookup table | `MIG_PROFILES` constant available in `constants.ts` — cascade select driven by `gpuModel` → valid profile list |
| GPU-05 | vGPU density table displayed per GPU model (clearly marked as estimated, driver-version dependent) | Static HTML table in wizard GPU section; no computation needed |
| RHOAI-01 | User can enable the RHOAI add-on to size an AI/ML platform layer | `rhoaiEnabled` already in `AddOnConfig` — checkbox in Step2 add-ons, same pattern as ODF/RHACM |
| RHOAI-04 | BoM shows RHOAI component breakdown (KServe, Data Science Pipelines, Model Registry) as a separate overhead row | New BoM row rendered when `rhoaiEnabled && sizing.infraNodes` — annotation-only row (no NodeSpec), showing fixed overhead text |
</phase_requirements>

---

## Summary

Phase 12 is a pure UI/presentation phase. The engine work (calcVirt, calcGpuNodes, calcRHOAI, all constants and types) is 100% complete across Phases 9–11 with 237 passing tests. Phase 12 connects that engine work to the user-facing layers: wizard inputs, BoM table rows, export composables, and i18n locale files.

The codebase pattern is exceptionally consistent. Every addition follows one of two established templates: (1) a checkbox toggle in Step2's add-ons section that sets an `addOnField`, optionally revealing a sub-section with `NumberSliderInput` components or selects; or (2) a conditional block inside the Step3 topology-specific sub-inputs section. BomTable and all three export composables share a single node-entry list pattern using `null`-check guards — adding GPU and RHOAI rows is a one-line conditional push in each file.

The critical gap discovered in research: `virtWorkerNodes`, `gpuNodes`, and RHOAI overhead are entirely absent from BomTable.vue, useCsvExport.ts, usePptxExport.ts, and usePdfExport.ts. The Phase 10 verification notes the GPU data-flow to UI as "not applicable — Phase 12 deferred." This means every export file will produce a BoM that silently drops GPU and virt rows until Phase 12 ships.

**Primary recommendation:** Follow the null-check guard pattern atomically across all four presentation artifacts (BomTable + 3 export composables) in one plan. Use the `addOnField` computed helper pattern for all new wizard inputs. Add all i18n keys simultaneously to all four locale files in one final plan.

---

## Standard Stack

### Core (all installed, no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | 3.x (installed) | Reactivity, components | Project framework |
| vue-i18n | 9.x (installed) | Locale string lookup | Existing i18n infrastructure |
| Pinia | 2.x (installed) | State via `inputStore` | Existing store pattern |
| TypeScript | 6.0 (installed) | Type safety | Project language |
| Tailwind v4 | 4.x (installed) | CSS utility classes | Project styling |
| Vitest | installed | Unit test runner | Existing test framework |
| pptxgenjs | installed | PPTX export | Existing export library |
| jsPDF + jspdf-autotable | installed | PDF export | Existing export library |

**No new npm packages are required for Phase 12.**

---

## Architecture Patterns

### Existing Wizard Structure (Step2 and Step3)

```
src/components/wizard/
  Step2WorkloadForm.vue      -- workload inputs + add-ons section
  Step3ArchitectureForm.vue  -- topology select + topology-sub-inputs
  RecommendationCard.vue     -- topology recommendation cards
src/components/shared/
  NumberSliderInput.vue      -- slider+number input component (reuse for all new numeric fields)
```

**Step numbering:** The wizard has 4 steps (not 3). Step 2 = workload + add-ons. Step 3 = architecture + sub-inputs per topology.

### Pattern 1: AddOn Checkbox Toggle (Step2)

Used by: odfEnabled, infraNodesEnabled, rhacmEnabled — all three follow identical structure.

```typescript
// In <script setup>:
function addOnField(key: keyof typeof activeCluster.value.addOns) {
  return computed({
    get: () => activeCluster.value.addOns[key],
    set: (val: boolean | number) => {
      const c = input.clusters[input.activeClusterIndex]
      if (c) input.updateCluster(c.id, { addOns: { ...c.addOns, [key]: val } })
    },
  })
}
const rhoaiEnabled = addOnField('rhoaiEnabled')
const gpuEnabled = addOnField('gpuEnabled')
```

```html
<!-- In <template> — add-ons section (border-t block): -->
<label class="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    :checked="rhoaiEnabled as boolean"
    :aria-label="t('workload.rhoaiAddon')"
    class="w-4 h-4 accent-blue-600"
    @change="rhoaiEnabled = ($event.target as HTMLInputElement).checked"
  />
  <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('workload.rhoaiAddon') }}</span>
</label>
```

### Pattern 2: Sub-Inputs After Checkbox (Step2)

Used by: rhacmManagedClusters (revealed when rhacmEnabled). Use same pattern for gpuNodeCount, gpuMode, gpuModel, migProfile, and GPU-specific inputs under the GPU checkbox.

```html
<!-- Revealed sub-inputs pattern (existing rhacmManagedClusters): -->
<div v-if="rhacmEnabled" class="ml-6 mt-2">
  <NumberSliderInput
    :model-value="rhacmManagedClusters as number"
    @update:model-value="(val: number) => { rhacmManagedClusters = val }"
    :label="t('hcp.clusterCount')"
    :min="1" :max="500" :step="1"
  />
</div>
```

### Pattern 3: Topology-Specific Sub-Inputs (Step3)

Existing block for SNO (profile buttons) and HCP (two sliders). Add virtEnabled sub-inputs when virt topology is active, following the same conditional structure.

```html
<!-- In Step3, inside the `v-if="ui.topologyConfirmed"` section: -->
<div v-if="topology === 'standard-ha' && virtEnabled" class="space-y-2">
  <!-- VM count, VMs per worker, avg vCPU, avg RAM sliders -->
</div>
```

**Decision on VIRT-01 placement:** OpenShift Virtualization is an add-on (enabled via `addOns.virtEnabled`), not a separate topology type. The wizard already surfaces topology via recommendation cards + override select in Step3. The correct UX is: (1) checkbox in Step2 to enable virt add-on, (2) sub-inputs for VM sizing in Step2 (or Step3 after topology confirm). This avoids adding a new topology string to the TopologyType union, which would require changes across the dispatcher, recommendation engine, and all exports. The VIRT-01 requirement says "as a topology in the architecture wizard step" — this is best interpreted as surfacing virt inputs in Step3's sub-input section after topology confirmation, matching the HCP pattern exactly.

**VIRT-01 implementation approach:** Add a virt sub-input block in Step3 that appears when `virtEnabled` and topology is `standard-ha` or `compact-3node`. This gives the user architectural-step context without adding a new topology enum value.

### Pattern 4: BomTable Row — Null-Check Guard

```typescript
// In BomTable.vue, rows computed():
if (s.virtWorkerNodes) entries.push({ labelKey: 'node.virtWorkers', spec: s.virtWorkerNodes })
if (s.gpuNodes) entries.push({ labelKey: 'node.gpu', spec: s.gpuNodes })
// RHOAI is special — no NodeSpec field, just an annotation row (separate from normal entries)
```

For RHOAI-04, the BoM needs a non-NodeSpec row showing component names and overhead summary. This is separate from the null-check NodeSpec entries. Options:
1. Add a second `entries` type for annotation-only rows
2. Render `rhoaiEnabled` as a conditional `<tr>` in the template (simpler, more direct)

**Recommended approach (option 2):** Add a dedicated annotation `<tr v-if="props.result.sizing.rhoaiOverhead">` block below the main entries loop. This avoids complicating the typed `entries` array. The `rhoaiOverhead` field would need to be added to `ClusterSizing` — OR it can be driven directly from `props.result.sizing` fields (infraNodes + rhoaiEnabled flag passed via the SizingResult or derived from config). Since BomTable only receives `SizingResult`, the cleanest approach is to expose a computed `rhoaiRow` based on whether `rhoaiEnabled` is in the result — but `SizingResult` does not currently carry config. See Open Questions.

**Simpler RHOAI-04 approach:** Add an `rhoaiOverhead: { vcpu: number; ramGB: number } | null` field to `ClusterSizing` in `types.ts`, populated by `calcRHOAI()`. BomTable renders it as an annotation row when non-null. This keeps BomTable purely data-driven from `SizingResult.sizing`.

### Pattern 5: Export Composables — Identical NodeEntry Pattern

All three export composables (useCsvExport, usePptxExport, usePdfExport) use the same `getNodeEntries(sizing)` helper that builds a list of `{ label: string; spec: NodeSpec }` entries. Extending all three requires the same one-line addition:

```typescript
// In getNodeEntries() / buildBomTableRows() / buildCsvContent():
...(sizing.virtWorkerNodes ? [{ label: 'Virt Worker Nodes', spec: sizing.virtWorkerNodes }] : []),
...(sizing.gpuNodes ? [{ label: 'GPU Nodes', spec: sizing.gpuNodes }] : []),
```

RHOAI-04 in exports: CSV adds a separate "RHOAI Overhead" row with component list text. PPTX adds an extra row to the BoM table. PDF adds an extra row to the autoTable body.

### Pattern 6: i18n Key Structure

The existing `en.json` structure uses nested dot-notation keys. All new keys must be added to all four locale files simultaneously:

```json
// Pattern: flat namespace per domain
"node": {
  "virtWorkers": "Virt Worker Nodes",
  "gpu": "GPU Nodes",
  "rhoaiOverhead": "RHOAI Overhead"
},
"workload": {
  "rhoaiAddon": "Red Hat OpenShift AI (RHOAI)",
  "gpuNodePool": "GPU Node Pool",
  "gpuNodeCount": "GPU Node Count",
  "gpuMode": "GPU Mode",
  "gpuModel": "GPU Model",
  "migProfile": "MIG Profile",
  "vmCount": "Total VM Count",
  "vmsPerWorker": "VMs per Worker Node",
  "virtAvgVmVcpu": "Average VM vCPU",
  "virtAvgVmRamGB": "Average VM RAM (GB)"
},
"gpu": {
  "modeContainer": "Container (whole GPU per pod)",
  "modePassthrough": "Passthrough (whole GPU per VM)",
  "modeVgpu": "vGPU (shared across VMs)",
  "migNone": "No MIG partitioning",
  "densityTableTitle": "vGPU Density Reference (estimated, driver-dependent)",
  "densityNote": "Values are estimates. Actual density depends on NVIDIA vGPU driver version and license tier."
},
"rhoai": {
  "label": "Red Hat OpenShift AI",
  "bomRow": "RHOAI Operator Overhead",
  "kserve": "KServe",
  "dsPipelines": "Data Science Pipelines",
  "modelRegistry": "Model Registry"
},
"warnings": {
  "virt": {
    "rwxRequiresOdf": "OpenShift Virtualization requires RWX storage (ODF) for live migration. Without ODF, live migration is unavailable."
  },
  "sno": {
    "virtNoLiveMigration": "SNO topology does not support live migration — VM HA is unavailable."
  },
  "gpu": {
    "passthroughBlocksLiveMigration": "GPU passthrough mode permanently blocks live migration on affected nodes.",
    "migProfileWithKubevirtUnsupported": "MIG profiles combined with KubeVirt VMs are unsupported by the standard GPU Operator."
  },
  "recommendation": {
    "standardHa": {
      "virtWorkloads": "Recommended for VM workloads — standard HA provides live migration and node redundancy."
    }
  }
}
```

**Critical:** The `warnings.virt.rwxRequiresOdf` and `warnings.sno.virtNoLiveMigration` and both `warnings.gpu.*` keys are already referenced in `validation.ts` as i18n messageKeys (lines 44, 54, 65, 76). These MUST be present in all four locales at Phase 12 launch or runtime will produce missing key warnings for active validation warnings. The `recommendation.standardHa.virtWorkloads` key is referenced in `recommendation.ts` justificationKey (deferred from Phase 9).

### Pattern 7: SNO Profile — snoVirtMode

`snoVirtMode` is a boolean in `AddOnConfig`. In Step3, when topology is `sno` and `virtEnabled` is true, show a toggle to enable `snoVirtMode`. This uses the same `addOnField` helper:

```html
<div v-if="topology === 'sno' && virtEnabled" class="mt-2">
  <label class="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" :checked="snoVirtMode as boolean" ... />
    <span>{{ t('sno.virtMode') }}</span>
  </label>
</div>
```

### Anti-Patterns to Avoid

- **Treating virtEnabled as a topology type:** Do not add `'virt'` or `'openshift-virtualization'` to the `TopologyType` union. This would require changes to the dispatcher, recommendation engine, BomTable label map, and all exports. The engine already handles it as an add-on.
- **Partial export updates:** Never update only one of the three export composables. They must be updated atomically in one plan commit.
- **Missing i18n keys in non-EN locales:** Missing keys cause runtime warnings and fall back to the raw key string. All four locales must be updated in one commit.
- **Spreading addOns without sibling preservation:** Always use `{ ...c.addOns, [key]: val }` spread pattern when calling `updateCluster` — never pass `{ addOns: { [key]: val } }` which wipes all other addOns fields.
- **Non-null RHOAI row when RHOAI disabled:** BomTable and exports must guard the RHOAI overhead row on the actual `rhoaiEnabled` state, not infer it from infra node size.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number input with slider | Custom range+text combo | `NumberSliderInput.vue` (existing) | Already handles min/max/step/unit/v-model |
| GPU model cascade select | Custom dropdown component | Native `<select>` element (existing Step3 pattern) | Matches override-select in Step3; no component library needed |
| MIG profile list | Compute from scratch | `MIG_PROFILES[gpuModel]` from constants.ts | Already a fully typed static lookup table |
| AddOn state management | Direct store mutation | `addOnField()` computed helper (existing) | Handles spread-merge pattern to avoid sibling field wipe |
| Export row construction | Custom serializers | Extend existing `getNodeEntries()` / `buildBomTableRows()` helpers | All three export formats share the same null-check pattern |

---

## Key Discoveries (Confirmed by Codebase Inspection)

### Discovery 1: All v2.0 AddOnConfig fields already exist

`AddOnConfig` in `types.ts` already has every field Phase 12 needs:
- Phase 9: `virtEnabled`, `vmCount`, `vmsPerWorker`, `virtAvgVmVcpu`, `virtAvgVmRamGB`, `snoVirtMode`
- Phase 10: `gpuEnabled`, `gpuNodeCount`, `gpuMode` (`'container' | 'passthrough' | 'vgpu'`), `gpuModel` (`'A100-40GB' | 'A100-80GB' | 'H100-80GB'`), `migProfile`, `gpuPerNode`
- Phase 11: `rhoaiEnabled`

All defaults are in `createDefaultClusterConfig()`. All fields are in `AddOnConfigSchema` in `useUrlState.ts`. **No type changes are needed for wizard inputs — Phase 12 is 100% UI.**

### Discovery 2: virtWorkerNodes and gpuNodes are absent from ALL presentation layers

Confirmed by grep: `virtWorkerNodes`, `gpuNodes`, `virtStorage`, `rhoai` do not appear in:
- `BomTable.vue`
- `useCsvExport.ts`
- `usePptxExport.ts`
- `usePdfExport.ts`

The Phase 10 VERIFICATION.md explicitly states: "Data-Flow Trace (Level 4): No UI rendering path yet (Phase 12 deferred)." These rows are completely missing from all user-visible output.

### Discovery 3: Existing export test fixtures are incomplete for v2.0

All three export test fixtures (`useCsvExport.test.ts`, `usePptxExport.test.ts`, `usePdfExport.test.ts`) use a `ClusterSizing` fixture that omits `virtWorkerNodes`, `gpuNodes`, `virtStorageGB`, and any RHOAI overhead field. TypeScript permits this because these fields are nullable. Phase 12 must add test cases covering the new rows.

### Discovery 4: Four warning i18n keys already referenced but not yet defined

`validation.ts` references four messageKeys that do not yet exist in any locale file:
- `warnings.virt.rwxRequiresOdf` (WARN-02 added in Phase 9)
- `warnings.sno.virtNoLiveMigration` (Phase 9)
- `warnings.gpu.passthroughBlocksLiveMigration` (WARN-01, Phase 10)
- `warnings.gpu.migProfileWithKubevirtUnsupported` (WARN-03, Phase 10)
- `recommendation.standardHa.virtWorkloads` (Phase 9 justificationKey)

**These 5 keys are pre-existing missing keys** that must be in the first i18n commit of Phase 12. Without them, any user who triggers validation warnings will see raw key strings rendered in the UI.

### Discovery 5: workload.gpuNodes key already exists in EN and FR locales

Both `en.json` and `fr.json` already have `"workload": { "gpuNodes": "GPU Nodes" }`. This was likely added during v1.0 planning. It is not wired to any checkbox yet — Phase 12 will wire it. No conflict.

### Discovery 6: MIG_PROFILES lookup table is fully implemented

`constants.ts` lines 79–98 has the complete `MIG_PROFILES` table for A100-40GB, A100-80GB, H100-80GB. The cascade select in the wizard reads `Object.keys(MIG_PROFILES[gpuModel])` to populate valid profile options. No computation needed — pure lookup.

### Discovery 7: RHOAI-04 requires a new field or annotation strategy

`ClusterSizing` does not currently have an `rhoaiOverhead` field. `BomTable.vue` only receives `SizingResult` (not `ClusterConfig`), so it cannot read `rhoaiEnabled` directly. Three options:
1. Add `rhoaiEnabled: boolean` to `SizingResult` (extends the interface)
2. Add `rhoaiOverhead: { vcpu: number; ramGB: number } | null` to `ClusterSizing` populated by `calcRHOAI()`
3. Infer from existing data: if `infraNodes` exists and its vcpu/ramGB exceed what baseline infra sizing would produce, RHOAI is likely enabled — but this is fragile

**Recommended: Option 2.** Add `rhoaiOverhead: { vcpu: number; ramGB: number } | null` to `ClusterSizing` in `types.ts`. Populate it in `calcRHOAI()` to record what overhead was added. This is minimal (one field), type-safe, and gives BomTable a clean null-check guard. The field value (4 vCPU / 16 GB) is the RHOAI_INFRA_OVERHEAD constants.

---

## vGPU Density Reference Table (GPU-05)

The vGPU density table is a static display element — no calculation, no API call. It should be clearly marked as estimated and driver-version dependent per the requirement. Proposed table content:

| GPU Model | vGPU Profile | Instances | Note |
|-----------|-------------|-----------|------|
| A100-40GB | 1g.5gb MIG | 7 | MIG-backed; requires MIG mode |
| A100-40GB | 2g.10gb MIG | 3 | MIG-backed |
| A100-40GB | 3g.20gb MIG | 2 | MIG-backed |
| A100-40GB | 7g.40gb MIG | 1 | Whole GPU in MIG mode |
| A100-80GB | 1g.10gb MIG | 7 | MIG-backed |
| H100-80GB | 1g.10gb MIG | 7 | MIG-backed |
| A100/H100 | NVIDIA vGPU | varies | Time-sharing; density depends on GRID driver version and license tier |

Confidence: HIGH for MIG data (sourced from `MIG_PROFILES` constant which is from official NVIDIA docs). LOW-MEDIUM for vGPU time-sharing density (NVIDIA license and driver dependent — shown as informational only).

---

## RHOAI BoM Row Content (RHOAI-04)

The RHOAI overhead row in the BoM should show:
- Row label: "RHOAI Operator Overhead"
- Sub-components listed: KServe, Data Science Pipelines, Model Registry
- Overhead values: +4 vCPU / +16 GB RAM (from `RHOAI_INFRA_OVERHEAD_VCPU` / `RHOAI_INFRA_OVERHEAD_RAM_GB` constants)
- Placement: on infra nodes when infra nodes are enabled; on worker nodes otherwise
- Display note: "(applied to Infra Nodes)" or "(applied to Worker Nodes)"

This is an annotation row, not a NodeSpec row. It does not contribute a new line to the main node count — it explains the overhead already baked into the infra or worker NodeSpec figures.

---

## Common Pitfalls

### Pitfall 1: Partial Export Updates
**What goes wrong:** Updating BomTable and CSV but not PPTX/PDF — GPU row appears in BoM but not in downloads.
**Why it happens:** Three separate composable files; easy to miss one.
**How to avoid:** Plan one task covers all three export composables + BomTable atomically.
**Warning signs:** Test for CSV row count does not match PPTX row count.

### Pitfall 2: Missing i18n Keys for Pre-existing Warning Codes
**What goes wrong:** WARN-01, WARN-02, WARN-03 validation warnings already fire in the engine — if messageKeys are absent in locale files, the ValidationWarning display component will show raw i18n key strings (e.g., `warnings.gpu.passthroughBlocksLiveMigration`).
**Why it happens:** Phases 9–11 added messageKeys to engine code but deferred locale translations to Phase 12.
**How to avoid:** First i18n commit must include all 5 pre-existing deferred keys + all new Phase 12 keys.
**Warning signs:** Any UI showing a dot-separated string like `warnings.virt.rwxRequiresOdf` verbatim.

### Pitfall 3: addOns Sibling Wipe
**What goes wrong:** Calling `updateCluster(id, { addOns: { gpuEnabled: true } })` wipes all other addOns fields (odfEnabled, virtEnabled, etc.) because Object.assign merges at top level only.
**Why it happens:** `updateCluster` uses `Object.assign(cluster, patch)` — the patch `{ addOns: { gpuEnabled: true } }` replaces the entire `addOns` object.
**How to avoid:** Always use `{ addOns: { ...c.addOns, [key]: val } }` spread pattern — confirmed correct in existing `addOnField()` helper.
**Warning signs:** Enabling GPU also disables ODF or resets RHACM.

### Pitfall 4: GPU Mode Select Not Disabling Live Migration Toggle
**What goes wrong:** User selects passthrough mode but UI does not visually indicate that live migration is blocked — warning appears only in results, not wizard.
**Why it happens:** No UI hint at selection time — warning only fires in `validateInputs()` output.
**How to avoid:** In the GPU section, show an inline amber alert when `gpuMode === 'passthrough'` explaining live migration impact. This is cosmetic (the warning also appears in results), but improves UX.

### Pitfall 5: snoVirtMode Not Wired to UI
**What goes wrong:** `snoVirtMode` field exists and affects `calcSNO()` (14/32/170 minimums) but has no UI toggle — users can never activate the SNO-with-virt profile via wizard.
**Why it happens:** Phase 9 added the engine behavior; Phase 12 must add the UI input.
**How to avoid:** In Step3, show a `snoVirtMode` checkbox when `topology === 'sno'` (regardless of `virtEnabled`). SNO-virt is a hardware profile choice, not strictly tied to the virt add-on.

### Pitfall 6: RHOAI-04 Row Missing from Exports
**What goes wrong:** RHOAI overhead row added to BomTable but not to CSV/PPTX/PDF — inconsistent representation.
**Why it happens:** RHOAI-04 is an annotation row (no NodeSpec), not part of the standard `getNodeEntries()` list.
**How to avoid:** Handle the RHOAI annotation row explicitly in each export composable as a separate appended row after the standard node entries. Test coverage must verify all three export formats.

---

## Code Examples

### Adding a New AddOn Field to Step2 (exact pattern for rhoaiEnabled)

```typescript
// Source: Step2WorkloadForm.vue lines 28-36 (addOnField pattern)
const rhoaiEnabled = addOnField('rhoaiEnabled')
const gpuEnabled = addOnField('gpuEnabled')
const gpuNodeCount = addOnField('gpuNodeCount')
const gpuMode = addOnField('gpuMode')
const gpuModel = addOnField('gpuModel')
const migProfile = addOnField('migProfile')
const vmCount = addOnField('vmCount')
const vmsPerWorker = addOnField('vmsPerWorker')
const virtAvgVmVcpu = addOnField('virtAvgVmVcpu')
const virtAvgVmRamGB = addOnField('virtAvgVmRamGB')
```

Note: `addOnField()` signature is `(key: keyof typeof activeCluster.value.addOns)` returning `computed<boolean | number>`. For string union fields (`gpuMode`, `gpuModel`, `migProfile`), the setter receives `string` — TypeScript will accept this since the union type extends string, but a type assertion may be needed: `gpuMode = val as typeof gpuMode.value`.

### MIG Profile Cascade Select (reads from MIG_PROFILES constant)

```typescript
// Source: constants.ts line 79 — MIG_PROFILES structure
import { MIG_PROFILES } from '@/engine/constants'

// In computed:
const migProfileOptions = computed(() => {
  const model = gpuModel.value as string
  const profiles = MIG_PROFILES[model]
  return profiles ? Object.keys(profiles) : []
})
```

```html
<select @change="migProfile = ($event.target as HTMLSelectElement).value">
  <option value="">{{ t('gpu.migNone') }}</option>
  <option v-for="p in migProfileOptions" :key="p" :value="p">{{ p }}</option>
</select>
```

### Adding GPU and Virt Rows to BomTable

```typescript
// Source: BomTable.vue lines 12-21 (rows computed pattern)
// Add after rhacmWorkers entry:
if (s.virtWorkerNodes) entries.push({ labelKey: 'node.virtWorkers', spec: s.virtWorkerNodes })
if (s.gpuNodes) entries.push({ labelKey: 'node.gpu', spec: s.gpuNodes })
```

### Adding GPU and Virt Rows to useCsvExport

```typescript
// Source: useCsvExport.ts lines 8-16 (getNodeEntries pattern)
// Add after rhacmWorkers conditional:
...(sizing.virtWorkerNodes ? [{ label: 'Virt Workers', spec: sizing.virtWorkerNodes }] : []),
...(sizing.gpuNodes ? [{ label: 'GPU Nodes', spec: sizing.gpuNodes }] : []),
```

### Adding GPU and Virt Rows to usePptxExport and usePdfExport

Same pattern — both files have an identical `entries: NodeEntry[]` array construction inside `buildBomTableRows()` and `getNodeEntries()`. Add same two lines to each.

### Type Extension for RHOAI-04 (if option 2 chosen)

```typescript
// In src/engine/types.ts — extend ClusterSizing:
export interface ClusterSizing {
  // ... existing fields ...
  rhoaiOverhead: { vcpu: number; ramGB: number } | null  // Phase 12: RHOAI-04 annotation data
}
```

```typescript
// In src/engine/addons.ts — calcRHOAI() records the overhead:
export function calcRHOAI(sizing: ClusterSizing, infraNodesEnabled: boolean): void {
  // ... existing Math.max mutations ...
  // Record overhead for BoM annotation (RHOAI-04)
  sizing.rhoaiOverhead = {
    vcpu: RHOAI_INFRA_OVERHEAD_VCPU,
    ramGB: RHOAI_INFRA_OVERHEAD_RAM_GB,
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All add-ons in a flat checkbox list | Checkbox + conditional sub-inputs (RHACM pattern) | v1.0 Phase 6 | GPU inputs must follow the conditional reveal sub-section pattern |
| Export composables with hardcoded field list | Null-check guard per NodeSpec entry | v1.0 Phase 4 | Extending is one line per composable per new NodeSpec field |
| All i18n eagerly bundled | EN eager, FR/DE/IT lazy-loaded chunks | v1.0 Phase 1 | New keys in all 4 locale files; loadLocale() uses explicit if/else branches |

---

## Open Questions

1. **RHOAI-04: rhoaiOverhead field vs SizingResult config reference**
   - What we know: BomTable receives only `SizingResult` (contains `sizing: ClusterSizing` but not `ClusterConfig`)
   - What's unclear: Whether to extend `ClusterSizing` with an `rhoaiOverhead` field OR pass additional props
   - Recommendation: Add `rhoaiOverhead: { vcpu: number; ramGB: number } | null` to `ClusterSizing`. This is the pattern-consistent approach (all BoM data comes from ClusterSizing). Requires small change to `calcRHOAI()` and `types.ts`. Tests pass automatically because existing ClusterSizing fixtures use `null` for unset fields.

2. **VIRT-01: Wizard placement of virt inputs**
   - What we know: `virtEnabled` is an add-on toggle (boolean in AddOnConfig), not a topology type
   - What's unclear: Whether virt inputs (vmCount, vmsPerWorker, etc.) belong in Step2 add-ons section or Step3 topology sub-inputs
   - Recommendation: Split — `virtEnabled` toggle in Step2 (alongside ODF/RHACM pattern), virt sizing inputs (vmCount, vmsPerWorker, avgVmVcpu, avgVmRamGB) in Step3 sub-inputs (alongside HCP pattern). Step3 shows virt inputs only when `virtEnabled && ui.topologyConfirmed && topology !== 'sno'`.

3. **GPU mode selector — Step2 or Step3?**
   - What we know: GPU mode/model/MIG profile are add-on config fields
   - What's unclear: Whether complex GPU configuration (mode select, model select, MIG cascade) belongs in Step2 (add-ons) or Step3 (after topology)
   - Recommendation: Step2 for the checkbox and node count (simple); Step3 (or a sub-section in Step2 revealed after GPU enabled) for mode/model/MIG. Given the RHACM pattern (slider revealed after checkbox in Step2), putting all GPU inputs in Step2 under the GPU checkbox is simpler and consistent.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 12 is purely UI/locale/export changes. No external tools, services, runtimes, databases, or CLIs are required beyond the existing project toolchain (Node.js, npm, Vite, Vitest — all confirmed operational from Phase 9–11 test runs).

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 12 is not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts require changes.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (installed, configured) |
| Config file | `vite.config.ts` (shared Vite + Vitest config) |
| Quick run command | `npx vitest run src/composables/__tests__/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GPU-03 | `buildCsvContent()` includes GPU row when `gpuNodes` non-null | unit | `npx vitest run src/composables/__tests__/useCsvExport.test.ts` | Wave 0 extension |
| GPU-03 | `buildBomTableRows()` includes GPU row when `gpuNodes` non-null | unit | `npx vitest run src/composables/__tests__/usePptxExport.test.ts` | Wave 0 extension |
| GPU-03 | `buildPdfTableData()` includes GPU row when `gpuNodes` non-null | unit | `npx vitest run src/composables/__tests__/usePdfExport.test.ts` | Wave 0 extension |
| VIRT-03 | Virt worker rows in BomTable rows computed | unit (component) | `npx vitest run` | Wave 0 addition |
| RHOAI-04 | RHOAI annotation row present in all 3 export formats | unit | `npx vitest run src/composables/__tests__/` | Wave 0 extension |
| GPU-01/02/04 | Wizard inputs update `addOns` correctly (addOnField pattern) | unit (store) | `npx vitest run src/stores/` | Existing pattern — no new store test needed |

### Sampling Rate
- **Per task commit:** `npx vitest run src/composables/__tests__/` (fast — pure unit tests)
- **Per wave merge:** `npx vitest run` (full suite — must stay at 237+ passing)
- **Phase gate:** Full suite green + `tsc --noEmit` clean before `/gsd:verify-work`

### Wave 0 Gaps

The three export test files already exist but their fixtures omit v2.0 ClusterSizing fields. Wave 0 must extend fixtures:

- [ ] `src/composables/__tests__/useCsvExport.test.ts` — add `virtWorkerNodes` + `gpuNodes` + `rhoaiOverhead` to fixtures; add test cases for GPU row present/absent
- [ ] `src/composables/__tests__/usePptxExport.test.ts` — same fixture extension; verify `buildBomTableRows` GPU/virt row count
- [ ] `src/composables/__tests__/usePdfExport.test.ts` — same fixture extension; verify `buildPdfTableData` body row count with GPU
- [ ] Add `rhoaiOverhead` to `ClusterSizing` in `types.ts` (if option 2 chosen) — requires extending `makeSizing()` fixture in all 3 test files

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `src/engine/types.ts` — AddOnConfig, ClusterSizing fields confirmed; all v2.0 fields present
- `src/engine/constants.ts` — MIG_PROFILES, RHOAI constants confirmed
- `src/engine/addons.ts` — calcVirt, calcGpuNodes, calcRHOAI signatures and behavior confirmed
- `src/engine/validation.ts` — all 5 deferred messageKeys confirmed absent from locale files
- `src/components/wizard/Step2WorkloadForm.vue` — addOnField pattern, checkbox template pattern
- `src/components/wizard/Step3ArchitectureForm.vue` — topology sub-input pattern (SNO/HCP examples)
- `src/components/results/BomTable.vue` — row rendering pattern, null-check guard
- `src/composables/useCsvExport.ts` — getNodeEntries pattern
- `src/composables/usePptxExport.ts` — buildBomTableRows pattern
- `src/composables/usePdfExport.ts` — buildPdfTableData pattern
- `src/composables/__tests__/useCsvExport.test.ts` — existing test structure
- `src/composables/__tests__/usePptxExport.test.ts` — existing test structure
- `src/composables/__tests__/usePdfExport.test.ts` — existing test structure
- `src/i18n/locales/en.json` — confirmed structure and 5 missing validation warning keys
- `src/i18n/locales/fr.json` — confirmed structure mirrors EN; same 5 missing keys
- `src/engine/defaults.ts` — confirmed all v2.0 addOns defaults present
- `src/composables/useUrlState.ts` (partial) — AddOnConfigSchema confirmed with all v2.0 fields
- `src/stores/calculationStore.ts` — confirmed bridge: calcCluster + validateInputs called; virt field passed to recommend
- `.planning/phases/10-gpu-node-engine/10-VERIFICATION.md` — confirmed "Phase 12 deferred" for UI data-flow
- `.planning/phases/11-rhoai-add-on-engine/VERIFICATION.md` — confirmed RHOAI-01/RHOAI-04 orphaned to Phase 12

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — confirmed Decisions log patterns for addOns spread-merge
- `.planning/research/SUMMARY.md` — vGPU density table content, MIG profile sources

---

## Metadata

**Confidence breakdown:**
- Wizard UI patterns: HIGH — direct Step2/Step3 source inspection; no ambiguity
- BoM row additions: HIGH — pattern is one line per composable; confirmed absent
- Export composable changes: HIGH — identical pattern across all three; confirmed absent
- i18n key additions: HIGH — structure confirmed; missing keys enumerated exactly
- RHOAI-04 implementation: MEDIUM — requires type extension decision (rhoaiOverhead field); two viable approaches

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable codebase; only changes when new phases land)
