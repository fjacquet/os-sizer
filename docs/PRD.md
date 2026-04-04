# os-sizer — Product Requirements Document

**Version:** 2.0.0
**Last Updated:** 2026-04-04
**Core Value:** From constraints to proposal-ready hardware BoM in minutes — covering every supported OpenShift topology.

---

## Product Overview

**os-sizer** is a browser-based OpenShift cluster sizing tool that guides users through a 3-step wizard (Environment → Workload → Architecture) and produces a Bill of Materials (BoM) exportable as CSV, PPTX, or PDF. It supports all major OpenShift deployment topologies and optional platform add-ons.

**Target users:** Pre-sales architects, field engineers, and infrastructure leads who need accurate hardware sizing proposals without manual spreadsheet work.

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

## Future Requirements (v2.1+)

| Item | Notes |
|------|-------|
| Multi-cluster sizing | Multiple sites/environments in one session |
| Air-gapped mirror registry sizing | Bastion host + 100–650 GB image storage |
| ROSA/ARO/OSD managed cloud comparison | Side-by-side cloud vs. on-prem |
| Side-by-side topology comparison | Compare two topologies in one view |
| Save/load sessions (localStorage) | Persist and reload wizard state |
| RWX/ODF storage row as dedicated BoM line | Separate storage sizing from compute |

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
| Tests | Vitest (256 tests at v2.0) |

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
