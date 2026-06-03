// Per-node VM capacity after reservations — zero Vue imports (CALC-01)
import type { NodeShape, NodeVmCapacity } from '../types'
import { allocatableRamGB, systemReservedCpuCores } from '../shared/reservations'
import { VIRT_OVERHEAD_CPU_PER_NODE, KUBEVIRT_INFRA_RAM_PER_NODE_GB } from '../constants'

export function nodeVmCapacity(nodeShape: NodeShape, cpuOvercommitRatio: number): NodeVmCapacity {
  const threads = nodeShape.physicalCores * nodeShape.threadsPerCore
  const allocThreads = threads - systemReservedCpuCores(threads) - VIRT_OVERHEAD_CPU_PER_NODE
  const vcpuCapacity = allocThreads * cpuOvercommitRatio
  const ramCapacityGB = allocatableRamGB(nodeShape.ramGB) - KUBEVIRT_INFRA_RAM_PER_NODE_GB
  return { allocThreads, vcpuCapacity, ramCapacityGB }
}
