import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import { calcCluster, recommend, validateInputs } from '@/engine/index'
import type { SizingResult, TopologyRecommendation } from '@/engine/types'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — never inside a computed() callback
  const input = useInputStore()

  // ZERO ref() — only computed() — enforces CALC-02
  const activeCluster = computed(() => input.clusters[input.activeClusterIndex] ?? input.clusters[0])

  const clusterResults = computed<SizingResult[]>(() =>
    input.clusters.map((cluster) => ({
      id: cluster.id,
      sizing: calcCluster(cluster).sizing,
      recommendations: recommend({
        environment: cluster.environment ?? 'datacenter',
        haRequired: cluster.haRequired ?? true,
        maxNodes: cluster.maxNodes ?? null,
        airGapped: cluster.airGapped ?? false,
        estimatedWorkers:
          cluster.workload.totalPods > 0 ? Math.ceil(cluster.workload.totalPods / 10) : 3,
        addOns: {
          odf: cluster.addOns.odfEnabled,
          rhacm: cluster.addOns.rhacmEnabled,
          virt: cluster.addOns.virtEnabled,
        },
      }),
      validationErrors: validateInputs(cluster),
    })),
  )

  const recommendations = computed<TopologyRecommendation[]>(() => {
    const cluster = activeCluster.value
    return recommend({
      environment: cluster.environment ?? 'datacenter',
      haRequired: cluster.haRequired ?? true,
      maxNodes: cluster.maxNodes ?? null,
      airGapped: cluster.airGapped ?? false,
      estimatedWorkers:
        cluster.workload.totalPods > 0 ? Math.ceil(cluster.workload.totalPods / 10) : 3,
      addOns: {
        odf: cluster.addOns.odfEnabled,
        rhacm: cluster.addOns.rhacmEnabled,
        virt: cluster.addOns.virtEnabled,
      },
    })
  })

  // Phase 13: aggregate totals across all clusters — CALC-02 compliant (computed only)
  const aggregateTotals = computed(() =>
    clusterResults.value.reduce(
      (acc, result) => ({
        vcpu: acc.vcpu + result.sizing.totals.vcpu,
        ramGB: acc.ramGB + result.sizing.totals.ramGB,
        storageGB: acc.storageGB + result.sizing.totals.storageGB,
      }),
      { vcpu: 0, ramGB: 0, storageGB: 0 },
    ),
  )

  return { clusterResults, recommendations, activeCluster, aggregateTotals }
})
