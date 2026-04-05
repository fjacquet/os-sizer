# Roadmap: os-sizer

## Milestones

- ✅ **v1.0 — Full OpenShift Sizer** — Phases 1-8 (shipped 2026-04-01) → [archive](.planning/milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 — OpenShift Virtualization + AI Sizing** — Phases 9-12 (shipped 2026-04-04) → [archive](.planning/milestones/v2.0-ROADMAP.md)
- 🚧 **v2.1 — Export** — Phases 13-19 (in progress)

## Phases

<details>
<summary>✅ v1.0 — Full OpenShift Sizer (Phases 1-8) — SHIPPED 2026-04-01</summary>

- [x] Phase 1: Project Foundation (3/3 plans) — completed 2026-03-31
- [x] Phase 2: Sizing Engine (6/6 plans) — completed 2026-03-31
- [x] Phase 3: Wizard UI (5/5 plans) — completed 2026-03-31
- [x] Phase 4: Results, Exports & Sharing (5/5 plans) — completed 2026-03-31
- [x] Phase 5: Polish & Release (4/4 plans) — completed 2026-03-31
- [x] Phase 6: Add-on Engine Integration (1/1 plans) — completed 2026-03-31
- [x] Phase 7: Wizard Component Tests (1/1 plans) — completed 2026-03-31
- [x] Phase 8: Engine Tech Debt (1/1 plans) — completed 2026-03-31

</details>

<details>
<summary>✅ v2.0 — OpenShift Virtualization + AI Sizing (Phases 9-12) — SHIPPED 2026-04-04</summary>

- [x] Phase 9: Virt Engine Foundation (4/4 plans) — completed 2026-04-01
- [x] Phase 10: GPU Node Engine (3/3 plans) — completed 2026-04-01
- [x] Phase 11: RHOAI Add-On Engine (3/3 plans) — completed 2026-04-01
- [x] Phase 12: BoM, Exports, Wizard UI + i18n (5/5 plans) — completed 2026-04-04

</details>

### 🚧 v2.1 — Export (In Progress)

**Milestone Goal:** Improve export quality, add multi-cluster sizing with side-by-side comparison, session portability, and fix the RWX storage live migration warning.

- [x] **Phase 13: Foundation Infrastructure** - Extract shared utilities and extend data model to unblock all v2.1 feature work (completed 2026-04-05)
- [x] **Phase 14: Warning Fix** - Correct WARN-02 to trigger on any absent RWX storage, not ODF exclusively (completed 2026-04-05)
- [x] **Phase 15: Session Portability** - Download and upload the full sizing session as a JSON file (completed 2026-04-05)
- [ ] **Phase 16: PPTX Redesign** - Consolidated 1-slide layout with native pptxgenjs charts
- [ ] **Phase 17: PDF Redesign** - Chart images, Unicode font, KPI callout, and inline warnings
- [ ] **Phase 18: Multi-Cluster UI** - Tab bar, role tagging, and side-by-side comparison view
- [ ] **Phase 19: Aggregate Exports** - Per-cluster sections and aggregate totals in all export formats

## Phase Details

### Phase 13: Foundation Infrastructure
**Goal**: Shared utilities and data model extensions are in place so all v2.1 feature phases can build without duplication or CALC-02 violations
**Depends on**: Phase 12
**Requirements**: (none — enabler phase)
**Success Criteria** (what must be TRUE):
  1. `src/composables/utils/download.ts` exports a `downloadBlob` utility used by at least one existing composable (extracted from useCsvExport)
  2. `src/composables/useChartData.ts` exists as a pure TypeScript module with no Vue imports and exports chart data builders accepting `ClusterSizing`
  3. `ClusterConfig` in `engine/types.ts` has an optional `role` field typed as `'hub' | 'spoke' | 'standalone'`
  4. `calculationStore` exposes an `aggregateTotals` computed value with zero `ref()` calls (CALC-02 compliant)
  5. All 256 existing tests continue to pass after refactoring
**Plans**: 2 plans

Plans:
- [x] 13-01: Extract downloadBlob utility and add useChartData pure TS module
- [x] 13-02: Extend ClusterConfig with role field and add aggregateTotals computed to calculationStore

### Phase 14: Warning Fix
**Goal**: Users see the live migration storage warning only when virtualization is enabled and no RWX-capable storage is configured — not when ODF is absent but another RWX storage class exists
**Depends on**: Phase 13
**Requirements**: WARN-04, WARN-05
**Success Criteria** (what must be TRUE):
  1. User enabling virtualization with ODF selected sees no live migration storage warning
  2. User enabling virtualization with a non-ODF RWX storage class selected sees no live migration storage warning
  3. User enabling virtualization with no RWX storage of any kind sees the `VIRT_RWX_STORAGE_REQUIRED` warning
  4. Warning key `VIRT_RWX_REQUIRES_ODF` no longer exists in any source file, locale file, or test fixture
  5. All 4 locale files (EN/FR/DE/IT) carry the updated warning message referencing RWX storage
**Plans**: 1 plan

Plans:
- [x] 14-01: Add rwxStorageAvailable field, update validation guard, rename warning code, update locales and tests, add UI checkbox

### Phase 15: Session Portability
**Goal**: Users can save their complete sizing session to a JSON file and restore it later — enabling cross-browser portability and sharing without URL size limits
**Depends on**: Phase 13
**Requirements**: SESSION-01, SESSION-02
**Success Criteria** (what must be TRUE):
  1. User can click "Save session" in the export toolbar and receive a `.json` file download containing the current cluster configuration
  2. User can click "Load session" in the export toolbar, select a previously saved `.json` file, and see the sizing results restored without page reload
  3. User who selects an invalid or corrupted JSON file sees a user-readable error message (not a raw Zod error) and the current session is unchanged
  4. Importing the same file twice works correctly (file input resets after each attempt)
**Plans**: 2 plans

Plans:
- [x] 15-01: Implement useSessionExport composable with export and import logic
- [x] 15-02: Add JSON import/export buttons to ExportToolbar with error handling UI
**UI hint**: yes

### Phase 16: PPTX Redesign
**Goal**: Exported PPTX decks contain a consolidated single-slide layout with native bar charts, making them immediately usable in pre-sales proposals without manual editing
**Depends on**: Phase 13
**Requirements**: PPTX-01, PPTX-02, PPTX-03
**Success Criteria** (what must be TRUE):
  1. Exported PPTX contains exactly one slide with title, KPI summary, chart, and BoM table — replacing the previous 2-slide layout
  2. That slide includes a vertical bar chart of node counts grouped by node pool type rendered via native pptxgenjs `BAR` chart API
  3. When 3 or more distinct node pool types exist in the sizing result, the slide also includes a stacked bar chart showing vCPU distribution per pool
  4. Zero-count node pools are absent from chart series (not represented as 0-height bars)
**Plans**: TBD

Plans:
- [ ] 16-01: Redesign usePptxExport with 1-slide layout and native pptxgenjs bar chart
- [ ] 16-02: Add stacked vCPU chart for 3+ node pool results and finalize chart options factory

### Phase 17: PDF Redesign
**Goal**: Exported PDFs contain chart visuals, a KPI summary block, validation warnings, and correct rendering of accented characters across all supported locales
**Depends on**: Phase 13
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04
**Success Criteria** (what must be TRUE):
  1. Exported PDF includes a bar chart image of node counts displayed above the BoM table
  2. Exported PDF includes a KPI summary callout box showing total vCPU, total RAM, and total Storage between the chart and the BoM table
  3. French, German, and Italian locale exports render accented and special characters correctly — no boxes or replacement characters appear in headers, labels, or table cells
  4. Exported PDF renders active validation warnings inline with severity-appropriate color differentiation
**Plans**: 2 plans

Plans:
- [ ] 17-01: Implement Chart.js offscreen canvas rendering and embed chart image in PDF via doc.addImage
- [ ] 17-02: Embed Roboto Regular Unicode font, add KPI callout box and inline warnings; update ExportToolbar to pass resolved warnings

### Phase 18: Multi-Cluster UI
**Goal**: Users can configure, label, and compare up to 5 independent clusters in a single session, with each cluster assignable a hub, spoke, or standalone role for Hub+Spoke pre-sales use cases
**Depends on**: Phase 13
**Requirements**: CLUSTER-01, CLUSTER-02, CLUSTER-03
**Success Criteria** (what must be TRUE):
  1. User can add a new cluster (up to 5) via a tab bar on the Results page and switch between clusters by clicking their tabs
  2. User can rename any cluster tab by double-clicking the label and typing a new name
  3. User can remove any cluster except the last one, and the tab bar updates without stale index errors
  4. User can assign each cluster a role (hub, spoke, or standalone) visible on the cluster tab
  5. User can toggle a comparison view showing all clusters side-by-side in a table with sizing metrics as rows and clusters as columns (maximum 5 columns)
**Plans**: TBD

Plans:
- [ ] 18-01: Add cluster tab bar to ResultsPage with add, remove, rename, and active-cluster switching
- [ ] 18-02: Add role selector to cluster tab and implement ComparisonView component
**UI hint**: yes

### Phase 19: Aggregate Exports
**Goal**: PPTX, PDF, and CSV exports cover all configured clusters with per-cluster sections and an aggregate totals row, giving pre-sales engineers a single-file deliverable for multi-cluster proposals
**Depends on**: Phase 16, Phase 17, Phase 18
**Requirements**: CLUSTER-04
**Success Criteria** (what must be TRUE):
  1. PPTX export includes one section per cluster and an aggregate summary slide when multiple clusters are configured
  2. PDF export includes one autoTable section per cluster (with cluster name header) and an aggregate totals row at the end
  3. CSV export includes per-cluster data with a cluster name grouping row and a single-file aggregate totals row
  4. All three export formats trigger a single download per user action (no multiple simultaneous downloads)
**Plans**: TBD

Plans:
- [ ] 19-01: Update usePptxExport and usePdfExport with multi-cluster mode and aggregate section
- [ ] 19-02: Update useCsvExport with cluster grouping rows and validate all three export formats end-to-end

## Progress

**Execution Order:**
Phases execute in numeric order: 13 → 14 → 15 → 16 → 17 → 18 → 19
(14, 15, 16 can run in parallel after 13; 17 can run alongside 16; 18 can run alongside 16-17; 19 requires 16+17+18)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Foundation | v1.0 | 3/3 | Complete | 2026-03-31 |
| 2. Sizing Engine | v1.0 | 6/6 | Complete | 2026-03-31 |
| 3. Wizard UI | v1.0 | 5/5 | Complete | 2026-03-31 |
| 4. Results, Exports & Sharing | v1.0 | 5/5 | Complete | 2026-03-31 |
| 5. Polish & Release | v1.0 | 4/4 | Complete | 2026-03-31 |
| 6. Add-on Engine Integration | v1.0 | 1/1 | Complete | 2026-03-31 |
| 7. Wizard Component Tests | v1.0 | 1/1 | Complete | 2026-03-31 |
| 8. Engine Tech Debt | v1.0 | 1/1 | Complete | 2026-03-31 |
| 9. Virt Engine Foundation | v2.0 | 4/4 | Complete | 2026-04-01 |
| 10. GPU Node Engine | v2.0 | 3/3 | Complete | 2026-04-01 |
| 11. RHOAI Add-On Engine | v2.0 | 3/3 | Complete | 2026-04-01 |
| 12. BoM, Exports, Wizard UI + i18n | v2.0 | 5/5 | Complete | 2026-04-04 |
| 13. Foundation Infrastructure | v2.1 | 2/2 | Complete   | 2026-04-05 |
| 14. Warning Fix | v2.1 | 1/1 | Complete   | 2026-04-05 |
| 15. Session Portability | v2.1 | 2/2 | Complete   | 2026-04-05 |
| 16. PPTX Redesign | v2.1 | 0/2 | Not started | - |
| 17. PDF Redesign | v2.1 | 0/2 | Planned | - |
| 18. Multi-Cluster UI | v2.1 | 0/2 | Not started | - |
| 19. Aggregate Exports | v2.1 | 0/2 | Not started | - |

---
*v1.0 archived: 2026-04-01*
*v2.0 archived: 2026-04-04*
*v2.1 roadmap created: 2026-04-04*
