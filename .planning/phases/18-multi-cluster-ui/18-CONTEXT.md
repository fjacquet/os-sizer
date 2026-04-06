# Phase 18: Multi-Cluster UI - Context

**Gathered:** 2026-04-05 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can configure up to 5 independent clusters via a tab bar at the top of the Results page. Each tab shows a compact role dropdown (hub/spoke/standalone). Clusters can be renamed by double-clicking the tab label. A side-by-side comparison view can be toggled to show all clusters in a single table. Per-cluster export sections (Phase 19) are out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Tab Bar Placement
- **D-01:** `ClusterTabBar` component placed as the **first element** in `ResultsPage.vue`, above `ArchOverviewCard` — switching clusters replaces the entire results view below the tab bar
- **D-02:** Tab bar layout: `[ Role: Name ▾ ]  [ Role: Name ▾ ]  [ + Add ]` — role badge as prefix, cluster name, chevron dropdown trigger, add button at end
- **D-03:** Add button is disabled (greyed out, tooltip) when cluster count reaches 5 — enforcing CLUSTER-01 maximum

### Role Assignment (CLUSTER-02)
- **D-04:** Each tab contains a compact role dropdown inline: clicking the role prefix (e.g. "Hub:") or chevron opens a 3-option dropdown: Hub / Spoke / Standalone
- **D-05:** Role badge uses distinct visual treatment per role: Hub → primary color (RH red tint), Spoke → secondary (blue tint), Standalone → neutral (gray) — exact colors at Claude's discretion
- **D-06:** Role defaults to `standalone` when a new cluster is added — matches the `ClusterConfig.role` optional field defaulting behaviour (Phase 13)
- **D-07:** Role assignment calls `inputStore.updateCluster(id, { role })` — no new store action needed

### Rename Interaction (CLUSTER-01)
- **D-08:** Double-clicking the cluster name on a tab activates an inline text input in-place; pressing Enter or blurring confirms rename — calls `inputStore.updateCluster(id, { name })`
- **D-09:** Rename is not in scope for the role dropdown — keep the two interactions separate (double-click = rename, click role/chevron = role dropdown)

### Comparison View (CLUSTER-03)
- **D-10:** A "Compare clusters" toggle button appears below the tab bar (or at the bottom of the Results page above the ExportToolbar) — visible only when 2+ clusters exist
- **D-11:** Toggling shows a `ClusterComparisonTable` component: rows = sizing metrics (Control Plane count/vCPU/RAM, Workers, Infra, ODF, RHACM, Virt, GPU, Total vCPU, Total RAM, Total Storage), columns = cluster names (max 5)
- **D-12:** Comparison table is a separate Vue component (`ClusterComparisonTable.vue`) that reads from `calculationStore.clusterResults` — not embedded in ResultsPage directly, conditional on toggle state

### i18n Keys
- **D-13:** Add keys under `results.clusters.*` namespace in all 4 locale files: `addCluster`, `removeCluster`, `roleHub`, `roleSpoke`, `roleStandalone`, `maxClustersReached`, `compareToggle`, `compareTitle`

### Claude's Discretion
- Exact tab visual styling (padding, active indicator, remove × button position)
- Role badge color tokens (must be distinguishable in both light and dark mode)
- Comparison toggle button label and placement (above or below results content)
- Whether to show cluster name in the comparison table column header or just an index

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Store — already multi-cluster capable
- `src/stores/inputStore.ts` — `clusters`, `activeClusterIndex`, `addCluster()`, `removeCluster()`, `updateCluster()` all exist; no new store actions needed
- `src/stores/calculationStore.ts` — `clusterResults[]` array indexed by cluster position; `activeClusterIndex` already used

### Results page integration point
- `src/components/results/ResultsPage.vue` — `ClusterTabBar` inserted as first element; all existing child components remain, just driven by `activeClusterIndex`

### Data types
- `src/engine/types.ts` — `ClusterConfig.role?: 'hub' | 'spoke' | 'standalone'` already exists (Phase 13)

### i18n namespace
- `src/i18n/locales/en.json` — `results.*` namespace for new `results.clusters.*` keys

### Requirements
- `.planning/REQUIREMENTS.md` §CLUSTER-01, CLUSTER-02, CLUSTER-03 — exact acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `inputStore.updateCluster(id, patch)` — use for both rename (`{ name }`) and role assignment (`{ role }`)
- `inputStore.addCluster()` / `removeCluster(id)` — already implemented and tested
- `storeToRefs(input).clusters` / `activeClusterIndex` — already destructured in ResultsPage.vue
- `calculationStore.clusterResults[]` — indexed array, parallel to `clusters[]`

### Established Patterns
- Vue 3 `<script setup>` with Tailwind utility classes — follow ExportToolbar.vue and BomTable.vue patterns
- `useI18n().t()` for all user-facing strings — no hardcoded English in templates
- Dark mode: all Tailwind classes must include `dark:` variant

### Integration Points
- `ResultsPage.vue` — prepend `<ClusterTabBar />` as first child; all existing children remain untouched, just reactive to `activeClusterIndex`
- New components live in `src/components/results/`: `ClusterTabBar.vue`, `ClusterComparisonTable.vue`

</code_context>

<specifics>
## Specific Ideas

- Tab layout confirmed: `[ Hub: Cluster A ▾ ]  [ Spoke: Cluster B ▾ ]  [ + ]` — role prefix + name + chevron on each tab
- "No specific requirements beyond ROADMAP success criteria — open to standard approaches for tab styling and comparison toggle"

</specifics>

<deferred>
## Deferred Ideas

- Drag-to-reorder cluster tabs — v2.2+ backlog
- Cluster duplication ("Clone this cluster") — v2.2+
- Per-cluster export sections — Phase 19

</deferred>

---

*Phase: 18-multi-cluster-ui*
*Context gathered: 2026-04-05*
