# ADR-0004: GPU Node Count is User-Specified, Not Formula-Derived

**Date:** 2026-04-01
**Status:** Accepted
**Deciders:** Project team

## Context

GPU node sizing differs fundamentally from worker node sizing. Worker counts are formula-derived from workload parameters (pod count, CPU/RAM requirements). GPU node counts depend on the number and type of AI/ML workloads, which are not expressible as simple resource requests without knowing the specific inference or training jobs.

## Decision

`calcGpuNodes()` accepts a user-specified `gpuNodeCount` and enforces hardware minimums, rather than deriving the count from workload parameters.

```typescript
// User specifies gpuNodeCount via wizard
// calcGpuNodes() only enforces floor values:
count:     Math.max(gpuNodeCount, 1)
vcpu:      Math.max(gpuPerNode * 4, GPU_NODE_MIN_VCPU)   // 16 vCPU min
ramGB:     Math.max(gpuPerNode * 16, GPU_NODE_MIN_RAM_GB)  // 64 GB min
storageGB: GPU_NODE_MIN_STORAGE_GB                         // 200 GB
```

## Rationale

- No authoritative Red Hat formula exists for GPU node count from AI workload parameters.
- GPU node count is operationally determined (how many parallel inference workers / training jobs).
- The user is expected to have a workload estimate; the tool's role is to enforce minimum viable hardware specs.
- This is consistent with RHACM managed cluster count, which is also user-specified.

## Consequences

- `GPU_NODE_MIN_VCPU=16` and `GPU_NODE_MIN_RAM_GB=64` are **LOW confidence** community estimates for bare-metal A100/H100 nodes. These should be re-validated against Red Hat's GPU node sizing guide when published.
- The `gpuPerNode` input lets users specify GPUs per node; the min formula scales with GPU count.
- `gpuNodes` is a distinct `NodeSpec` on `ClusterSizing`, separate from `workerNodes`, to ensure export layers can render it as a dedicated BoM row.

## GPU Mode Constraints

| Mode | Constraint |
|------|-----------|
| container | Whole GPU per pod. No special constraints. |
| passthrough (PCIe vfio) | Permanently blocks live VM migration on the node. `WARN-01` emitted. |
| vGPU | Shared GPU across VMs. Requires NVIDIA vGPU license. Density table shown as reference. |
| MIG + KubeVirt | Unsupported by standard NVIDIA GPU Operator. `WARN-03` emitted. |
