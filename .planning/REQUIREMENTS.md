# Requirements — os-sizer v2.1 Export

**Milestone:** v2.1 Export
**Status:** Active
**Last updated:** 2026-04-04

---

## Milestone v2.1 Requirements

### Validation Fix (WARN)

- [x] **WARN-04**: User sees a live migration warning only when virtualization is enabled AND no RWX-capable storage (ODF or any other RWX storage class) is configured — not exclusively when ODF is absent
- [x] **WARN-05**: Warning code, i18n keys, and test fixtures are updated from `VIRT_RWX_REQUIRES_ODF` to `VIRT_RWX_STORAGE_REQUIRED` consistently across all 4 locales (EN/FR/DE/IT) and all test files

### PPTX Export (PPTX)

- [ ] **PPTX-01**: User exports a consolidated single-slide PPTX containing title, KPI summary, chart, and BoM table on one slide (replaces current 2-slide layout)
- [ ] **PPTX-02**: Exported PPTX includes a vertical bar chart of node counts grouped by node pool type (using native pptxgenjs `BAR` chart API)
- [ ] **PPTX-03**: Exported PPTX includes a stacked bar chart showing vCPU distribution per node pool when 3 or more distinct node pool types are present in the sizing result

### PDF Export (PDF)

- [ ] **PDF-01**: Exported PDF includes a bar chart of node counts displayed above the BoM table
- [ ] **PDF-02**: Exported PDF includes a KPI summary callout box showing total vCPU, total RAM, and total Storage between the chart and the BoM table
- [ ] **PDF-03**: Exported PDF correctly renders accented and special characters for FR, DE, and IT locales (embedded Unicode-capable font — no boxes or missing characters)
- [ ] **PDF-04**: Exported PDF includes validation warnings rendered inline with severity-appropriate color and icon

### Multi-Cluster (CLUSTER)

- [ ] **CLUSTER-01**: User can add, remove, and rename up to 5 independent clusters via a tab bar on the Results page; each cluster has its own sizing configuration
- [ ] **CLUSTER-02**: User can tag each cluster with a role: hub, spoke, or standalone — displayed on the cluster tab and included in export headers
- [ ] **CLUSTER-03**: User can view a side-by-side comparison table of all configured clusters (rows = sizing metrics, columns = clusters, maximum 5 columns)
- [ ] **CLUSTER-04**: PPTX, PDF, and CSV exports include per-cluster sections and an aggregate totals row summing across all clusters

### Session Portability (SESSION)

- [ ] **SESSION-01**: User can download the current sizing session as a `.json` file from the export toolbar
- [ ] **SESSION-02**: User can load a previously saved `.json` session file from the export toolbar; the file is validated via Zod schema with user-friendly error messages on validation failure

---

## Future Requirements (Deferred to v2.2+)

- Red Hat branding on PPTX (red header band, logo, date/author footer)
- Import preview before session replace ("3 clusters: Hub, Spoke-A, Spoke-B")
- Session JSON version field for forward compatibility
- Air-gapped mirror registry sizing (bastion host, storage for 100–650 GB images)
- ROSA/ARO/OSD managed cloud comparison view
- RWX/ODF storage row as separate BoM line item
- Fix SNO_VIRT_NO_HA warning surfacing (store drops .warnings from calcCluster return)
- Remove orphan `gpuPerNode` field from AddOnConfig
- Aggregate BoM export per-cluster with delta indicators in comparison view
- Cluster template inheritance (Hub settings propagated to spokes)
- Comparison view URL sharing

---

## Out of Scope (v2.1)

- **html2canvas for export rendering** — requires mounted DOM, breaks headless export composable pattern; use native pptxgenjs charts + Chart.js offscreen canvas instead
- **New npm packages** — all v2.1 features achievable with pptxgenjs, jsPDF, chart.js, Zod, Pinia already installed
- **Cloud/server-side session storage** — static GitHub Pages app; no backend
- **localStorage session persistence** — hidden state, bad UX; JSON file export is the chosen approach
- **Radar or 3D chart types** — inappropriate for hardware count data
- **More than 5 cluster columns** — cognitive overload limit per UX research (NNGroup)
- **Per-cluster wizard duplication** — existing wizard reused via `activeClusterIndex`
- **Subscription/licensing costs** — pricing changes too frequently
- **Network topology design** — out of scope for hardware sizer
- **Day-2 operations planning** — focus is initial sizing

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| WARN-04 | Phase 14 | 14-01 | pending |
| WARN-05 | Phase 14 | 14-01 | pending |
| PPTX-01 | Phase 16 | 16-01 | pending |
| PPTX-02 | Phase 16 | 16-01 | pending |
| PPTX-03 | Phase 16 | 16-02 | pending |
| PDF-01 | Phase 17 | 17-01 | pending |
| PDF-02 | Phase 17 | 17-02 | pending |
| PDF-03 | Phase 17 | 17-02 | pending |
| PDF-04 | Phase 17 | 17-02 | pending |
| CLUSTER-01 | Phase 18 | 18-01 | pending |
| CLUSTER-02 | Phase 18 | 18-02 | pending |
| CLUSTER-03 | Phase 18 | 18-02 | pending |
| CLUSTER-04 | Phase 19 | 19-01 | pending |
| SESSION-01 | Phase 15 | 15-01 | pending |
| SESSION-02 | Phase 15 | 15-01 | pending |
