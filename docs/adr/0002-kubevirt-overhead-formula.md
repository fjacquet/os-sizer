# ADR-0002: KubeVirt Overhead Formula for calcVirt()

**Date:** 2026-04-01
**Status:** Accepted
**Deciders:** Project team

## Context

Sizing VM-based workloads on OpenShift Virtualization (KubeVirt) requires accounting for two overhead sources beyond raw VM resource requirements:

1. **Per-VM memory overhead**: Each KubeVirt VM process consumes additional host memory beyond the guest RAM allocation.
2. **Per-node CPU overhead**: The KubeVirt virt-handler DaemonSet and related infrastructure consume vCPU on every worker node.

## Decision

The following constants and formula are used in `calcVirt()`:

```typescript
// src/engine/constants.ts
VIRT_OVERHEAD_CPU_PER_NODE   = 2      // vCPU/node for KubeVirt infrastructure
VIRT_VM_OVERHEAD_BASE_MIB    = 218    // MiB base per VM (libvirt + QEMU)
VIRT_VM_OVERHEAD_PER_VCPU_MIB = 8    // MiB per vCPU of the VM
VIRT_VM_OVERHEAD_GUEST_RAM_RATIO = 0.002  // 0.2% of guest RAM in MiB
```

Per-VM overhead: `overheadMiB = 218 + 8 × vCPUs + 0.002 × guestRAM_MiB`

Worker count derivation uses three independent constraints, taking the maximum:
- **Density constraint**: `ceil(vmCount / vmsPerWorker)`
- **RAM constraint**: `ceil(totalRamDemand / allocatableRamPerNode)`
- **CPU constraint**: `ceil(totalVcpuDemand / (nodeVcpu × TARGET_UTILIZATION))`

Final worker `NodeSpec.vcpu` adds `+VIRT_OVERHEAD_CPU_PER_NODE` to bake in the per-node overhead.

## Confidence

- Per-VM overhead formula: **HIGH** — sourced from Red Hat official documentation (January 2025).
- Per-node CPU overhead (2 vCPU): **HIGH** — confirmed in KubeVirt operator deployment manifests.
- `+1` live migration reserve (included in count): **MEDIUM** — community guidance, not a Red Hat SLA.

## Consequences

- Formula is conservative by design — real overhead may be lower for idle VMs.
- `vmCount` is an explicit `AddOnConfig` field (not derived from `vmsPerWorker × workerNodes`) to avoid circular dependency.
- SNO-with-Virt bypasses this formula and uses fixed minimums (ADR-0003).

## Source

Red Hat OpenShift Virtualization documentation: [Virtual machine overhead memory](https://docs.redhat.com/en/documentation/openshift_container_platform/latest/html/virtualization/virt-getting-started)
