# ADR-0008: OVE Assumptions, Storage Planning, and the Executive Navy Deck

**Date:** 2026-06-03
**Status:** Accepted
**Deciders:** Project team

## Context

The virtualization mode (ADR-0007) targets the **OpenShift Virtualization Engine (OVE)**
subscription, which has sizing-relevant constraints distinct from full OpenShift. This ADR records
the OVE assumptions baked into the sizer, the storage-planning approximation, the practical density
cap, and the decision to retire Red Hat red from the presentation exports.

## Decision

### OVE licensing assumptions (surfaced, not enforced)

- OVE is **bare-metal**, licensed **per socket-pair, up to 128 cores/pair**, VM-only. The recommended
  node shape therefore favours **dense dual-socket bare-metal** nodes (the wizard default is 64
  physical cores / 512 GB, HT on). Minimum 8 cores/worker.
- **ODF is NOT included in OVE.** When `storageBackend === 'odf'`, the sizer emits a
  `VIRT_ODF_NOT_IN_OVE` warning ("license and size separately"). Containers, ODF, ACS, and guest OS
  licenses require separate subscriptions.

### Storage planning approximation

- Live migration requires **RWX** storage. `storageBackend` is `'odf'` (sized here) or
  `'external-rwx'` (provider-managed; raw capacity reported as 0).
- For ODF, raw capacity is planned as **`raw ≈ usableDisk × 3 / 0.85`** — replica-3 (3× usable) with a
  Ceph fullness headroom target of ~85%. This is a **planning estimate**, not an ODF sizing tool; the
  replica-3 assumption is stated in the output.

### Density cap

- `MAX_VMS_PER_NODE = 250` is a **practical default**, not a Red Hat-published number. In practice CPU
  or RAM binds first; density is a guard. If it ever binds, revisit the constant.

### Executive Navy deck (red retired)

- The PPTX/PDF exports drop the heavy Red Hat red (`EE0000`) in favour of an **Executive Navy**
  palette (`1E2761` navy + `F9B935` gold accent + slate), shared with the sibling **vatlas** tool for
  one house style. PPTX colours are centralized in `src/composables/pptx/theme.ts`; the PDF uses navy
  RGB `30,39,97`. Fonts unchanged (Arial prose, Consolas metrics).

## Confidence

- OVE bare-metal / per-socket-pair / 128-core / ODF-excluded: **HIGH** — Red Hat OVE product page
  (2025–2026).
- ODF replica-3 → usable ≈ raw/3, keep < ~85% full: **HIGH** — Red Hat ODF planning docs.
- `MAX_VMS_PER_NODE = 250`: **LOW** — chosen default; no authoritative source.

## Consequences

- The sizer is honest about OVE boundaries (ODF/containers cost extra) without blocking the user.
- The storage figure is a budgeting approximation; precise ODF sizing remains a separate exercise.
- Brand identity shifts from Red Hat red to a calmer executive look consistent with vatlas.

## Source

- OpenShift Virtualization Engine: https://www.redhat.com/en/technologies/cloud-computing/openshift/virtualization-engine
- ODF planning: https://docs.redhat.com/en/documentation/red_hat_openshift_data_foundation/
- Design spec: `docs/superpowers/specs/2026-06-03-openshift-virtualization-sizer-redesign-design.md`
