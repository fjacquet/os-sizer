import { describe, it, expect } from 'vitest'
import { aggregateVmDemand } from './aggregate'
import type { VmClass } from '../types'

const CLASSES: VmClass[] = [
  { id: 's', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 120 },
  { id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 },
  { id: 'l', name: 'Large', vcpu: 8, ramGB: 64, diskGB: 300, count: 15 },
]

describe('aggregateVmDemand', () => {
  it('sums counts, vCPU, RAM, disk across classes', () => {
    const d = aggregateVmDemand(CLASSES)
    expect(d.totalVms).toBe(195)
    expect(d.totalVcpu).toBe(600)
    expect(d.totalGuestRamGB).toBe(2400)
    expect(d.totalDiskGB).toBe(15300)
  })

  it('sums per-VM memory overhead → ~51.001 GB', () => {
    const d = aggregateVmDemand(CLASSES)
    expect(d.totalOverheadRamGB).toBeCloseTo(51.001, 2)
  })

  it('empty list → all zeros', () => {
    expect(aggregateVmDemand([])).toEqual({
      totalVms: 0,
      totalVcpu: 0,
      totalGuestRamGB: 0,
      totalOverheadRamGB: 0,
      totalDiskGB: 0,
    })
  })
})
