# Pitfalls Research

**Domain:** v2.1 Export milestone — PPTX charts, PDF charts, multi-cluster Pinia state, JSON session import/export, WARN-02 fix added to existing Vue 3 + TypeScript + Vite 8 + pptxgenjs + jsPDF app
**Researched:** 2026-04-04
**Confidence:** HIGH for pptxgenjs/jsPDF issues (reproduced from GitHub issues + official docs). HIGH for Pinia reactivity (official Pinia docs). MEDIUM for JSON session migration pattern (community sources). MEDIUM for Blob download browser compatibility (MDN + bug reports).

---

## pptxgenjs Charts

### Risk: Object Mutation Corrupts Repeated Chart Calls

**Risk:** pptxgenjs mutates option objects in-place (converts dimension values to EMU units). If a single options object is reused across multiple `addChart()` calls, the second call receives already-converted values, producing corrupted slide geometry. This is a silent corruption — the `.pptx` file is generated without error but renders incorrectly in PowerPoint.

**Prevention:** Always construct fresh option objects per chart call. Never store a chart options object in a variable and pass it to two different `addChart()` invocations. Use a factory function that returns a new object each time. Applies especially when iterating over multiple clusters to generate per-cluster slides.

**Phase:** Phase adding PPTX chart slides (PPTX redesign).

---

### Risk: chartData[0] TypeError When Data Array Is Empty or Undefined

**Risk:** `addChart()` throws `TypeError: Cannot read property '0' of undefined` when the `data` array is empty or when a series object is missing required fields. For a sizing report, this happens when a topology returns `null` for optional node pools (e.g., `gpuNodes: null`, `infraNodes: null`) and the chart-building function maps over all fields including null entries without filtering.

**Prevention:** Validate all chart data series before calling `addChart()`. Filter out null/zero node specs from the BoM-to-chart mapping step. Wrap `addChart()` in a guard: if the resulting data array has length 0, render a placeholder text element instead. Add a Vitest unit test for `buildChartData()` that covers a topology where all optional node pools are null (e.g., SNO).

**Phase:** Phase adding PPTX chart slides.

---

### Risk: Zero Values Disappear in Line/Bar Charts

**Risk:** pptxgenjs renders values of `0` (zero) as missing data points in certain chart types when the value is passed as a numeric `0`. This is a known issue (PptxGenJS GitHub issue #240). In a sizing report, a zero worker count (e.g., compact-3node has `workerNodes: null`) or a zero RHOAI overhead is not the same as "absent" — but the chart omits the data point.

**Prevention:** For the sizing chart use case, exclude zero-value series entirely rather than representing them as 0. Only include node pools with `count > 0` in chart series. Do not attempt to show null/absent pools as 0. This matches the BoM table behaviour (already conditional on `?? null` checks in existing code).

**Phase:** Phase adding PPTX chart slides.

---

### Risk: Custom Slide Layout Breaks Geometry After defineLayout()

**Risk:** When using `pptx.defineLayout()` to create a custom slide size and then assigning `pptx.layout` to that name, a known bug in pptxgenjs v3.3.0 produces a corrupted `.pptx` where PowerPoint opens a repair dialog and the layout dimensions are wrong. The workaround is to manually assign `pptx.presLayout.width` and `pptx.presLayout.height` after setting the layout name.

**Prevention:** Use the built-in `LAYOUT_WIDE` (13.33" x 7.5") for the redesigned slide. If a custom layout is ever needed, explicitly set `pptx.presLayout = { name: 'CUSTOM', width: ..., height: ... }` after `defineLayout()`. Pin the pptxgenjs version in package.json with an exact version (`"pptxgenjs": "3.x.y"`) not a range, and test after any upgrade.

**Phase:** Phase adding PPTX chart slides.

---

### Risk: writeFile() fileName Receives Object Instead of String

**Risk:** A confirmed pptxgenjs bug (GitHub issue #957): if `writeFile({ fileName: someVar })` is called and `someVar` is the result of an expression that returns an object (e.g., a template literal evaluated against `undefined`), the downloaded file is named `[object Object].pptx`. The existing code constructs the filename using `cluster.name` — if `cluster` is undefined at call time (e.g., multi-cluster index out of bounds), the name expression silently evaluates to `[object Object]`.

**Prevention:** Validate `cluster` is defined before constructing the filename string. Add a guard at the top of `generatePptxReport()` that throws a descriptive error if `input.clusters[clusterIdx]` is undefined. The existing code already has `?? input.clusters[0]` fallback — verify this is sufficient for the multi-cluster case where `clusterIdx` may be a valid but stale index after cluster removal.

**Phase:** Phase adding PPTX chart slides and multi-cluster export.

---

## PDF Charts with jsPDF

### Risk: Canvas Chart Renders as Black Rectangle in PDF

**Risk:** When rendering a Chart.js chart to canvas and then calling `doc.addImage(canvas.toDataURL(...))`, the image in the PDF is a solid black rectangle. This occurs when the canvas element is not yet fully rendered when `toDataURL()` is called (async rendering), or when `useCORS: true` is not set for html2canvas when any chart asset crosses origin. In a Vite SPA deployed at a GitHub Pages subpath (`/os-sizer/`), the font files loaded for Chart.js labels can trigger canvas taint.

**Prevention:** Use Chart.js's `animation: false` option and call `toDataURL()` only inside the `onComplete` callback or after `chart.render()` resolves. Alternatively, use the `chart.toBase64Image()` method directly (Chart.js built-in) which handles rendering state correctly. Do not use html2canvas for chart export — generate chart images programmatically via Chart.js canvas API instead.

**Phase:** Phase adding PDF chart slides (PDF redesign).

---

### Risk: jsPDF autoTable finalY Cast Breaks When No Table Was Rendered

**Risk:** The existing code already uses `(doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 200` to get the Y position after the table. This cast is fragile: if autoTable is not called (e.g., empty BoM), `lastAutoTable` is undefined and the fallback `200` may overflow the page. In the multi-cluster export case where multiple tables are rendered on the same page, `lastAutoTable.finalY` refers only to the most recently rendered table — stacking multiple cluster tables on one page requires tracking `finalY` explicitly between calls.

**Prevention:** Capture `autoTable()` return value directly: `const tableResult = autoTable(doc, {...})` and use `tableResult.finalY`. The jspdf-autotable v3.x API returns an object with `finalY`. Remove the `lastAutoTable` cast from existing code as part of the PDF redesign. Add a guard that starts a new page if `finalY + nextTableHeight > doc.internal.pageSize.height`.

**Phase:** Phase adding PDF charts (PDF redesign).

---

### Risk: Unicode Characters (Accented French/German/Italian) Render as Boxes or Are Dropped

**Risk:** jsPDF's default font (Helvetica) does not support characters outside the Latin-1 subset. The app uses four locales: EN, FR, IT, DE. French uses é, à, ç; German uses ä, ö, ü (no eszett per existing project decision); Italian uses accents. In the PDF, these render as boxes or are silently dropped with the default encoding. This is a well-documented jsPDF limitation (GitHub issue #2093, AutoTable issue #391).

**Prevention:** Use the `setFont()` method with an embedded Unicode-capable font. The standard approach is to embed a subset of NotoSans or Roboto using `addFileToVFS()` + `addFont()`. Alternatively, call `doc.setLanguage('fr')` and use `doc.setCharSpace(0)` — but this does not resolve the encoding limitation. The correct fix is font embedding. Since the project already decided against eszett, only the accented characters subset needs coverage. Consider adding a `fonts/` directory with a Base64-encoded NotoSans subset generated at build time. Verify all four locales in manual PDF tests before shipping.

**Phase:** Phase adding PDF redesign (especially if header/footer text is locale-translated).

---

### Risk: Page Break Splits a Row Across Pages in Large Multi-Cluster Tables

**Risk:** jspdf-autotable's default behaviour splits rows across pages when a row is taller than the remaining page space. For the BoM table, rows are single-line and this is not normally a problem. However, the RHOAI overhead row contains a long text string ("RHOAI Overhead (KServe / DS Pipelines / Model Registry)") that may wrap across lines at narrow column widths, making the row taller. In the multi-cluster aggregate BoM, a repeating-header approach is needed but not enabled by default.

**Prevention:** Set `rowPageBreak: 'avoid'` in autoTable options to prevent mid-row splits. For multi-cluster aggregate tables, enable `showHead: 'everyPage'` to repeat column headers. For the RHOAI label specifically, consider abbreviating the text in the PDF context (different from the PPTX context where space is more constrained).

**Phase:** Phase adding PDF redesign and multi-cluster aggregate BoM.

---

### Risk: doc.save() Triggers Popup Blocker in Some Browsers

**Risk:** `doc.save(filename)` in jsPDF triggers a file download via a temporary anchor element. In Safari on iOS, this does not reliably trigger a download — Safari on iOS requires the download to originate from a user gesture handler on the same call stack. If `generatePdfReport()` is called from a Vue event handler that awaits the dynamic import of jsPDF before triggering the save, the user gesture context is lost by the time `doc.save()` is called. The result is either a popup blocker interception or a silent no-op.

**Prevention:** Pre-warm the dynamic import. In the component that shows the export button, call `import('jspdf')` and `import('jspdf-autotable')` eagerly (e.g., in `onMounted`) so the modules are cached. When the user clicks the button, `await import('jspdf')` resolves immediately from cache, keeping the call stack within the gesture handler's synchronous lifetime. Add a comment in the composable explaining this constraint.

**Phase:** Phase adding PDF redesign; also applies to PPTX `writeFile()`.

---

## Multi-Cluster Pinia State

### Risk: Replacing the Clusters Array Breaks Reactivity

**Risk:** The `inputStore` uses `ref<ClusterConfig[]>([...])` as stated in the inline comment: "ref<[]> NOT reactive([]) — avoids storeToRefs() double-wrap bug". This is correct, but the consequence is that replacing the array wholesale (e.g., `clusters.value = loadedClusters`) works for reactivity, while mutating via index assignment (`clusters.value[0] = newCluster`) does NOT trigger reactivity for computed consumers in `calculationStore` that depend on `input.clusters[i]`. The existing `updateCluster()` uses `Object.assign(cluster, patch)` which does work because it mutates the existing ref'd object in place.

**Prevention:** All cluster mutations must go through the established `updateCluster(id, patch)` pattern. When adding multi-cluster operations (add, remove, reorder), follow the existing patterns: `push()` for add (already present), `splice()` for remove (already present). For bulk session import (restoring a full clusters array from JSON), use `clusters.value = newArray` (full array replacement on the ref — correct) not `clusters.value.forEach((c, i) => c = newArray[i])` (index assignment — broken).

**Phase:** Phase adding multi-cluster sizing and session import.

---

### Risk: calculationStore computed clusterResults Silently Returns Stale Result After Cluster Removal

**Risk:** `calculationStore.clusterResults` is a `computed<SizingResult[]>` that maps over `input.clusters`. After `removeCluster()`, the `clusters` array length changes and `clusterResults` recomputes. However, if any component holds a destructured reference `const { clusterResults } = storeToRefs(calc)` and then accesses `clusterResults.value[previousIndex]`, it may access a valid but wrong cluster (the cluster that shifted into that index position). The `activeClusterIndex` is clamped in `removeCluster()`, but component-local index variables are not.

**Prevention:** Components must never cache a cluster index as a local variable across async operations. Always read `input.activeClusterIndex` fresh from the store. In the multi-cluster UI tab component, use `storeToRefs()` for `activeClusterIndex` and drive all cluster access through it. Add a test that removes the active cluster and verifies the result displayed is the correct remaining cluster.

**Phase:** Phase adding multi-cluster UI.

---

### Risk: Aggregate BoM Computed Over All Clusters Recomputes on Every Input Keystroke

**Risk:** The multi-cluster aggregate BoM (total across all clusters) will be a `computed()` getter derived from `clusterResults`. Since `clusterResults` already recomputes on every input change (even mid-keystroke in a number input), the aggregate computed also fires on every keystroke. For 2-3 clusters this is negligible. If the aggregate BoM getter also formats i18n strings or formats numbers for display, those string operations inside a hot computed path add up.

**Prevention:** Keep the aggregate computed to pure arithmetic (summing NodeSpec counts/vcpu/ramGB). Move all formatting and i18n lookups to the template layer (not inside the computed). Use `computed(() => ({ totalVcpu: ..., totalRamGB: ..., totalStorageGB: ... }))` — numbers only. Format in the template with `{{ n(result.totalVcpu) }}`. This matches the existing pattern in `calculationStore` which exposes raw numbers.

**Phase:** Phase adding multi-cluster aggregate BoM.

---

### Risk: useInputStore() Called Inside computed() Callback Breaks SSR and Can Use Wrong Pinia Instance

**Risk:** The existing `calculationStore.ts` has a comment: "CRITICAL: call useInputStore() at TOP LEVEL — never inside a computed() callback". This constraint also applies to any new composables or stores added for multi-cluster or session export. Calling `useInputStore()` inside `computed(() => { const input = useInputStore(); ... })` works in SPA mode but breaks Pinia's SSR context injection and can use the wrong Pinia instance in tests that use `createTestingPinia()`.

**Prevention:** Always call `useOtherStore()` at the top level of `defineStore(() => { ... })` before any `computed()` or `watchEffect()` calls. This is already established as a pattern in `calculationStore`. When adding a session export store or a multi-cluster summary store, repeat this constraint in a comment on the first line.

**Phase:** Phase adding multi-cluster sizing and session export stores.

---

## JSON Session Import/Export

### Risk: Importing a Session Saved from a Different App Version Silently Overwrites Valid State with Partial/Wrong Data

**Risk:** The session JSON will encode a `ClusterConfig[]` (or a wrapper containing it). If a future version adds new fields (e.g., for v2.2 air-gapped mirror sizing), a session file exported from v2.1 will not contain those fields. Using `JSON.parse()` followed by direct assignment to the store without schema validation will either silently omit new required fields or apply wrong defaults. In the reverse direction, a v2.2 session imported into a v2.1 app may have unrecognised fields that corrupt the engine inputs.

**Prevention:** Use Zod's `z.object(...).passthrough()` for forward-compatibility (unknown fields ignored, not rejected). Always parse with `schema.safeParse(data)` — never with `schema.parse(data)` in import flow (throws on failure, which is unhandled in async context). Include a `version` field in the session envelope: `{ version: "2.1", clusters: [...] }`. When `version` does not match, show a user-visible warning: "This session was created with a different version. Some settings may have been reset to defaults." Do not silently discard. Implement a migration function per version step: `migrateV21toV22(data)`.

**Phase:** Phase adding session export/import.

---

### Risk: Zod safeParse Swallows the Error — UI Shows "Import Failed" With No Detail

**Risk:** `schema.safeParse(data).success === false` is the correct way to handle invalid imports. However, the `error.errors` array from Zod is verbose and technical (path arrays, issue codes). Displaying it directly to a pre-sales architect is confusing and unhelpful. The common mistake is to either display nothing ("Import failed") or display the raw Zod error object.

**Prevention:** Map Zod validation errors to user-friendly messages before displaying. A minimal approach: catch the first 3 errors and format them as "Field X: expected Y, got Z". Show a toast or modal with actionable guidance: "The file appears to be from an incompatible version. Export a new session from the current version and try again." Log the full Zod error to the browser console for debugging.

**Phase:** Phase adding session import.

---

### Risk: File Reader API Race Condition — FileReader.onload Fires After Component Unmounts

**Risk:** The file import flow uses the browser `FileReader` API to read the uploaded JSON file. If the user navigates away from the import UI while the read is in progress, `FileReader.onload` fires after the component has unmounted, attempting to call reactive store methods on a stale component context. This causes Vue warnings and potential store mutations in an undefined state.

**Prevention:** Wrap `FileReader` usage in a composable that tracks mount state. Use `onUnmounted(() => { reader.abort() })` to cancel in-flight reads. Alternatively, use `file.text()` (the modern File API returning a Promise) instead of `FileReader`, and wrap in `AbortController` if needed. The `file.text()` approach is cleaner for modern browser targets (all browsers supported by Vue 3 support it).

**Phase:** Phase adding session import UI.

---

### Risk: Large Session JSON Blocks the Main Thread During Parse

**Risk:** `JSON.parse()` is synchronous and blocks the main thread. For a session file containing many clusters (Hub+Spoke with 10+ clusters), or if historical export includes verbosely serialised engine output, a large file can cause a perceptible UI freeze. For an app deployed on GitHub Pages and opened by a pre-sales engineer during a customer meeting, a UI freeze is noticeable.

**Prevention:** Limit the session export to serialising `ClusterConfig[]` only — not `ClusterSizing` (which can be recomputed). This keeps the session file small (typically under 5 KB for 10 clusters). Add a `MAX_FILE_SIZE = 100 * 1024` (100 KB) guard at the start of the import handler: reject files larger than this with a clear message. For v2.1's use case (export/import of a handful of clusters), this is a complete prevention strategy. Do not add web worker complexity unless profiling shows a real problem.

**Phase:** Phase adding session import.

---

### Risk: Browser File Input Does Not Reset Between Imports — Second Import Ignored

**Risk:** An `<input type="file">` element does not fire the `change` event if the same file is selected twice in a row. If a user imports a session, modifies the imported data in the app, then wants to re-import the original file (same filename), the `change` event does not fire and the import is silently skipped.

**Prevention:** After processing an import, reset the file input value: `event.target.value = ''`. This ensures the `change` event fires on subsequent selection of the same file. Add this reset as a standard step in the import handler's `finally` block.

**Phase:** Phase adding session import UI.

---

## File Download / Upload (Browser Compatibility)

### Risk: Blob URL Not Revoked — Memory Leak in Long-Running SPA Sessions

**Risk:** The pattern `URL.createObjectURL(blob)` + `anchor.click()` + `URL.revokeObjectURL(url)` has a known Firefox bug: `revokeObjectURL()` does not release memory if the blob URL is actively being downloaded when revoke is called (Mozilla bug #939510). The workaround is to call `revokeObjectURL()` inside a `setTimeout(() => ..., 100)` delay. In a Vue SPA that a pre-sales engineer keeps open for hours, unreleased blobs accumulate.

**Prevention:** Use the `setTimeout` delay pattern for `revokeObjectURL()`. For jsPDF's `doc.save()`, jsPDF handles the cleanup internally — do not wrap it in additional blob creation code. For the PPTX `writeFile()`, pptxgenjs handles the download internally in browser mode. Only apply the blob cleanup pattern when manually constructing a download for the JSON session export.

**Phase:** Phase adding session export (JSON download).

---

### Risk: Safari iOS Does Not Support anchor.download Attribute

**Risk:** The `<a download="filename.json">` attribute is not honoured in Safari on iOS (opens file in browser tab instead of downloading). A pre-sales architect reviewing a customer proposal on an iPad cannot export a session file with the standard anchor-click download pattern.

**Prevention:** For the JSON session export specifically, consider offering a "Copy to clipboard" fallback in addition to file download. Alternatively, display the session JSON in a modal with a "Select All" button — the user can then paste it into a text file. Detect the limitation with `typeof navigator !== 'undefined' && /iPad|iPhone/.test(navigator.userAgent)` and show the clipboard fallback UI. This is a cosmetic degradation, not a blocking defect for the primary desktop use case.

**Phase:** Phase adding session export. Flag as known limitation in release notes.

---

### Risk: GitHub Pages Base Path Breaks Relative Asset URLs in Exported Files

**Risk:** The app is deployed at `https://fjacquet.github.io/os-sizer/` (base path `/os-sizer/`). The Vite config sets `base: '/os-sizer/'`. Any export that embeds URLs or references assets (e.g., a logo image in the PPTX from the public/ directory) must use absolute URLs, not relative paths. `fetch('/logo.png')` will 404; `fetch('/os-sizer/logo.png')` or `import.meta.env.BASE_URL + 'logo.png'` works.

**Prevention:** Use `import.meta.env.BASE_URL` when constructing any asset URL in export composables. The existing composables do not embed external images, so this is a new concern only for the PPTX/PDF branding redesign that might want to include the Red Hat logo. If embedding the logo, encode it as Base64 at build time using a Vite asset import (`import logoUrl from '@/assets/logo.png'`) and pass the data URL directly to `addImage()` — avoids the runtime URL issue entirely.

**Phase:** Phase adding PPTX/PDF branding redesign.

---

## WARN-02 Fix (RWX Storage / ODF Validation)

### Risk: Renaming VIRT_RWX_REQUIRES_ODF Breaks Existing Tests and i18n Keys

**Risk:** The current WARN-02 code is `VIRT_RWX_REQUIRES_ODF` with `messageKey: 'warnings.virt.rwxRequiresOdf'`. The fix changes the semantics: live migration requires any RWX storage (ODF, NFS, etc.), not ODF specifically. If the fix renames the warning code or messageKey, all 4 locale files must be updated atomically, and any test asserting the old code string will fail. Any component that conditionally displays special UI for this specific warning code (e.g., `if (warning.code === 'VIRT_RWX_REQUIRES_ODF')`) will silently stop matching.

**Prevention:** Rename the warning code to `VIRT_RWX_STORAGE_REQUIRED` to accurately reflect the new semantics. Update all 4 locale files in the same commit. Search the codebase for the old code string before renaming: grep for `VIRT_RWX_REQUIRES_ODF` in all `.ts`, `.vue`, `.json` files. Update all tests. Add a migration comment in `validation.ts` explaining the rename rationale.

**Phase:** Phase fixing WARN-02.

---

### Risk: The Fix Widens the Condition Too Broadly — Warning Disappears When It Should Still Fire

**Risk:** The current condition is:
```
if (config.addOns.virtEnabled && !config.addOns.odfEnabled && config.topology !== 'sno')
```
The correct fix means "warn if virt is enabled with live migration intent but no RWX-capable storage is configured". The app currently has no `rwxStorageProvider` field in `AddOnConfig`. If the fix simply removes the `!odfEnabled` condition without adding a new storage flag, the warning fires for ALL virt-enabled clusters (including ones where the user knows they have NFS — which they can't currently express). Alternatively, if the fix adds `nfsEnabled` or `rwxStorageEnabled` boolean to `AddOnConfig`, that widens the schema.

**Prevention:** The correct fix for v2.1 scope is: add a `rwxStorageAvailable: boolean` field to `AddOnConfig` (default `false`), update the wizard Step 3 to show a checkbox "RWX-capable storage available (ODF, NFS, or other)" visible when `virtEnabled = true`. Change the warning condition to `virtEnabled && !odfEnabled && !rwxStorageAvailable`. This is the minimal schema extension that resolves the semantic inaccuracy without breaking existing validation paths. Add the field to `createDefaultClusterConfig()` in `defaults.ts` and update all test fixtures.

**Phase:** Phase fixing WARN-02.

---

### Risk: Changing the Warning Condition Breaks the Existing validation.test.ts Snapshot

**Risk:** `validation.test.ts` likely has a test asserting that `VIRT_RWX_REQUIRES_ODF` fires when `virtEnabled=true` and `odfEnabled=false`. If the condition changes (to also check `rwxStorageAvailable`), the test that was passing must be updated. Failing to update the test means CI passes with a stale test that no longer reflects the intended behaviour.

**Prevention:** When changing the condition in `validateInputs()`, immediately update the corresponding test. Add a new test case: `virtEnabled=true, odfEnabled=false, rwxStorageAvailable=true` → no warning. And: `virtEnabled=true, odfEnabled=false, rwxStorageAvailable=false` → warning fires. This gives full coverage of the new condition.

**Phase:** Phase fixing WARN-02 — tests must be updated in the same PR as the logic change.

---

## Cross-Cutting Integration Pitfalls

### Risk: Multi-Cluster Export Calls generatePptxReport() or generatePdfReport() Per Cluster, Creating Multiple Downloads

**Risk:** The current export composables are scoped to a single active cluster. For multi-cluster export (aggregate BoM), calling the existing functions in a loop triggers one browser download per cluster. Browsers block multiple simultaneous downloads after the first as a security measure.

**Prevention:** Redesign the export composables to accept an optional `clusterIds?: string[]` parameter. When provided, include all specified clusters in a single PPTX (one slide per cluster + an aggregate slide) or a single PDF (one section per cluster). Never call the download trigger more than once per user action.

**Phase:** Phase adding multi-cluster export.

---

### Risk: Dynamic Import of pptxgenjs and jsPDF Inside the Same Export Function Causes Parallel Import Race

**Risk:** The PPTX and PDF export functions each independently do `await import('pptxgenjs')` and `await import('jspdf')`. If a future refactor calls both from the same user action, the imports may race. This is not a current problem but becomes one if an "Export All" button triggers both exports.

**Prevention:** Import both libraries at the top of a shared composable and cache the modules in module-scope variables. Since they are dynamically imported once and then cached by the browser module system, subsequent calls are free. For v2.1, the existing pattern is safe as long as PPTX and PDF are triggered by separate user actions.

**Phase:** Not blocking for v2.1, but note for any "export all formats" feature.

---

### Risk: Session Import Restores clusters Array but calculationStore clusterResults Momentarily Shows Stale Data

**Risk:** When a session is imported by replacing `inputStore.clusters.value`, Vue's reactivity system schedules the recomputation of `calculationStore.clusterResults` as a microtask — not synchronously. If the import UI immediately navigates to the results page in the same tick, the results page may briefly render stale data from the previous session (or an empty state) before the computed values update.

**Prevention:** Use `await nextTick()` after replacing the clusters array in the import handler, before navigating to the results page. This ensures the reactive graph has settled before the results are rendered. In tests, use `flushPromises()` from `@vue/test-utils` after the import action to verify the correct post-import state.

**Phase:** Phase adding session import.

---

## "Looks Done But Isn't" Checklist (v2.1 Additions)

- [ ] **PPTX chart data guard:** Verify `buildChartData()` handles all null node specs without throwing.
- [ ] **PPTX object reuse:** Verify no chart options object is shared across multiple `addChart()` calls.
- [ ] **PDF font encoding:** Verify accented FR/DE/IT characters render correctly in generated PDF (not boxes).
- [ ] **PDF finalY tracking:** Verify the `lastAutoTable` cast has been replaced with the `autoTable()` return value.
- [ ] **PDF user gesture:** Verify `doc.save()` is called without an intermediate `await` after the jsPDF dynamic import resolves (pre-warmed import pattern).
- [ ] **Multi-cluster reactivity:** Verify session import uses full array replacement (`clusters.value = [...]`) not index assignment.
- [ ] **Multi-cluster index safety:** Verify `removeCluster()` followed by accessing `clusterResults[previousIndex]` does not return a wrong cluster.
- [ ] **Session JSON schema:** Verify `version` field is in the exported JSON envelope.
- [ ] **Session import safeParse:** Verify import uses `safeParse()` not `parse()` and maps errors to user-friendly messages.
- [ ] **File input reset:** Verify the file `<input>` value is cleared after each import attempt.
- [ ] **WARN-02 code rename:** Verify old `VIRT_RWX_REQUIRES_ODF` string is absent from all `.ts`, `.vue`, `.json` files after fix.
- [ ] **WARN-02 new condition:** Verify three test cases: ODF enabled, RWX available, neither.
- [ ] **i18n completeness:** Verify all renamed/new messageKeys exist in all 4 locale files.
- [ ] **Base URL in exports:** Verify any asset embedded in PPTX/PDF uses `import.meta.env.BASE_URL` or Base64 import, not a bare `/` path.
- [ ] **Blob URL cleanup:** Verify JSON session download uses `setTimeout(() => revokeObjectURL(...), 100)` pattern.
- [ ] **Multi-cluster single download:** Verify aggregate BoM export triggers exactly one browser download, not one per cluster.

---

## Sources

- [PptxGenJS object mutation bug — mutates options in-place (EMU conversion)](https://github.com/gitbrent/PptxGenJS/issues)
- [PptxGenJS chart data TypeError — chartData[0] undefined](https://github.com/gitbrent/PptxGenJS/issues/572)
- [PptxGenJS zero values missing in line chart](https://github.com/gitbrent/PptxGenJS/issues/240)
- [PptxGenJS broken pptx with custom slide layout v3.3.0](https://github.com/gitbrent/PptxGenJS/issues/826)
- [PptxGenJS writeFile fileName receives object](https://github.com/gitbrent/PptxGenJS/issues/957)
- [jsPDF page break row split issue](https://github.com/parallax/jsPDF/issues/650)
- [jsPDF AutoTable UTF-8 support](https://github.com/simonbengtsson/jsPDF-AutoTable/issues/391)
- [jsPDF Unicode languages support limitation](https://github.com/parallax/jsPDF/issues/2093)
- [Pinia reactivity: objects/arrays in getters not reactive](https://github.com/vuejs/pinia/issues/780)
- [Pinia computed reactive not trigger sometimes](https://github.com/vuejs/pinia/issues/2265)
- [Pinia storeToRefs documentation](https://pinia.vuejs.org/api/pinia/functions/storeToRefs.html)
- [Pinia composing stores — useStore() before await](https://pinia.vuejs.org/cookbook/composing-stores.html)
- [URL.revokeObjectURL does not free memory for downloads — Firefox bug #939510](https://bugzilla.mozilla.org/show_bug.cgi?id=939510)
- [Safari iOS blob URL memory leak — Apple Developer Forums](https://developer.apple.com/forums/thread/693447)
- [Zod safeParse documentation](https://zod.dev/)
- [Verzod — versioned schema migration with Zod](https://github.com/AndrewBastin/verzod)

---

## Appendix: v2.0 Pitfalls (Virt/GPU/RHOAI Milestone)

*The following section documents pitfalls from the v2.0 milestone (OpenShift Virtualization + GPU + RHOAI sizing). Retained for reference.*

**Domain:** OpenShift Virtualization + RHOAI/GPU sizing
**Researched:** 2026-04-01
**Confidence:** HIGH for KubeVirt overhead numbers (official Red Hat docs). MEDIUM for RHOAI operator overhead. LOW for MIG-backed vGPU + OCP Virt combination.

### Pitfall 1: Omitting the KubeVirt Node Overhead Addend in calcVirt()

**What goes wrong:** `calcVirt()` sizes worker nodes based on VM workload demand without adding KubeVirt infrastructure overhead. Results in systematic undersizing.

**Prevention:** Apply per-virt-worker overhead (+2 CPU cores) and per-VM overhead addend in `calcVirt()`. Use named constants `VIRT_NODE_OVERHEAD_VCPU` and `VIRT_VM_BASE_OVERHEAD_MIB`.

**Phase:** Phase 1 (calcVirt() engine).

### Pitfall 2: GPU Passthrough, vGPU, and Container GPU Treated as Co-Schedulable

**What goes wrong:** GPU Operator enforces mutually exclusive node labels — a node cannot serve GPU containers AND GPU VMs simultaneously.

**Prevention:** Model GPU nodes as a dedicated pool (`gpuNodes NodeSpec`), separate from general workers. Emit warnings for passthrough mode (no live migration).

**Phase:** Phase 2 (GPU node type engine).

### Pitfall 3: SNO-with-Virt Minimum Not Boosted

**What goes wrong:** `calcSNO()` returns base 8 vCPU / 16 GB for SNO+Virt instead of minimum 14 vCPU / 32 GB + second disk.

**Prevention:** Check `virtEnabled` in `calcSNO()` and boost minimums. Constants: `SNO_VIRT_MIN_VCPU = 14`, `SNO_VIRT_MIN_RAM = 32`, `SNO_VIRT_STORAGE_MIN = 50`.

**Phase:** Phase 3 (SNO-with-Virt profile).

### Pitfall 4: RWX Storage Requirement Buried as Comment, Not Warning

**What goes wrong:** Live VM migration requires RWX PVCs. If not surfaced as a validation warning, architects miss the ODF dependency.

**Prevention:** Emit `VIRT_RWX_REQUIRES_ODF` (now renamed `VIRT_RWX_STORAGE_REQUIRED` in v2.1) when `virtEnabled=true` and no RWX storage source is configured.

**Phase:** Phase 1 (calcVirt engine) — upgraded to WARN-02 fix in v2.1.

### Pitfall 5: MIG-Backed vGPU in OCP Virt Silently Not Supported

**What goes wrong:** MIG-backed vGPU for KubeVirt VMs is not supported by the standard GPU Operator.

**Prevention:** Emit `MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED` error when `gpuMode=vGpu` + MIG-capable GPU + `virtEnabled`.

**Phase:** Phase 2 (GPU node engine).

### Pitfall 6: RHOAI Operator Overhead Missing from Worker Node Sizing

**What goes wrong:** RHOAI installs dashboard, KServe, ModelMesh, etc. — 16 vCPU / 64 GB minimum before any data science workloads.

**Prevention:** `calcRHOAI()` enforces cluster-level minimum. Emits `RHOAI_MINIMUM_CLUSTER_REQUIRED` warning when workers fall below floor.

**Phase:** Phase 5 (RHOAI add-on calculator).

### Pitfall 7: ClusterSizing Type Not Extended First

**What goes wrong:** Adding new node roles without extending `ClusterSizing` first causes runtime errors in BoM/export rather than compile-time errors.

**Prevention:** Extend `ClusterSizing` as the first commit of any major feature. Run `tsc --noEmit` in CI. Use typed fixtures — never `Partial<ClusterSizing>` or `any`.

**Phase:** Phase 1 (pre-code, type-first).

---

*v2.1 pitfalls researched: 2026-04-04*
*v2.0 pitfalls researched: 2026-04-01*
