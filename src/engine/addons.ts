// Add-on calculator functions for os-sizer — zero Vue imports (CALC-01)
// Implements ODF storage, infrastructure nodes, and RHACM hub sizing.
// Source: .planning/research/hardware-sizing.md sections 4, 5.1, 7

import type { NodeSpec, ClusterSizing } from './types'
import {
  ODF_MIN_CPU_PER_NODE,
  ODF_MIN_RAM_PER_NODE_GB,
  ODF_MIN_NODES,
  ODF_CPU_PER_OSD,
  ODF_RAM_PER_OSD_GB,
  VIRT_OVERHEAD_CPU_PER_NODE,
  VIRT_VM_OVERHEAD_BASE_MIB,
  VIRT_VM_OVERHEAD_PER_VCPU_MIB,
  VIRT_VM_OVERHEAD_GUEST_RAM_RATIO,
  TARGET_UTILIZATION,
  WORKER_MIN,
  GPU_NODE_MIN_VCPU,
  GPU_NODE_MIN_RAM_GB,
  GPU_NODE_MIN_STORAGE_GB,
  RHOAI_WORKER_MIN_VCPU,
  RHOAI_WORKER_MIN_RAM_GB,
  RHOAI_INFRA_OVERHEAD_VCPU,
  RHOAI_INFRA_OVERHEAD_RAM_GB,
} from './constants'
import { infraNodeSizing, allocatableRamGB } from './formulas'

/**
 * ODF (OpenShift Data Foundation) storage node sizing.
 *
 * Base per node: ODF_MIN_CPU_PER_NODE vCPU, ODF_MIN_RAM_PER_NODE_GB RAM.
 * Each extra OSD adds ODF_CPU_PER_OSD vCPU and ODF_RAM_PER_OSD_GB GB RAM.
 * Always returns ODF_MIN_NODES (3) storage nodes.
 * storageGB is 0 — storage capacity comes from the OSDs themselves.
 *
 * @param extraOsdCount - number of extra OSDs beyond the default 1 per node
 * @returns NodeSpec for the ODF storage node pool
 */
export function calcODF(extraOsdCount: number): NodeSpec {
  return {
    count: ODF_MIN_NODES,
    vcpu: ODF_MIN_CPU_PER_NODE + ODF_CPU_PER_OSD * extraOsdCount,
    ramGB: ODF_MIN_RAM_PER_NODE_GB + ODF_RAM_PER_OSD_GB * extraOsdCount,
    storageGB: 0,
  }
}

/**
 * Infrastructure node sizing based on worker count.
 *
 * Delegates to infraNodeSizing() for the vCPU/RAM lookup and always
 * returns 3 infra nodes with 100 GB of local storage each.
 *
 * @param workerCount - number of worker nodes in the cluster
 * @returns NodeSpec for the infra node pool
 */
export function calcInfraNodes(workerCount: number): NodeSpec {
  const sizing = infraNodeSizing(workerCount)
  return {
    count: 3,
    vcpu: sizing.vcpu,
    ramGB: sizing.ramGB,
    storageGB: 100,
  }
}

/**
 * RHACM (Red Hat Advanced Cluster Management) hub node sizing.
 *
 * Two tiers based on managed cluster count:
 *   - Small  (< 100 clusters): 3 × 8 vCPU / 32 GB RAM
 *   - Large (>= 100 clusters): 3 × 16 vCPU / 64 GB RAM
 *
 * @param managedClusters - number of clusters managed by the RHACM hub
 * @returns NodeSpec for the RHACM hub worker nodes
 */
export function calcRHACM(managedClusters: number): NodeSpec {
  const large = managedClusters >= 100
  return {
    count: 3,
    vcpu: large ? 16 : 8,
    ramGB: large ? 64 : 32,
    storageGB: 100,
  }
}

/**
 * OpenShift Virtualization worker pool sizing.
 *
 * Sizes a dedicated virt-enabled worker pool to host the specified VM count.
 * Applies KubeVirt per-node CPU overhead (VIRT_OVERHEAD_CPU_PER_NODE=2 vCPU/node)
 * and per-VM memory overhead formula:
 *   overheadMiB = VIRT_VM_OVERHEAD_BASE_MIB + VIRT_VM_OVERHEAD_PER_VCPU_MIB * avgVmVcpu
 *               + VIRT_VM_OVERHEAD_GUEST_RAM_RATIO * (avgVmRamGB * 1024)
 *
 * Worker count = max(density, RAM, CPU constraints, 3) + 1 live migration reserve.
 * The +1 ensures one node can be drained without losing VM capacity.
 *
 * Per-node CPU overhead is encoded in the returned NodeSpec.vcpu field:
 *   spec.vcpu = nodeVcpu + VIRT_OVERHEAD_CPU_PER_NODE
 *
 * @param vmCount       - total VMs to host across the worker pool
 * @param vmsPerWorker  - target VM density per node (drives density constraint)
 * @param avgVmVcpu     - average vCPUs per VM (for overhead formula)
 * @param avgVmRamGB    - average RAM per VM in GiB (for overhead formula)
 * @param nodeVcpu      - worker node vCPU count (before overhead)
 * @param nodeRamGB     - worker node total RAM in GiB
 * @returns NodeSpec for the virt worker pool
 */
export function calcVirt(
  vmCount: number,
  vmsPerWorker: number,
  avgVmVcpu: number,
  avgVmRamGB: number,
  nodeVcpu: number,
  nodeRamGB: number,
): NodeSpec {
  // Constraint 1: density (target VM packing)
  const workersByDensity = Math.ceil(vmCount / Math.max(vmsPerWorker, 1))

  // Constraint 2: RAM demand with per-VM overhead
  const vmOverheadMiB =
    VIRT_VM_OVERHEAD_BASE_MIB +
    VIRT_VM_OVERHEAD_PER_VCPU_MIB * avgVmVcpu +
    VIRT_VM_OVERHEAD_GUEST_RAM_RATIO * (avgVmRamGB * 1024)
  const totalRamDemandGB = vmCount * (avgVmRamGB + vmOverheadMiB / 1024)
  const workersByRam = Math.ceil(totalRamDemandGB / (allocatableRamGB(nodeRamGB) * TARGET_UTILIZATION))

  // Constraint 3: CPU demand
  const totalVcpuDemand = vmCount * avgVmVcpu
  const workersByCpu = Math.ceil(totalVcpuDemand / (nodeVcpu * TARGET_UTILIZATION))

  // Final: take maximum of all constraints, enforce minimum 3, add 1 for live migration headroom
  const workerCount = Math.max(workersByDensity, workersByRam, workersByCpu, 3) + 1

  return {
    count: workerCount,
    vcpu: nodeVcpu + VIRT_OVERHEAD_CPU_PER_NODE,   // per-node KubeVirt CPU overhead baked in
    ramGB: Math.max(nodeRamGB, WORKER_MIN.ramGB),
    storageGB: WORKER_MIN.storageGB,
  }
}

/**
 * Calculate GPU node pool spec.
 *
 * GPU node count is USER-SPECIFIED (not formula-derived — unlike calcVirt).
 * The function enforces hardware minimums so nodes are never undersized.
 *
 * @param gpuNodeCount  - user-specified number of GPU nodes in the pool
 * @param nodeVcpu      - worker node vCPU count (from WorkloadProfile)
 * @param nodeRamGB     - worker node RAM in GiB (from WorkloadProfile)
 * @param nodeStorageGB - storage per node in GiB
 * @returns NodeSpec for the GPU node pool
 */
export function calcGpuNodes(
  gpuNodeCount: number,
  nodeVcpu: number,
  nodeRamGB: number,
  nodeStorageGB: number,
): NodeSpec {
  return {
    count: Math.max(gpuNodeCount, 1),
    vcpu: Math.max(nodeVcpu, GPU_NODE_MIN_VCPU),
    ramGB: Math.max(nodeRamGB, GPU_NODE_MIN_RAM_GB),
    storageGB: Math.max(nodeStorageGB, GPU_NODE_MIN_STORAGE_GB),
  }
}

/**
 * Apply RHOAI operator constraints to an already-computed ClusterSizing.
 *
 * RHOAI-02: Enforces per-worker minimum (RHOAI_WORKER_MIN_VCPU / RHOAI_WORKER_MIN_RAM_GB).
 *   Uses Math.max to lift nodes below the floor — never lowers them.
 *   No-op when workerNodes is null (SNO, compact-3node, MicroShift have no separate worker pool).
 *
 * RHOAI-03: Adds operator overhead to infra nodes when present (infraNodesEnabled=true).
 *   Overhead covers: RHOAI dashboard, KServe controller, DS Pipelines controller,
 *   Model Registry controller pods pinned to infra nodes via nodeSelector.
 *   No-op when infraNodesEnabled=false or infraNodes is null.
 *
 * @param sizing            - ClusterSizing produced by topology calculator (mutated in-place)
 * @param infraNodesEnabled - whether dedicated infra nodes are in the cluster
 */
export function calcRHOAI(sizing: ClusterSizing, infraNodesEnabled: boolean): void {
  // RHOAI-02: enforce per-worker floor (SNO/compact-3node return workerNodes=null — skip)
  if (sizing.workerNodes) {
    sizing.workerNodes = {
      ...sizing.workerNodes,
      vcpu:  Math.max(sizing.workerNodes.vcpu,  RHOAI_WORKER_MIN_VCPU),
      ramGB: Math.max(sizing.workerNodes.ramGB, RHOAI_WORKER_MIN_RAM_GB),
    }
  }

  // RHOAI-03: add operator overhead addend to infra nodes when infraNodesEnabled=true
  // When infraNodesEnabled=false, RHOAI operator pods land on worker nodes;
  // the worker floor (RHOAI-02) above already ensures adequate capacity.
  if (infraNodesEnabled && sizing.infraNodes) {
    sizing.infraNodes = {
      ...sizing.infraNodes,
      vcpu:  sizing.infraNodes.vcpu  + RHOAI_INFRA_OVERHEAD_VCPU,
      ramGB: sizing.infraNodes.ramGB + RHOAI_INFRA_OVERHEAD_RAM_GB,
    }
  }

  // RHOAI-04: record the overhead addend for BoM display (Phase 12 BomTable contract)
  // Always set when calcRHOAI is called (i.e. rhoaiEnabled=true) — constants represent
  // the addend amounts regardless of whether they landed on infra or worker nodes.
  sizing.rhoaiOverhead = {
    vcpu: RHOAI_INFRA_OVERHEAD_VCPU,
    ramGB: RHOAI_INFRA_OVERHEAD_RAM_GB,
  }
}
