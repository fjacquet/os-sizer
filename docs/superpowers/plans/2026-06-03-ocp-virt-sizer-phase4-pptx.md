# OpenShift Virtualization Sizer — Phase 4: Exports (Executive Navy + virt content) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the heavy Red Hat red across the PPTX and PDF in favour of the **Executive Navy** palette (shared with vatlas), and make the exports **virt-aware** — a VM-class breakdown and virtualization metrics in the deck, and VM-class rows in CSV.

**Architecture:** Colors are already centralized in `src/composables/pptx/theme.ts` (`PPTX_COLORS`), so the PPTX goes navy by swapping that palette + renaming the local `RH_RED` alias. The PDF hardcodes red RGB in ~7 spots → replace with navy RGB. Virt content: pure data-builders (`buildVmClassBreakdownRows`, `buildVirtMetricsData`) feed a new VM-class slide and a metrics strip, rendered when `cluster.mode === 'virtualization'`. CSV gains a per-VM-class section in virt mode.

**Tech Stack:** TypeScript, pptxgenjs 4, jsPDF + autotable, Vitest. Builds on Phase 1–3 (`VmClass`, `VirtWorkerSizing`, `ClusterSizing.virtMetrics`, `cluster.virt`).

**Scope note:** This phase prioritizes the explicit "less red" ask + virt-aware content over a cosmetic file-structure reorg. `usePptxExport.ts` stays the deck assembler (not split into a `pptx/slides/` folder); a dedicated title/assumptions cover slide is deferred (the per-cluster slide already carries KPIs + BoM). These can be a small follow-up if wanted.

## File structure

| File | Responsibility |
|------|----------------|
| `src/composables/pptx/theme.ts` *(modify)* | Navy `PPTX_COLORS` palette (red retired). |
| `src/composables/usePptxExport.ts` *(modify)* | Rename `RH_RED`→`NAVY`; add VM-class slide + virt metrics strip (virt mode). |
| `src/composables/usePptxExport.test.ts` *(modify)* | Tests for `buildVmClassBreakdownRows` + metrics + navy. |
| `src/composables/usePdfExport.ts` *(modify)* | Navy RGB in place of `238,0,0`. |
| `src/composables/useCsvExport.ts` *(modify)* | VM-class section in virt mode. |
| `src/composables/__tests__/useCsvExport.test.ts` *(modify)* | Test virt CSV. |

**Conventions:** bare-hex (no `#`) for pptxgenjs, RGB triples for jsPDF. `.git/hooks/pre-commit` runs `npm run lint` (0 errors). `.vue` not involved here, so no Prettier-reindent needed, but run `npm run format:check` at the end. Commit with `rtk`.

---

### Task 1: Navy PPTX palette

**Files:** `src/composables/pptx/theme.ts`, `src/composables/usePptxExport.ts`

- [ ] **Step 1: Rewrite the palette** — replace the `PPTX_COLORS` object in `theme.ts` with the Midnight-Executive navy palette (keep the `PPTX_FONT` block unchanged):

```ts
// Bare hex (NO # prefix) — pptxgenjs convention. Executive Navy palette (shared with vatlas).
export const PPTX_COLORS = {
  navy: '1E2761', // title bands, KPI fills, primary chart series
  navyLight: '5566C9',
  gold: 'F9B935', // factual accent (never a verdict colour)
  headerBg: 'E8ECF7', // light navy tint for table headers
  white: 'FFFFFF',
  black: '0F172A', // ink
  border: 'CBD5E1',
  /** Navy chart series (darkening → lightening navy/blue). */
  series: ['1E2761', '3245B7', '5566C9', '819AE9', 'B0C2F9', 'CDD9F5', 'E3EAFC'],
} as const
```

- [ ] **Step 2: Update `usePptxExport.ts` references.** Change the alias block (lines ~25-27):

```ts
const NAVY = PPTX_COLORS.navy
const HEADER_BG = PPTX_COLORS.headerBg
const WHITE = PPTX_COLORS.white
```

Then replace every `RH_RED` with `NAVY` in the file (8 usages — title bands, KPI box fill/line, node-chart `chartColors: [NAVY]`). And change the stacked-chart `chartColors: [...PPTX_COLORS.vcpuSeries]` → `chartColors: [...PPTX_COLORS.series]`.

- [ ] **Step 3: Verify**

Run: `npm run type-check` → exit 0.
Run: `npm run test -- src/composables/usePptxExport.test.ts` → existing tests still pass (font + table assertions unaffected by color).

- [ ] **Step 4: Commit**

```bash
rtk git add src/composables/pptx/theme.ts src/composables/usePptxExport.ts
rtk git commit -m "feat(pptx): Executive Navy palette — retire Red Hat red

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: VM-class breakdown + virt metrics data builders

**Files:** `src/composables/usePptxExport.ts` (add exported pure builders), test

- [ ] **Step 1: Write the failing test** — append to `src/composables/usePptxExport.test.ts`:

```ts
import { buildVmClassBreakdownRows, buildVirtMetricsData } from '../usePptxExport'
import type { VmClass, VirtWorkerSizing } from '@/engine/types'

const VMCLASSES: VmClass[] = [
  { id: 's', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 120 },
  { id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 },
]

describe('buildVmClassBreakdownRows', () => {
  it('header + one row per class + totals row', () => {
    const rows = buildVmClassBreakdownRows(VMCLASSES)
    expect(rows).toHaveLength(4) // header + 2 classes + total
    expect(rows[1]?.[0]?.text).toBe('Small')
    expect(rows[1]?.[1]?.text).toBe('120')
    // total vCPU = 120*2 + 60*4 = 480
    expect(rows[3]?.[2]?.text).toBe('480')
  })
})

describe('buildVirtMetricsData', () => {
  it('formats the four headline metrics', () => {
    const m: VirtWorkerSizing = {
      baseNodes: 6, spareNodes: 1, totalNodes: 7, limitingResource: 'ram',
      achievedOvercommit: 0.8, vmsPerNode: 32.5, cpuUtilizationPct: 8, ramUtilizationPct: 85.5,
    }
    const d = buildVirtMetricsData(m)
    expect(d.find((x) => x.label.includes('overcommit'))?.value).toBe('0.80:1')
    expect(d.find((x) => x.label.includes('VMs'))?.value).toBe('32.5')
  })
})
```

(Note: adjust the import to merge with the existing `from '../usePptxExport'` import at the top of the test file rather than duplicating it.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/composables/usePptxExport.test.ts` → FAIL (builders not exported).

- [ ] **Step 3: Implement** — add to `src/composables/usePptxExport.ts` (near the other builders; reuses the existing `TableRow`/`hdrCell`/`cell`/`numCell` helpers and imports `VmClass`/`VirtWorkerSizing` from `@/engine/types`):

```ts
export function buildVmClassBreakdownRows(vmClasses: VmClass[]): TableRow[] {
  const header: TableRow = [
    hdrCell('VM Class'),
    hdrCell('Count'),
    hdrCell('Total vCPU'),
    hdrCell('Total RAM (GB)'),
    hdrCell('Total Disk (GB)'),
  ]
  const rows: TableRow[] = vmClasses.map((c) => [
    cell(c.name),
    numCell(String(c.count)),
    numCell(String(c.count * c.vcpu)),
    numCell(String(c.count * c.ramGB)),
    numCell(String(c.count * c.diskGB)),
  ])
  const tot = vmClasses.reduce(
    (a, c) => ({
      count: a.count + c.count,
      vcpu: a.vcpu + c.count * c.vcpu,
      ram: a.ram + c.count * c.ramGB,
      disk: a.disk + c.count * c.diskGB,
    }),
    { count: 0, vcpu: 0, ram: 0, disk: 0 },
  )
  const totalRow: TableRow = [
    hdrCell('Total'),
    hdrCell(String(tot.count)),
    hdrCell(String(tot.vcpu)),
    hdrCell(String(tot.ram)),
    hdrCell(String(tot.disk)),
  ]
  return [header, ...rows, totalRow]
}

export function buildVirtMetricsData(m: VirtWorkerSizing): { label: string; value: string }[] {
  return [
    { label: 'Achieved overcommit', value: `${m.achievedOvercommit.toFixed(2)}:1` },
    { label: 'VMs / node', value: m.vmsPerNode.toFixed(1) },
    { label: 'Limiting resource', value: m.limitingResource.toUpperCase() },
    { label: 'CPU / RAM util', value: `${m.cpuUtilizationPct.toFixed(0)}% / ${m.ramUtilizationPct.toFixed(0)}%` },
  ]
}
```

Add `import type { ClusterConfig, ClusterSizing, NodeSpec, VmClass, VirtWorkerSizing } from '@/engine/types'` (extend the existing type import).

- [ ] **Step 4: Run to verify it passes** → `npm run test -- src/composables/usePptxExport.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/composables/usePptxExport.ts src/composables/usePptxExport.test.ts
rtk git commit -m "feat(pptx): VM-class breakdown + virt metrics data builders

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Render the VM-class slide in virt mode

**Files:** `src/composables/usePptxExport.ts`

- [ ] **Step 1: Add a slide builder + call it.** Add a helper that appends a VM-class breakdown slide, and call it for virt-mode clusters in both the single- and multi-cluster paths of `generatePptxReport`. The deck loop already has the `ClusterConfig` (`input.clusters[i]`) and `sizing`. Insert after each cluster's main slide:

```ts
// after addClusterSlide(...) / single-cluster slide build:
if (cluster.mode === 'virtualization' && cluster.virt) {
  addVmClassSlide(pptx, cluster.name, cluster.virt.vmClasses, sizing.virtMetrics ?? null)
}
```

Add the builder (uses navy theme + the Task-2 data builders):

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addVmClassSlide(
  pptx: any,
  name: string,
  vmClasses: VmClass[],
  metrics: VirtWorkerSizing | null,
): void {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: NAVY } })
  slide.addText('VM Class Breakdown — ' + name, {
    x: 0.3, y: 0, w: 13.0, h: 0.6, fontSize: 20, bold: true, color: WHITE,
    valign: 'middle', fontFace: PPTX_FONT.body,
  })
  slide.addTable(buildVmClassBreakdownRows(vmClasses), {
    x: 0.5, y: 1.0, w: 8.0, border: { type: 'solid', color: PPTX_COLORS.border, pt: 0.5 },
    fontFace: PPTX_FONT.body, fontSize: 11, rowH: 0.35,
  })
  if (metrics) {
    const data = buildVirtMetricsData(metrics)
    data.forEach((it, i) => {
      const y = 1.0 + i * 1.0
      slide.addText(it.label, {
        x: 9.0, y, w: 3.8, h: 0.3, fontSize: 10, color: PPTX_COLORS.black, fontFace: PPTX_FONT.body,
      })
      slide.addText(it.value, {
        x: 9.0, y: y + 0.3, w: 3.8, h: 0.5, fontSize: 18, bold: true, color: NAVY,
        fontFace: PPTX_FONT.metric,
      })
    })
  }
}
```

- [ ] **Step 2: Verify** — `npm run type-check` → exit 0. `npm run test -- src/composables/usePptxExport.test.ts` → PASS (data builders covered; render path is integration, not unit-tested, matching existing pattern).

- [ ] **Step 3: Commit**

```bash
rtk git add src/composables/usePptxExport.ts
rtk git commit -m "feat(pptx): VM-class breakdown slide + metrics strip (virt mode)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Navy PDF + virt CSV

**Files:** `src/composables/usePdfExport.ts`, `src/composables/useCsvExport.ts` (+ test)

- [ ] **Step 1: PDF navy.** In `usePdfExport.ts`, replace every red `238, 0, 0` with navy `30, 39, 97` — in `setTextColor(238, 0, 0)`, `setFillColor(238, 0, 0)`, and `headStyles: { fillColor: [238, 0, 0], ... }` (≈7 occurrences). Leave the orange warning color `249, 115, 22` and the grays as-is.

- [ ] **Step 2: CSV virt section.** In `useCsvExport.ts`, add a builder and use it in `generateCsvReport` when the active cluster is virt mode:

```ts
import type { VmClass } from '@/engine/types'

export function buildVmClassCsv(vmClasses: VmClass[]): string {
  const header = 'VM Class,Count,Total vCPU,Total RAM (GB),Total Disk (GB)'
  const rows = vmClasses.map(
    (c) => `${c.name},${c.count},${c.count * c.vcpu},${c.count * c.ramGB},${c.count * c.diskGB}`,
  )
  return [header, ...rows].join('\n')
}
```

In the single-cluster path of `generateCsvReport`, when `cluster.mode === 'virtualization' && cluster.virt`, prepend/append the VM-class CSV section to the output.

- [ ] **Step 3: Test** — append to `src/composables/__tests__/useCsvExport.test.ts`:

```ts
import { buildVmClassCsv } from '../useCsvExport'

describe('buildVmClassCsv', () => {
  it('emits header + per-class totals', () => {
    const csv = buildVmClassCsv([
      { id: 's', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 120 },
    ])
    expect(csv.split('\n')[0]).toContain('VM Class')
    expect(csv).toContain('Small,120,240,480,4800')
  })
})
```

- [ ] **Step 4: Run + full regression**

Run: `npm run test -- src/composables/__tests__/useCsvExport.test.ts` → PASS.
Run: `npm run type-check` → exit 0.
Run: `npm run test` → all pass (393 + Phase 4 ≈ 398+).
Run: `npm run format:check && npm run lint` → clean; 0 errors.
Run: `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
rtk git add src/composables/usePdfExport.ts src/composables/useCsvExport.ts src/composables/__tests__/useCsvExport.test.ts
rtk git commit -m "feat(export): navy PDF + VM-class CSV section (virt mode)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 self-review

- **Spec coverage:** navy palette retiring red across PPTX (Task 1) + PDF (Task 4); virt-aware deck content — VM-class breakdown slide + metrics (Tasks 2–3); CSV VM-class section (Task 4). Deferred (noted in Scope): `pptx/slides/` file reorg + dedicated title/assumptions cover slide.
- **Placeholder scan:** none — real palette hex, real builder code, exact test expectations.
- **Type consistency:** `buildVmClassBreakdownRows`/`buildVirtMetricsData`/`buildVmClassCsv` use `VmClass`/`VirtWorkerSizing` from Phase 1/3; `NAVY`/`PPTX_COLORS.series` replace `RH_RED`/`vcpuSeries` consistently.
- **Worked numbers:** breakdown totals for Small×120/Medium×60 → vCPU 480; CSV `Small,120,240,480,4800` (120×2, 120×4, 120×40).

## Next: Phase 5 (Docs/ADRs + milestone audit) — planned when reached.
