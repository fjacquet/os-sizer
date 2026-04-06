import { describe, it, expect } from 'vitest'
import { buildCsvContent, buildMultiClusterCsvContent } from '../useCsvExport'
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

describe('buildMultiClusterCsvContent', () => {
  const clusters = [{ name: 'Hub' }, { name: 'Spoke-A' }]
  const sizings = [sizing, sizing] // reuse same fixture for both
  const totals = { vcpu: 72, ramGB: 288, storageGB: 1200 } // double the single-cluster totals

  it('contains both cluster names as grouping rows', () => {
    const csv = buildMultiClusterCsvContent(clusters, sizings, totals)
    expect(csv).toContain('Hub,,,,')
    expect(csv).toContain('Spoke-A,,,,')
  })

  it('first line is the first cluster name grouping row', () => {
    const csv = buildMultiClusterCsvContent(clusters, sizings, totals)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Hub,,,,')
  })

  it('repeats header row after each cluster name row', () => {
    const csv = buildMultiClusterCsvContent(clusters, sizings, totals)
    const lines = csv.split('\n')
    // Header should appear right after the grouping row (index 0 is cluster name, index 1 is header)
    expect(lines[1]).toBe('Node Type,Count,vCPU,RAM (GB),Storage (GB)')
    // Find the second cluster grouping row and check its header
    const secondGroupingIdx = lines.findIndex((l) => l === 'Spoke-A,,,,')
    expect(secondGroupingIdx).toBeGreaterThan(0)
    expect(lines[secondGroupingIdx + 1]).toBe('Node Type,Count,vCPU,RAM (GB),Storage (GB)')
  })

  it('contains a blank line between cluster sections', () => {
    const csv = buildMultiClusterCsvContent(clusters, sizings, totals)
    const lines = csv.split('\n')
    // There should be at least one blank line in the output
    expect(lines).toContain('')
    // The blank line should appear between the two cluster sections
    const firstClusterDataEnd = lines.findIndex(
      (l, i) => i > 2 && l === '',
    )
    expect(firstClusterDataEnd).toBeGreaterThan(0)
  })

  it('last non-empty line starts with AGGREGATE TOTAL', () => {
    const csv = buildMultiClusterCsvContent(clusters, sizings, totals)
    const lines = csv.split('\n').filter((l) => l.trim() !== '')
    expect(lines[lines.length - 1]).toMatch(/^AGGREGATE TOTAL/)
  })

  it('aggregate row contains summed vCPU/RAM/Storage matching aggregateTotals input', () => {
    const csv = buildMultiClusterCsvContent(clusters, sizings, totals)
    expect(csv).toContain(`AGGREGATE TOTAL,,${totals.vcpu},${totals.ramGB},${totals.storageGB}`)
  })

  it('wraps cluster name containing comma in double quotes', () => {
    const clustersWithComma = [{ name: 'Hub, Primary' }, { name: 'Spoke' }]
    const csv = buildMultiClusterCsvContent(clustersWithComma, sizings, totals)
    expect(csv).toContain('"Hub, Primary",,,,')
  })

  it('single cluster name without comma is not quoted', () => {
    const csv = buildMultiClusterCsvContent([{ name: 'Hub' }], [sizing], {
      vcpu: 36,
      ramGB: 144,
      storageGB: 600,
    })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Hub,,,,')
    expect(lines[0]).not.toMatch(/^"/)
  })
})
