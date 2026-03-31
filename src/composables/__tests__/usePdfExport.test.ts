import { describe, it, expect } from 'vitest'
import { buildPdfTableData } from '../usePdfExport'
import type { ClusterSizing } from '@/engine/types'

const sizing: ClusterSizing = {
  masterNodes: { count: 3, vcpu: 4, ramGB: 16, storageGB: 100 },
  workerNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 100 },
  infraNodes: null,
  odfNodes: null,
  rhacmWorkers: null,
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
