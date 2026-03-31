import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDefaultClusterConfig } from '@/engine/defaults'
import type { ClusterConfig } from '@/engine/types'

export const useInputStore = defineStore('input', () => {
  // ref<[]> NOT reactive([]) — avoids storeToRefs() double-wrap bug
  const clusters = ref<ClusterConfig[]>([createDefaultClusterConfig(0)])
  const activeClusterIndex = ref(0)

  function addCluster() {
    clusters.value.push(createDefaultClusterConfig(clusters.value.length))
    activeClusterIndex.value = clusters.value.length - 1
  }

  function removeCluster(id: string) {
    const idx = clusters.value.findIndex((c) => c.id === id)
    if (idx === -1 || clusters.value.length === 1) return
    clusters.value.splice(idx, 1)
    activeClusterIndex.value = Math.min(activeClusterIndex.value, clusters.value.length - 1)
  }

  function updateCluster(id: string, patch: Partial<ClusterConfig>) {
    const cluster = clusters.value.find((c) => c.id === id)
    if (cluster) Object.assign(cluster, patch)  // direct assignment — NOT $patch()
  }

  return { clusters, activeClusterIndex, addCluster, removeCluster, updateCluster }
})
