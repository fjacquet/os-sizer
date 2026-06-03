// Barrel re-exports for public engine API — zero Vue imports (CALC-01)
export * from './types'
export * from './constants'
export { createDefaultClusterConfig } from './defaults'
export { cpSizing, allocatableRamGB, workerCount, infraNodeSizing } from './formulas'
export {
  calcCluster,
  calcStandardHA,
  calcCompact3Node,
  calcSNO,
  calcTNA,
  calcTNF,
  calcHCP,
  calcMicroShift,
  calcManagedCloud,
} from './calculators'
export { calcODF, calcInfraNodes, calcRHACM } from './addons'
export { recommend } from './recommendation'
export { validateInputs } from './validation'
// Virtualization mode (Phase 1)
export { perVmMemoryOverheadMiB, systemReservedCpuCores } from './shared/reservations'
export { aggregateVmDemand } from './virtualization/aggregate'
export { nodeVmCapacity } from './virtualization/capacity'
export { sizeVirtWorkers } from './virtualization/sizeVirtWorkers'
export { virtStorage } from './virtualization/storage'
export type { VirtStorage } from './virtualization/storage'
