// Assemble a full ClusterSizing for virtualization mode — zero Vue imports (CALC-01)
import type { VirtConfig, ClusterSizing, NodeSpec } from '../types'
import { sizeVirtWorkers } from './sizeVirtWorkers'
import { aggregateVmDemand } from './aggregate'
import { virtStorage } from './storage'
import { cpSizing } from '../formulas'
import { calcODF } from '../addons'
import { CP_MIN, WORKER_MIN } from '../constants'

export function assembleVirtCluster(virt: VirtConfig): ClusterSizing {
  const worker = sizeVirtWorkers(virt)
  const demand = aggregateVmDemand(virt.vmClasses)
  const storage = virtStorage(demand.totalDiskGB, virt.storageBackend)

  const threadsPerNode = virt.nodeShape.physicalCores * virt.nodeShape.threadsPerCore
  const virtWorkerNodes: NodeSpec = {
    count: worker.totalNodes,
    vcpu: threadsPerNode,
    ramGB: virt.nodeShape.ramGB,
    storageGB: WORKER_MIN.storageGB,
  }

  const cpSpec = cpSizing(worker.totalNodes)
  const masterNodes: NodeSpec = {
    count: CP_MIN.count,
    vcpu: Math.max(cpSpec.vcpu, CP_MIN.vcpu),
    ramGB: Math.max(cpSpec.ramGB, CP_MIN.ramGB),
    storageGB: CP_MIN.storageGB,
  }

  const odfNodes: NodeSpec | null = virt.storageBackend === 'odf' ? calcODF(0) : null
  const virtStorageGB = Math.round(storage.rawGB)

  const pools: (NodeSpec | null)[] = [masterNodes, virtWorkerNodes, odfNodes]
  const totals = pools.reduce(
    (acc, n) =>
      n
        ? {
            vcpu: acc.vcpu + n.vcpu * n.count,
            ramGB: acc.ramGB + n.ramGB * n.count,
            storageGB: acc.storageGB + n.storageGB * n.count,
          }
        : acc,
    { vcpu: 0, ramGB: 0, storageGB: 0 },
  )
  totals.storageGB += virtStorageGB

  return {
    masterNodes,
    workerNodes: null,
    infraNodes: null,
    odfNodes,
    rhacmWorkers: null,
    virtWorkerNodes,
    gpuNodes: null,
    virtStorageGB,
    virtStorage: { usableGB: storage.usableGB, rawGB: storage.rawGB, backend: storage.backend },
    rhoaiOverhead: null,
    virtMetrics: worker,
    totals,
  }
}
