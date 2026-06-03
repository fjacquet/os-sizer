// Defaults factory functions — NOT exported constants (constants = shared refs = mutation bugs)
// Zero Vue imports (CALC-01)
import type { ClusterConfig, VirtConfig } from './types'
import { DEFAULT_CPU_OVERCOMMIT_RATIO, DEFAULT_TARGET_VIRT_UTILIZATION } from './constants'

export function createDefaultVirtConfig(): VirtConfig {
  return {
    vmClasses: [
      { id: crypto.randomUUID(), name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 40 },
      { id: crypto.randomUUID(), name: 'Medium', vcpu: 4, ramGB: 16, diskGB: 100, count: 20 },
      { id: crypto.randomUUID(), name: 'Large', vcpu: 8, ramGB: 64, diskGB: 300, count: 5 },
    ],
    cpuOvercommitRatio: DEFAULT_CPU_OVERCOMMIT_RATIO,
    redundancy: 'n+1',
    nodeShape: { physicalCores: 64, threadsPerCore: 2, ramGB: 512 },
    storageBackend: 'odf',
    targetUtilization: DEFAULT_TARGET_VIRT_UTILIZATION,
  }
}

export function createDefaultClusterConfig(index: number): ClusterConfig {
  return {
    id: crypto.randomUUID(),
    name: `Cluster-${index + 1}`,
    mode: 'container',
    virt: createDefaultVirtConfig(),
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
      rwxStorageAvailable: false,
    },
    environment: 'datacenter',
    haRequired: true,
    airGapped: false,
    maxNodes: null,
  }
}
