import { describe, it, expect } from 'vitest'
import { nodeVmCapacity } from './capacity'
import type { NodeShape } from '../types'

// 64 physical cores, HT on (128 threads), 512 GB RAM.
const NODE: NodeShape = { physicalCores: 64, threadsPerCore: 2, ramGB: 512 }

describe('nodeVmCapacity', () => {
  it('allocThreads = 128 − systemReserved(1.584) − 2 = 124.416', () => {
    expect(nodeVmCapacity(NODE, 10).allocThreads).toBeCloseTo(124.416, 3)
  })

  it('vcpuCapacity = allocThreads × overcommit (10) = 1244.16', () => {
    expect(nodeVmCapacity(NODE, 10).vcpuCapacity).toBeCloseTo(1244.16, 2)
  })

  it('ramCapacityGB = allocatableRamGB(512)=479.64 − 2 = 477.64', () => {
    expect(nodeVmCapacity(NODE, 10).ramCapacityGB).toBeCloseTo(477.64, 2)
  })

  it('overcommit 1 (dedicated) → vcpuCapacity == allocThreads', () => {
    const cap = nodeVmCapacity(NODE, 1)
    expect(cap.vcpuCapacity).toBeCloseTo(cap.allocThreads, 6)
  })
})
