// Add-on calculator functions for os-sizer — zero Vue imports (CALC-01)
// Implements ODF storage, infrastructure nodes, and RHACM hub sizing.
// Source: .planning/research/hardware-sizing.md sections 4, 5.1, 7

import type { NodeSpec } from './types'
import {
  ODF_MIN_CPU_PER_NODE,
  ODF_MIN_RAM_PER_NODE_GB,
  ODF_MIN_NODES,
  ODF_CPU_PER_OSD,
  ODF_RAM_PER_OSD_GB,
} from './constants'
import { infraNodeSizing } from './formulas'

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
