// Defaults factory functions — NOT exported constants (constants = shared refs = mutation bugs)
// Zero Vue imports (CALC-01)
import type { ClusterConfig } from './types'

export function createDefaultClusterConfig(index: number): ClusterConfig {
  return {
    id: crypto.randomUUID(),
    name: `Cluster-${index + 1}`,
    topology: 'standard-ha',
    snoProfile: 'standard',
    hcpHostedClusters: 1,
    hcpQpsPerCluster: 1000,
    workload: {
      totalPods: 10,
      podCpuMillicores: 500,
      podMemMiB: 512,
      nodeVcpu: 16,
      nodeRamGB: 32,
    },
    addOns: {
      odfEnabled: false,
      odfExtraOsdCount: 0,
      infraNodesEnabled: false,
      rhacmEnabled: false,
      rhacmManagedClusters: 0,
      // Phase 9: OpenShift Virtualization
      virtEnabled: false,
      vmCount: 50,
      vmsPerWorker: 10,
      virtAvgVmVcpu: 4,
      virtAvgVmRamGB: 8,
      snoVirtMode: false,
      // Phase 10: GPU Node Engine
      gpuEnabled: false,
      gpuNodeCount: 1,
      gpuMode: 'container' as const,
      gpuModel: 'A100-40GB' as const,
      migProfile: '',
      gpuPerNode: 1,
      // Phase 11: Red Hat OpenShift AI
      rhoaiEnabled: false,
    },
    environment: 'datacenter',
    haRequired: true,
    airGapped: false,
    maxNodes: null,
  }
}
