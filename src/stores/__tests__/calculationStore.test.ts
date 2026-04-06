/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from '../inputStore'
import { useCalculationStore } from '../calculationStore'

describe('calculationStore.aggregateTotals', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns zero totals when all cluster totals are zero', () => {
    // With the default single cluster, aggregateTotals should sum result.sizing.totals
    const calc = useCalculationStore()
    // aggregateTotals must exist (will fail RED phase because it is not yet exported)
    expect(calc.aggregateTotals).toBeDefined()
  })

  it('returns totals for a single cluster', () => {
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    expect(totals).toHaveProperty('vcpu')
    expect(totals).toHaveProperty('ramGB')
    expect(totals).toHaveProperty('storageGB')
    expect(typeof totals.vcpu).toBe('number')
    expect(typeof totals.ramGB).toBe('number')
    expect(typeof totals.storageGB).toBe('number')
  })

  it('sums totals across two clusters', () => {
    const input = useInputStore()
    const calc = useCalculationStore()

    const single = { ...calc.aggregateTotals }

    input.addCluster()

    // With two clusters, totals should be double that of a single cluster
    expect(calc.aggregateTotals.vcpu).toBe(single.vcpu * 2)
    expect(calc.aggregateTotals.ramGB).toBe(single.ramGB * 2)
    expect(calc.aggregateTotals.storageGB).toBe(single.storageGB * 2)
  })

  it('sums totals across three clusters', () => {
    const input = useInputStore()
    const calc = useCalculationStore()

    const single = { ...calc.aggregateTotals }

    input.addCluster()
    input.addCluster()

    // With three clusters, totals should be triple that of a single cluster
    expect(calc.aggregateTotals.vcpu).toBe(single.vcpu * 3)
    expect(calc.aggregateTotals.ramGB).toBe(single.ramGB * 3)
    expect(calc.aggregateTotals.storageGB).toBe(single.storageGB * 3)
  })
})
