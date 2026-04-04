# ADR-0006: rhoaiOverhead Field as BoM Data Contract

**Date:** 2026-04-04
**Status:** Accepted
**Deciders:** Project team

## Context

`BomTable.vue` receives only a `SizingResult` (containing `ClusterSizing`) — it does not receive `ClusterConfig`. Therefore, it cannot read `config.addOns.rhoaiEnabled` to decide whether to show the RHOAI overhead row.

Two options were considered:

1. **Prop drilling**: Pass `rhoaiEnabled` as a separate prop to `BomTable.vue`.
2. **Type extension**: Add `rhoaiOverhead: { vcpu: number; ramGB: number } | null` to `ClusterSizing`, populated by `calcRHOAI()`.

## Decision

**Extend `ClusterSizing`** with:
```typescript
rhoaiOverhead: { vcpu: number; ramGB: number } | null
```

`calcRHOAI()` sets this field alongside its mutations:
```typescript
sizing.rhoaiOverhead = { vcpu: RHOAI_INFRA_OVERHEAD_VCPU, ramGB: RHOAI_INFRA_OVERHEAD_RAM_GB }
```

All topology calculators initialize it as `rhoaiOverhead: null`.

`BomTable.vue` renders the overhead annotation row with a simple null guard:
```html
<tr v-if="props.result.sizing.rhoaiOverhead">
```

## Rationale

- Self-contained data flow: the BoM component reads everything it needs from `ClusterSizing` without knowing about `ClusterConfig`.
- The field is non-optional (not `rhoaiOverhead?:`) to force all topology calculators to explicitly set it, preventing stale `undefined` reads.
- This is consistent with `gpuNodes: NodeSpec | null`, `virtWorkerNodes: NodeSpec | null`, and other nullable pools on `ClusterSizing`.
- Avoids prop drilling through `ResultsPage` → `BomTable` → export composables.

## Consequences

- All 7 topology calculator struct literals required updating to include `rhoaiOverhead: null` — enforced by TypeScript at compile time.
- Export composables also read `sizing.rhoaiOverhead` for the annotation row in CSV/PPTX/PDF.
- The field carries only the addend amount, not the post-mutation worker/infra specs.
