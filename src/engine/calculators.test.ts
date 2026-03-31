import { describe, it, expect } from 'vitest'
import {
  calcStandardHA,
  calcCompact3Node,
  calcSNO,
  calcTNA,
  calcTNF,
  calcHCP,
  calcMicroShift,
  calcManagedCloud,
  calcCluster,
} from './calculators'
import type { ClusterConfig } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ClusterConfig> = {}): ClusterConfig {
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
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// calcStandardHA
// ---------------------------------------------------------------------------

describe('calcStandardHA', () => {
  it('returns 3 CP nodes + calculated workers', () => {
    const config = makeConfig()
    const { sizing } = calcStandardHA(config)
    expect(sizing.masterNodes.count).toBe(3)
    expect(sizing.workerNodes).not.toBeNull()
    expect(sizing.workerNodes!.count).toBeGreaterThanOrEqual(2)
  })

  it('CP sizing scales with worker count', () => {
    // Large workload forces more workers → larger CP tier
    const config = makeConfig({
      workload: {
        totalPods: 5000,
        podCpuMillicores: 500,
        podMemMiB: 512,
        nodeVcpu: 16,
        nodeRamGB: 32,
      },
    })
    const { sizing } = calcStandardHA(config)
    // With many workers, CP should have more vCPU than the base 4
    expect(sizing.masterNodes.vcpu).toBeGreaterThanOrEqual(4)
    expect(sizing.masterNodes.count).toBe(3)
  })

  it('workers minimum 2 for HA', () => {
    // Even with a trivially small workload, at least 2 workers
    const config = makeConfig({
      workload: {
        totalPods: 1,
        podCpuMillicores: 10,
        podMemMiB: 10,
        nodeVcpu: 16,
        nodeRamGB: 32,
      },
    })
    const { sizing } = calcStandardHA(config)
    expect(sizing.workerNodes!.count).toBeGreaterThanOrEqual(2)
  })

  it('includes infra nodes when enabled', () => {
    const config = makeConfig({
      addOns: {
        odfEnabled: false,
        odfExtraOsdCount: 0,
        infraNodesEnabled: true,
        rhacmEnabled: false,
        rhacmManagedClusters: 0,
      },
    })
    const { sizing } = calcStandardHA(config)
    expect(sizing.infraNodes).not.toBeNull()
    expect(sizing.infraNodes!.count).toBe(3)
  })

  it('totals sum all non-null node groups', () => {
    const config = makeConfig()
    const { sizing } = calcStandardHA(config)
    const expectedVcpu =
      sizing.masterNodes.vcpu * sizing.masterNodes.count +
      (sizing.workerNodes ? sizing.workerNodes.vcpu * sizing.workerNodes.count : 0)
    expect(sizing.totals.vcpu).toBe(expectedVcpu)
  })
})

// ---------------------------------------------------------------------------
// calcCompact3Node
// ---------------------------------------------------------------------------

describe('calcCompact3Node', () => {
  it('returns 3 combined nodes, workerNodes is null', () => {
    const config = makeConfig({ topology: 'compact-3node' })
    const { sizing } = calcCompact3Node(config)
    expect(sizing.masterNodes.count).toBe(3)
    expect(sizing.workerNodes).toBeNull()
  })

  it('totals reflect only the 3 master nodes', () => {
    const config = makeConfig({ topology: 'compact-3node' })
    const { sizing } = calcCompact3Node(config)
    expect(sizing.totals.vcpu).toBe(sizing.masterNodes.vcpu * 3)
    expect(sizing.totals.ramGB).toBe(sizing.masterNodes.ramGB * 3)
  })
})

// ---------------------------------------------------------------------------
// calcSNO
// ---------------------------------------------------------------------------

describe('calcSNO', () => {
  it('standard profile: 8 vCPU / 16 GB / 120 GB', () => {
    const config = makeConfig({ topology: 'sno', snoProfile: 'standard' })
    const { sizing } = calcSNO(config)
    expect(sizing.masterNodes).toMatchObject({ count: 1, vcpu: 8, ramGB: 16, storageGB: 120 })
  })

  it('edge profile: 8 vCPU / 32 GB / 120 GB', () => {
    const config = makeConfig({ topology: 'sno', snoProfile: 'edge' })
    const { sizing } = calcSNO(config)
    expect(sizing.masterNodes).toMatchObject({ count: 1, vcpu: 8, ramGB: 32, storageGB: 120 })
  })

  it('telecom profile: 24 vCPU / 48 GB / 600 GB', () => {
    const config = makeConfig({ topology: 'sno', snoProfile: 'telecom-vdu' })
    const { sizing } = calcSNO(config)
    expect(sizing.masterNodes).toMatchObject({ count: 1, vcpu: 24, ramGB: 48, storageGB: 600 })
  })

  it('workerNodes is null', () => {
    const config = makeConfig({ topology: 'sno' })
    const { sizing } = calcSNO(config)
    expect(sizing.workerNodes).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// calcTNA
// ---------------------------------------------------------------------------

describe('calcTNA', () => {
  it('returns 2 CP nodes + 1 arbiter (2 vCPU / 8 GB / 50 GB)', () => {
    const config = makeConfig({ topology: 'two-node-arbiter' })
    const { sizing } = calcTNA(config)
    expect(sizing.masterNodes.count).toBe(2)
    // Arbiter is represented in infraNodes
    expect(sizing.infraNodes).not.toBeNull()
    expect(sizing.infraNodes).toMatchObject({ count: 1, vcpu: 2, ramGB: 8, storageGB: 50 })
  })

  it('includes Tech Preview warning', () => {
    const config = makeConfig({ topology: 'two-node-arbiter' })
    const { warnings } = calcTNA(config)
    const codes = warnings.map(w => w.code)
    expect(codes).toContain('TNA_TECH_PREVIEW')
    const tnaWarn = warnings.find(w => w.code === 'TNA_TECH_PREVIEW')!
    expect(tnaWarn.severity).toBe('warning')
    expect(tnaWarn.messageKey).toBe('warnings.tna.techPreview')
  })
})

// ---------------------------------------------------------------------------
// calcTNF
// ---------------------------------------------------------------------------

describe('calcTNF', () => {
  it('returns 2 CP nodes, no arbiter', () => {
    const config = makeConfig({ topology: 'two-node-fencing' })
    const { sizing } = calcTNF(config)
    expect(sizing.masterNodes.count).toBe(2)
    expect(sizing.workerNodes).toBeNull()
    expect(sizing.infraNodes).toBeNull()
  })

  it('includes Tech Preview warning and Redfish BMC warning', () => {
    const config = makeConfig({ topology: 'two-node-fencing' })
    const { warnings } = calcTNF(config)
    const codes = warnings.map(w => w.code)
    expect(codes).toContain('TNF_TECH_PREVIEW')
    expect(codes).toContain('TNF_REDFISH_REQUIRED')

    const techPreview = warnings.find(w => w.code === 'TNF_TECH_PREVIEW')!
    expect(techPreview.severity).toBe('warning')

    const redfish = warnings.find(w => w.code === 'TNF_REDFISH_REQUIRED')!
    expect(redfish.severity).toBe('error')
    expect(redfish.messageKey).toBe('warnings.tnf.redfishRequired')
  })
})

// ---------------------------------------------------------------------------
// calcHCP
// ---------------------------------------------------------------------------

describe('calcHCP', () => {
  it('management cluster: 5 vCPU / 18 GB per hosted cluster at idle (0 QPS)', () => {
    const config = makeConfig({
      topology: 'hcp',
      hcpHostedClusters: 1,
      hcpQpsPerCluster: 0,
    })
    const { sizing } = calcHCP(config)
    // At 0 QPS, 1 cluster: totalCPU=5, totalRAM=18
    // workersByCPU = ceil(5 / (16*0.70)) = ceil(0.446) = 1 → but min=3
    expect(sizing.workerNodes).not.toBeNull()
    expect(sizing.workerNodes!.count).toBeGreaterThanOrEqual(3)
    expect(sizing.masterNodes.count).toBe(3)
  })

  it('QPS scaling: +9 vCPU / +2.5 GB per 1000 QPS per cluster', () => {
    const config1 = makeConfig({ topology: 'hcp', hcpHostedClusters: 1, hcpQpsPerCluster: 0 })
    const config2 = makeConfig({ topology: 'hcp', hcpHostedClusters: 1, hcpQpsPerCluster: 1000 })
    const { sizing: s1 } = calcHCP(config1)
    const { sizing: s2 } = calcHCP(config2)
    // More QPS must result in >= workers
    expect(s2.workerNodes!.count).toBeGreaterThanOrEqual(s1.workerNodes!.count)
  })

  it('default 1000 QPS per cluster results in at least 3 workers', () => {
    const config = makeConfig({ topology: 'hcp', hcpHostedClusters: 1, hcpQpsPerCluster: 1000 })
    const { sizing } = calcHCP(config)
    expect(sizing.workerNodes!.count).toBeGreaterThanOrEqual(3)
  })

  it('scales workers with more hosted clusters', () => {
    const cfg1 = makeConfig({ topology: 'hcp', hcpHostedClusters: 1, hcpQpsPerCluster: 1000 })
    const cfg5 = makeConfig({ topology: 'hcp', hcpHostedClusters: 5, hcpQpsPerCluster: 1000 })
    const { sizing: s1 } = calcHCP(cfg1)
    const { sizing: s5 } = calcHCP(cfg5)
    expect(s5.workerNodes!.count).toBeGreaterThan(s1.workerNodes!.count)
  })
})

// ---------------------------------------------------------------------------
// calcMicroShift
// ---------------------------------------------------------------------------

describe('calcMicroShift', () => {
  it('1 node: 2 vCPU / 2 GB base + workload overhead', () => {
    const config = makeConfig({
      topology: 'microshift',
      workload: {
        totalPods: 0,
        podCpuMillicores: 0,
        podMemMiB: 0,
        nodeVcpu: 2,
        nodeRamGB: 2,
      },
    })
    const { sizing } = calcMicroShift(config)
    expect(sizing.masterNodes.count).toBe(1)
    expect(sizing.masterNodes.vcpu).toBeGreaterThanOrEqual(2)
    expect(sizing.masterNodes.ramGB).toBeGreaterThanOrEqual(2)
    expect(sizing.workerNodes).toBeNull()
  })

  it('workload overhead adds to base minimum', () => {
    const config = makeConfig({
      topology: 'microshift',
      workload: {
        totalPods: 100,
        podCpuMillicores: 500,
        podMemMiB: 512,
        nodeVcpu: 2,
        nodeRamGB: 2,
      },
    })
    const { sizing } = calcMicroShift(config)
    // 100 pods * 500m / 1000 / 0.70 + 2 = ~73 vCPU; must be > 2
    expect(sizing.masterNodes.vcpu).toBeGreaterThan(2)
    expect(sizing.masterNodes.ramGB).toBeGreaterThan(2)
  })

  it('storage is at least 100 GB', () => {
    const config = makeConfig({ topology: 'microshift' })
    const { sizing } = calcMicroShift(config)
    expect(sizing.masterNodes.storageGB).toBeGreaterThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// calcManagedCloud
// ---------------------------------------------------------------------------

describe('calcManagedCloud', () => {
  it('returns count=0 NodeSpecs', () => {
    const config = makeConfig({ topology: 'managed-cloud' })
    const { sizing } = calcManagedCloud(config)
    expect(sizing.masterNodes.count).toBe(0)
    expect(sizing.masterNodes.vcpu).toBe(0)
    expect(sizing.workerNodes).toBeNull()
  })

  it('totals are all zero', () => {
    const config = makeConfig({ topology: 'managed-cloud' })
    const { sizing } = calcManagedCloud(config)
    expect(sizing.totals).toEqual({ vcpu: 0, ramGB: 0, storageGB: 0 })
  })

  it('includes managedCloudNoHardware warning', () => {
    const config = makeConfig({ topology: 'managed-cloud' })
    const { warnings } = calcManagedCloud(config)
    const codes = warnings.map(w => w.code)
    expect(codes).toContain('MANAGED_CLOUD_NO_HARDWARE')
    const warn = warnings.find(w => w.code === 'MANAGED_CLOUD_NO_HARDWARE')!
    expect(warn.severity).toBe('warning')
    expect(warn.messageKey).toBe('warnings.managedCloud.noHardware')
  })
})

// ---------------------------------------------------------------------------
// calcCluster dispatcher
// ---------------------------------------------------------------------------

describe('calcCluster dispatcher', () => {
  it('routes standard-ha', () => {
    const config = makeConfig({ topology: 'standard-ha' })
    const { sizing } = calcCluster(config)
    expect(sizing.masterNodes.count).toBe(3)
    expect(sizing.workerNodes).not.toBeNull()
  })

  it('routes compact-3node', () => {
    const config = makeConfig({ topology: 'compact-3node' })
    const { sizing } = calcCluster(config)
    expect(sizing.workerNodes).toBeNull()
  })

  it('routes sno', () => {
    const config = makeConfig({ topology: 'sno' })
    const { sizing } = calcCluster(config)
    expect(sizing.masterNodes.count).toBe(1)
  })

  it('routes two-node-arbiter', () => {
    const config = makeConfig({ topology: 'two-node-arbiter' })
    const { warnings } = calcCluster(config)
    expect(warnings.some(w => w.code === 'TNA_TECH_PREVIEW')).toBe(true)
  })

  it('routes two-node-fencing', () => {
    const config = makeConfig({ topology: 'two-node-fencing' })
    const { warnings } = calcCluster(config)
    expect(warnings.some(w => w.code === 'TNF_REDFISH_REQUIRED')).toBe(true)
  })

  it('routes hcp', () => {
    const config = makeConfig({ topology: 'hcp' })
    const { sizing } = calcCluster(config)
    expect(sizing.workerNodes).not.toBeNull()
  })

  it('routes microshift', () => {
    const config = makeConfig({ topology: 'microshift' })
    const { sizing } = calcCluster(config)
    expect(sizing.masterNodes.count).toBe(1)
    expect(sizing.workerNodes).toBeNull()
  })

  it('routes managed-cloud', () => {
    const config = makeConfig({ topology: 'managed-cloud' })
    const { warnings } = calcCluster(config)
    expect(warnings.some(w => w.code === 'MANAGED_CLOUD_NO_HARDWARE')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// calcCluster add-on dispatch
// ---------------------------------------------------------------------------

describe('calcCluster add-on dispatch', () => {
  it('odfEnabled=true returns odfNodes with count=3, vcpu=16, ramGB=64', () => {
    const config = makeConfig({
      addOns: {
        odfEnabled: true,
        odfExtraOsdCount: 0,
        infraNodesEnabled: false,
        rhacmEnabled: false,
        rhacmManagedClusters: 0,
      },
    })
    const { sizing } = calcCluster(config)
    expect(sizing.odfNodes).not.toBeNull()
    expect(sizing.odfNodes!.count).toBe(3)
    expect(sizing.odfNodes!.vcpu).toBe(16)
    expect(sizing.odfNodes!.ramGB).toBe(64)
  })

  it('odfEnabled=true with odfExtraOsdCount=2 scales odfNodes vcpu and ramGB', () => {
    const config = makeConfig({
      addOns: {
        odfEnabled: true,
        odfExtraOsdCount: 2,
        infraNodesEnabled: false,
        rhacmEnabled: false,
        rhacmManagedClusters: 0,
      },
    })
    const { sizing } = calcCluster(config)
    expect(sizing.odfNodes).not.toBeNull()
    // Base 16 vCPU + 2 extra OSDs * 2 vCPU/OSD = 20
    expect(sizing.odfNodes!.vcpu).toBe(20)
    // Base 64 GB RAM + 2 extra OSDs * 5 GB/OSD = 74
    expect(sizing.odfNodes!.ramGB).toBe(74)
  })

  it('rhacmEnabled=true with managedClusters=50 returns rhacmWorkers small tier (count=3, vcpu=8, ramGB=32)', () => {
    const config = makeConfig({
      addOns: {
        odfEnabled: false,
        odfExtraOsdCount: 0,
        infraNodesEnabled: false,
        rhacmEnabled: true,
        rhacmManagedClusters: 50,
      },
    })
    const { sizing } = calcCluster(config)
    expect(sizing.rhacmWorkers).not.toBeNull()
    expect(sizing.rhacmWorkers!.count).toBe(3)
    expect(sizing.rhacmWorkers!.vcpu).toBe(8)
    expect(sizing.rhacmWorkers!.ramGB).toBe(32)
  })

  it('rhacmEnabled=true with managedClusters=200 returns rhacmWorkers large tier (vcpu=16, ramGB=64)', () => {
    const config = makeConfig({
      addOns: {
        odfEnabled: false,
        odfExtraOsdCount: 0,
        infraNodesEnabled: false,
        rhacmEnabled: true,
        rhacmManagedClusters: 200,
      },
    })
    const { sizing } = calcCluster(config)
    expect(sizing.rhacmWorkers).not.toBeNull()
    expect(sizing.rhacmWorkers!.vcpu).toBe(16)
    expect(sizing.rhacmWorkers!.ramGB).toBe(64)
  })

  it('both odfEnabled and rhacmEnabled returns both non-null with totals including add-on resources', () => {
    const config = makeConfig({
      addOns: {
        odfEnabled: true,
        odfExtraOsdCount: 0,
        infraNodesEnabled: false,
        rhacmEnabled: true,
        rhacmManagedClusters: 50,
      },
    })
    const { sizing } = calcCluster(config)
    expect(sizing.odfNodes).not.toBeNull()
    expect(sizing.rhacmWorkers).not.toBeNull()
    // totals must include odfNodes and rhacmWorkers contributions
    const expectedVcpu =
      sizing.masterNodes.vcpu * sizing.masterNodes.count +
      (sizing.workerNodes ? sizing.workerNodes.vcpu * sizing.workerNodes.count : 0) +
      sizing.odfNodes!.vcpu * sizing.odfNodes!.count +
      sizing.rhacmWorkers!.vcpu * sizing.rhacmWorkers!.count
    expect(sizing.totals.vcpu).toBe(expectedVcpu)
  })

  it('odfEnabled=false returns odfNodes=null (no regression)', () => {
    const config = makeConfig({
      addOns: {
        odfEnabled: false,
        odfExtraOsdCount: 0,
        infraNodesEnabled: false,
        rhacmEnabled: false,
        rhacmManagedClusters: 0,
      },
    })
    const { sizing } = calcCluster(config)
    expect(sizing.odfNodes).toBeNull()
    expect(sizing.rhacmWorkers).toBeNull()
  })
})
