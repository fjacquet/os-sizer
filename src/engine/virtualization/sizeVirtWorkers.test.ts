import { describe, it, expect } from 'vitest'
import { sizeVirtWorkers } from './sizeVirtWorkers'
import type { VirtConfig, VmClass } from '../types'

const CLASSES: VmClass[] = [
  { id: 's', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 120 },
  { id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 },
  { id: 'l', name: 'Large', vcpu: 8, ramGB: 64, diskGB: 300, count: 15 },
]

function cfg(over: Partial<VirtConfig> = {}): VirtConfig {
  return {
    vmClasses: CLASSES,
    cpuOvercommitRatio: 10,
    redundancy: 'n+1',
    nodeShape: { physicalCores: 64, threadsPerCore: 2, ramGB: 512 },
    storageBackend: 'odf',
    targetUtilization: 1,
    ...over,
  }
}

describe('sizeVirtWorkers — RAM-bound baseline (3-class example)', () => {
  it('6 base nodes + 1 spare = 7, limited by RAM', () => {
    const r = sizeVirtWorkers(cfg())
    expect(r.baseNodes).toBe(6)
    expect(r.spareNodes).toBe(1)
    expect(r.totalNodes).toBe(7)
    expect(r.limitingResource).toBe('ram')
  })

  it('achieved metrics', () => {
    const r = sizeVirtWorkers(cfg())
    expect(r.vmsPerNode).toBeCloseTo(32.5, 2) // 195 / 6
    expect(r.achievedOvercommit).toBeCloseTo(0.804, 2) // 600 / (6 × 124.416)
    expect(r.ramUtilizationPct).toBeCloseTo(85.5, 1)
  })

  it('redundancy none → no spare; n+2 → 2 spares', () => {
    expect(sizeVirtWorkers(cfg({ redundancy: 'none' })).totalNodes).toBe(6)
    expect(sizeVirtWorkers(cfg({ redundancy: 'n+2' })).totalNodes).toBe(8)
  })
})

describe('sizeVirtWorkers — CPU-bound (dedicated, high-vCPU class)', () => {
  it('28 base nodes, limited by CPU', () => {
    const r = sizeVirtWorkers({
      vmClasses: [{ id: 'c', name: 'CPU', vcpu: 8, ramGB: 1, diskGB: 10, count: 100 }],
      cpuOvercommitRatio: 1,
      redundancy: 'none',
      nodeShape: { physicalCores: 16, threadsPerCore: 2, ramGB: 256 },
      storageBackend: 'external-rwx',
      targetUtilization: 1,
    })
    expect(r.baseNodes).toBe(28)
    expect(r.limitingResource).toBe('cpu')
  })
})

describe('sizeVirtWorkers — density-bound (many tiny VMs)', () => {
  it('3 base nodes, limited by density', () => {
    const r = sizeVirtWorkers({
      vmClasses: [{ id: 't', name: 'Tiny', vcpu: 1, ramGB: 1, diskGB: 10, count: 600 }],
      cpuOvercommitRatio: 10,
      redundancy: 'none',
      nodeShape: { physicalCores: 64, threadsPerCore: 2, ramGB: 512 },
      storageBackend: 'odf',
      targetUtilization: 1,
    })
    expect(r.baseNodes).toBe(3) // ceil(600/250)
    expect(r.limitingResource).toBe('density')
  })
})

describe('sizeVirtWorkers — target utilization headroom', () => {
  it('default 0.8 needs more nodes than full pack and lowers RAM utilization', () => {
    const full = sizeVirtWorkers(cfg({ targetUtilization: 1 }))
    const headroom = sizeVirtWorkers(cfg({ targetUtilization: 0.8 }))
    expect(headroom.baseNodes).toBeGreaterThan(full.baseNodes)
    expect(headroom.ramUtilizationPct).toBeLessThan(full.ramUtilizationPct)
    expect(headroom.ramUtilizationPct).toBeLessThan(80)
    expect(headroom.limitingResource).toBe('ram')
  })

  it('3-class baseline at 0.8 → 7 base nodes (+1 spare = 8)', () => {
    const r = sizeVirtWorkers(cfg({ targetUtilization: 0.8 }))
    expect(r.baseNodes).toBe(7)
    expect(r.totalNodes).toBe(8)
  })

  it('undefined targetUtilization falls back to the 0.8 default', () => {
    const explicit = sizeVirtWorkers(cfg({ targetUtilization: 0.8 }))
    const fallback = sizeVirtWorkers(cfg({ targetUtilization: undefined }))
    expect(fallback.baseNodes).toBe(explicit.baseNodes)
  })
})
