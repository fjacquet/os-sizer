import { describe, it, expect } from 'vitest'
import { calcODF, calcInfraNodes, calcRHACM, calcVirt } from './addons'

describe('calcODF', () => {
  it('0 extra OSD: 3 nodes x 16 vCPU / 64 GB', () => {
    expect(calcODF(0)).toEqual({ count: 3, vcpu: 16, ramGB: 64, storageGB: 0 })
  })

  it('1 extra OSD: 3 nodes x 18 vCPU / 69 GB', () => {
    expect(calcODF(1)).toEqual({ count: 3, vcpu: 18, ramGB: 69, storageGB: 0 })
  })

  it('2 extra OSDs: 3 nodes x 20 vCPU / 74 GB', () => {
    expect(calcODF(2)).toEqual({ count: 3, vcpu: 20, ramGB: 74, storageGB: 0 })
  })
})

describe('calcInfraNodes', () => {
  it('27 workers -> 3 nodes x 4 vCPU / 24 GB', () => {
    expect(calcInfraNodes(27)).toEqual({ count: 3, vcpu: 4, ramGB: 24, storageGB: 100 })
  })

  it('120 workers -> 3 nodes x 8 vCPU / 48 GB', () => {
    expect(calcInfraNodes(120)).toEqual({ count: 3, vcpu: 8, ramGB: 48, storageGB: 100 })
  })
})

describe('calcRHACM', () => {
  it('50 clusters -> 3 x 8 vCPU / 32 GB', () => {
    expect(calcRHACM(50)).toEqual({ count: 3, vcpu: 8, ramGB: 32, storageGB: 100 })
  })

  it('100 clusters -> 3 x 16 vCPU / 64 GB', () => {
    expect(calcRHACM(100)).toEqual({ count: 3, vcpu: 16, ramGB: 64, storageGB: 100 })
  })

  it('500 clusters -> 3 x 16 vCPU / 64 GB', () => {
    expect(calcRHACM(500)).toEqual({ count: 3, vcpu: 16, ramGB: 64, storageGB: 100 })
  })
})

describe('calcVirt', () => {
  it('worker count exceeds raw density minimum (includes live migration reserve)', () => {
    // raw density = ceil(10/10) = 1, but min=3 and +1 reserve → expect >=4
    const result = calcVirt(10, 10, 4, 8, 16, 32)
    expect(result.count).toBeGreaterThan(1)
  })

  it('per-node vCPU includes KubeVirt overhead: nodeVcpu + 2', () => {
    const result = calcVirt(10, 10, 4, 8, 16, 32)
    expect(result.vcpu).toBe(18)   // 16 nodeVcpu + 2 VIRT_OVERHEAD_CPU_PER_NODE
  })

  it('minimum 3 workers + 1 live migration reserve enforced even for 1 VM', () => {
    const result = calcVirt(1, 10, 4, 8, 16, 32)
    expect(result.count).toBeGreaterThanOrEqual(4)
  })

  it('density constraint applied: 100 VMs at 10/worker requires >=10 workers', () => {
    const result = calcVirt(100, 10, 4, 8, 16, 32)
    expect(result.count).toBeGreaterThanOrEqual(10)
  })
})
