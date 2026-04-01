import { describe, it, expect } from 'vitest'
import { calcODF, calcInfraNodes, calcRHACM, calcVirt, calcGpuNodes, calcRHOAI } from './addons'
import { MIG_PROFILES } from './constants'

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

describe('calcGpuNodes', () => {
  it('node count below 1 is clamped to 1', () => {
    const result = calcGpuNodes(0, 16, 64, 200)
    expect(result.count).toBe(1)
  })

  it('nodeVcpu below GPU_NODE_MIN_VCPU is lifted to 16', () => {
    const result = calcGpuNodes(3, 8, 16, 200)
    expect(result.vcpu).toBe(16)
    expect(result.ramGB).toBe(64)
  })

  it('nodeVcpu and nodeRamGB above minimums are returned as-is', () => {
    const result = calcGpuNodes(3, 32, 128, 200)
    expect(result.vcpu).toBe(32)
    expect(result.ramGB).toBe(128)
  })

  it('returns exact NodeSpec at minimum boundary', () => {
    const result = calcGpuNodes(3, 16, 64, 200)
    expect(result).toEqual({ count: 3, vcpu: 16, ramGB: 64, storageGB: 200 })
  })
})

describe('calcRHOAI', () => {
  const baseWorker = { count: 3, vcpu: 4, ramGB: 8, storageGB: 100 }
  const baseInfra  = { count: 3, vcpu: 4, ramGB: 24, storageGB: 100 }

  it('lifts worker vcpu below floor to RHOAI_WORKER_MIN_VCPU (8)', () => {
    const sizing = { masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, workerNodes: { ...baseWorker }, infraNodes: null, odfNodes: null, rhacmWorkers: null, virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0, totals: { vcpu: 0, ramGB: 0, storageGB: 0 } }
    calcRHOAI(sizing, false)
    expect(sizing.workerNodes!.vcpu).toBe(8)
    expect(sizing.workerNodes!.ramGB).toBe(32)
  })

  it('does not lower worker vcpu already at minimum (8 vCPU / 32 GB)', () => {
    const sizing = { masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, workerNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, infraNodes: null, odfNodes: null, rhacmWorkers: null, virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0, totals: { vcpu: 0, ramGB: 0, storageGB: 0 } }
    calcRHOAI(sizing, false)
    expect(sizing.workerNodes!.vcpu).toBe(8)
    expect(sizing.workerNodes!.ramGB).toBe(32)
  })

  it('does not lower worker vcpu above minimum (32 vCPU / 64 GB)', () => {
    const sizing = { masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, workerNodes: { count: 3, vcpu: 32, ramGB: 64, storageGB: 100 }, infraNodes: null, odfNodes: null, rhacmWorkers: null, virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0, totals: { vcpu: 0, ramGB: 0, storageGB: 0 } }
    calcRHOAI(sizing, false)
    expect(sizing.workerNodes!.vcpu).toBe(32)
    expect(sizing.workerNodes!.ramGB).toBe(64)
  })

  it('is a no-op when workerNodes is null (SNO/compact-3node)', () => {
    const sizing = { masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, workerNodes: null, infraNodes: null, odfNodes: null, rhacmWorkers: null, virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0, totals: { vcpu: 0, ramGB: 0, storageGB: 0 } }
    expect(() => calcRHOAI(sizing, false)).not.toThrow()
    expect(sizing.workerNodes).toBeNull()
  })

  it('adds infra overhead when infraNodesEnabled=true and infraNodes present (4 vcpu + 16 ramGB)', () => {
    const sizing = { masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, workerNodes: { ...baseWorker }, infraNodes: { ...baseInfra }, odfNodes: null, rhacmWorkers: null, virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0, totals: { vcpu: 0, ramGB: 0, storageGB: 0 } }
    calcRHOAI(sizing, true)
    expect(sizing.infraNodes!.vcpu).toBe(8)    // 4 + RHOAI_INFRA_OVERHEAD_VCPU(4)
    expect(sizing.infraNodes!.ramGB).toBe(40)  // 24 + RHOAI_INFRA_OVERHEAD_RAM_GB(16)
  })

  it('skips infra overhead when infraNodesEnabled=false', () => {
    const sizing = { masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, workerNodes: { ...baseWorker }, infraNodes: { ...baseInfra }, odfNodes: null, rhacmWorkers: null, virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0, totals: { vcpu: 0, ramGB: 0, storageGB: 0 } }
    calcRHOAI(sizing, false)
    expect(sizing.infraNodes!.vcpu).toBe(4)    // unchanged
    expect(sizing.infraNodes!.ramGB).toBe(24)  // unchanged
  })

  it('is a no-op for infra when infraNodesEnabled=true but infraNodes is null', () => {
    const sizing = { masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, workerNodes: { ...baseWorker }, infraNodes: null, odfNodes: null, rhacmWorkers: null, virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0, totals: { vcpu: 0, ramGB: 0, storageGB: 0 } }
    expect(() => calcRHOAI(sizing, true)).not.toThrow()
    expect(sizing.infraNodes).toBeNull()
  })

  it('preserves count and storageGB unchanged on worker nodes', () => {
    const sizing = { masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 }, workerNodes: { ...baseWorker }, infraNodes: null, odfNodes: null, rhacmWorkers: null, virtWorkerNodes: null, gpuNodes: null, virtStorageGB: 0, totals: { vcpu: 0, ramGB: 0, storageGB: 0 } }
    calcRHOAI(sizing, false)
    expect(sizing.workerNodes!.count).toBe(3)
    expect(sizing.workerNodes!.storageGB).toBe(100)
  })
})

describe('MIG_PROFILES — A100-40GB lookup', () => {
  it('1g.5gb resolves to 7 instances', () => {
    expect(MIG_PROFILES['A100-40GB']['1g.5gb']).toBe(7)
  })

  it('2g.10gb resolves to 3 instances', () => {
    expect(MIG_PROFILES['A100-40GB']['2g.10gb']).toBe(3)
  })

  it('3g.20gb resolves to 2 instances', () => {
    expect(MIG_PROFILES['A100-40GB']['3g.20gb']).toBe(2)
  })

  it('7g.40gb resolves to 1 instance (whole GPU in MIG mode)', () => {
    expect(MIG_PROFILES['A100-40GB']['7g.40gb']).toBe(1)
  })

  it('H100-80GB has 4 profile entries matching A100-80GB structure', () => {
    expect(Object.keys(MIG_PROFILES['H100-80GB']).length).toBe(4)
  })
})
