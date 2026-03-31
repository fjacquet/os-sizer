# os-sizer

## What This Is

A web-based OpenShift sizing and architecture recommendation tool for pre-sales architects and engineers. Users describe their constraints (workload, HA requirements, environment) and the tool guides them to the right OpenShift deployment topology, then calculates precise hardware requirements and produces exportable BoM reports.

## Core Value

From constraints to proposal-ready hardware BoM in minutes — covering every supported OpenShift topology.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

**Architecture Coverage:**

- [ ] Standard HA cluster (3 masters + N workers + optional infra nodes)
- [ ] Compact 3-node cluster (masters double as workers)
- [ ] Single Node OpenShift (SNO) — edge profiles including telecom/vDU
- [ ] Two-Node with Arbiter (TNA)
- [ ] Two-Node with Fencing (TNF) — bare-metal only
- [ ] Hosted Control Planes (HCP) — decoupled control plane
- [ ] MicroShift / Red Hat Device Edge — far edge, IoT
- [ ] Managed cloud (ROSA, ARO) — informational sizing

**Sizing Engine:**

- [ ] Workload profile inputs (apps, pods, CPU/RAM per workload)
- [ ] HA/resilience inputs (node failure tolerance, site failure tolerance)
- [ ] Environment constraints (edge, air-gapped, datacenter, cloud)
- [ ] Optional add-ons: ODF storage, infra nodes, GPU nodes, RHACM
- [ ] Infrastructure node sizing (logging, monitoring, registry, ingress) — separate from workers
- [ ] Control plane node sizing per topology
- [ ] Worker node sizing based on workload profile

**UI / UX:**

- [ ] Guided wizard: constraints → architecture recommendation → hardware sizing
- [ ] On-screen Bill of Materials summary
- [ ] Shareable compressed URL (all inputs encoded)

**Exports:**

- [ ] PowerPoint (PPTX) export via pptxgenjs
- [ ] PDF export
- [ ] CSV export

**Internationalization:**

- [ ] English (EN)
- [ ] French (FR)
- [ ] Italian (IT)
- [ ] German (DE)

### Out of Scope

- Subscription/licensing cost calculations — pricing changes too frequently, maintain separately
- Network topology design — out of scope for hardware sizer
- Day-2 operations planning — focus is on initial sizing

## Context

- Inspired by and structurally modeled on the `vcf-sizer` project (VMware Cloud Foundation sizer)
- vcf-sizer uses Vue 3 + TypeScript + Vite + Tailwind v4 + Pinia + vue-i18n + pptxgenjs
- Architecture source document: `docs/Architectures de déploiement OpenShift supportées.md` — comprehensive French-language research covering all OpenShift deployment topologies with hardware specs
- Target audience: pre-sales architects creating customer proposals and BoM documents
- Red Hat publishes official minimum hardware specs per topology; sizer must align with these

## Constraints

- **Tech stack**: Vue 3 + TypeScript + Vite + Tailwind v4 + Pinia + vue-i18n — match vcf-sizer for maintainability
- **Accuracy**: Sizing must align with Red Hat official hardware specifications (not estimates)
- **Languages**: FR, EN, IT, DE from day one — all UI strings via vue-i18n
- **Exports**: PPTX via pptxgenjs (same library as vcf-sizer), PDF, CSV

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mirror vcf-sizer tech stack | Same maintainer, consistency, proven patterns | — Pending |
| All architectures in v1 | Full coverage matches the architecture doc scope | — Pending |
| Infra nodes sized separately | Key for licensing optimization (infra nodes don't consume app subscriptions) | — Pending |
| 4 languages from day one | Primary markets: FR, EN, IT, DE | — Pending |

---
*Last updated: 2026-03-31 after project initialization*
