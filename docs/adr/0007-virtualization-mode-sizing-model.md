# ADR-0007: Mode-First VM-Centric Virtualization Sizing

**Date:** 2026-06-03
**Status:** Accepted
**Deciders:** Project team

## Context

os-sizer began as a **container-first** sizer (pods → nodes) with OpenShift Virtualization bolted on
as a secondary add-on (`calcVirt`, a `vmsPerWorker` density knob — see ADR-0002). Customers buying
the **OpenShift Virtualization Engine (OVE)** subscription run VM-only estates and need virtualization
to be the primary sizing path, modelled the way practitioners actually plan VM clusters (CPU
overcommit, right-sizing, N+1), not as a pod add-on.

This decision records the VM-centric sizing model introduced as a first-class mode.

## Decision

A `mode: 'container' | 'virtualization'` field is added to `ClusterConfig` (**optional**, defaulting
to `'container'` — see ADR-0009 backward-compat note below). Virtualization mode carries a discrete
`virt: VirtConfig`:

```ts
type VirtConfig = {
  vmClasses: VmClass[]          // Small/Medium/Large × counts (vcpu, ramGB, diskGB)
  cpuOvercommitRatio: number    // vCPU : thread — default 10, conservative 4, 1 = dedicated
  redundancy: 'none' | 'n+1' | 'n+2'
  nodeShape: { physicalCores; threadsPerCore; ramGB }   // bare-metal worker
  storageBackend: 'odf' | 'external-rwx'
}
```

**Sizing pipeline** (`src/engine/virtualization/`):

1. **Aggregate** demand across VM classes → total vCPU, guest RAM, per-VM overhead RAM, disk, VM count.
2. **Per-node VM capacity**:
   - `allocThreads = physicalCores × threadsPerCore − systemReservedCpu − KubeVirt infra (2 cores)`
   - `vcpuCapacity = allocThreads × cpuOvercommitRatio`  (KubeVirt `vmiCPUAllocationRatio` semantics)
   - `ramCapacityGB = allocatableRamGB(nodeRamGB) − KubeVirt infra RAM`
3. **Worker count** = `max(⌈vCPU/vcpuCap⌉, ⌈ramDemand/ramCap⌉, ⌈vms/MAX_VMS_PER_NODE⌉, MIN_VIRT_WORKERS) + spare`,
   where `spare = {none:0, n+1:1, n+2:2}`. The **limiting resource** and achieved metrics (realised
   overcommit, VMs/node, CPU/RAM utilization) are reported.
4. **Cluster assembly** (`assembleVirtCluster`): 3 control-plane (sized for the worker count) + the
   virt worker pool + optional ODF + storage → `ClusterSizing` (with `virtMetrics`).

CPU overcommit is measured **per CPU thread** (hyperthreading counts), matching KubeVirt's
`vmiCPUAllocationRatio`. Memory overcommit is **not** modelled (off by default per Red Hat best
practice — it requires swap/wasp-agent).

## Confidence

- CPU overcommit per-thread semantics (default 10, conservative 4): **HIGH** — KubeVirt HCO
  `vmiCPUAllocationRatio` API.
- Per-VM memory overhead (`218 + 8·vCPU + 0.2%·guestRAM`): **HIGH** — reuses ADR-0002, re-verified
  against current Red Hat docs (2026-06).
- `system-reserved` CPU (`60m + 12m/thread`, min 500m): **HIGH** — OCP 4.17+ docs.
- N+1 covers full **restart** load (not just live-migration drain): **HIGH** — failure reboots the VM
  on another node; only graceful drains migrate.

## Consequences

- The container path is unchanged; `mode` branches `calcCluster`. Both modes are first-class.
- `vmClasses` (a list) replaces the single-average `vmCount`/`vmsPerWorker` add-on model for the new
  mode; the legacy add-on remains for container-mode clusters.
- Topology is engine-irrelevant in virtualization mode (the cluster is standard-HA bare-metal); the
  wizard auto-confirms topology so the stepper proceeds.

## Source

- KubeVirt HyperConverged `vmiCPUAllocationRatio` (default 10): https://github.com/kubevirt/hyperconverged-cluster-operator
- Red Hat — VM overhead memory + system-reserved: https://docs.redhat.com/en/documentation/openshift_container_platform/4.16/html/virtualization/
- Design spec: `docs/superpowers/specs/2026-06-03-openshift-virtualization-sizer-redesign-design.md`
