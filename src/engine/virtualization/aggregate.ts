// Aggregate VM demand across size classes — zero Vue imports (CALC-01)
import type { VmClass, VmDemand } from '../types'
import { perVmMemoryOverheadMiB } from '../shared/reservations'

export function aggregateVmDemand(vmClasses: VmClass[]): VmDemand {
  let totalVms = 0
  let totalVcpu = 0
  let totalGuestRamGB = 0
  let totalOverheadMiB = 0
  let totalDiskGB = 0
  for (const c of vmClasses) {
    totalVms += c.count
    totalVcpu += c.count * c.vcpu
    totalGuestRamGB += c.count * c.ramGB
    totalOverheadMiB += c.count * perVmMemoryOverheadMiB(c.vcpu, c.ramGB)
    totalDiskGB += c.count * c.diskGB
  }
  return {
    totalVms,
    totalVcpu,
    totalGuestRamGB,
    totalOverheadRamGB: totalOverheadMiB / 1024,
    totalDiskGB,
  }
}
