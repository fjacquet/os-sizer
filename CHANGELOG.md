# Changelog

All notable changes to os-sizer are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.1.0] — 2026-04-06

### Added — Multi-Cluster, Session Portability & Export Redesign

#### Multi-Cluster Sizing (Phase 18)
- Cluster tab bar with add/remove/rename for up to 5 independent clusters
- Cluster role tagging: hub, spoke, or standalone — displayed on tab and in exports
- Side-by-side comparison table (rows = metrics, columns = clusters, max 5)
- `addCluster()` copies active cluster config for consistent defaults

#### Session Portability (Phase 15)
- Download current sizing session as `.json` file from export toolbar
- Load previously saved `.json` session with Zod schema validation and user-friendly error messages

#### Aggregate Exports (Phase 19)
- PPTX: per-cluster slides + aggregate summary slide with totals
- PDF: per-cluster sections with headers + aggregate total row
- CSV: per-cluster grouping rows with repeated headers + aggregate totals

#### PPTX Export Redesign (Phase 16)
- Consolidated single-slide PPTX with title, KPI summary, chart, and BoM table
- Vertical bar chart of node counts grouped by node pool type (native pptxgenjs BAR)
- Stacked bar chart showing vCPU distribution when ≥3 node pool types

#### PDF Export Redesign (Phase 17)
- Bar chart of node counts displayed above BoM table
- KPI summary callout box (total vCPU, RAM, Storage) between chart and BoM
- Unicode-capable embedded font for FR/DE/IT locale rendering
- Validation warnings rendered inline with severity-appropriate color and icon

#### Validation Fix (Phase 14)
- Live migration warning triggers on virt enabled + no RWX storage (not just ODF absence)
- Warning code updated from `VIRT_RWX_REQUIRES_ODF` to `VIRT_RWX_STORAGE_REQUIRED` across all 4 locales

#### Foundation Infrastructure (Phase 13)
- Chart.js integration with `useChartData` composable for offscreen canvas rendering
- Shared chart helpers for BoM visualization

### Changed
- `ClusterConfig` extended with `id`, `name`, `role` fields for multi-cluster support
- `inputStore` manages `clusters[]` array and `activeClusterIndex` via Pinia
- `calculationStore` computes `clusterResults[]` and `aggregateTotals` reactively
- ClusterTabBar moved from Results page to App layout (accessible from all wizard steps)
- Test suite expanded from 256 to 349 tests

### Fixed
- `addCluster()` now copies active cluster config instead of creating blank defaults
- Duplicate `role` field removed from `ClusterConfig` type (merge artifact)
- Warning code/i18n keys/test fixtures updated consistently across EN/FR/DE/IT

---

## [2.0.0] — 2026-04-04

### Added — OpenShift Virtualization + AI Sizing

#### Virtualization (OpenShift Virtualization / KubeVirt)
- `calcVirt()` engine function applies KubeVirt per-worker overhead: +2 vCPU/node plus per-VM formula (218 MiB base + 8 MiB × vCPUs + 0.2% guest RAM)
- Wizard Step2: OpenShift Virtualization toggle with VM count, VMs per worker, average VM vCPU/RAM inputs
- Wizard Step3: Virt sub-inputs shown when `virtEnabled` and topology is standard-ha or compact-3node
- Recommendation engine boosts standard-ha score by +25 when VM workloads are present
- SNO-with-Virt profile: enforces 14 vCPU / 32 GB RAM / 170 GB storage (120 GB root + 50 GB second disk)
- `ValidationWarning` emitted when virt is active without ODF enabled (RWX storage required for live migration)
- `virtWorkerNodes` row in BoM table and all exports (CSV, PPTX, PDF)

#### GPU Node Pool
- `calcGpuNodes()` engine function: user-specified dedicated GPU node pool, enforces hardware minimums (16 vCPU / 64 GB RAM / 200 GB storage)
- Wizard Step2: GPU pool toggle with node count, GPU mode (container / passthrough / vGPU), GPU model (A100-40GB / A100-80GB / H100-80GB), MIG profile cascade select
- MIG profile lookup table for A100-40GB (1g.5gb→7, 2g.10gb→3, 3g.20gb→2, 7g.40gb→1 instances), A100-80GB, H100-80GB
- Static vGPU density reference table per GPU model (clearly marked as estimated, driver-version dependent)
- `ValidationWarning` emitted when GPU passthrough mode is active (live migration permanently blocked)
- `ValidationWarning` emitted when MIG profile combined with KubeVirt VMs (unsupported by GPU Operator)
- `gpuNodes` row in BoM table and all exports (CSV, PPTX, PDF)

#### Red Hat OpenShift AI (RHOAI)
- `calcRHOAI()` engine function: enforces 8 vCPU / 32 GB RAM per-worker floor; adds +4 vCPU / +16 GB RAM infra overhead
- Wizard Step2: RHOAI add-on toggle
- BoM shows RHOAI overhead row with KServe, Data Science Pipelines, Model Registry component breakdown

#### i18n
- 31 new i18n keys across all four locales (EN, FR, DE, IT)
- 5 pre-existing missing warning/recommendation keys backfilled in all locales

### Changed
- `ClusterSizing` type extended with `virtWorkerNodes`, `gpuNodes`, `virtStorageGB`, `rhoaiOverhead` fields
- `AddOnConfig` extended with 13 new fields (virt × 6, GPU × 6, rhoaiEnabled × 1)
- `sumTotals()` now aggregates `virtWorkerNodes` and `gpuNodes` alongside existing pools

### Fixed
- All export composables (CSV, PPTX, PDF) now include virtWorkerNodes and gpuNodes rows

---

## [1.0.0] — 2026-04-01

### Added — Full OpenShift Sizer

#### Sizing Engine
- Multi-topology calculator: standard-ha, compact-3node, SNO, HCP, stretched-metro, single-site-ha
- Add-on engines: `calcODF()`, `calcRHACM()` post-dispatch pattern
- Recommendation engine with topology scoring and justification keys
- ValidationWarning system for incompatible topology/add-on combinations
- URL state serialization (LZ-compressed, shareable links)

#### Wizard UI
- 3-step wizard: Environment → Workload → Architecture
- WizardStepper with step state management
- NumberSliderInput, RecommendationCard, WarningBanner shared components
- Full dark mode support (Tailwind v4 class-based)

#### Results & Exports
- BoM table with per-pool NodeSpec rows (worker, infra, ODF, RHACM, control plane)
- TotalsSummaryCard and ArchOverviewCard
- CSV export (downloadable)
- PPTX export (slide deck via pptxgenjs)
- PDF export (via jsPDF + autotable)
- Shareable URL via clipboard

#### i18n
- Full EN, FR, DE, IT locale support
- vue-i18n v11 with compile-time optimization

#### Tech
- Vue 3.5 + TypeScript + Vite 8 + Tailwind v4 + Pinia + vue-i18n
- 186 Vitest unit tests at release
