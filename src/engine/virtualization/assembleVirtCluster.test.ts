import { describe, it, expect } from 'vitest'
import { assembleVirtCluster } from './assembleVirtCluster'
import type { VirtConfig } from '../types'

const VIRT: VirtConfig = {
  vmClasses: [
    { id: 's', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 120 },
    { id: 'm', name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 60 },
    { id: 'l', name: 'Large', vcpu: 8, ramGB: 64, diskGB: 300, count: 15 },
  ],
  cpuOvercommitRatio: 10,
  redundancy: 'n+1',
  nodeShape: { physicalCores: 64, threadsPerCore: 2, ramGB: 512 },
  storageBackend: 'odf',
  targetUtilization: 1,
}

describe('assembleVirtCluster (ODF)', () => {
  const s = assembleVirtCluster(VIRT)

  it('virt worker pool: 7 nodes (6 + N+1), 128 threads, 512 GB', () => {
    expect(s.virtWorkerNodes).toEqual({ count: 7, vcpu: 128, ramGB: 512, storageGB: 100 })
  })

  it('control plane sized for the worker count', () => {
    expect(s.masterNodes).toEqual({ count: 3, vcpu: 4, ramGB: 16, storageGB: 100 })
  })

  it('ODF storage nodes present; no container worker pool', () => {
    expect(s.odfNodes).toEqual({ count: 3, vcpu: 16, ramGB: 64, storageGB: 0 })
    expect(s.workerNodes).toBeNull()
  })

  it('virtStorageGB = raw ODF capacity 54000', () => {
    expect(s.virtStorageGB).toBe(54000)
  })

  it('totals include node specs + VM disk raw', () => {
    expect(s.totals).toEqual({ vcpu: 956, ramGB: 3824, storageGB: 55000 })
  })

  it('exposes virt metrics (limiting resource + base nodes)', () => {
    expect(s.virtMetrics?.limitingResource).toBe('ram')
    expect(s.virtMetrics?.baseNodes).toBe(6)
    expect(s.virtMetrics?.totalNodes).toBe(7)
  })
})

describe('assembleVirtCluster (external-rwx)', () => {
  it('no ODF nodes; virtStorageGB 0', () => {
    const s = assembleVirtCluster({ ...VIRT, storageBackend: 'external-rwx' })
    expect(s.odfNodes).toBeNull()
    expect(s.virtStorageGB).toBe(0)
    expect(s.totals).toEqual({ vcpu: 908, ramGB: 3632, storageGB: 1000 })
  })
})
