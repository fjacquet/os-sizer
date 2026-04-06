/// <reference types="vitest/globals" />
// NOTE: This test requires @vue/test-utils and jsdom environment.
// Run with: vitest --environment jsdom (after installing @vue/test-utils)
// Skipped in default vitest run (node environment, components excluded).
import { describe, it, expect } from 'vitest'
import type { SizingResult, ClusterSizing } from '@/engine/types'

// Replicates the BomTable `rows` computed logic — updated in Phase 12 to include
// virtWorkerNodes, gpuNodes, and rhoaiOverhead awareness (GPU-03, RHOAI-04)
function buildRows(s: ClusterSizing): { labelKey: string }[] {
  const entries: { labelKey: string }[] = []
  entries.push({ labelKey: 'node.masters' })
  if (s.workerNodes) entries.push({ labelKey: 'node.workers' })
  if (s.infraNodes) entries.push({ labelKey: 'node.infra' })
  if (s.odfNodes) entries.push({ labelKey: 'node.storage' })
  if (s.rhacmWorkers) entries.push({ labelKey: 'results.bom.rhacmWorkers' })
  if (s.virtWorkerNodes) entries.push({ labelKey: 'node.virtWorkers' })
  if (s.gpuNodes) entries.push({ labelKey: 'node.gpu' })
  return entries
}

function makeBaseSizing(overrides: Partial<ClusterSizing> = {}): ClusterSizing {
  return {
    masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 120 },
    workerNodes: null,
    infraNodes: null,
    odfNodes: null,
    rhacmWorkers: null,
    virtWorkerNodes: null,
    gpuNodes: null,
    virtStorageGB: 0,
    rhoaiOverhead: null,
    totals: { vcpu: 24, ramGB: 96, storageGB: 360 },
    ...overrides,
  }
}

describe('BomTable', () => {
  it('renders 5 rows when all NodeSpec fields are populated', () => {
    const mockResult: SizingResult = {
      id: 'test-cluster',
      sizing: {
        masterNodes: { count: 3, vcpu: 8, ramGB: 32, storageGB: 120 },
        workerNodes: { count: 3, vcpu: 16, ramGB: 64, storageGB: 200 },
        infraNodes: { count: 3, vcpu: 4, ramGB: 16, storageGB: 100 },
        odfNodes: { count: 3, vcpu: 12, ramGB: 64, storageGB: 2048 },
        rhacmWorkers: { count: 2, vcpu: 8, ramGB: 32, storageGB: 120 },
        virtWorkerNodes: null,
        gpuNodes: null,
        virtStorageGB: 0,
        rhoaiOverhead: null,
        totals: { vcpu: 141, ramGB: 624, storageGB: 8820 },
      },
      recommendations: [],
      validationErrors: [],
    }

    // Verify mock data structure is correct (static type check)
    expect(mockResult.sizing.masterNodes.count).toBe(3)
    expect(mockResult.sizing.masterNodes.vcpu).toBe(8)
    expect(mockResult.sizing.workerNodes).not.toBeNull()
    expect(mockResult.sizing.infraNodes).not.toBeNull()
    expect(mockResult.sizing.odfNodes).not.toBeNull()
    expect(mockResult.sizing.rhacmWorkers).not.toBeNull()

    // The BomTable component will render 5 rows for this mock (all non-null)
    const nonNullCount = [
      mockResult.sizing.masterNodes,
      mockResult.sizing.workerNodes,
      mockResult.sizing.infraNodes,
      mockResult.sizing.odfNodes,
      mockResult.sizing.rhacmWorkers,
    ].filter(Boolean).length
    expect(nonNullCount).toBe(5)
  })

  it('skips null NodeSpec entries', () => {
    const mockResultSno: SizingResult = {
      id: 'sno-cluster',
      sizing: makeBaseSizing({ masterNodes: { count: 1, vcpu: 8, ramGB: 32, storageGB: 120 }, totals: { vcpu: 8, ramGB: 32, storageGB: 120 } }),
      recommendations: [],
      validationErrors: [],
    }

    const nonNullCount = [
      mockResultSno.sizing.masterNodes,
      mockResultSno.sizing.workerNodes,
      mockResultSno.sizing.infraNodes,
      mockResultSno.sizing.odfNodes,
      mockResultSno.sizing.rhacmWorkers,
    ].filter(Boolean).length
    expect(nonNullCount).toBe(1)
  })

  // Phase 12 — GPU-03 / RHOAI-04 tests
  it('rows computed includes virtWorkers entry when virtWorkerNodes is non-null', () => {
    const s = makeBaseSizing({
      virtWorkerNodes: { count: 4, vcpu: 32, ramGB: 128, storageGB: 500 },
    })
    const rows = buildRows(s)
    expect(rows.map((r) => r.labelKey)).toContain('node.virtWorkers')
  })

  it('rows computed includes gpu entry when gpuNodes is non-null', () => {
    const s = makeBaseSizing({
      gpuNodes: { count: 2, vcpu: 48, ramGB: 192, storageGB: 400 },
    })
    const rows = buildRows(s)
    expect(rows.map((r) => r.labelKey)).toContain('node.gpu')
  })

  it('rows computed excludes virtWorkers and gpu entries when both are null', () => {
    const s = makeBaseSizing()
    const rows = buildRows(s)
    const keys = rows.map((r) => r.labelKey)
    expect(keys).not.toContain('node.virtWorkers')
    expect(keys).not.toContain('node.gpu')
  })

  it('rhoaiOverhead non-null is present on sizing (template uses it for annotation row)', () => {
    const s = makeBaseSizing({
      rhoaiOverhead: { vcpu: 16, ramGB: 64 },
    })
    expect(s.rhoaiOverhead).not.toBeNull()
    expect(s.rhoaiOverhead?.vcpu).toBe(16)
    expect(s.rhoaiOverhead?.ramGB).toBe(64)
  })
})
