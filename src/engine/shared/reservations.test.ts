import { describe, it, expect } from 'vitest'
import { perVmMemoryOverheadMiB, systemReservedCpuCores } from './reservations'

describe('perVmMemoryOverheadMiB', () => {
  // 218 + 8·vcpu + 0.002·(ramGB·1024)
  it('2 vCPU / 4 GB → 242.192 MiB', () => {
    expect(perVmMemoryOverheadMiB(2, 4)).toBeCloseTo(242.192, 3)
  })

  it('8 vCPU / 64 GB → 413.072 MiB', () => {
    expect(perVmMemoryOverheadMiB(8, 64)).toBeCloseTo(413.072, 3)
  })
})

describe('systemReservedCpuCores', () => {
  it('128 threads → 1.584 cores', () => {
    expect(systemReservedCpuCores(128)).toBeCloseTo(1.584, 3)
  })

  it('16 threads → 0.5 cores (floor applies)', () => {
    expect(systemReservedCpuCores(16)).toBeCloseTo(0.5, 6)
  })
})
