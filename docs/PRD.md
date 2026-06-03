# os-sizer — Product Requirements Document

**Version:** 2.2.0 (unreleased)
**Last Updated:** 2026-06-03
**Core Value:** From constraints to proposal-ready hardware BoM in minutes — for both containerized OpenShift and OpenShift Virtualization (OVE) estates.

---

## Product Overview

**os-sizer** is a browser-based OpenShift cluster sizing tool that guides users through a 3-step wizard (Environment → Workload → Architecture) and produces a Bill of Materials (BoM) exportable as CSV, PPTX, or PDF. It supports all major OpenShift deployment topologies and optional platform add-ons.

**Target users:** Pre-sales architects, field engineers, and infrastructure leads who need accurate hardware sizing proposals without manual spreadsheet work.

---

## Sizing Modes

The wizard opens with a **mode** choice that branches the flow:

| Mode | For | Primary inputs |
|------|-----|----------------|
| **Container platform** | Containerized OpenShift workloads (pods) | pods, pod CPU/RAM, worker node size, add-ons (ODF/RHACM/infra/GPU/RHOAI) |
| **Virtualization (OVE)** | Virtual machines on OpenShift Virtualization Engine | VM size classes, bare-metal node shape, CPU overcommit, redundancy, storage backend |

**Virtualization mode** sizes a bare-metal OpenShift cluster to host VMs (KubeVirt), grounded in
Red Hat best practice (ADR-0007, ADR-0008):

- **VM size classes** — Small/Medium/Large × counts, each with vCPU / RAM / disk.
- **CPU overcommit** — vCPU:thread ratio (default 10, conservative 4, 1 = dedicated), per
  KubeVirt `vmiCPUAllocationRatio` (hyperthreading counted).
- **Per-VM memory overhead** — `218 MiB + 8 MiB/vCPU + 0.2% guest RAM`, auto-applied.
- **Node reservations** — OpenShift `system-reserved` + ~2 cores/node KubeVirt infra, auto-applied.
- **Redundancy** — N+1 (default) / N+2 spare nodes covering full restart load.
- **Storage** — ODF (replica-3, `raw ≈ usable × 3 / 0.85`) or external RWX; live migration requires RWX.
- **Results** — node count, limiting resource (CPU/RAM/density), achieved overcommit, VMs/node, and
  CPU/RAM utilization; exports add a VM-class breakdown.

OVE licensing boundaries are surfaced (ODF and container workloads are not included in OVE).

| Requirement | Description | Status |
|-------------|-------------|--------|
| MODE-01 | Mode selector on Step 1 (container vs virtualization) | ✅ |
| VMODE-01 | VM size-classes table + bare-metal node shape inputs | ✅ |
| VMODE-02 | CPU overcommit + N+1/N+2 redundancy inputs | ✅ |
| VMODE-03 | VM-centric worker sizing with limiting-resource + metrics | ✅ |
| VMODE-04 | ODF/external-RWX storage planning + OVE licensing warning | ✅ |
| VMODE-05 | Executive Navy exports with VM-class breakdown | ✅ |
| VMODE-06 | Backward-compatible sessions/URLs (default mode = container) | ✅ |

---

## Supported Topologies

| Topology | Description |
|----------|-------------|
| Standard HA | 3 control-plane + N workers + optional infra nodes |
| Compact 3-node | 3 combined control-plane/worker nodes |
| SNO | Single-node OpenShift (edge/lab) |
| SNO-with-Virt | SNO + OpenShift Virtualization (boosted minimums) |
| HCP (Hosted Control Plane) | Hosted control planes on a shared management cluster |
| Stretched Metro | Two-site active-active with synchronous replication |
| Single-site HA | Single-site variation of standard HA |

---

## v2.0 Feature Requirements

### VIRT — OpenShift Virtualization

| ID | Requirement | Status |
|----|-------------|--------|
| VIRT-01 | User can select 'OpenShift Virtualization' as topology in wizard Step3, enabling the virt sizing path | ✅ Complete |
| VIRT-02 | `calcVirt()` applies KubeVirt overhead: +2 vCPU/node + per-VM formula (218 MiB + 8 MiB×vCPUs + 0.2% guest RAM) | ✅ Complete |
| VIRT-03 | User inputs VM count per worker node to drive worker count (density, RAM, CPU constraints) | ✅ Complete |
| VIRT-04 | Recommendation engine boosts standard-ha score (+25) when VM workloads are present | ✅ Complete |

### GPU — GPU Node Pool

| ID | Requirement | Status |
|----|-------------|--------|
| GPU-01 | User enables dedicated GPU node pool with configurable node count | ✅ Complete |
| GPU-02 | User selects GPU mode: container (whole-GPU/pod), passthrough (whole-GPU/VM), vGPU (shared) | ✅ Complete |
| GPU-03 | GPU nodes rendered as separate NodeSpec row in BoM table and all exports (CSV, PPTX, PDF) | ✅ Complete |
| GPU-04 | User selects MIG profile for A100/H100 from static lookup table (1g.5gb, 2g.10gb, 3g.20gb, 7g.40gb) | ✅ Complete |
| GPU-05 | vGPU density reference table shown per GPU model (marked estimated, driver-version dependent) | ✅ Complete |

### RHOAI — Red Hat OpenShift AI

| ID | Requirement | Status |
|----|-------------|--------|
| RHOAI-01 | User enables RHOAI add-on to size the AI/ML platform layer | ✅ Complete |
| RHOAI-02 | When RHOAI enabled, each worker node is scaled up to minimum 8 vCPU / 32 GB RAM | ✅ Complete |
| RHOAI-03 | RHOAI operator overhead (+4 vCPU / +16 GB RAM) reserved on infra nodes | ✅ Complete |
| RHOAI-04 | BoM shows RHOAI overhead row: KServe, Data Science Pipelines, Model Registry breakdown | ✅ Complete |

### SNO — Single Node OpenShift

| ID | Requirement | Status |
|----|-------------|--------|
| SNO-01 | SNO-with-Virt profile enforces minimums: 14 vCPU, 32 GB RAM, 170 GB storage (120 GB root + 50 GB second disk) | ✅ Complete |

### WARN — Validation Warnings

| ID | Requirement | Status |
|----|-------------|--------|
| WARN-01 | Warning when GPU passthrough active: live migration permanently blocked | ✅ Complete |
| WARN-02 | Warning when virt enabled without ODF: RWX storage required for live migration | ✅ Complete |
| WARN-03 | Warning when MIG profile + KubeVirt VMs: combination unsupported by GPU Operator | ✅ Complete |

---

## v2.1 Feature Requirements (shipped 2026-04-06)

### WARN — Validation Fix

| ID | Requirement | Status |
|----|-------------|--------|
| WARN-04 | Live migration warning only when virt enabled AND no RWX-capable storage configured | ✅ Complete |
| WARN-05 | Warning code/i18n keys/test fixtures updated from `VIRT_RWX_REQUIRES_ODF` to `VIRT_RWX_STORAGE_REQUIRED` across all 4 locales | ✅ Complete |

### PPTX — Export Redesign

| ID | Requirement | Status |
|----|-------------|--------|
| PPTX-01 | Consolidated single-slide PPTX with title, KPI summary, chart, and BoM table | ✅ Complete |
| PPTX-02 | Vertical bar chart of node counts grouped by node pool type (native pptxgenjs BAR) | ✅ Complete |
| PPTX-03 | Stacked bar chart showing vCPU distribution when ≥3 distinct node pool types | ✅ Complete |

### PDF — Export Redesign

| ID | Requirement | Status |
|----|-------------|--------|
| PDF-01 | Bar chart of node counts displayed above BoM table | ✅ Complete |
| PDF-02 | KPI summary callout box (total vCPU, RAM, Storage) between chart and BoM table | ✅ Complete |
| PDF-03 | Unicode-capable embedded font for FR/DE/IT locale rendering | ✅ Complete |
| PDF-04 | Validation warnings rendered inline with severity-appropriate color and icon | ✅ Complete |

### CLUSTER — Multi-Cluster Sizing

| ID | Requirement | Status |
|----|-------------|--------|
| CLUSTER-01 | Add/remove/rename up to 5 independent clusters via tab bar; each with own config | ✅ Complete |
| CLUSTER-02 | Tag each cluster with role: hub, spoke, or standalone | ✅ Complete |
| CLUSTER-03 | Side-by-side comparison table of all clusters (rows = metrics, columns = clusters, max 5) | ✅ Complete |
| CLUSTER-04 | PPTX, PDF, CSV exports include per-cluster sections and aggregate totals row | ✅ Complete |

### SESSION — Session Portability

| ID | Requirement | Status |
|----|-------------|--------|
| SESSION-01 | Download current sizing session as `.json` file from export toolbar | ✅ Complete |
| SESSION-02 | Load previously saved `.json` session with Zod schema validation | ✅ Complete |

---

## v1.0 Feature Requirements (shipped 2026-04-01)

All v1.0 requirements were delivered. Key capabilities:

- Multi-topology sizing engine for all 7 supported topologies
- Add-on engines: ODF (storage), RHACM (managed clusters)
- Recommendation engine with topology scoring and justification
- 3-step wizard with dark mode support
- BoM table with per-pool NodeSpec rows
- Export: CSV, PPTX, PDF
- Shareable URL (LZ-compressed state)
- i18n: EN, FR, DE, IT

---

## Future Requirements (v2.2+)

| Item | Notes |
|------|-------|
| Air-gapped mirror registry sizing | Bastion host + 100–650 GB image storage |
| ROSA/ARO/OSD managed cloud comparison | Side-by-side cloud vs. on-prem |
| RWX/ODF storage row as dedicated BoM line | Separate storage sizing from compute |
| Red Hat branding on PPTX | Red header band, logo, date/author footer |
| Import preview before session replace | "3 clusters: Hub, Spoke-A, Spoke-B" |
| Session JSON version field | Forward compatibility |
| Cluster template inheritance | Hub settings propagated to spokes |
| Comparison view URL sharing | Share multi-cluster comparison via URL |

---

## Out of Scope

- Subscription/licensing cost calculations — pricing changes too frequently
- Network topology design — focus is on hardware sizing only
- Day-2 operations planning — initial sizing only
- SNO + worker nodes — SNO is by definition single-node (Red Hat unsupported)
- vGPU license type modeling — depends on NVIDIA licensing tier, not statically modelable

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3.5 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind v4 (class-based dark mode) |
| State | Pinia |
| i18n | vue-i18n v11 |
| Validation | Zod |
| PDF export | jsPDF + jspdf-autotable |
| PPTX export | pptxgenjs |
| URL compression | lz-string |
| Tests | Vitest (349 tests at v2.1) |

---

## Architecture Decision Records

| ADR | Decision |
|-----|---------|
| [ADR-0001](adr/0001-post-dispatch-addon-pattern.md) | Post-dispatch add-on pattern for engine extensions |
| [ADR-0002](adr/0002-kubevirt-overhead-formula.md) | KubeVirt overhead formula constants and sources |
| [ADR-0003](adr/0003-sno-virt-fixed-minimums.md) | SNO-with-Virt as fixed-minimum profile |
| [ADR-0004](adr/0004-gpu-node-pool-user-specified.md) | GPU node count is user-specified, not formula-derived |
| [ADR-0005](adr/0005-rhoai-inplace-mutation.md) | RHOAI engine uses in-place NodeSpec mutation |
| [ADR-0006](adr/0006-rhoai-overhead-bom-contract.md) | rhoaiOverhead field as BoM data contract |
