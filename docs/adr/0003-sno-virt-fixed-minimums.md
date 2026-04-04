# ADR-0003: SNO-with-Virt as a Fixed-Minimum Profile, Not a Formula

**Date:** 2026-04-01
**Status:** Accepted
**Deciders:** Project team

## Context

Single Node OpenShift (SNO) is a special topology where one node runs all control plane, infra, and worker roles. When OpenShift Virtualization is enabled on SNO, the node must also host KubeVirt infrastructure and VM workloads, significantly increasing minimum requirements.

Two approaches were considered:

1. **Formula-derived**: Apply `calcVirt()` overhead formula on top of the SNO base profile.
2. **Fixed minimum profile**: Define a separate `SNO_VIRT_MIN` constant with pre-validated hardware minimums.

## Decision

Use a **fixed minimum profile** (`SNO_VIRT_MIN`) rather than deriving from the overhead formula.

```typescript
// src/engine/constants.ts
SNO_VIRT_MIN = { count: 1, vcpu: 14, ramGB: 32, storageGB: 170 }
SNO_VIRT_STORAGE_EXTRA_GB = 50  // second disk for VM PVCs
```

In `calcSNO()`:
```typescript
if (config.addOns.snoVirtMode) return SNO_VIRT_MIN
```

## Rationale

- The 14/32/170 figures come from the v2.0 ROADMAP success criteria, which are derived from Red Hat's stated minimums for SNO-with-Virt.
- The formula approach would require knowing `vmCount` at SNO sizing time, but SNO virt use cases are edge/lab deployments with undefined workload sizes.
- Fixed minimums are easier to reason about, easier to update when Red Hat revises guidance, and less likely to produce undersized results.
- SNO is a single-node topology; `calcVirt()`'s multi-node density math does not apply.

## Consequences

- The 170 GB storage figure assumes: 120 GB root disk + 50 GB second disk for VM PVC storage.
- Live migration is not available on SNO with or without virt (single node cannot migrate to itself).
- `SNO_VIRT_NO_HA` warning is emitted to inform users that HA is unavailable.
- `VIRT_RWX_REQUIRES_ODF` warning is suppressed for SNO (ODF is incompatible with SNO topology).
- `SNO_VIRT_NO_LIVE_MIGRATION` warning is emitted instead when `virtEnabled && topology === 'sno'`.
