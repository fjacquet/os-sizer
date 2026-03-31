/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from './inputStore'

describe('inputStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with 1 cluster of topology standard-ha', () => {
    const store = useInputStore()
    expect(store.clusters).toHaveLength(1)
    expect(store.clusters[0].topology).toBe('standard-ha')
  })

  it('addCluster appends a new cluster and updates activeClusterIndex', () => {
    const store = useInputStore()
    store.addCluster()
    expect(store.clusters).toHaveLength(2)
    expect(store.activeClusterIndex).toBe(1)
  })

  it('removeCluster removes the target cluster', () => {
    const store = useInputStore()
    store.addCluster()
    const idToRemove = store.clusters[1].id
    store.removeCluster(idToRemove)
    expect(store.clusters).toHaveLength(1)
    expect(store.clusters.find((c) => c.id === idToRemove)).toBeUndefined()
  })

  it('removeCluster refuses if only 1 cluster remains', () => {
    const store = useInputStore()
    const id = store.clusters[0].id
    store.removeCluster(id)
    expect(store.clusters).toHaveLength(1)  // unchanged
  })

  it('updateCluster mutates the target cluster field', () => {
    const store = useInputStore()
    const id = store.clusters[0].id
    store.updateCluster(id, { topology: 'sno' })
    expect(store.clusters[0].topology).toBe('sno')
  })
})
