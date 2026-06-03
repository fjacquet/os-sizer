# Milestone Summary — OpenShift Virtualization (OVE) Sizing Mode

**Date:** 2026-06-03
**Branch:** `design/ocp-virt-sizer-redesign`
**Spec:** `docs/superpowers/specs/2026-06-03-openshift-virtualization-sizer-redesign-design.md`
**Status:** Phases 1–5 complete; not yet merged.

## Goal

Make virtualization a first-class sizing path (for customers on the OpenShift Virtualization Engine
SKU, which excludes container entitlement), using a VM-centric methodology grounded in Red Hat best
practice, and rework the PowerPoint into a calmer Executive Navy look.

## Outcome vs. spec

| Spec area | Delivered | Phase |
|-----------|-----------|-------|
| Mode-first framing (container vs virtualization) | ✅ `ClusterConfig.mode` + Step 1 selector | 2, 3 |
| VM-centric engine (overcommit, reservations, N+1, limiting resource, metrics) | ✅ `engine/virtualization/*` + `engine/shared/reservations` | 1 |
| VM size classes + bare-metal node shape inputs | ✅ `VmClassesTable` + `VirtWorkloadSection` | 3 |
| CPU overcommit + N+1/N+2 selectors | ✅ Step 2 | 3 |
| Storage backend (ODF replica-3 / external RWX) | ✅ engine + Step 3 | 1, 3 |
| Backward-compatible sessions/URLs | ✅ optional `mode`/`virt`, default container | 2 |
| Executive Navy deck (red retired) + per-VM-class breakdown | ✅ PPTX + PDF navy, VM-class slide/CSV | 4 |
| i18n in all four locales | ✅ en/fr/de/it | 2, 3 |
| ADRs / PRD / changelog | ✅ ADR-0007, ADR-0008, PRD §Sizing Modes, CHANGELOG | 5 |

**Deliberately deferred** (lower value, noted in plans): single-average→size-classes was upgraded to
classes; `pptx/slides/` file-structure reorg and a dedicated title/assumptions cover slide were not
done (the per-cluster slide carries KPIs + BoM).

## Phase log

1. **Engine foundation** — types, constants, shared reservations + per-VM overhead, aggregate /
   capacity / worker-sizing / storage (8 commits). Non-breaking.
2. **Store & plumbing** — `mode`/`virt` on `ClusterConfig`, `createDefaultVirtConfig`,
   `assembleVirtCluster`, `calcCluster` branch, validation, versioned session/URL schema, i18n (8).
3. **Wizard UI** — mode selector, VM-class table, node shape, overcommit/redundancy, storage choice,
   results metrics card; container path wrapped untouched (8).
4. **Exports** — Executive Navy palette (PPTX + PDF), VM-class breakdown slide + metrics, CSV section (4).
5. **Docs** — ADR-0007, ADR-0008, PRD, CHANGELOG, this summary (this phase).

## Verification (final)

- **Tests:** 396 passing (started at 352; +44 across phases).
- **Type-check:** strict `vue-tsc -b` exit 0 (`ES2022` + `noUncheckedIndexedAccess`).
- **Format:** Biome (`.ts`) + Prettier (`.vue`) clean.
- **Lint:** ESLint 0 errors (`.git/hooks/pre-commit` gate passing on every commit).
- **Build:** `npm run build` succeeds.
- 37 commits since `v2.1.2`, each atomic and individually verified.

## Best-practice grounding

CPU overcommit per-thread (KubeVirt `vmiCPUAllocationRatio`, default 10 / conservative 4); per-VM
overhead `218 + 8·vCPU + 0.2%·guestRAM`; OCP `system-reserved` (`60m + 12m/thread`, min 500m) +
~2 cores/node KubeVirt infra; N+1 covers full restart load; ODF replica-3 with ~85% fullness; OVE
bare-metal / per-socket-pair / ODF-excluded. Full citations in the spec and ADRs.

## Known follow-ups

- **Manual UX pass / Playwright smoke test** of the virtualization wizard path (engine + bindings
  are tested; a live click-through was not run).
- `MAX_VMS_PER_NODE = 250` is a chosen default (LOW confidence) — revisit if density ever binds.
- Optional polish: `pptx/slides/` reorg, dedicated title/assumptions cover slide, memory-overcommit
  knob (currently off by design).

## To ship

Branch is non-breaking and self-contained. Suggested release: **v2.2.0** (the CHANGELOG carries an
`[Unreleased]` section ready to date on merge). Open a PR from `design/ocp-virt-sizer-redesign`.
