import { describe, it, expect } from 'vitest'
import { recommend } from './recommendation'

describe('recommend', () => {
  it('datacenter + HA required -> standard-ha ranked first', () => {
    const result = recommend({
      environment: 'datacenter',
      haRequired: true,
      maxNodes: null,
      airGapped: false,
      estimatedWorkers: 10,
      addOns: { odf: false, rhacm: false },
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].topology).toBe('standard-ha')
    expect(result[0].justificationKey).not.toContain(' ')
    expect(result[0].fitScore).toBeGreaterThan(result[1]?.fitScore ?? -1)
  })

  it('far-edge -> includes SNO or MicroShift in top 2', () => {
    const result = recommend({
      environment: 'far-edge',
      haRequired: false,
      maxNodes: 1,
      airGapped: false,
      estimatedWorkers: 0,
      addOns: { odf: false, rhacm: false },
    })
    const top2 = result.slice(0, 2).map((r) => r.topology)
    expect(top2.some((t) => t === 'sno' || t === 'microshift')).toBe(true)
    expect(top2).not.toContain('standard-ha')
  })

  it('air-gapped -> excludes managed-cloud entirely', () => {
    const result = recommend({
      environment: 'datacenter',
      haRequired: true,
      maxNodes: null,
      airGapped: true,
      estimatedWorkers: 10,
      addOns: { odf: false, rhacm: false },
    })
    expect(result.every((r) => r.topology !== 'managed-cloud')).toBe(true)
  })

  it('budget-constrained (maxNodes<=3) -> compact-3node ranked in top 2', () => {
    const result = recommend({
      environment: 'datacenter',
      haRequired: true,
      maxNodes: 3,
      airGapped: false,
      estimatedWorkers: 5,
      addOns: { odf: false, rhacm: false },
    })
    const top2 = result.slice(0, 2).map((r) => r.topology)
    expect(top2).toContain('compact-3node')
  })

  it('cloud environment -> managed-cloud ranked first', () => {
    const result = recommend({
      environment: 'cloud',
      haRequired: false,
      maxNodes: null,
      airGapped: false,
      estimatedWorkers: 0,
      addOns: { odf: false, rhacm: false },
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].topology).toBe('managed-cloud')
  })

  it('every recommendation has justificationKey without spaces', () => {
    const constraints = {
      environment: 'datacenter' as const,
      haRequired: false,
      maxNodes: null,
      airGapped: false,
      estimatedWorkers: 5,
      addOns: { odf: false, rhacm: false },
    }
    const result = recommend(constraints)
    for (const r of result) {
      expect(/^\S+$/.test(r.justificationKey)).toBe(true)
    }
  })

  it('returns array sorted by fitScore descending', () => {
    const result = recommend({
      environment: 'datacenter',
      haRequired: true,
      maxNodes: null,
      airGapped: false,
      estimatedWorkers: 10,
      addOns: { odf: false, rhacm: false },
    })
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].fitScore).toBeGreaterThanOrEqual(result[i + 1].fitScore)
    }
  })

  it('HA required excludes SNO and MicroShift from results', () => {
    const result = recommend({
      environment: 'datacenter',
      haRequired: true,
      maxNodes: null,
      airGapped: false,
      estimatedWorkers: 10,
      addOns: { odf: false, rhacm: false },
    })
    expect(result.every((r) => r.topology !== 'sno')).toBe(true)
    expect(result.every((r) => r.topology !== 'microshift')).toBe(true)
  })
})
