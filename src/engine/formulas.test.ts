import { describe, it, expect } from 'vitest'
// import { cpSizing, allocatableRamGB, workerCount, infraNodeSizing } from './formulas'

describe('cpSizing', () => {
  it.todo('24 workers -> 4 vCPU / 16 GB')
  it.todo('120 workers -> 8 vCPU / 32 GB')
  it.todo('252 workers -> 16 vCPU / 64 GB')
  it.todo('501 workers -> 16 vCPU / 96 GB')
  it.todo('252 workers with OVN-K -> 24 vCPU / 128 GB')
  it.todo('boundary: 25 workers -> 8 vCPU / 32 GB (next tier)')
})

describe('allocatableRamGB', () => {
  it.todo('8 GB node -> ~6.2 GB allocatable')
  it.todo('16 GB node -> ~12.4 GB allocatable')
  it.todo('32 GB node -> ~28.4 GB allocatable')
  it.todo('64 GB node -> ~60.7 GB allocatable')
  it.todo('4 GB node -> 3.0 GB allocatable (only first tier)')
})

describe('workerCount', () => {
  it.todo('returns max of CPU-limited, RAM-limited, pod-density-limited')
  it.todo('minimum 2 workers for HA')
  it.todo('uses 70% target utilization')
  it.todo('pod density check: 201 pods -> 2 workers (ceil(201/200))')
})

describe('infraNodeSizing', () => {
  it.todo('27 workers -> 4 vCPU / 24 GB')
  it.todo('120 workers -> 8 vCPU / 48 GB')
  it.todo('252 workers -> 16 vCPU / 128 GB')
  it.todo('boundary: 28 workers -> 8 vCPU / 48 GB (next tier)')
})
