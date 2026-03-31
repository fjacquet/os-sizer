import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import type { SizingResult } from '@/engine/types'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — never inside a computed() callback
  const input = useInputStore()

  // ZERO ref() — only computed() — enforces CALC-02
  const clusterResults = computed<SizingResult[]>(() =>
    input.clusters.map((cluster) => ({
      id: cluster.id,
      // Engine functions are stubbed here — Phase 2 will replace with real calculations
      sizing: {
        masterNodes: { count: 3, vcpu: 4, ramGB: 16, storageGB: 100 },
        workerNodes: { count: 0, vcpu: 2, ramGB: 8, storageGB: 100 },
        infraNodes: null,
      },
      validationErrors: [],
    })),
  )

  return { clusterResults }
})
