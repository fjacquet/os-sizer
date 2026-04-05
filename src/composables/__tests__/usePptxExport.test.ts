import { describe, it, expect } from 'vitest'
import {
  buildArchSummaryData,
  buildBomTableRows,
  buildNodeCountChartData,
  shouldShowVcpuChart,
  buildVcpuStackedChartData,
  type PptxChartSeries,
} from '../usePptxExport'
import type { ClusterConfig, ClusterSizing, NodeSpec } from '@/engine/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeClusterConfig(overrides: Partial<ClusterConfig> = {}): ClusterConfig {
  return {
    id: 'test-id',
    name: 'Test Cluster',
    topology: 'standard-ha',
    snoProfile: 'standard',
    hcpHostedClusters: 1,
    hcpQpsPerCluster: 1000,
    workload: {
      totalPods: 10,
      podCpuMillicores: 500,
      podMemMiB: 512,
      nodeVcpu: 16,
      nodeRamGB: 32,
    },
    addOns: {
      odfEnabled: false,
      odfExtraOsdCount: 0,
      infraNodesEnabled: false,
      rhacmEnabled: false,
      rhacmManagedClusters: 0,
      virtEnabled: false,
      vmCount: 0,
      vmsPerWorker: 10,
      virtAvgVmVcpu: 4,
      virtAvgVmRamGB: 8,
      snoVirtMode: false,
      gpuEnabled: false,
      gpuNodeCount: 1,
      gpuMode: 'container' as const,
      gpuModel: 'A100-40GB',
      migProfile: '',
      gpuPerNode: 1,
      rhoaiEnabled: false,
      rwxStorageAvailable: false,
    },
    environment: 'datacenter',
    haRequired: true,
    airGapped: false,
    maxNodes: null,
    ...overrides,
  }
}

function makeNodeSpec(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return { count: 3, vcpu: 8, ramGB: 32, storageGB: 120, ...overrides }
}

function makeSizing(overrides: Partial<ClusterSizing> = {}): ClusterSizing {
  return {
    masterNodes: makeNodeSpec({ count: 3, vcpu: 8, ramGB: 32, storageGB: 120 }),
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

// ── buildArchSummaryData ──────────────────────────────────────────────────────

describe('buildArchSummaryData', () => {
  it('returns exactly 6 rows for any valid ClusterConfig', () => {
    const cluster = makeClusterConfig()
    const totals = { vcpu: 24, ramGB: 96, storageGB: 360 }
    const rows = buildArchSummaryData(cluster, totals)
    expect(rows).toHaveLength(6)
  })

  it('row[0] has label "Topology" and value matching cluster.topology', () => {
    const cluster = makeClusterConfig({ topology: 'compact-3node' })
    const totals = { vcpu: 12, ramGB: 48, storageGB: 180 }
    const rows = buildArchSummaryData(cluster, totals)
    expect(rows[0].label).toBe('Topology')
    expect(rows[0].value).toBe('compact-3node')
  })

  it('row[1] has label "Environment" and value matching cluster.environment', () => {
    const cluster = makeClusterConfig({ environment: 'edge' })
    const totals = { vcpu: 24, ramGB: 96, storageGB: 360 }
    const rows = buildArchSummaryData(cluster, totals)
    expect(rows[1].label).toBe('Environment')
    expect(rows[1].value).toBe('edge')
  })

  it('row[2] has label "HA Required" and value "Yes" when haRequired is true', () => {
    const cluster = makeClusterConfig({ haRequired: true })
    const totals = { vcpu: 24, ramGB: 96, storageGB: 360 }
    const rows = buildArchSummaryData(cluster, totals)
    expect(rows[2].label).toBe('HA Required')
    expect(rows[2].value).toBe('Yes')
  })

  it('row[2] value is "No" when haRequired is false', () => {
    const cluster = makeClusterConfig({ haRequired: false })
    const totals = { vcpu: 24, ramGB: 96, storageGB: 360 }
    const rows = buildArchSummaryData(cluster, totals)
    expect(rows[2].value).toBe('No')
  })

  it('rows[3..5] contain stringified totals', () => {
    const cluster = makeClusterConfig()
    const totals = { vcpu: 48, ramGB: 192, storageGB: 1440 }
    const rows = buildArchSummaryData(cluster, totals)
    expect(rows[3]).toEqual({ label: 'Total vCPU', value: '48' })
    expect(rows[4]).toEqual({ label: 'Total RAM (GB)', value: '192' })
    expect(rows[5]).toEqual({ label: 'Total Storage (GB)', value: '1440' })
  })
})

// ── buildBomTableRows ─────────────────────────────────────────────────────────

describe('buildBomTableRows', () => {
  it('returns 2 rows (header + masters) when only masterNodes is non-null', () => {
    const sizing = makeSizing()
    const rows = buildBomTableRows(sizing)
    expect(rows).toHaveLength(2)
  })

  it('first row is the header with bold options', () => {
    const sizing = makeSizing()
    const rows = buildBomTableRows(sizing)
    const header = rows[0]
    expect(header[0].text).toBe('Node Type')
    expect(header[1].text).toBe('Count')
    expect(header[2].text).toBe('vCPU')
    expect(header[3].text).toBe('RAM (GB)')
    expect(header[4].text).toBe('Storage (GB)')
    // Bold option set on header cells
    expect(header[0].options?.bold).toBe(true)
  })

  it('header cells have HEADER_BG fill color', () => {
    const sizing = makeSizing()
    const rows = buildBomTableRows(sizing)
    const header = rows[0]
    expect(header[0].options?.fill?.color).toBe('E8E8E8')
  })

  it('returns 6 rows (header + 5 node types) when all NodeSpecs are non-null', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3 }),
      workerNodes: makeNodeSpec({ count: 3 }),
      infraNodes: makeNodeSpec({ count: 3 }),
      odfNodes: makeNodeSpec({ count: 3 }),
      rhacmWorkers: makeNodeSpec({ count: 2 }),
    })
    const rows = buildBomTableRows(sizing)
    expect(rows).toHaveLength(6)
  })

  it('second row contains master node data as strings', () => {
    const masterSpec = makeNodeSpec({ count: 3, vcpu: 8, ramGB: 32, storageGB: 120 })
    const sizing = makeSizing({ masterNodes: masterSpec })
    const rows = buildBomTableRows(sizing)
    const masterRow = rows[1]
    expect(masterRow[0].text).toBe('Control Plane')
    expect(masterRow[1].text).toBe('3')
    expect(masterRow[2].text).toBe('8')
    expect(masterRow[3].text).toBe('32')
    expect(masterRow[4].text).toBe('120')
  })

  it('skips null NodeSpec entries (e.g. workerNodes null → not in output)', () => {
    const sizing = makeSizing({
      workerNodes: makeNodeSpec({ count: 5 }),
      infraNodes: null,
      odfNodes: makeNodeSpec({ count: 3 }),
      rhacmWorkers: null,
    })
    const rows = buildBomTableRows(sizing)
    // header + masters + workers + odfNodes = 4
    expect(rows).toHaveLength(4)
    const labels = rows.slice(1).map((r) => r[0].text)
    expect(labels).toContain('Control Plane')
    expect(labels).toContain('Workers')
    expect(labels).toContain('ODF Storage')
    expect(labels).not.toContain('Infra Nodes')
    expect(labels).not.toContain('RHACM Hub')
  })
})

// ── buildBomTableRows v2.0 rows ───────────────────────────────────────────────

describe('buildBomTableRows v2.0 rows', () => {
  it('includes Virt Workers row when virtWorkerNodes non-null', () => {
    const rows = buildBomTableRows(
      makeSizing({ virtWorkerNodes: { count: 4, vcpu: 16, ramGB: 64, storageGB: 200 } }),
    )
    const allText = rows.flat().map((c) => c.text).join('|')
    expect(allText).toContain('Virt Workers')
  })

  it('includes GPU Nodes row when gpuNodes non-null', () => {
    const rows = buildBomTableRows(
      makeSizing({ gpuNodes: { count: 2, vcpu: 48, ramGB: 192, storageGB: 500 } }),
    )
    const allText = rows.flat().map((c) => c.text).join('|')
    expect(allText).toContain('GPU Nodes')
  })

  it('appends RHOAI annotation row when rhoaiOverhead non-null', () => {
    const rows = buildBomTableRows(makeSizing({ rhoaiOverhead: { vcpu: 4, ramGB: 16 } }))
    const allText = rows.flat().map((c) => c.text).join('|')
    expect(allText).toContain('RHOAI Overhead')
    expect(allText).toContain('+4')
  })

  it('omits GPU and Virt rows when null', () => {
    const rows = buildBomTableRows(makeSizing())
    const allText = rows.flat().map((c) => c.text).join('|')
    expect(allText).not.toContain('GPU Nodes')
    expect(allText).not.toContain('Virt Workers')
    expect(allText).not.toContain('RHOAI Overhead')
  })
})

// ── buildNodeCountChartData ───────────────────────────────────────────────────

describe('buildNodeCountChartData', () => {
  it('returns a single series named "Node Count"', () => {
    const sizing = makeSizing({ masterNodes: makeNodeSpec({ count: 3 }) })
    const data = buildNodeCountChartData(sizing)
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('Node Count')
  })

  it('labels and values match non-zero pools only', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3 }),
      workerNodes: makeNodeSpec({ count: 6 }),
      infraNodes: null,
      odfNodes: makeNodeSpec({ count: 3 }),
    })
    const data = buildNodeCountChartData(sizing)
    expect(data[0].labels).toEqual(['Control Plane', 'Workers', 'ODF Storage'])
    expect(data[0].values).toEqual([3, 6, 3])
  })

  it('excludes pools with count=0 from labels and values', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3 }),
      workerNodes: makeNodeSpec({ count: 0 }),
    })
    const data = buildNodeCountChartData(sizing)
    expect(data[0].labels).not.toContain('Workers')
    expect(data[0].values).not.toContain(0)
  })

  it('returns single label "Control Plane" when only masters exist', () => {
    const sizing = makeSizing()
    const data = buildNodeCountChartData(sizing)
    expect(data[0].labels).toEqual(['Control Plane'])
    expect(data[0].values).toEqual([3])
  })
})

// ── shouldShowVcpuChart ───────────────────────────────────────────────────────

describe('shouldShowVcpuChart', () => {
  it('returns false when only 1 pool type (masters only)', () => {
    expect(shouldShowVcpuChart(makeSizing())).toBe(false)
  })

  it('returns false when exactly 2 non-zero pool types', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3 }),
      workerNodes: makeNodeSpec({ count: 6 }),
    })
    expect(shouldShowVcpuChart(sizing)).toBe(false)
  })

  it('returns true when exactly 3 non-zero pool types', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3 }),
      workerNodes: makeNodeSpec({ count: 6 }),
      odfNodes: makeNodeSpec({ count: 3 }),
    })
    expect(shouldShowVcpuChart(sizing)).toBe(true)
  })

  it('returns true when 4 or more non-zero pool types', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3 }),
      workerNodes: makeNodeSpec({ count: 6 }),
      odfNodes: makeNodeSpec({ count: 3 }),
      infraNodes: makeNodeSpec({ count: 3 }),
    })
    expect(shouldShowVcpuChart(sizing)).toBe(true)
  })

  it('does not count zero-count pools toward the threshold', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3 }),
      workerNodes: makeNodeSpec({ count: 0 }),
      odfNodes: makeNodeSpec({ count: 0 }),
    })
    expect(shouldShowVcpuChart(sizing)).toBe(false)
  })
})

// ── buildVcpuStackedChartData ─────────────────────────────────────────────────

describe('buildVcpuStackedChartData', () => {
  it('returns null when fewer than 3 non-zero pool types', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3 }),
      workerNodes: makeNodeSpec({ count: 6 }),
    })
    expect(buildVcpuStackedChartData(sizing)).toBeNull()
  })

  it('returns null for a single pool type (masters only)', () => {
    expect(buildVcpuStackedChartData(makeSizing())).toBeNull()
  })

  it('returns one series per non-zero pool when 3+ types exist', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3, vcpu: 8 }),
      workerNodes: makeNodeSpec({ count: 6, vcpu: 16 }),
      odfNodes: makeNodeSpec({ count: 3, vcpu: 12 }),
    })
    const data = buildVcpuStackedChartData(sizing)
    expect(data).not.toBeNull()
    expect(data).toHaveLength(3)
  })

  it('each series name matches pool label', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3, vcpu: 8 }),
      workerNodes: makeNodeSpec({ count: 6, vcpu: 16 }),
      odfNodes: makeNodeSpec({ count: 3, vcpu: 12 }),
    })
    const data = buildVcpuStackedChartData(sizing)!
    expect(data.map((s) => s.name)).toEqual(['Control Plane', 'Workers', 'ODF Storage'])
  })

  it('each series has a single label "vCPU Distribution"', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3, vcpu: 8 }),
      workerNodes: makeNodeSpec({ count: 6, vcpu: 16 }),
      odfNodes: makeNodeSpec({ count: 3, vcpu: 12 }),
    })
    const data = buildVcpuStackedChartData(sizing)!
    data.forEach((series) => {
      expect(series.labels).toEqual(['vCPU Distribution'])
    })
  })

  it('each series value equals count * vcpu for that pool', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3, vcpu: 8 }), // 24 vCPU
      workerNodes: makeNodeSpec({ count: 6, vcpu: 16 }), // 96 vCPU
      odfNodes: makeNodeSpec({ count: 3, vcpu: 12 }), // 36 vCPU
    })
    const data = buildVcpuStackedChartData(sizing)!
    expect(data[0].values).toEqual([24])
    expect(data[1].values).toEqual([96])
    expect(data[2].values).toEqual([36])
  })

  it('excludes zero-count pools even when total pool list has 3+ entries', () => {
    const sizing = makeSizing({
      masterNodes: makeNodeSpec({ count: 3, vcpu: 8 }),
      workerNodes: makeNodeSpec({ count: 0, vcpu: 16 }), // zero — excluded
      odfNodes: makeNodeSpec({ count: 3, vcpu: 12 }),
    })
    // Only 2 non-zero pools → should return null
    const data = buildVcpuStackedChartData(sizing)
    expect(data).toBeNull()
  })
})
