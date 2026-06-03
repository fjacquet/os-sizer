import { describe, it, expect } from 'vitest'
import { createDefaultClusterConfig, createDefaultVirtConfig } from './defaults'

describe('createDefaultVirtConfig', () => {
  it('has 3 VM classes (Small/Medium/Large) with defaults', () => {
    const v = createDefaultVirtConfig()
    expect(v.vmClasses.map((c) => c.name)).toEqual(['Small', 'Medium', 'Large'])
    expect(v.cpuOvercommitRatio).toBe(10)
    expect(v.redundancy).toBe('n+1')
    expect(v.nodeShape).toEqual({ physicalCores: 64, threadsPerCore: 2, ramGB: 512 })
    expect(v.storageBackend).toBe('odf')
  })

  it('defaults targetUtilization to 0.8', () => {
    expect(createDefaultVirtConfig().targetUtilization).toBe(0.8)
  })

  it('gives each VM class a unique id', () => {
    const ids = createDefaultVirtConfig().vmClasses.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('createDefaultClusterConfig', () => {
  it("defaults mode to 'container' and includes a virt config", () => {
    const c = createDefaultClusterConfig(0)
    expect(c.mode).toBe('container')
    expect(c.virt).toBeDefined()
    expect(c.virt?.vmClasses.length).toBe(3)
  })
})
