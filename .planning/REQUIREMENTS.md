# Requirements: os-sizer

**Defined:** 2026-03-31
**Core Value:** From constraints to proposal-ready hardware BoM in minutes — covering every supported OpenShift topology.

## v1 Requirements

### Project Setup

- [x] **SETUP-01**: Vue 3 + TypeScript + Vite + Tailwind v4 project initialized with same conventions as vcf-sizer
- [x] **SETUP-02**: ESLint + Prettier configured with same rules as vcf-sizer
- [x] **SETUP-03**: Vitest configured for unit testing the sizing engine
- [x] **SETUP-04**: vue-i18n configured with EN/FR/IT/DE locale files (lazy-loaded)
- [x] **SETUP-05**: Pinia configured with `inputStore` (refs) and `calculationStore` (computed) pattern

### Sizing Engine — Core Types & Formulas

- [x] **ENG-01**: TypeScript types defined for all 8 topologies: `StandardHA`, `Compact3Node`, `SNO`, `TNA`, `TNF`, `HCP`, `MicroShift`, `ManagedCloud`
- [x] **ENG-02**: Control plane node sizing formula (scales with worker count: 24→4vCPU/16GB, 120→8vCPU/32GB, 252→16vCPU/64GB, 501→16vCPU/96GB)
- [x] **ENG-03**: Worker count calculation formula: `max(cpu_limited, ram_limited, pod_density_limited)` with 70% target utilization
- [x] **ENG-04**: Allocatable RAM formula with tiered kernel reservation (25%/20%/10%/6% model)
- [x] **ENG-05**: Infrastructure node sizing formula (scales with worker count: 27→4CPU/24GB, 120→8CPU/48GB, 252→16CPU/128GB)
- [ ] **ENG-06**: Minimum hardware constants per topology: <!-- gap-closure Phase 8 -->
  - Standard HA CP: 4 vCPU / 16 GB / 100 GB SSD / 300 IOPS
  - Worker minimum: 2 vCPU / 8 GB / 100 GB
  - SNO standard: 8 vCPU / 16 GB / 120 GB
  - SNO vDU/telecom: 24–32 vCPU / 48–64 GB / 600 GB
  - Compact 3-node: same as CP minimum, workers=0
  - TNA arbiter: 2 vCPU / 8 GB / 50 GB SSD
  - TNF: 2 full CPs, no arbiter, Redfish BMC required
  - HCP: 78 pods / 5 vCPU / 18 GiB per hosted CP at idle
  - MicroShift: 2 vCPU / 2 GB + workload overhead
- [x] **ENG-07**: ODF add-on sizing: 16 vCPU / 64 GB × 3 storage nodes minimum; +2 CPU/+5 GB per additional OSD <!-- gap-closure Phase 6 -->
- [x] **ENG-08**: RHACM hub sizing: 3 workers × 16 vCPU / 64 GB (handles ~500 clusters) <!-- gap-closure Phase 6 -->
- [x] **ENG-09**: All engine functions are pure TypeScript with no Vue imports, fully unit-tested

### Sizing Engine — Architecture Recommendation

- [x] **REC-01**: Recommendation engine takes user constraints and returns ranked topology suggestions with reasoning
- [x] **REC-02**: Constraints that drive recommendations: HA requirement, node budget, environment type (edge/datacenter/cloud), connectivity (air-gapped), workload size
- [x] **REC-03**: Each recommendation includes a short human-readable justification (i18n)

### Input Form — Wizard

- [ ] **FORM-01**: Multi-step wizard: (1) Environment constraints → (2) Workload profile → (3) Architecture selection → (4) Results
- [ ] **FORM-02**: Environment constraint inputs: datacenter / edge / far-edge / cloud, connectivity (connected / air-gapped), HA level required
- [ ] **FORM-03**: Workload profile inputs: number of applications, total pods, average CPU per pod (millicores), average RAM per pod (MiB)
- [ ] **FORM-04**: Architecture selection: auto-recommended or manual override from all 8 topologies
- [x] **FORM-05**: Optional add-ons toggle: ODF storage, infra nodes, GPU nodes, RHACM hub <!-- gap-closure Phase 6 -->
- [ ] **FORM-06**: SNO profile selector: Standard / Edge / Telecom-vDU (different hardware minimums)
- [ ] **FORM-07**: HCP inputs: number of hosted clusters, target QPS per cluster
- [ ] **FORM-08**: All inputs validated with Zod; errors displayed inline
- [ ] **FORM-09**: NumberSliderInput and WarningBanner shared components reused from vcf-sizer pattern

### Results Display

- [x] **RES-01**: On-screen Bill of Materials table: node type, count, vCPU, RAM, storage per node type <!-- gap-closure Phase 6 -->
- [ ] **RES-02**: Total resource summary: total vCPU, total RAM, total storage
- [ ] **RES-03**: Architecture overview card with topology name, HA level, and key constraints
- [ ] **RES-04**: Infra nodes displayed as separate line item when enabled <!-- gap-closure Phase 8 -->
- [x] **RES-05**: ODF nodes displayed as separate line item when enabled <!-- gap-closure Phase 6 -->
- [ ] **RES-06**: Warnings shown when inputs fall below official Red Hat minimums
- [ ] **RES-07**: Charts (bar/donut) showing resource distribution across node types

### URL Sharing

- [ ] **SHARE-01**: All wizard inputs encoded into a shareable compressed URL (lz-string + Zod schema)
- [ ] **SHARE-02**: URL decoded on page load to restore full state
- [ ] **SHARE-03**: Copy-to-clipboard button on results page

### Exports

- [ ] **EXP-01**: PowerPoint (PPTX) export via pptxgenjs — architecture summary slide + BoM table slide
- [ ] **EXP-02**: PDF export via jsPDF + jspdf-autotable — same content as PPTX, dynamically imported
- [ ] **EXP-03**: CSV export — BoM table as comma-separated file, plain TypeScript blob download

### Internationalization

- [x] **I18N-01**: All UI strings externalized to vue-i18n locale files
- [x] **I18N-02**: English (EN) locale complete
- [x] **I18N-03**: French (FR) locale complete
- [x] **I18N-04**: Italian (IT) locale complete
- [x] **I18N-05**: German (DE) locale complete
- [x] **I18N-06**: Language switcher in header
- [x] **I18N-07**: VueI18nPlugin configured WITHOUT the `include` option (Vite 8 rolldown compatibility)

### Quality & Testing

- [ ] **QA-01**: Unit tests for all engine sizing formulas (vitest)
- [ ] **QA-02**: Unit tests for recommendation engine
- [ ] **QA-03**: Unit tests for Zod validation schemas
- [ ] **QA-04**: Component tests for wizard step navigation <!-- gap-closure Phase 7 -->
- [x] **QA-05**: Test coverage for edge cases: minimums enforcement, topology-specific constraints

## v2 Requirements

### Advanced Scenarios

- **V2-01**: Multi-cluster sizing (multiple sites or environments in one session)
- **V2-02**: Air-gapped environment mirror registry sizing (bastion host, storage for 100–650 GB images)
- **V2-03**: Remote worker nodes topology with latency profile guidance
- **V2-04**: Submariner network overlay sizing for multi-cluster connectivity
- **V2-05**: ROSA / ARO / OSD managed cloud comparison view

### UX Enhancements

- **V2-06**: Save/load sessions (localStorage)
- **V2-07**: Side-by-side topology comparison
- **V2-08**: Printable HTML report (in addition to PPTX/PDF)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Subscription/licensing cost calculations | Pricing changes frequently; separate tool concern |
| Network topology design | Out of scope for hardware sizer |
| Day-2 operations planning (patching, upgrades) | Focus is initial sizing |
| SNO + worker nodes (not supported) | SNO is by definition single-node |
| Managed cloud (ROSA/ARO) hardware sizing | Managed — no user-controlled hardware |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 – SETUP-05 | Phase 1 | Complete |
| ENG-01, 02, 03, 05, 09 | Phase 2 | Complete |
| ENG-04 | Phase 8 (gap closure) | Pending |
| ENG-06 | Phase 8 (gap closure) | Pending |
| ENG-07 | Phase 6 (gap closure) | Complete |
| ENG-08 | Phase 6 (gap closure) | Complete |
| REC-01, 03 | Phase 2 | Complete |
| REC-02 | Phase 6 (gap closure) | Complete |
| FORM-01, 02, 03, 04, 06, 07, 08, 09 | Phase 3 | Complete |
| FORM-05 | Phase 6 (gap closure) | Complete |
| RES-02, 03, 06, 07 | Phase 4 | Complete |
| RES-01 | Phase 6 (gap closure) | Complete |
| RES-04 | Phase 8 (gap closure) | Pending |
| RES-05 | Phase 6 (gap closure) | Complete |
| SHARE-01 – SHARE-03 | Phase 4 | Complete |
| EXP-01 – EXP-03 | Phase 4 | Complete |
| I18N-01 – I18N-07 | Phase 1–4 | Complete |
| QA-01, 02, 03, 05 | Phase 2–5 | Complete |
| QA-04 | Phase 7 (gap closure) | Pending |

**Coverage:**

- v1 requirements: 52 total
- Complete: 41
- Gap closure pending (phases 6–8): 11
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after initial research*
