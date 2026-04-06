import { describe, it, expect } from 'vitest'
import {
  buildChartRows,
  buildVcpuData,
  buildRamData,
  buildStorageData,
  buildNodeCountData,
} from '../useChartData'
import type { ClusterSizing } from '@/engine/types'

const fixture: ClusterSizing = {
  masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 120 },
  workerNodes: { count: 5, vcpu: 16, ramGB: 64, storageGB: 200 },
  infraNodes: null,
  odfNodes: null,
  rhacmWorkers: null,
  virtWorkerNodes: null,
  gpuNodes: null,
  virtStorageGB: 0,
  rhoaiOverhead: null,
  totals: { vcpu: 104, ramGB: 416, storageGB: 1360 },
}

describe('buildChartRows', () => {
  it('returns rows for non-null node specs only', () => {
    const rows = buildChartRows(fixture)
    expect(rows).toHaveLength(2)
    expect(rows[0].label).toBe('Control Plane')
    expect(rows[1].label).toBe('Workers')
  })

  it('includes all 7 node types when all are present', () => {
    const full: ClusterSizing = {
      ...fixture,
      infraNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 },
      odfNodes: { count: 3, vcpu: 16, ramGB: 64, storageGB: 2000 },
      rhacmWorkers: { count: 3, vcpu: 8, ramGB: 16, storageGB: 100 },
      virtWorkerNodes: { count: 4, vcpu: 32, ramGB: 128, storageGB: 500 },
      gpuNodes: { count: 2, vcpu: 64, ramGB: 256, storageGB: 1000 },
    }
    expect(buildChartRows(full)).toHaveLength(7)
  })
})

describe('buildVcpuData', () => {
  it('returns count * vcpu for each row', () => {
    const rows = buildChartRows(fixture)
    expect(buildVcpuData(rows)).toEqual([24, 80])
  })
})

describe('buildRamData', () => {
  it('returns count * ramGB for each row', () => {
    const rows = buildChartRows(fixture)
    expect(buildRamData(rows)).toEqual([96, 320])
  })
})

describe('buildStorageData', () => {
  it('returns count * storageGB for each row', () => {
    const rows = buildChartRows(fixture)
    expect(buildStorageData(rows)).toEqual([360, 1000])
  })
})

describe('buildNodeCountData', () => {
  it('returns count for each row', () => {
    const rows = buildChartRows(fixture)
    expect(buildNodeCountData(rows)).toEqual([3, 5])
  })
})
