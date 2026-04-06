---
phase: 18
slug: multi-cluster-ui
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-05
---

# Phase 18 — UI Design Contract

> Visual and interaction contract for the Multi-Cluster UI feature. Covers ClusterTabBar, inline role dropdown, rename interaction, and ClusterComparisonTable.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — Tailwind v4 utility classes, no component library |
| Preset | not applicable |
| Component library | none (Vue 3 SFC + Tailwind v4 utilities) |
| Icon library | Unicode glyphs inline (+ for add, ✕ for remove, ▾ for chevron) — source: existing ExportToolbar.vue + WarningBanner.vue patterns |
| Font | font-sans (system UI stack via Tailwind default) |

> Source: codebase scan — no components.json found; shadcn is React-only and not applicable to this Vue 3 + Vite project. All tokens are Tailwind utility classes used directly in SFCs.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gap within tab label (`gap-1`) |
| sm | 8px | Gap between tab elements (`gap-2` = 8px) |
| md | 16px | Horizontal tab padding (`px-3`) |
| lg | 24px | Vertical tab padding (`py-2`), section spacing |
| xl | 32px | Page horizontal padding (`sm:px-6`) |
| 2xl | 48px | Major section breaks |

Exceptions:
- Tab bar uses `flex flex-wrap gap-1 mb-4` — established dense tab layout
- Comparison toggle button sits below the tab bar with `mb-4 mt-2` separating it from the results content

> Source: ExportToolbar.vue (`flex flex-wrap gap-2 pt-2`), BomTable.vue table patterns.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px (text-base) | 400 (regular) | 1.5 |
| Tab label | 14px (text-sm) | 500 (font-medium) | 1.25 |
| Role badge | 12px (text-xs) | 600 (font-semibold) | 1.25 |
| Comparison table header | 14px (text-sm) | 500 (font-medium) | 1.25 |
| Comparison table cell | 14px (text-sm) | 400 (regular) | 1.25 |

Notes:
- Tab cluster name uses `text-sm font-medium` — match ExportToolbar button label style
- Role badge uses `text-xs font-semibold` to visually differentiate from the cluster name
- Comparison table metrics column uses `text-sm font-medium` for row headers

---

## Color

### Tab States

| State | Background | Border | Text |
|-------|-----------|--------|------|
| Active | `bg-white dark:bg-gray-800` | `border-gray-200 dark:border-gray-700 border-b-transparent` | `text-gray-900 dark:text-gray-100` |
| Inactive | `bg-gray-50 dark:bg-gray-700` | `border-gray-200 dark:border-gray-700` | `text-gray-600 dark:text-gray-400` |
| Hover (inactive) | `hover:bg-gray-100 dark:hover:bg-gray-600` | unchanged | `hover:text-gray-800 dark:hover:text-gray-200` |

### Role Badge Colors

| Role | Light mode | Dark mode |
|------|-----------|-----------|
| Hub | `bg-red-100 text-red-800` | `dark:bg-red-900/30 dark:text-red-300` |
| Spoke | `bg-blue-100 text-blue-800` | `dark:bg-blue-900/30 dark:text-blue-300` |
| Standalone | `bg-gray-100 text-gray-700` | `dark:bg-gray-700 dark:text-gray-300` |

### Add Cluster Button

| State | Style |
|-------|-------|
| Enabled | `border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-200` |
| Disabled (5 clusters) | `opacity-50 cursor-not-allowed` |

### Compare Toggle Button

Same visual class as ExportToolbar buttons:
`text-sm px-3 py-2 font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors`

Active state (comparison open): add `bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300`

---

## Component Inventory

Components touched or created in this phase:

| Component | Action | Notes |
|-----------|--------|-------|
| `src/components/results/ClusterTabBar.vue` | Create (new) | Tab bar with add/remove/rename/role dropdown |
| `src/components/results/ClusterComparisonTable.vue` | Create (new) | Side-by-side comparison table for all clusters |
| `src/components/results/ResultsPage.vue` | Modify | Prepend `<ClusterTabBar />`, add compare toggle + `<ClusterComparisonTable />` |
| `src/i18n/locales/en.json` | Modify | Add `results.clusters.*` keys |
| `src/i18n/locales/fr.json` | Modify | Add translated keys |
| `src/i18n/locales/de.json` | Modify | Add translated keys |
| `src/i18n/locales/it.json` | Modify | Add translated keys |

---

## Interaction Contract

### Tab Bar Layout

```
[ Hub: Cluster 1 ▾ ✕ ]  [ Spoke: Cluster 2 ▾ ✕ ]  [ + ]
```

- Each tab: `[ role-badge: cluster-name chevron remove-button ]`
- Role badge is a colored `<span>` with role abbreviation (Hub / Spoke / Standalone)
- Cluster name is a `<span>` that becomes an `<input>` on double-click
- Chevron `▾` triggers role dropdown
- Remove button `✕` removes cluster (hidden on last remaining cluster)
- Add button `[ + ]` at end, disabled at 5 clusters with tooltip

### Rename Interaction

- **Trigger:** double-click on the cluster name `<span>`
- **Activated state:** replace `<span>` with `<input type="text">`, autofocus, select-all
- **Confirm:** press Enter or blur (`@keydown.enter` + `@blur`)
- **Cancel:** press Escape — reverts to original name, no store mutation
- **Validation:** empty name not committed — revert to previous name if blank after trim
- **Calls:** `inputStore.updateCluster(id, { name: trimmedName })`

### Role Dropdown

- **Trigger:** click on role badge span OR chevron `▾`
- **Opens:** a small dropdown positioned below the tab (absolute, z-10)
- **Options:** Hub | Spoke | Standalone — translated via `results.clusters.roleHub` etc.
- **Selection:** calls `inputStore.updateCluster(id, { role })`, closes dropdown
- **Close:** click outside or press Escape
- **Implementation:** use a local `ref<boolean>` per tab for dropdown open state — no store state needed

### Comparison Toggle

- **Trigger:** click "Compare clusters" button
- **Visibility:** only rendered when `clusters.length >= 2`
- **State:** local `ref<boolean> showComparison` in ResultsPage
- **Label:** `t('results.clusters.compareToggle')` — e.g. "Compare clusters" / "Hide comparison"
- **Toggle behavior:** show/hide `<ClusterComparisonTable />`

### Comparison Table Layout

```
| Metric              | Cluster 1 (Hub) | Cluster 2 (Spoke) | ... |
|---------------------|-----------------|-------------------|-----|
| Control Plane nodes | 3               | 3                 |     |
| Control Plane vCPU  | 48              | 48                |     |
| Control Plane RAM   | 192 GB          | 192 GB            |     |
| Worker nodes        | 5               | 3                 |     |
| ...                 | ...             | ...               |     |
| Total vCPU          | 112             | 80                |     |
| Total RAM           | 448 GB          | 320 GB            |     |
| Total Storage       | 0 GB            | 0 GB              |     |
```

- Column header: cluster name + role badge
- Rows: metrics from `ClusterSizing` — each row represented by a `labelKey` + value per cluster
- Null node pools (e.g., `workerNodes = null` for compact-3node) shown as `—`
- `totals.vcpu / totals.ramGB / totals.storageGB` in dedicated summary rows with bold styling

---

## i18n Keys Contract

### Required keys (all 4 locales: en, fr, de, it)

```json
"results": {
  "clusters": {
    "addCluster": "Add cluster",
    "removeCluster": "Remove cluster",
    "roleHub": "Hub",
    "roleSpoke": "Spoke",
    "roleStandalone": "Standalone",
    "maxClustersReached": "Maximum of 5 clusters reached",
    "compareToggle": "Compare clusters",
    "compareTitle": "Cluster Comparison",
    "roleLabel": "Role"
  }
}
```

### Translations

| Key | EN | FR | DE | IT |
|-----|----|----|----|----|
| addCluster | Add cluster | Ajouter un cluster | Cluster hinzufügen | Aggiungi cluster |
| removeCluster | Remove cluster | Supprimer le cluster | Cluster entfernen | Rimuovi cluster |
| roleHub | Hub | Hub | Hub | Hub |
| roleSpoke | Spoke | Spoke | Spoke | Spoke |
| roleStandalone | Standalone | Autonome | Eigenständig | Autonomo |
| maxClustersReached | Maximum of 5 clusters reached | Maximum de 5 clusters atteint | Maximal 5 Cluster erreicht | Massimo di 5 cluster raggiunto |
| compareToggle | Compare clusters | Comparer les clusters | Cluster vergleichen | Confronta cluster |
| compareTitle | Cluster Comparison | Comparaison des clusters | Cluster-Vergleich | Confronto cluster |
| roleLabel | Role | Rôle | Rolle | Ruolo |

---

## Accessibility Contract

| Requirement | Implementation |
|-------------|---------------|
| Remove button announces cluster name | `:aria-label="t('results.clusters.removeCluster') + ' ' + cluster.name"` |
| Add button announces disabled reason | `title` attribute with `t('results.clusters.maxClustersReached')` when disabled |
| Role dropdown items are selectable | `role="option"` on dropdown items, `role="listbox"` on dropdown container |
| Active tab indicated | `aria-selected="true"` on active tab |
| Comparison table accessible | `<caption>` element with `t('results.clusters.compareTitle')` |
| Rename input is accessible | `aria-label` on input with current cluster name |

---

## Known Platform Limitations

- **Dropdown positioning on small screens:** The role dropdown may overflow on very narrow viewports (< 320px). This is acceptable for the pre-sales engineer target audience using desktop browsers. No special-case code required.
- **Tab bar wrapping:** With 5 clusters the tab bar wraps to a second line on small screens — this is intentional via `flex flex-wrap`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none — project does not use shadcn | not applicable |
| Third-party | none | not applicable |

> Source: No components.json found in project root. Vue 3 + Tailwind v4 utility-class approach confirmed. Registry vetting gate not triggered.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
