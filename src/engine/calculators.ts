// Topology calculator functions for os-sizer — zero Vue imports (CALC-01)
// Each calculator returns { sizing: ClusterSizing; warnings: ValidationWarning[] }
// Source: .planning/research/hardware-sizing.md

import type { ClusterConfig, ClusterSizing, NodeSpec, ValidationWarning } from './types'
import { calcODF, calcRHACM } from './addons'
import {
  CP_MIN,
  WORKER_MIN,
  SNO_STD_MIN,
  SNO_EDGE_MIN,
  SNO_TELECOM_MIN,
  TNA_CP_MIN,
  TNA_ARBITER_MIN,
  TNF_CP_MIN,
  HCP_CPU_PER_CP_IDLE,
  HCP_RAM_PER_CP_IDLE,
  HCP_CPU_PER_1000_QPS,
  HCP_RAM_PER_1000_QPS,
  MICROSHIFT_SYS_MIN,
} from './constants'
import { cpSizing, workerCount as calcWorkerCount, infraNodeSizing, allocatableRamGB } from './formulas'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sum totals across a list of NodeSpec (or null). Multiplies each spec's per-node
 * figures by its count.
 */
function sumTotals(nodes: Array<NodeSpec | null>): { vcpu: number; ramGB: number; storageGB: number } {
  return nodes.reduce<{ vcpu: number; ramGB: number; storageGB: number }>(
    (acc, n) => {
      if (!n) return acc
      return {
        vcpu: acc.vcpu + n.vcpu * n.count,
        ramGB: acc.ramGB + n.ramGB * n.count,
        storageGB: acc.storageGB + n.storageGB * n.count,
      }
    },
    { vcpu: 0, ramGB: 0, storageGB: 0 },
  )
}

/** Return an empty ClusterSizing scaffold with all optional fields null. */
function emptySizing(masterNodes: NodeSpec): ClusterSizing {
  return {
    masterNodes,
    workerNodes: null,
    infraNodes: null,
    odfNodes: null,
    rhacmWorkers: null,
    totals: sumTotals([masterNodes]),
  }
}

// ---------------------------------------------------------------------------
// 1. Standard HA
// ---------------------------------------------------------------------------

/**
 * Standard HA: 3 control-plane nodes + N workers.
 * CP sizing is determined by the worker count (via CP_SIZING_TABLE lookup).
 * Workers are sized by workload formula, minimum 2 per HA requirement.
 * Infra nodes are added when addOns.infraNodesEnabled is true.
 */
export function calcStandardHA(config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const { workload, addOns } = config

  const wCount = calcWorkerCount(
    workload.totalPods * workload.podCpuMillicores,
    workload.totalPods * workload.podMemMiB,
    workload.totalPods,
    workload.nodeVcpu,
    workload.nodeRamGB,
  )

  const cpSpec = cpSizing(wCount)

  const masterNodes: NodeSpec = {
    count: CP_MIN.count,
    vcpu: Math.max(cpSpec.vcpu, CP_MIN.vcpu),
    ramGB: Math.max(cpSpec.ramGB, CP_MIN.ramGB),
    storageGB: CP_MIN.storageGB,
  }

  const workerNodes: NodeSpec = {
    count: Math.max(wCount, WORKER_MIN.count),
    vcpu: Math.max(workload.nodeVcpu, WORKER_MIN.vcpu),
    ramGB: Math.max(workload.nodeRamGB, WORKER_MIN.ramGB),
    storageGB: WORKER_MIN.storageGB,
  }

  let infraNodes: NodeSpec | null = null
  if (addOns.infraNodesEnabled) {
    const infraSpec = infraNodeSizing(workerNodes.count)
    infraNodes = {
      count: 3,
      vcpu: infraSpec.vcpu,
      ramGB: infraSpec.ramGB,
      storageGB: 100,
    }
  }

  const sizing: ClusterSizing = {
    masterNodes,
    workerNodes,
    infraNodes,
    odfNodes: null,
    rhacmWorkers: null,
    totals: sumTotals([masterNodes, workerNodes, infraNodes]),
  }

  return { sizing, warnings: [] }
}

// ---------------------------------------------------------------------------
// 2. Compact 3-Node
// ---------------------------------------------------------------------------

/**
 * Compact 3-node: masters double as workers — no separate worker pool.
 * Returns CP_MIN as masterNodes with workerNodes null.
 */
export function calcCompact3Node(_config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const masterNodes: NodeSpec = { ...CP_MIN }

  const sizing: ClusterSizing = {
    masterNodes,
    workerNodes: null,
    infraNodes: null,
    odfNodes: null,
    rhacmWorkers: null,
    totals: sumTotals([masterNodes]),
  }

  return { sizing, warnings: [] }
}

// ---------------------------------------------------------------------------
// 3. Single Node OpenShift (SNO)
// ---------------------------------------------------------------------------

/**
 * SNO: single-node topology; profile determines minimum hardware.
 * workerNodes is always null — the one node acts as both CP and worker.
 */
export function calcSNO(config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const profileMap: Record<string, Readonly<NodeSpec>> = {
    'standard': SNO_STD_MIN,
    'edge': SNO_EDGE_MIN,
    'telecom-vdu': SNO_TELECOM_MIN,
  }

  const base = profileMap[config.snoProfile] ?? SNO_STD_MIN
  const masterNodes: NodeSpec = { ...base }

  const sizing: ClusterSizing = emptySizing(masterNodes)

  return { sizing, warnings: [] }
}

// ---------------------------------------------------------------------------
// 4. Two-Node Arbiter (TNA)
// ---------------------------------------------------------------------------

/**
 * TNA: 2 control-plane nodes + 1 arbiter node.
 * The arbiter (TNA_ARBITER_MIN) is represented as a third "master-type" node
 * appended to the totals via an internal arbiterNode field — for sizing purposes
 * we include it in the masterNodes count (count=3) but track the specs separately.
 *
 * Returns a Tech Preview warning.
 */
export function calcTNA(_config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  // Two CP nodes
  const cpNodes: NodeSpec = { ...TNA_CP_MIN }

  // One arbiter node (smaller spec)
  const arbiterNode: NodeSpec = { ...TNA_ARBITER_MIN }

  // For ClusterSizing we express both CP nodes as masterNodes (count=2)
  // and include the arbiter in totals via infraNodes slot (semantically it's
  // a separate role, but the interface has no dedicated arbiter field).
  const sizing: ClusterSizing = {
    masterNodes: cpNodes,
    workerNodes: null,
    infraNodes: arbiterNode,
    odfNodes: null,
    rhacmWorkers: null,
    totals: sumTotals([cpNodes, arbiterNode]),
  }

  const warnings: ValidationWarning[] = [
    {
      code: 'TNA_TECH_PREVIEW',
      severity: 'warning',
      messageKey: 'warnings.tna.techPreview',
    },
  ]

  return { sizing, warnings }
}

// ---------------------------------------------------------------------------
// 5. Two-Node Fencing (TNF)
// ---------------------------------------------------------------------------

/**
 * TNF: 2 control-plane nodes; bare-metal only (Redfish BMC required).
 * Returns both a Tech Preview warning and a Redfish BMC error.
 */
export function calcTNF(_config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const masterNodes: NodeSpec = { ...TNF_CP_MIN }

  const sizing: ClusterSizing = {
    masterNodes,
    workerNodes: null,
    infraNodes: null,
    odfNodes: null,
    rhacmWorkers: null,
    totals: sumTotals([masterNodes]),
  }

  const warnings: ValidationWarning[] = [
    {
      code: 'TNF_TECH_PREVIEW',
      severity: 'warning',
      messageKey: 'warnings.tnf.techPreview',
    },
    {
      code: 'TNF_REDFISH_REQUIRED',
      severity: 'error',
      messageKey: 'warnings.tnf.redfishRequired',
    },
  ]

  return { sizing, warnings }
}

// ---------------------------------------------------------------------------
// 6. Hosted Control Planes (HCP)
// ---------------------------------------------------------------------------

/**
 * HCP: management cluster that hosts N OpenShift control planes.
 * Worker count is derived from total CPU/RAM demand of hosted CPs at the given QPS.
 *
 * Formula (per hosted cluster):
 *   cpuPerCP  = HCP_CPU_PER_CP_IDLE  + (qps/1000) * HCP_CPU_PER_1000_QPS
 *   ramPerCP  = HCP_RAM_PER_CP_IDLE  + (qps/1000) * HCP_RAM_PER_1000_QPS
 *
 * Total demand:
 *   totalCPU = clusters * cpuPerCP
 *   totalRAM = clusters * ramPerCP
 *
 * Workers (16 vCPU / 32 GB each, 70% utilization):
 *   workersByCPU = ceil(totalCPU / (16 * 0.70))
 *   workersByRAM = ceil(totalRAM / (allocatableRamGB(WORKER_RAM_GB) * 0.70))
 *   workers = max(workersByCPU, workersByRAM, 3)
 */
export function calcHCP(config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const { hcpHostedClusters, hcpQpsPerCluster, addOns } = config
  const qpsFactor = hcpQpsPerCluster / 1000

  const cpuPerCP = HCP_CPU_PER_CP_IDLE + qpsFactor * HCP_CPU_PER_1000_QPS
  const ramPerCP = HCP_RAM_PER_CP_IDLE + qpsFactor * HCP_RAM_PER_1000_QPS

  const totalCPU = hcpHostedClusters * cpuPerCP
  const totalRAM = hcpHostedClusters * ramPerCP

  const WORKER_VCPU = 16
  const WORKER_RAM_GB = 32
  const UTIL = 0.70

  const workersByCPU = Math.ceil(totalCPU / (WORKER_VCPU * UTIL))
  const workersByRAM = Math.ceil(totalRAM / (allocatableRamGB(WORKER_RAM_GB) * UTIL))
  const workers = Math.max(workersByCPU, workersByRAM, 3)

  const masterNodes: NodeSpec = { ...CP_MIN }
  const workerNodes: NodeSpec = {
    count: workers,
    vcpu: Math.max(WORKER_VCPU, WORKER_MIN.vcpu),
    ramGB: Math.max(WORKER_RAM_GB, WORKER_MIN.ramGB),
    storageGB: WORKER_MIN.storageGB,
  }

  let infraNodes: NodeSpec | null = null
  if (addOns.infraNodesEnabled) {
    const infraSpec = infraNodeSizing(workerNodes.count)
    infraNodes = {
      count: 3,
      vcpu: infraSpec.vcpu,
      ramGB: infraSpec.ramGB,
      storageGB: 100,
    }
  }

  const sizing: ClusterSizing = {
    masterNodes,
    workerNodes,
    infraNodes,
    odfNodes: null,
    rhacmWorkers: null,
    totals: sumTotals([masterNodes, workerNodes, infraNodes]),
  }

  return { sizing, warnings: [] }
}

// ---------------------------------------------------------------------------
// 7. MicroShift
// ---------------------------------------------------------------------------

/**
 * MicroShift: single-node edge/IoT deployment.
 * Sizing is the maximum of MICROSHIFT_SYS_MIN and workload-derived overhead.
 *
 *   vcpu   = max(2, ceil(pods * podCPUm / 1000 / 0.70) + 2)
 *   ramGB  = max(2, ceil(pods * podMemMiB / 1024 / 0.70) + 2)   -- +2 GB system overhead
 *   storage = max(10, 100)  → always 100 GB practical minimum
 */
export function calcMicroShift(config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const { workload } = config

  const computedVcpu = Math.ceil(
    (workload.totalPods * workload.podCpuMillicores) / 1000 / 0.70
  ) + 2

  const computedRamGB = Math.ceil(
    (workload.totalPods * workload.podMemMiB) / 1024 / 0.70
  ) + 2

  const masterNodes: NodeSpec = {
    count: 1,
    vcpu: Math.max(MICROSHIFT_SYS_MIN.vcpu, computedVcpu),
    ramGB: Math.max(MICROSHIFT_SYS_MIN.ramGB, computedRamGB),
    storageGB: Math.max(MICROSHIFT_SYS_MIN.storageGB, 100),
  }

  const sizing: ClusterSizing = emptySizing(masterNodes)

  return { sizing, warnings: [] }
}

// ---------------------------------------------------------------------------
// 8. Managed Cloud (ROSA / ARO — informational only)
// ---------------------------------------------------------------------------

/**
 * Managed cloud topologies (ROSA, ARO) are provisioned by the cloud provider.
 * No on-premises hardware is required; returns zero-count NodeSpecs.
 */
export function calcManagedCloud(_config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  const zero: NodeSpec = { count: 0, vcpu: 0, ramGB: 0, storageGB: 0 }

  const sizing: ClusterSizing = {
    masterNodes: zero,
    workerNodes: null,
    infraNodes: null,
    odfNodes: null,
    rhacmWorkers: null,
    totals: { vcpu: 0, ramGB: 0, storageGB: 0 },
  }

  const warnings: ValidationWarning[] = [
    {
      code: 'MANAGED_CLOUD_NO_HARDWARE',
      severity: 'warning',
      messageKey: 'warnings.managedCloud.noHardware',
    },
  ]

  return { sizing, warnings }
}

// ---------------------------------------------------------------------------
// 9. Dispatcher — calcCluster
// ---------------------------------------------------------------------------

/**
 * Route a ClusterConfig to the appropriate topology calculator.
 * After dispatch, apply post-dispatch add-on augmentation (ENG-07, ENG-08):
 * - odfEnabled: populate odfNodes via calcODF()
 * - rhacmEnabled: populate rhacmWorkers via calcRHACM()
 * - Recalculate totals to include any add-on nodes
 */
export function calcCluster(config: ClusterConfig): { sizing: ClusterSizing; warnings: ValidationWarning[] } {
  let result: { sizing: ClusterSizing; warnings: ValidationWarning[] }
  switch (config.topology) {
    case 'standard-ha':      result = calcStandardHA(config); break
    case 'compact-3node':    result = calcCompact3Node(config); break
    case 'sno':              result = calcSNO(config); break
    case 'two-node-arbiter': result = calcTNA(config); break
    case 'two-node-fencing': result = calcTNF(config); break
    case 'hcp':              result = calcHCP(config); break
    case 'microshift':       result = calcMicroShift(config); break
    case 'managed-cloud':    result = calcManagedCloud(config); break
  }

  // Post-dispatch add-on augmentation (ENG-07, ENG-08)
  const { sizing } = result
  if (config.addOns.odfEnabled) {
    sizing.odfNodes = calcODF(config.addOns.odfExtraOsdCount)
  }
  if (config.addOns.rhacmEnabled) {
    sizing.rhacmWorkers = calcRHACM(config.addOns.rhacmManagedClusters)
  }

  // Recalculate totals to include add-on nodes
  if (config.addOns.odfEnabled || config.addOns.rhacmEnabled) {
    sizing.totals = sumTotals([
      sizing.masterNodes,
      sizing.workerNodes,
      sizing.infraNodes,
      sizing.odfNodes,
      sizing.rhacmWorkers,
    ])
  }

  return result
}
