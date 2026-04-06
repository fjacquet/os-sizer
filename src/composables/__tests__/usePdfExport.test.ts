import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildPdfTableData, buildChartImageDataUrl, buildKpiStripData, buildAggregateRow } from '../usePdfExport'
import type { ClusterSizing } from '@/engine/types'

// Hoist mocks so they are available before vi.mock factory runs
const { mockDestroy, mockChart } = vi.hoisted(() => {
  const mockDestroy = vi.fn()
  // Must use a regular function (not arrow) because Chart is called with `new`
  const mockChart = vi.fn(function () {
    return { destroy: mockDestroy }
  })
  return { mockDestroy, mockChart }
})

// Mock chart.js/auto — Chart constructor and destroy
vi.mock('chart.js/auto', () => ({ default: mockChart }))

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

describe('buildKpiStripData', () => {
  it('returns total vCPU from sizing.totals', () => {
    const kpi = buildKpiStripData(sizing)
    expect(kpi.vcpu).toBe(36)
  })
  it('returns total RAM from sizing.totals', () => {
    const kpi = buildKpiStripData(sizing)
    expect(kpi.ramGB).toBe(144)
  })
  it('returns total Storage from sizing.totals', () => {
    const kpi = buildKpiStripData(sizing)
    expect(kpi.storageGB).toBe(600)
  })
  it('formats label with vCPU, RAM and Storage values', () => {
    const kpi = buildKpiStripData(sizing)
    expect(kpi.label).toMatch(/Total vCPU:\s*36/)
    expect(kpi.label).toMatch(/RAM:\s*144\s*GB/)
    expect(kpi.label).toMatch(/Storage:\s*600\s*GB/)
  })
})

describe('buildChartImageDataUrl', () => {
  let mockCanvas: {
    width: number
    height: number
    getContext: ReturnType<typeof vi.fn>
    toDataURL: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDestroy.mockClear()
    mockChart.mockClear()

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({}),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,MOCK'),
    }

    // In node environment, document is not available — stub it globally
    vi.stubGlobal('document', {
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas
        return {}
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a string starting with data: for non-zero sizing', () => {
    const result = buildChartImageDataUrl(sizing)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^data:/)
  })

  it('returns null when all node pools have count 0', () => {
    const zeroSizing: ClusterSizing = {
      ...sizing,
      masterNodes: { count: 0, vcpu: 4, ramGB: 16, storageGB: 100 },
      workerNodes: { count: 0, vcpu: 8, ramGB: 32, storageGB: 100 },
    }
    const result = buildChartImageDataUrl(zeroSizing)
    expect(result).toBeNull()
  })

  it('constructs chart with type bar', () => {
    buildChartImageDataUrl(sizing)
    expect(mockChart).toHaveBeenCalled()
    const callArgs = mockChart.mock.calls[0]
    expect(callArgs[1].type).toBe('bar')
  })

  it('sets animation duration 0 to ensure immediate canvas paint', () => {
    buildChartImageDataUrl(sizing)
    expect(mockChart).toHaveBeenCalled()
    const callArgs = mockChart.mock.calls[0]
    expect(callArgs[1].options?.animation?.duration).toBe(0)
  })

  it('calls chart.destroy() after toDataURL to prevent memory leaks', () => {
    buildChartImageDataUrl(sizing)
    expect(mockDestroy).toHaveBeenCalledOnce()
  })

  it('excludes zero-count pools from chart labels', () => {
    const sizingWithZeroWorkers: ClusterSizing = {
      ...sizing,
      workerNodes: { count: 0, vcpu: 8, ramGB: 32, storageGB: 100 },
    }
    buildChartImageDataUrl(sizingWithZeroWorkers)
    expect(mockChart).toHaveBeenCalled()
    const callArgs = mockChart.mock.calls[0]
    const labels: string[] = callArgs[1].data.labels
    expect(labels).not.toContain('Workers')
    expect(labels).toContain('Control Plane')
  })
})

// ── buildAggregateRow ─────────────────────────────────────────────────────────

describe('buildAggregateRow', () => {
  it('returns a row with AGGREGATE TOTAL in first cell', () => {
    const row = buildAggregateRow({ vcpu: 100, ramGB: 384, storageGB: 2400 })
    expect(row[0]).toBe('AGGREGATE TOTAL')
  })

  it('returns correct stringified values for vcpu, ramGB, storageGB', () => {
    const row = buildAggregateRow({ vcpu: 100, ramGB: 384, storageGB: 2400 })
    expect(row).toEqual(['AGGREGATE TOTAL', '', '100', '384', '2400'])
  })

  it('second cell is empty string (placeholder for Count column)', () => {
    const row = buildAggregateRow({ vcpu: 48, ramGB: 192, storageGB: 720 })
    expect(row[1]).toBe('')
  })

  it('works with zero values', () => {
    const row = buildAggregateRow({ vcpu: 0, ramGB: 0, storageGB: 0 })
    expect(row).toEqual(['AGGREGATE TOTAL', '', '0', '0', '0'])
  })
})
