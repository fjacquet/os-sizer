# OpenShift Virtualization Sizer — Phase 3: Wizard UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface virtualization mode in the wizard — a mode selector, VM-size-classes table + bare-metal node shape + overcommit + redundancy inputs, a storage-backend choice, and virt metrics on the results page — all bound to the Phase 1/2 engine.

**Architecture:** No new routes (App.vue is a step machine on `ui.currentWizardStep`). Step 1 gains a **mode** selector. Step 2 branches: virtualization mode renders the new virt inputs (a `VmClassesTable` + node-shape/overcommit/redundancy), container mode unchanged. Step 3 branches: virtualization shows a storage-backend choice and auto-confirms topology. Results gains a `VirtMetricsCard`. Engine: `ClusterSizing` gains an optional `virtMetrics` so the results page can show achieved overcommit / VMs-per-node / limiting resource / utilization without recomputing.

**Tech Stack:** Vue 3 SFC (`<script setup lang="ts">`), Pinia, vue-i18n, Tailwind v4, Vitest. Reuses `NumberSliderInput`, the `clusterField`/`activeCluster` patterns, and `cluster.virt: VirtConfig` from Phase 2.

---

## Design decisions

- **Field shape is `cluster.virt: VirtConfig`** (vmClasses / cpuOvercommitRatio / redundancy / nodeShape / storageBackend) — NOT new `addOns` fields.
- **`virtField` helper** mirrors `addOnField`, writing `{ virt: { ...c.virt, [key]: val } }`. Falls back to `createDefaultVirtConfig()` when `c.virt` is absent.
- **VM-class array ops** live in a pure `vmClassOps.ts` module (add/remove/update) so they're unit-tested without mounting components.
- **Topology in virt mode:** the engine ignores topology for virt sizing. Step 3 (virt branch) auto-confirms (`ui.confirmTopology()` on mount) so the stepper's Step 3→4 gate passes.
- **Metrics surfacing:** `assembleVirtCluster` already computes `sizeVirtWorkers`; expose it via `ClusterSizing.virtMetrics?: VirtWorkerSizing | null` (null for container).

## File structure

| File | Responsibility |
|------|----------------|
| `src/i18n/locales/{en,fr,de,it}.json` *(modify)* | `mode.*` + virt wizard + metrics labels. |
| `src/engine/types.ts` *(modify)* | `ClusterSizing.virtMetrics?`. |
| `src/engine/virtualization/assembleVirtCluster.ts` *(modify)* | populate `virtMetrics`. |
| `src/engine/virtualization/assembleVirtCluster.test.ts` *(modify)* | assert `virtMetrics`. |
| `src/components/wizard/vmClassOps.ts` *(create)* | pure VM-class array ops. |
| `src/components/wizard/__tests__/vmClassOps.test.ts` *(create)* | tests. |
| `src/components/wizard/ModeSelector.vue` *(create)* | Container/Virtualization toggle. |
| `src/components/wizard/Step1EnvironmentForm.vue` *(modify)* | render `ModeSelector`. |
| `src/components/wizard/VmClassesTable.vue` *(create)* | editable VM-class rows. |
| `src/components/wizard/VirtWorkloadSection.vue` *(create)* | VM table + node shape + overcommit + redundancy. |
| `src/components/wizard/Step2WorkloadForm.vue` *(modify)* | branch on mode. |
| `src/components/wizard/Step3ArchitectureForm.vue` *(modify)* | virt storage branch + auto-confirm. |
| `src/components/results/VirtMetricsCard.vue` *(create)* | achieved overcommit / VMs-per-node / limiting / utilization. |
| `src/components/results/ResultsPage.vue` *(modify)* | render `VirtMetricsCard` when virt. |
| `src/components/wizard/__tests__/virtBindings.test.ts` *(create)* | store-binding tests for mode + virt fields. |

**Conventions:** components use `<script setup lang="ts">`, `useI18n()`, Tailwind classes mirroring existing forms. Tests: `setActivePinia(createPinia())` + `useInputStore()` + `updateCluster`. `.git/hooks/pre-commit` runs `npm run lint` (0 errors required). Commit with `rtk`.

---

### Task 1: i18n keys (4 locales)

**Files:** `src/i18n/locales/{en,fr,de,it}.json`

- [ ] **Step 1: Add a `mode` block and virt wizard/metric keys**

Add a top-level `mode` object and extend `workload` + `results` + `node`. In **en.json**, add after the existing `"workload": { ... }` object a new top-level key:

```json
  "mode": {
    "label": "Deployment Mode",
    "container": "Container platform",
    "virtualization": "Virtualization (OVE)",
    "containerHint": "Size for containerized OpenShift workloads (pods).",
    "virtualizationHint": "Size for virtual machines on OpenShift Virtualization Engine."
  },
  "virt": {
    "vmClasses": "VM size classes",
    "className": "Class",
    "vcpuPerVm": "vCPU / VM",
    "ramPerVm": "RAM GB / VM",
    "diskPerVm": "Disk GB / VM",
    "vmCount": "# VMs",
    "addClass": "Add VM class",
    "removeClass": "Remove",
    "nodeShape": "Bare-metal worker node",
    "physicalCores": "Physical cores / node",
    "nodeRamGB": "RAM GB / node",
    "hyperthreading": "Hyperthreading",
    "htOn": "On (×2)",
    "htOff": "Off",
    "overcommit": "CPU overcommit (vCPU : thread)",
    "overcommitDedicated": "Dedicated (1:1)",
    "redundancy": "Redundancy",
    "redNone": "None",
    "redN1": "N+1",
    "redN2": "N+2",
    "storage": "Storage backend",
    "storageOdf": "OpenShift Data Foundation (ODF)",
    "storageExternal": "External RWX storage",
    "metricsTitle": "Virtualization metrics",
    "achievedOvercommit": "Achieved overcommit",
    "vmsPerNode": "VMs / node",
    "limitingResource": "Limiting resource",
    "cpuUtil": "CPU utilization",
    "ramUtil": "RAM utilization",
    "limCpu": "CPU",
    "limRam": "RAM",
    "limDensity": "Density"
  },
```

Add the translated equivalents to **fr.json**, **de.json**, **it.json** (same keys). Use these values:

*fr* `mode`: `label`="Mode de déploiement", `container`="Plateforme de conteneurs", `virtualization`="Virtualisation (OVE)", `containerHint`="Dimensionner pour des charges conteneurisées (pods).", `virtualizationHint`="Dimensionner pour des machines virtuelles sur OpenShift Virtualization Engine." — *virt*: `vmClasses`="Classes de VM", `className`="Classe", `vcpuPerVm`="vCPU / VM", `ramPerVm`="RAM Go / VM", `diskPerVm`="Disque Go / VM", `vmCount`="# VM", `addClass`="Ajouter une classe", `removeClass`="Supprimer", `nodeShape`="Nœud worker bare-metal", `physicalCores`="Cœurs physiques / nœud", `nodeRamGB`="RAM Go / nœud", `hyperthreading`="Hyperthreading", `htOn`="Activé (×2)", `htOff`="Désactivé", `overcommit`="Surallocation CPU (vCPU : thread)", `overcommitDedicated`="Dédié (1:1)", `redundancy`="Redondance", `redNone`="Aucune", `redN1`="N+1", `redN2`="N+2", `storage`="Backend de stockage", `storageOdf`="OpenShift Data Foundation (ODF)", `storageExternal`="Stockage RWX externe", `metricsTitle`="Métriques de virtualisation", `achievedOvercommit`="Surallocation atteinte", `vmsPerNode`="VM / nœud", `limitingResource`="Ressource limitante", `cpuUtil`="Utilisation CPU", `ramUtil`="Utilisation RAM", `limCpu`="CPU", `limRam`="RAM", `limDensity`="Densité".

*de*: `label`="Bereitstellungsmodus", `container`="Container-Plattform", `virtualization`="Virtualisierung (OVE)", `containerHint`="Dimensionierung für containerisierte Workloads (Pods).", `virtualizationHint`="Dimensionierung für VMs auf OpenShift Virtualization Engine." — `vmClasses`="VM-Größenklassen", `className`="Klasse", `vcpuPerVm`="vCPU / VM", `ramPerVm`="RAM GB / VM", `diskPerVm`="Disk GB / VM", `vmCount`="# VMs", `addClass`="VM-Klasse hinzufügen", `removeClass`="Entfernen", `nodeShape`="Bare-Metal-Worker-Knoten", `physicalCores`="Physische Kerne / Knoten", `nodeRamGB`="RAM GB / Knoten", `hyperthreading`="Hyperthreading", `htOn`="Ein (×2)", `htOff`="Aus", `overcommit`="CPU-Overcommit (vCPU : Thread)", `overcommitDedicated`="Dediziert (1:1)", `redundancy`="Redundanz", `redNone`="Keine", `redN1`="N+1", `redN2`="N+2", `storage`="Speicher-Backend", `storageOdf`="OpenShift Data Foundation (ODF)", `storageExternal`="Externer RWX-Speicher", `metricsTitle`="Virtualisierungsmetriken", `achievedOvercommit`="Erreichtes Overcommit", `vmsPerNode`="VMs / Knoten", `limitingResource`="Begrenzende Ressource", `cpuUtil`="CPU-Auslastung", `ramUtil`="RAM-Auslastung", `limCpu`="CPU", `limRam`="RAM", `limDensity`="Dichte".

*it*: `label`="Modalità di distribuzione", `container`="Piattaforma container", `virtualization`="Virtualizzazione (OVE)", `containerHint`="Dimensiona per carichi containerizzati (pod).", `virtualizationHint`="Dimensiona per macchine virtuali su OpenShift Virtualization Engine." — `vmClasses`="Classi di VM", `className`="Classe", `vcpuPerVm`="vCPU / VM", `ramPerVm`="RAM GB / VM", `diskPerVm`="Disco GB / VM", `vmCount`="# VM", `addClass`="Aggiungi classe", `removeClass`="Rimuovi", `nodeShape`="Nodo worker bare-metal", `physicalCores`="Core fisici / nodo", `nodeRamGB`="RAM GB / nodo", `hyperthreading`="Hyperthreading", `htOn`="Attivo (×2)", `htOff`="Disattivo", `overcommit`="Overcommit CPU (vCPU : thread)", `overcommitDedicated`="Dedicato (1:1)", `redundancy`="Ridondanza", `redNone`="Nessuna", `redN1`="N+1", `redN2`="N+2", `storage`="Backend di storage", `storageOdf`="OpenShift Data Foundation (ODF)", `storageExternal`="Storage RWX esterno", `metricsTitle`="Metriche di virtualizzazione", `achievedOvercommit`="Overcommit raggiunto", `vmsPerNode`="VM / nodo", `limitingResource`="Risorsa limitante", `cpuUtil`="Utilizzo CPU", `ramUtil`="Utilizzo RAM", `limCpu`="CPU", `limRam`="RAM", `limDensity`="Densità".

- [ ] **Step 2: Validate JSON**

Run: `node -e "['en','fr','de','it'].forEach(l=>{const o=JSON.parse(require('fs').readFileSync('src/i18n/locales/'+l+'.json','utf8'));if(!o.mode||!o.virt||!o.virt.overcommit)throw new Error('missing in '+l)});console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
rtk git add src/i18n/locales/en.json src/i18n/locales/fr.json src/i18n/locales/de.json src/i18n/locales/it.json
rtk git commit -m "i18n: wizard mode + virtualization input/metric labels (en/fr/de/it)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `ClusterSizing.virtMetrics`

**Files:** `src/engine/types.ts`, `src/engine/virtualization/assembleVirtCluster.ts` (+ test)

- [ ] **Step 1: Add the field**

In `src/engine/types.ts`, in the `ClusterSizing` interface, add after `rhoaiOverhead`:

```ts
  /** Virtualization-mode worker metrics (null for container mode). */
  virtMetrics?: VirtWorkerSizing | null
```

- [ ] **Step 2: Update the failing test**

In `src/engine/virtualization/assembleVirtCluster.test.ts`, add to the ODF `describe` block:

```ts
  it('exposes virt metrics (limiting resource + base nodes)', () => {
    expect(s.virtMetrics?.limitingResource).toBe('ram')
    expect(s.virtMetrics?.baseNodes).toBe(6)
    expect(s.virtMetrics?.totalNodes).toBe(7)
  })
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- src/engine/virtualization/assembleVirtCluster.test.ts`
Expected: FAIL — `virtMetrics` is undefined.

- [ ] **Step 4: Populate it**

In `src/engine/virtualization/assembleVirtCluster.ts`, change the returned object to include `virtMetrics: worker` (the `sizeVirtWorkers` result is already computed as `worker`):

```ts
    rhoaiOverhead: null,
    virtMetrics: worker,
    totals,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/engine/virtualization/assembleVirtCluster.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/engine/types.ts src/engine/virtualization/assembleVirtCluster.ts src/engine/virtualization/assembleVirtCluster.test.ts
rtk git commit -m "feat(engine): expose virt worker metrics on ClusterSizing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Pure VM-class array ops

**Files:** `src/components/wizard/vmClassOps.ts` + test

- [ ] **Step 1: Write the failing test**

Create `src/components/wizard/__tests__/vmClassOps.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { addVmClass, removeVmClass, updateVmClass } from '../vmClassOps'
import type { VmClass } from '@/engine/types'

const base: VmClass[] = [{ id: 'a', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 10 }]

describe('vmClassOps', () => {
  it('addVmClass appends a new class with a fresh id', () => {
    const next = addVmClass(base)
    expect(next).toHaveLength(2)
    expect(next[0]).toBe(base[0]) // original preserved
    expect(next[1]?.id).not.toBe('a')
    expect(next[1]?.count).toBe(0)
  })

  it('removeVmClass drops by index immutably', () => {
    const two = addVmClass(base)
    const next = removeVmClass(two, 0)
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe(two[1]?.id)
  })

  it('updateVmClass patches one field by index', () => {
    const next = updateVmClass(base, 0, { count: 99 })
    expect(next[0]?.count).toBe(99)
    expect(next[0]?.name).toBe('Small')
    expect(base[0]?.count).toBe(10) // input untouched
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/wizard/__tests__/vmClassOps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/wizard/vmClassOps.ts`:

```ts
// Pure, immutable VM-class array operations (testable without mounting components).
import type { VmClass } from '@/engine/types'

export function addVmClass(classes: VmClass[]): VmClass[] {
  return [
    ...classes,
    { id: crypto.randomUUID(), name: 'New', vcpu: 2, ramGB: 4, diskGB: 40, count: 0 },
  ]
}

export function removeVmClass(classes: VmClass[], index: number): VmClass[] {
  return classes.filter((_, i) => i !== index)
}

export function updateVmClass(
  classes: VmClass[],
  index: number,
  patch: Partial<VmClass>,
): VmClass[] {
  return classes.map((c, i) => (i === index ? { ...c, ...patch } : c))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/wizard/__tests__/vmClassOps.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/wizard/vmClassOps.ts src/components/wizard/__tests__/vmClassOps.test.ts
rtk git commit -m "feat(wizard): pure VM-class array ops

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Mode selector + Step 1

**Files:** `src/components/wizard/ModeSelector.vue` (create), `Step1EnvironmentForm.vue` (modify)

- [ ] **Step 1: Create `ModeSelector.vue`**

```vue
<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useInputStore } from '@/stores/inputStore'
  import { createDefaultClusterConfig } from '@/engine/defaults'
  import type { SizingMode } from '@/engine/types'

  const { t } = useI18n()
  const input = useInputStore()
  const activeCluster = computed(
    () => input.clusters[input.activeClusterIndex] ?? createDefaultClusterConfig(0),
  )
  const mode = computed(() => activeCluster.value.mode ?? 'container')

  function setMode(m: SizingMode) {
    const c = input.clusters[input.activeClusterIndex]
    if (c) input.updateCluster(c.id, { mode: m })
  }
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('mode.label') }}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="m in ['container', 'virtualization'] as const"
        :key="m"
        type="button"
        class="text-left p-3 rounded-lg border transition-colors"
        :class="
          mode === m
            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 dark:border-blue-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        "
        @click="setMode(m)"
      >
        <span class="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {{ t(`mode.${m}`) }}
        </span>
        <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t(`mode.${m}Hint`) }}
        </span>
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Render it at the top of Step 1**

In `src/components/wizard/Step1EnvironmentForm.vue`, import and render `<ModeSelector />` as the first child of the form's root container. Add to the script:

```ts
import ModeSelector from './ModeSelector.vue'
```

and in the template, immediately inside the outer wrapper (before the environment field), add:

```vue
    <ModeSelector />
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run type-check`
Expected: PASS.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/wizard/ModeSelector.vue src/components/wizard/Step1EnvironmentForm.vue
rtk git commit -m "feat(wizard): deployment mode selector on Step 1

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: VM-class table + virt workload section + Step 2 branch

**Files:** `VmClassesTable.vue`, `VirtWorkloadSection.vue` (create), `Step2WorkloadForm.vue` (modify)

- [ ] **Step 1: Create `VmClassesTable.vue`**

```vue
<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useInputStore } from '@/stores/inputStore'
  import { createDefaultClusterConfig, createDefaultVirtConfig } from '@/engine/defaults'
  import { addVmClass, removeVmClass, updateVmClass } from './vmClassOps'
  import type { VmClass } from '@/engine/types'

  const { t } = useI18n()
  const input = useInputStore()
  const activeCluster = computed(
    () => input.clusters[input.activeClusterIndex] ?? createDefaultClusterConfig(0),
  )
  const classes = computed<VmClass[]>(
    () => (activeCluster.value.virt ?? createDefaultVirtConfig()).vmClasses,
  )

  function commit(next: VmClass[]) {
    const c = input.clusters[input.activeClusterIndex]
    if (c) input.updateCluster(c.id, { virt: { ...(c.virt ?? createDefaultVirtConfig()), vmClasses: next } })
  }
  const numFields = ['vcpu', 'ramGB', 'diskGB', 'count'] as const
  function onNum(i: number, key: (typeof numFields)[number], e: Event) {
    const v = Number((e.target as HTMLInputElement).value)
    if (!Number.isNaN(v)) commit(updateVmClass(classes.value, i, { [key]: v }))
  }
  function onName(i: number, e: Event) {
    commit(updateVmClass(classes.value, i, { name: (e.target as HTMLInputElement).value }))
  }
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.vmClasses') }}</p>
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs text-gray-500 dark:text-gray-400">
          <th class="text-left py-1">{{ t('virt.className') }}</th>
          <th class="py-1">{{ t('virt.vcpuPerVm') }}</th>
          <th class="py-1">{{ t('virt.ramPerVm') }}</th>
          <th class="py-1">{{ t('virt.diskPerVm') }}</th>
          <th class="py-1">{{ t('virt.vmCount') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in classes" :key="row.id">
          <td class="py-1">
            <input
              :value="row.name"
              :aria-label="t('virt.className')"
              class="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              @input="onName(i, $event)"
            />
          </td>
          <td v-for="key in numFields" :key="key" class="py-1 px-1">
            <input
              type="number"
              min="0"
              :value="row[key]"
              :aria-label="`${row.name} ${key}`"
              class="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              @input="onNum(i, key, $event)"
            />
          </td>
          <td class="py-1 text-center">
            <button
              type="button"
              :aria-label="t('virt.removeClass')"
              class="text-gray-400 hover:text-red-600"
              :disabled="classes.length <= 1"
              @click="commit(removeVmClass(classes, i))"
            >
              ✕
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <button
      type="button"
      class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      @click="commit(addVmClass(classes))"
    >
      ＋ {{ t('virt.addClass') }}
    </button>
  </div>
</template>
```

- [ ] **Step 2: Create `VirtWorkloadSection.vue`** (node shape + overcommit + redundancy, plus the table)

```vue
<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useInputStore } from '@/stores/inputStore'
  import { createDefaultClusterConfig, createDefaultVirtConfig } from '@/engine/defaults'
  import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
  import VmClassesTable from './VmClassesTable.vue'
  import type { VirtConfig } from '@/engine/types'

  const { t } = useI18n()
  const input = useInputStore()
  const activeCluster = computed(
    () => input.clusters[input.activeClusterIndex] ?? createDefaultClusterConfig(0),
  )
  const virt = computed<VirtConfig>(() => activeCluster.value.virt ?? createDefaultVirtConfig())

  function patch(p: Partial<VirtConfig>) {
    const c = input.clusters[input.activeClusterIndex]
    if (c) input.updateCluster(c.id, { virt: { ...(c.virt ?? createDefaultVirtConfig()), ...p } })
  }
  function patchNode(p: Partial<VirtConfig['nodeShape']>) {
    patch({ nodeShape: { ...virt.value.nodeShape, ...p } })
  }
  const overcommitOptions = [1, 4, 10]
  const redundancyOptions = ['none', 'n+1', 'n+2'] as const
</script>

<template>
  <div class="space-y-5">
    <VmClassesTable />

    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.nodeShape') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberSliderInput
          :model-value="virt.nodeShape.physicalCores"
          :label="t('virt.physicalCores')"
          :min="8"
          :max="256"
          :step="8"
          @update:model-value="(v: number) => patchNode({ physicalCores: v })"
        />
        <NumberSliderInput
          :model-value="virt.nodeShape.ramGB"
          :label="t('virt.nodeRamGB')"
          :min="64"
          :max="4096"
          :step="64"
          @update:model-value="(v: number) => patchNode({ ramGB: v })"
        />
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          class="w-4 h-4 accent-blue-600"
          :checked="virt.nodeShape.threadsPerCore === 2"
          :aria-label="t('virt.hyperthreading')"
          @change="patchNode({ threadsPerCore: ($event.target as HTMLInputElement).checked ? 2 : 1 })"
        />
        {{ t('virt.hyperthreading') }}
      </label>
    </div>

    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.overcommit') }}</p>
      <div class="flex gap-2">
        <button
          v-for="o in overcommitOptions"
          :key="o"
          type="button"
          class="px-3 py-1.5 text-sm rounded border"
          :class="
            virt.cpuOvercommitRatio === o
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 dark:border-blue-500 text-gray-900 dark:text-gray-100'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
          "
          @click="patch({ cpuOvercommitRatio: o })"
        >
          {{ o === 1 ? t('virt.overcommitDedicated') : `${o}:1` }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.redundancy') }}</p>
      <div class="flex gap-2">
        <button
          v-for="r in redundancyOptions"
          :key="r"
          type="button"
          class="px-3 py-1.5 text-sm rounded border"
          :class="
            virt.redundancy === r
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 dark:border-blue-500 text-gray-900 dark:text-gray-100'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
          "
          @click="patch({ redundancy: r })"
        >
          {{ r === 'none' ? t('virt.redNone') : r === 'n+1' ? t('virt.redN1') : t('virt.redN2') }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Branch Step 2 on mode**

In `src/components/wizard/Step2WorkloadForm.vue`: import `VirtWorkloadSection` and a `mode` computed, then wrap the existing workload/add-on content in `v-if="mode === 'container'"` and render `<VirtWorkloadSection v-else />`. Add to script:

```ts
import VirtWorkloadSection from './VirtWorkloadSection.vue'
const mode = computed(() => activeCluster.value.mode ?? 'container')
```

In the template, wrap the existing inner content block:

```vue
    <template v-if="mode === 'container'">
      <!-- existing workload + add-ons markup unchanged -->
    </template>
    <VirtWorkloadSection v-else />
```

- [ ] **Step 4: Verify**

Run: `npm run type-check`
Expected: PASS.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/wizard/VmClassesTable.vue src/components/wizard/VirtWorkloadSection.vue src/components/wizard/Step2WorkloadForm.vue
rtk git commit -m "feat(wizard): virtualization workload inputs (VM classes, node shape, overcommit, redundancy)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Step 3 storage branch + auto-confirm

**Files:** `src/components/wizard/Step3ArchitectureForm.vue`

- [ ] **Step 1: Add a virt branch**

In `Step3ArchitectureForm.vue`, add `mode` + `virt` computed (mirroring Step 2), import `useUiStore`, and on mount auto-confirm topology in virt mode so the stepper gate passes. Add to script:

```ts
import { onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/uiStore'
import { createDefaultVirtConfig } from '@/engine/defaults'
import type { VirtConfig } from '@/engine/types'

const ui = useUiStore()
const mode = computed(() => activeCluster.value.mode ?? 'container')
const virt = computed<VirtConfig>(() => activeCluster.value.virt ?? createDefaultVirtConfig())
function setStorage(b: VirtConfig['storageBackend']) {
  const c = input.clusters[input.activeClusterIndex]
  if (c) input.updateCluster(c.id, { virt: { ...(c.virt ?? createDefaultVirtConfig()), storageBackend: b } })
}
function confirmIfVirt() {
  if (mode.value === 'virtualization') ui.confirmTopology()
}
onMounted(confirmIfVirt)
watch(mode, confirmIfVirt)
```

In the template, wrap the existing topology-selection content in `v-if="mode === 'container'"`, and add a virt branch:

```vue
    <div v-if="mode === 'virtualization'" class="space-y-2">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('virt.storage') }}</p>
      <div class="flex flex-col gap-2">
        <button
          v-for="b in ['odf', 'external-rwx'] as const"
          :key="b"
          type="button"
          class="text-left p-3 rounded-lg border"
          :class="
            virt.storageBackend === b
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 dark:border-blue-500'
              : 'border-gray-300 dark:border-gray-600'
          "
          @click="setStorage(b)"
        >
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ b === 'odf' ? t('virt.storageOdf') : t('virt.storageExternal') }}
          </span>
        </button>
      </div>
    </div>
```

- [ ] **Step 2: Verify**

Run: `npm run type-check` → PASS. Run: `npm run lint` → 0 errors.

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/wizard/Step3ArchitectureForm.vue
rtk git commit -m "feat(wizard): virt storage-backend choice + auto-confirm on Step 3

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Virt metrics card on results

**Files:** `src/components/results/VirtMetricsCard.vue` (create), `ResultsPage.vue` (modify)

- [ ] **Step 1: Create `VirtMetricsCard.vue`**

```vue
<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { VirtWorkerSizing } from '@/engine/types'

  const props = defineProps<{ metrics: VirtWorkerSizing }>()
  const { t } = useI18n()
  const limLabel = computed(() =>
    props.metrics.limitingResource === 'cpu'
      ? t('virt.limCpu')
      : props.metrics.limitingResource === 'ram'
        ? t('virt.limRam')
        : t('virt.limDensity'),
  )
  const items = computed(() => [
    { k: t('virt.achievedOvercommit'), v: `${props.metrics.achievedOvercommit.toFixed(2)}:1` },
    { k: t('virt.vmsPerNode'), v: props.metrics.vmsPerNode.toFixed(1) },
    { k: t('virt.limitingResource'), v: limLabel.value },
    { k: t('virt.cpuUtil'), v: `${props.metrics.cpuUtilizationPct.toFixed(0)}%` },
    { k: t('virt.ramUtil'), v: `${props.metrics.ramUtilizationPct.toFixed(0)}%` },
  ])
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
      {{ t('virt.metricsTitle') }}
    </h3>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <div v-for="it in items" :key="it.k" class="text-center">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {{ it.k }}
        </p>
        <p class="mt-1 text-lg font-mono font-bold text-gray-900 dark:text-gray-100">{{ it.v }}</p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Render it in `ResultsPage.vue`**

Import it and render after `TotalsSummaryCard`, guarded on the metrics being present:

```ts
import VirtMetricsCard from './VirtMetricsCard.vue'
```

```vue
    <VirtMetricsCard
      v-if="activeResult?.sizing.virtMetrics"
      :metrics="activeResult.sizing.virtMetrics"
    />
```

- [ ] **Step 3: Verify**

Run: `npm run type-check` → PASS. Run: `npm run lint` → 0 errors.

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/results/VirtMetricsCard.vue src/components/results/ResultsPage.vue
rtk git commit -m "feat(results): virtualization metrics card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Store-binding tests + full regression

**Files:** `src/components/wizard/__tests__/virtBindings.test.ts` (create)

- [ ] **Step 1: Write the binding tests**

```ts
/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from '@/stores/inputStore'
import { calcCluster } from '@/engine'

describe('virtualization store bindings', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { language: 'en' })
    setActivePinia(createPinia())
  })

  it('switching mode to virtualization persists', () => {
    const store = useInputStore()
    const id = store.clusters[0].id
    store.updateCluster(id, { mode: 'virtualization' })
    expect(store.clusters[0].mode).toBe('virtualization')
  })

  it('patching virt.cpuOvercommitRatio persists and recomputes', () => {
    const store = useInputStore()
    const c = store.clusters[0]
    store.updateCluster(c.id, {
      mode: 'virtualization',
      virt: { ...c.virt!, cpuOvercommitRatio: 4 },
    })
    expect(store.clusters[0].virt?.cpuOvercommitRatio).toBe(4)
    const { sizing } = calcCluster(store.clusters[0])
    expect(sizing.virtWorkerNodes).not.toBeNull()
    expect(sizing.virtMetrics?.limitingResource).toBeDefined()
  })

  it('patching storageBackend to external-rwx drops ODF nodes', () => {
    const store = useInputStore()
    const c = store.clusters[0]
    store.updateCluster(c.id, {
      mode: 'virtualization',
      virt: { ...c.virt!, storageBackend: 'external-rwx' },
    })
    const { sizing } = calcCluster(store.clusters[0])
    expect(sizing.odfNodes).toBeNull()
  })
})
```

- [ ] **Step 2: Run + full regression**

Run: `npm run test -- src/components/wizard/__tests__/virtBindings.test.ts`
Expected: PASS (3 tests).

Run: `npm run type-check` → exit 0.
Run: `npm run test` → all pass (386 + Phase 3 ≈ 395+).
Run: `npm run format:check && npm run lint` → clean; 0 errors.
Run: `npm run build` → succeeds.

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/wizard/__tests__/virtBindings.test.ts
rtk git commit -m "test(wizard): virtualization store-binding + recompute tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 self-review

- **Spec coverage:** mode entry (Task 4), VM-class table + node shape + overcommit + redundancy (Tasks 3+5), storage backend (Task 6), results virt metrics (Tasks 2+7), i18n in all locales (Task 1), bindings tested (Task 8). Container path is wrapped in `v-if="mode === 'container'"` and otherwise untouched.
- **Placeholder scan:** none — full component code, exact i18n values, real test assertions.
- **Type consistency:** uses `cluster.virt: VirtConfig` (Phase 2), `VirtWorkerSizing` (Phase 1), `ClusterSizing.virtMetrics` (Task 2). The explore agent's invented `addOns.*` virt fields are deliberately NOT used.
- **Manual check after execution:** `npm run dev`, pick Virtualization on Step 1, edit VM classes / node shape / overcommit / redundancy on Step 2, choose storage on Step 3, confirm results show the BoM (control plane + virt workers + ODF) and the virt metrics card.

## Next: Phase 4 (PPTX executive deck), Phase 5 (Docs) — planned when reached.
