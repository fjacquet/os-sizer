import { describe, it, expect } from 'vitest'
// import { calcStandardHA, calcCompact3Node, calcSNO, calcTNA, calcTNF, calcHCP, calcMicroShift, calcManagedCloud } from './calculators'

describe('calcStandardHA', () => {
  it.todo('returns 3 CP nodes + calculated workers')
  it.todo('CP sizing scales with worker count')
  it.todo('workers minimum 2 for HA')
  it.todo('includes infra nodes when enabled')
})

describe('calcCompact3Node', () => {
  it.todo('returns 3 combined nodes, workerNodes is null')
  it.todo('includes compact subscription warning')
})

describe('calcSNO', () => {
  it.todo('standard profile: 8 vCPU / 16 GB / 120 GB')
  it.todo('edge profile: 8 vCPU / 32 GB / 120 GB')
  it.todo('telecom profile: 24 vCPU / 48 GB / 600 GB')
  it.todo('workerNodes is null')
})

describe('calcTNA', () => {
  it.todo('returns 2 CP nodes + 1 arbiter (2 vCPU / 8 GB / 50 GB)')
  it.todo('includes Tech Preview warning')
})

describe('calcTNF', () => {
  it.todo('returns 2 CP nodes, no arbiter')
  it.todo('includes Tech Preview warning and Redfish BMC warning')
})

describe('calcHCP', () => {
  it.todo('management cluster: 78 pods / 5 vCPU / 18 GB per hosted cluster at idle')
  it.todo('QPS scaling: +9 vCPU / +2.5 GB per 1000 QPS')
  it.todo('default 1000 QPS per cluster')
})

describe('calcMicroShift', () => {
  it.todo('1 node: 2 vCPU / 2 GB base + workload overhead')
})

describe('calcManagedCloud', () => {
  it.todo('returns count=0 NodeSpecs')
  it.todo('includes managedCloudNoHardware warning')
})
