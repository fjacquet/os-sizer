import { describe, it, expect } from 'vitest'
import { buildArchSummaryData, buildBomTableRows } from '../usePptxExport'
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
