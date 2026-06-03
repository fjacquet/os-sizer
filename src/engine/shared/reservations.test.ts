import { describe, it, expect } from 'vitest'
import {
  perVmMemoryOverheadMiB,
  systemReservedCpuCores,
  resolveTargetUtilization,
} from './reservations'

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

describe('resolveTargetUtilization', () => {
  it('falls back to 0.8 when undefined', () => {
    expect(resolveTargetUtilization(undefined)).toBe(0.8)
  })
  it('passes through an in-range value', () => {
    expect(resolveTargetUtilization(0.7)).toBe(0.7)
  })
  it('clamps below 0.5 up to 0.5', () => {
    expect(resolveTargetUtilization(0.3)).toBe(0.5)
  })
  it('clamps above 1.0 down to 1.0', () => {
    expect(resolveTargetUtilization(1.5)).toBe(1.0)
  })
  it('allows exactly 1.0 (full pack)', () => {
    expect(resolveTargetUtilization(1)).toBe(1)
  })
  it('treats NaN/0 as fallback', () => {
    expect(resolveTargetUtilization(0)).toBe(0.8)
    expect(resolveTargetUtilization(Number.NaN)).toBe(0.8)
  })
})
