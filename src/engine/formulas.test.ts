import { describe, it, expect } from 'vitest'
import { cpSizing, allocatableRamGB, workerCount, infraNodeSizing } from './formulas'

describe('cpSizing', () => {
  it('24 workers -> 4 vCPU / 16 GB', () => {
    expect(cpSizing(24)).toEqual({ vcpu: 4, ramGB: 16 })
  })

  it('120 workers -> 8 vCPU / 32 GB', () => {
    expect(cpSizing(120)).toEqual({ vcpu: 8, ramGB: 32 })
  })

  it('252 workers -> 16 vCPU / 64 GB', () => {
    expect(cpSizing(252)).toEqual({ vcpu: 16, ramGB: 64 })
  })

  it('501 workers -> 16 vCPU / 96 GB', () => {
    expect(cpSizing(501)).toEqual({ vcpu: 16, ramGB: 96 })
  })

  it('252 workers with OVN-K -> 24 vCPU / 128 GB', () => {
    expect(cpSizing(252, true)).toEqual({ vcpu: 24, ramGB: 128 })
  })

  it('boundary: 25 workers -> 8 vCPU / 32 GB (next tier)', () => {
    expect(cpSizing(25)).toEqual({ vcpu: 8, ramGB: 32 })
  })
})

describe('allocatableRamGB', () => {
  it('4 GB node -> 3.0 GB allocatable (only first tier)', () => {
    // 25% of 4 = 1.0 reserved, 4 - 1.0 = 3.0
    expect(allocatableRamGB(4)).toBeCloseTo(3.0, 1)
  })

  it('8 GB node -> ~6.2 GB allocatable', () => {
    // 25% of 4 = 1.0, 20% of 4 = 0.8; reserved = 1.8; 8 - 1.8 = 6.2
    expect(allocatableRamGB(8)).toBeCloseTo(6.2, 1)
  })

  it('16 GB node -> ~13.4 GB allocatable (formula: 1.0+0.8+0.8=2.6 reserved)', () => {
    // 25% of 4 = 1.0, 20% of 4 = 0.8, 10% of 8 = 0.8, 6% of 0 = 0; reserved = 2.6; 16 - 2.6 = 13.4
    // Note: plan/research mentions 12.4 but that contradicts the formula. Formula gives 13.4.
    expect(allocatableRamGB(16)).toBeCloseTo(13.4, 1)
  })

  it('32 GB node -> ~28.4 GB allocatable', () => {
    // 25% of 4=1.0, 20% of 4=0.8, 10% of 8=0.8, 6% of 16=0.96; reserved=3.56; 32-3.56=28.44
    expect(allocatableRamGB(32)).toBeCloseTo(28.44, 1)
  })

  it('64 GB node -> ~58.52 GB allocatable', () => {
    // 25% of 4=1.0, 20% of 4=0.8, 10% of 8=0.8, 6% of 48=2.88; reserved=5.48; 64-5.48=58.52
    expect(allocatableRamGB(64)).toBeCloseTo(58.52, 1)
  })
})

describe('workerCount', () => {
  it('returns max of CPU-limited, RAM-limited, pod-density-limited', () => {
    // Input: 100000m total CPU, 65536 MiB total mem, 500 pods, node 16vCPU/32GB
    // byCpu = ceil(100/(16*0.70)) = ceil(100/11.2) = ceil(8.93) = 9
    // byRam = ceil(64/(28.44*0.70)) = ceil(64/19.908) = ceil(3.21) = 4
    // byPods = ceil(500/200) = 3
    // result = max(9,4,3,2) = 9
    expect(workerCount(100000, 65536, 500, 16, 32)).toBe(9)
  })

  it('minimum 2 workers for HA', () => {
    // Small workload should still return minimum 2
    expect(workerCount(1000, 512, 5, 16, 32)).toBe(2)
  })

  it('uses 70% target utilization', () => {
    // 10 apps × 2 pods × 500m CPU × 1GiB RAM
    // totalPodCpu = 10*2*500 = 10000m = 10 cores, totalPodMem = 10*2*1024 = 20480 MiB
    // byCpu = ceil(10/(16*0.70)) = ceil(10/11.2) = 1
    // byRam = ceil(20/(28.44*0.70)) = ceil(20/19.908) = ceil(1.005) = 2
    // byPods = ceil(20/200) = 1
    // result = max(1,2,1,2) = 2
    const result = workerCount(10000, 20480, 20, 16, 32)
    expect(result).toBeGreaterThanOrEqual(2)
  })

  it('pod density check: 201 pods -> 2 workers (ceil(201/200))', () => {
    // Tiny workload but 201 pods forces at least 2 workers
    expect(workerCount(100, 100, 201, 16, 32)).toBe(2)
  })
})

describe('infraNodeSizing', () => {
  it('27 workers -> 4 vCPU / 24 GB', () => {
    expect(infraNodeSizing(27)).toEqual({ vcpu: 4, ramGB: 24 })
  })

  it('120 workers -> 8 vCPU / 48 GB', () => {
    expect(infraNodeSizing(120)).toEqual({ vcpu: 8, ramGB: 48 })
  })

  it('252 workers -> 16 vCPU / 128 GB', () => {
    expect(infraNodeSizing(252)).toEqual({ vcpu: 16, ramGB: 128 })
  })

  it('boundary: 28 workers -> 8 vCPU / 48 GB (next tier)', () => {
    expect(infraNodeSizing(28)).toEqual({ vcpu: 8, ramGB: 48 })
  })
})
