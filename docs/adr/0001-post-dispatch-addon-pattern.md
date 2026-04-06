# ADR-0001: Post-Dispatch Add-On Pattern for Engine Extensions

**Date:** 2026-03-31
**Status:** Accepted
**Deciders:** Project team

## Context

The sizing engine dispatches to one of seven topology calculators (`calcStandardHA`, `calcSNO`, `calcHCP`, etc.) based on `config.topology`. Several optional platform components (ODF, RHACM, OpenShift Virtualization, GPU nodes, RHOAI) need to augment the base sizing result with additional node pools or mutate existing node specs.

Two design options were evaluated:

1. **Topology-integrated**: Each topology calculator handles add-on logic internally.
2. **Post-dispatch add-on functions**: A second pass of pure functions runs after topology dispatch and mutates or augments the `ClusterSizing` result.

## Decision

Use the **post-dispatch add-on pattern**. After the topology dispatcher returns a `ClusterSizing`, the following sequence runs:

```typescript
// In calcCluster()
sizing = dispatcher(config)           // topology result
calcODF(sizing, config)               // ODF add-on
calcRHACM(sizing, config)             // RHACM add-on
calcVirt(sizing, config)              // Virt add-on (v2.0)
sizing.gpuNodes = calcGpuNodes(...)   // GPU pool (v2.0)
calcRHOAI(sizing, config)             // RHOAI add-on (v2.0)
sizing.totals = sumTotals(sizing)     // aggregate
```

Each add-on function is a pure function in `src/engine/addons.ts` with signature `(sizing: ClusterSizing, ...) => void | NodeSpec`.

## Consequences

**Positive:**
- New add-ons require no changes to existing topology calculators.
- Add-on functions are independently unit-testable.
- The pattern scales linearly — adding Phase 10 GPU engine did not touch Phase 9 virt code.
- `addons.ts` is the single authoritative source for all post-dispatch logic.

**Negative:**
- `calcRHOAI()` mutates existing `NodeSpec` objects in-place (Math.max pattern) rather than returning new objects — requires discipline to avoid aliasing bugs.
- `sumTotals()` must be called after all add-ons complete; callers must not cache intermediate totals.

## Alternatives Rejected

- Topology-integrated add-ons: Rejected because 7 topology calculators × 5 add-ons = 35 interaction points to maintain.
- Middleware chain (pipeline): Overkill for a fixed, ordered set of add-ons with no dynamic registration requirement.
