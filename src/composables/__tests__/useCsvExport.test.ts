import { describe, it, expect } from 'vitest'
import { buildCsvContent } from '../useCsvExport'
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

describe('buildCsvContent', () => {
  it('returns header + data rows', () => {
    const csv = buildCsvContent(sizing)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('Node Type,Count,vCPU,RAM (GB),Storage (GB)')
    expect(lines).toHaveLength(3) // header + masters + workers
  })
  it('skips null NodeSpec entries', () => {
    const csv = buildCsvContent({ ...sizing, workerNodes: null })
    expect(csv.trim().split('\n')).toHaveLength(2) // header + masters only
  })
  it('includes correct values for masterNodes row', () => {
    const csv = buildCsvContent(sizing)
    const lines = csv.trim().split('\n')
    expect(lines[1]).toBe('Control Plane,3,4,16,100')
  })
  it('includes all non-null NodeSpec entries', () => {
    const sizingWithAll: ClusterSizing = {
      ...sizing,
      infraNodes: { count: 2, vcpu: 4, ramGB: 16, storageGB: 50 },
      odfNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 500 },
      rhacmWorkers: { count: 2, vcpu: 4, ramGB: 16, storageGB: 100 },
    }
    const csv = buildCsvContent(sizingWithAll)
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(6) // header + masters + workers + infra + odf + rhacm
  })

  // Phase 12 — GPU-03 / RHOAI-04 tests
  it('includes Virt Workers row when virtWorkerNodes is non-null', () => {
    const csv = buildCsvContent({
      ...sizing,
      virtWorkerNodes: { count: 4, vcpu: 32, ramGB: 128, storageGB: 500 },
    })
    expect(csv).toContain('Virt Workers')
  })

  it('includes GPU Nodes row when gpuNodes is non-null', () => {
    const csv = buildCsvContent({
      ...sizing,
      gpuNodes: { count: 2, vcpu: 48, ramGB: 192, storageGB: 400 },
    })
    expect(csv).toContain('GPU Nodes')
  })

  it('excludes Virt Workers and GPU rows when both are null', () => {
    const csv = buildCsvContent(sizing)
    expect(csv).not.toContain('Virt Workers')
    expect(csv).not.toContain('GPU Nodes')
  })

  it('appends RHOAI annotation row when rhoaiOverhead is non-null', () => {
    const csv = buildCsvContent({
      ...sizing,
      rhoaiOverhead: { vcpu: 16, ramGB: 64 },
    })
    expect(csv).toContain('RHOAI Overhead')
    expect(csv).toContain('+16')
    expect(csv).toContain('+64')
  })

  it('omits RHOAI annotation row when rhoaiOverhead is null', () => {
    const csv = buildCsvContent(sizing)
    expect(csv).not.toContain('RHOAI Overhead')
  })
})
