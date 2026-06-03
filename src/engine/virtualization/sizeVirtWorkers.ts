// Virt worker pool sizing: count + limiting resource + achieved metrics — zero Vue imports (CALC-01)
import type { VirtConfig, VirtWorkerSizing, LimitingResource } from '../types'
import { aggregateVmDemand } from './aggregate'
import { nodeVmCapacity } from './capacity'
import { MAX_VMS_PER_NODE, MIN_VIRT_WORKERS } from '../constants'

const SPARE_NODES: Record<VirtConfig['redundancy'], number> = { none: 0, 'n+1': 1, 'n+2': 2 }

export function sizeVirtWorkers(config: VirtConfig): VirtWorkerSizing {
  const demand = aggregateVmDemand(config.vmClasses)
  const cap = nodeVmCapacity(config.nodeShape, config.cpuOvercommitRatio)
  const ramDemand = demand.totalGuestRamGB + demand.totalOverheadRamGB

  const byCpu = cap.vcpuCapacity > 0 ? Math.ceil(demand.totalVcpu / cap.vcpuCapacity) : 0
  const byRam = cap.ramCapacityGB > 0 ? Math.ceil(ramDemand / cap.ramCapacityGB) : 0
  const byDensity = Math.ceil(demand.totalVms / MAX_VMS_PER_NODE)

  // Limiting resource = the constraint with the highest node demand (ties: cpu > ram > density).
  let limitingResource: LimitingResource = 'cpu'
  let max = byCpu
  if (byRam > max) {
    max = byRam
    limitingResource = 'ram'
  }
  if (byDensity > max) {
    limitingResource = 'density'
  }

  const baseNodes = Math.max(byCpu, byRam, byDensity, MIN_VIRT_WORKERS)
  const spareNodes = SPARE_NODES[config.redundancy]
  const totalNodes = baseNodes + spareNodes

  const achievedOvercommit =
    baseNodes > 0 && cap.allocThreads > 0 ? demand.totalVcpu / (baseNodes * cap.allocThreads) : 0
  const vmsPerNode = baseNodes > 0 ? demand.totalVms / baseNodes : 0
  const cpuUtilizationPct =
    baseNodes > 0 && cap.vcpuCapacity > 0
      ? (demand.totalVcpu / (baseNodes * cap.vcpuCapacity)) * 100
      : 0
  const ramUtilizationPct =
    baseNodes > 0 && cap.ramCapacityGB > 0 ? (ramDemand / (baseNodes * cap.ramCapacityGB)) * 100 : 0

  return {
    baseNodes,
    spareNodes,
    totalNodes,
    limitingResource,
    achievedOvercommit,
    vmsPerNode,
    cpuUtilizationPct,
    ramUtilizationPct,
  }
}
