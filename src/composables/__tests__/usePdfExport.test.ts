import { describe, it, expect } from 'vitest'
import { buildPdfTableData } from '../usePdfExport'
import type { ClusterSizing } from '@/engine/types'

const sizing: ClusterSizing = {
  masterNodes: { count: 3, vcpu: 4, ramGB: 16, storageGB: 100 },
  workerNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 },
  infraNodes: null,
  odfNodes: null,
  rhacmWorkers: null,
  virtWorkerNodes: null,
  gpuNodes: null,
  virtStorageGB: 0,
  rhoaiOverhead: null,
  totals: { vcpu: 36, ramGB: 144, storageGB: 600 },
}

describe('buildPdfTableData', () => {
  it('returns head with 5 columns', () => {
    const { head } = buildPdfTableData(sizing)
    expect(head[0]).toHaveLength(5)
  })
  it('returns body rows for non-null specs', () => {
    const { body } = buildPdfTableData(sizing)
    expect(body).toHaveLength(2) // masters + workers
  })
  it('includes masterNodes row values as strings', () => {
    const { body } = buildPdfTableData(sizing)
    expect(body[0][0]).toBe('Control Plane')
    expect(body[0][1]).toBe('3')
  })
  it('head row contains expected column labels', () => {
    const { head } = buildPdfTableData(sizing)
    expect(head[0]).toEqual(['Node Type', 'Count', 'vCPU', 'RAM (GB)', 'Storage (GB)'])
  })
  it('skips null NodeSpec entries in body', () => {
    const { body } = buildPdfTableData({ ...sizing, workerNodes: null })
    expect(body).toHaveLength(1) // masters only
  })
  it('includes all non-null entries', () => {
    const sizingWithAll: ClusterSizing = {
      ...sizing,
      infraNodes: { count: 2, vcpu: 4, ramGB: 16, storageGB: 50 },
      odfNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 500 },
      rhacmWorkers: { count: 2, vcpu: 4, ramGB: 16, storageGB: 100 },
    }
    const { body } = buildPdfTableData(sizingWithAll)
    expect(body).toHaveLength(5) // masters + workers + infra + odf + rhacm
  })
})

describe('buildPdfTableData v2.0 rows', () => {
  it('includes Virt Workers row when virtWorkerNodes non-null', () => {
    const { body } = buildPdfTableData({
      ...sizing,
      virtWorkerNodes: { count: 4, vcpu: 16, ramGB: 64, storageGB: 200 },
    })
    expect(body.some((row) => row[0] === 'Virt Workers')).toBe(true)
  })

  it('includes GPU Nodes row when gpuNodes non-null', () => {
    const { body } = buildPdfTableData({
      ...sizing,
      gpuNodes: { count: 2, vcpu: 48, ramGB: 192, storageGB: 500 },
    })
    expect(body.some((row) => row[0] === 'GPU Nodes')).toBe(true)
  })

  it('appends RHOAI annotation row when rhoaiOverhead non-null', () => {
    const { body } = buildPdfTableData({
      ...sizing,
      rhoaiOverhead: { vcpu: 4, ramGB: 16 },
    })
    expect(body.some((row) => row[0].includes('RHOAI Overhead'))).toBe(true)
    expect(body.some((row) => row[2] === '+4')).toBe(true)
  })

  it('omits new rows when all new fields are null', () => {
    const { body } = buildPdfTableData(sizing)
    expect(body.some((row) => row[0] === 'GPU Nodes')).toBe(false)
    expect(body.some((row) => row[0] === 'Virt Workers')).toBe(false)
    expect(body.some((row) => row[0].includes('RHOAI Overhead'))).toBe(false)
  })
})
