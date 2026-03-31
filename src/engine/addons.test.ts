import { describe, it, expect } from 'vitest'
// import { calcODF, calcInfraNodes, calcRHACM } from './addons'

describe('calcODF', () => {
  it.todo('0 extra OSD: 3 nodes x 16 vCPU / 64 GB')
  it.todo('1 extra OSD: 3 nodes x 18 vCPU / 69 GB')
  it.todo('2 extra OSDs: 3 nodes x 20 vCPU / 74 GB')
})

describe('calcInfraNodes', () => {
  it.todo('27 workers -> 3 nodes x 4 vCPU / 24 GB')
  it.todo('120 workers -> 3 nodes x 8 vCPU / 48 GB')
})

describe('calcRHACM', () => {
  it.todo('50 clusters -> 3 x 8 vCPU / 32 GB')
  it.todo('100 clusters -> 3 x 16 vCPU / 64 GB')
  it.todo('500 clusters -> 3 x 16 vCPU / 64 GB')
})
