# ADR-0005: RHOAI Engine Uses In-Place NodeSpec Mutation

**Date:** 2026-04-01
**Status:** Accepted
**Deciders:** Project team

## Context

RHOAI (Red Hat OpenShift AI) does not create a new node pool. Instead, it imposes two constraints on existing nodes:

1. **Worker floor**: All worker nodes must meet minimum 8 vCPU / 32 GB RAM.
2. **Infra overhead**: RHOAI operator components consume resources on infra nodes.

Two implementation approaches were considered:

1. **New NodeSpec pool**: Add `rhoaiWorkers: NodeSpec | null` to `ClusterSizing`, sized to RHOAI minimums.
2. **In-place mutation**: Modify existing `workerNodes` and `infraNodes` using `Math.max()`.

## Decision

Use **in-place mutation** via object spread:

```typescript
// calcRHOAI() in addons.ts
sizing.workerNodes = {
  ...sizing.workerNodes,
  vcpu:  Math.max(sizing.workerNodes.vcpu,  RHOAI_WORKER_MIN_VCPU),
  ramGB: Math.max(sizing.workerNodes.ramGB, RHOAI_WORKER_MIN_RAM_GB),
}
sizing.infraNodes = {
  ...sizing.infraNodes,
  vcpu:  sizing.infraNodes.vcpu  + RHOAI_INFRA_OVERHEAD_VCPU,
  ramGB: sizing.infraNodes.ramGB + RHOAI_INFRA_OVERHEAD_RAM_GB,
}
```

`rhoaiOverhead: { vcpu: number; ramGB: number } | null` is added to `ClusterSizing` solely to carry the addend value to the BoM layer without re-deriving it.

## Rationale

- RHOAI is an operator add-on, not a separate machine pool. Red Hat docs describe minimum worker specs, not additional worker nodes.
- The "scale up, not supplement" behavior matches user expectations: the cluster sizing result shows what each node must be, not separate RHOAI-dedicated nodes.
- The `Math.max` pattern is idempotent and safe to call multiple times.
- Object spread preserves `count` and `storageGB` unchanged.

## Constants

```typescript
RHOAI_WORKER_MIN_VCPU   = 8   // HIGH confidence — RHOAI 3.x install docs
RHOAI_WORKER_MIN_RAM_GB = 32  // HIGH confidence — RHOAI 3.x install docs
RHOAI_INFRA_OVERHEAD_VCPU   = 4   // MEDIUM — community estimate, no official table
RHOAI_INFRA_OVERHEAD_RAM_GB = 16  // MEDIUM — community estimate, no official table
```

## Consequences

- SNO topology (`workerNodes === null`) is safely handled with a null guard — `calcRHOAI()` is a no-op on SNO.
- When `infraNodesEnabled=false`, only the worker floor is enforced; no infra overhead addend.
- The `2 × RHOAI_WORKER_MIN_VCPU = 16 vCPU` cluster minimum (2 workers required) is verified by unit tests.
- RHOAI infra constants should be re-validated against Red Hat's RHOAI 4.x release notes.
