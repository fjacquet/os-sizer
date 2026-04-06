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

  it('addCluster copies active cluster config instead of using defaults', () => {
    const store = useInputStore()
    // Configure cluster 1 with non-default values (simulates user filling wizard)
    store.updateCluster(store.clusters[0].id, {
      topology: 'compact-3node',
      environment: 'edge',
      haRequired: false,
      workload: { totalPods: 500, podCpuMillicores: 2000, podMemMiB: 4096, nodeVcpu: 32, nodeRamGB: 128 },
      addOns: { ...store.clusters[0].addOns, odfEnabled: true, odfExtraOsdCount: 3 },
    })
    store.addCluster()
    const newCluster = store.clusters[1]
    // New cluster must copy workload from cluster 1, not defaults
    expect(newCluster.workload.totalPods).toBe(500)
    expect(newCluster.workload.podCpuMillicores).toBe(2000)
    expect(newCluster.workload.podMemMiB).toBe(4096)
    // New cluster must copy topology and environment
    expect(newCluster.topology).toBe('compact-3node')
    expect(newCluster.environment).toBe('edge')
    expect(newCluster.haRequired).toBe(false)
    // New cluster must copy addOns
    expect(newCluster.addOns.odfEnabled).toBe(true)
    expect(newCluster.addOns.odfExtraOsdCount).toBe(3)
    // New cluster must have its own unique id
    expect(newCluster.id).not.toBe(store.clusters[0].id)
    // Modifying new cluster must not mutate source cluster
    store.updateCluster(newCluster.id, { workload: { ...newCluster.workload, totalPods: 999 } })
    expect(store.clusters[0].workload.totalPods).toBe(500)
  })
})
