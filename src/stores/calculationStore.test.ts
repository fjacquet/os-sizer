/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from './inputStore'
import { useCalculationStore } from './calculationStore'

describe('calculationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('clusterResults returns one result per cluster', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.clusterResults).toHaveLength(1)
    input.addCluster()
    expect(calc.clusterResults).toHaveLength(2)
  })

  it('clusterResults.id matches the corresponding cluster.id', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.clusterResults[0].id).toBe(input.clusters[0].id)
  })
})
